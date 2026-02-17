"""
AICRM System - Anti-Detection & Proxy Management
反爬虫检测对抗和代理管理系统
"""
import asyncio
import random
import time
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import aiohttp
import httpx
from loguru import logger
from fake_useragent import UserAgent
import json
import hashlib


class ProxyType(Enum):
    """代理类型"""
    HTTP = "http"
    HTTPS = "https"
    SOCKS5 = "socks5"


class ProxyQuality(Enum):
    """代理质量等级"""
    HIGH = "high"  # 响应时间 < 2s
    MEDIUM = "medium"  # 响应时间 2-5s
    LOW = "low"  # 响应时间 > 5s
    DEAD = "dead"  # 无法连接


@dataclass
class Proxy:
    """代理数据类"""
    host: str
    port: int
    proxy_type: ProxyType
    username: Optional[str] = None
    password: Optional[str] = None
    quality: ProxyQuality = ProxyQuality.MEDIUM
    response_time: float = 0
    success_count: int = 0
    fail_count: int = 0
    last_used: float = 0
    last_checked: float = 0

    @property
    def url(self) -> str:
        """获取代理URL"""
        if self.username and self.password:
            return f"{self.proxy_type.value}://{self.username}:{self.password}@{self.host}:{self.port}"
        return f"{self.proxy_type.value}://{self.host}:{self.port}"

    @property
    def success_rate(self) -> float:
        """计算成功率"""
        total = self.success_count + self.fail_count
        if total == 0:
            return 0.5
        return self.success_count / total

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            "host": self.host,
            "port": self.port,
            "type": self.proxy_type.value,
            "quality": self.quality.value,
            "response_time": self.response_time,
            "success_rate": self.success_rate,
            "success_count": self.success_count,
            "fail_count": self.fail_count
        }


class ProxyPool:
    """代理池管理器"""

    def __init__(
        self,
        min_size: int = 50,
        max_size: int = 200,
        check_interval: int = 300,
        check_timeout: int = 10,
        check_url: str = "http://httpbin.org/ip"
    ):
        self.min_size = min_size
        self.max_size = max_size
        self.check_interval = check_interval
        self.check_timeout = check_timeout
        self.check_url = check_url

        self.proxies: List[Proxy] = []
        self.active_proxies: List[Proxy] = []
        self.failed_proxies: Dict[str, Proxy] = {}

        self._lock = asyncio.Lock()
        self._checker_task: Optional[asyncio.Task] = None
        self._running = False

    async def add_proxy(self, proxy: Proxy) -> bool:
        """添加代理到池中"""
        async with self._lock:
            if len(self.proxies) >= self.max_size:
                return False

            # 检查是否已存在
            proxy_key = f"{proxy.host}:{proxy.port}"
            if any(p.host == proxy.host and p.port == proxy.port for p in self.proxies):
                return False

            self.proxies.append(proxy)
            logger.info(f"Added proxy: {proxy.host}:{proxy.port}")
            return True

    async def remove_proxy(self, proxy: Proxy):
        """从池中移除代理"""
        async with self._lock:
            if proxy in self.proxies:
                self.proxies.remove(proxy)
            if proxy in self.active_proxies:
                self.active_proxies.remove(proxy)

    async def get_proxy(self, quality: ProxyQuality = ProxyQuality.MEDIUM) -> Optional[Proxy]:
        """获取一个可用代理"""
        async with self._lock:
            # 筛选符合质量要求的代理
            available = [
                p for p in self.proxies
                if (p.quality == quality or
                    (quality == ProxyQuality.MEDIUM and p.quality in [ProxyQuality.HIGH, ProxyQuality.MEDIUM]))
                and p not in self.active_proxies
            ]

            if not available:
                return None

            # 按成功率和响应时间排序
            available.sort(key=lambda p: (p.success_rate, -p.response_time), reverse=True)

            proxy = available[0]
            self.active_proxies.append(proxy)
            proxy.last_used = time.time()

            return proxy

    async def release_proxy(self, proxy: Proxy, success: bool, response_time: float = 0):
        """释放代理回池"""
        async with self._lock:
            if proxy in self.active_proxies:
                self.active_proxies.remove(proxy)

            if success:
                proxy.success_count += 1
                proxy.response_time = response_time

                # 更新质量等级
                if response_time < 2:
                    proxy.quality = ProxyQuality.HIGH
                elif response_time < 5:
                    proxy.quality = ProxyQuality.MEDIUM
                else:
                    proxy.quality = ProxyQuality.LOW
            else:
                proxy.fail_count += 1

                # 连续失败多次则标记为死亡
                if proxy.fail_count >= 3:
                    proxy.quality = ProxyQuality.DEAD
                    await self.remove_proxy(proxy)

    async def check_proxy(self, proxy: Proxy) -> Tuple[bool, float]:
        """检查代理是否可用"""
        start_time = time.time()
        try:
            async with httpx.AsyncClient(timeout=self.check_timeout) as client:
                response = await client.get(
                    self.check_url,
                    proxies={"all://": proxy.url}
                )
                response_time = time.time() - start_time

                if response.status_code == 200:
                    proxy.last_checked = time.time()
                    return True, response_time
                return False, response_time

        except Exception as e:
            logger.debug(f"Proxy check failed: {proxy.host}:{proxy.port} - {str(e)}")
            return False, time.time() - start_time

    async def check_all_proxies(self):
        """检查所有代理的可用性"""
        async with self._lock:
            tasks = [self.check_proxy(proxy) for proxy in self.proxies]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for proxy, result in zip(self.proxies, results):
                if isinstance(result, Exception):
                    await self.release_proxy(proxy, False)
                else:
                    success, response_time = result
                    await self.release_proxy(proxy, success, response_time)

    async def start_checker(self):
        """启动代理检查器"""
        if self._checker_task and not self._checker_task.done():
            return

        self._running = True
        self._checker_task = asyncio.create_task(self._checker_loop())

    async def stop_checker(self):
        """停止代理检查器"""
        self._running = False
        if self._checker_task:
            self._checker_task.cancel()
            try:
                await self._checker_task
            except asyncio.CancelledError:
                pass

    async def _checker_loop(self):
        """代理检查循环"""
        while self._running:
            try:
                await self.check_all_proxies()
                await asyncio.sleep(self.check_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Proxy checker error: {str(e)}")
                await asyncio.sleep(60)

    async def load_from_api(self, api_url: str, api_key: str = None):
        """从API加载代理"""
        try:
            headers = {}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            async with httpx.AsyncClient() as client:
                response = await client.get(api_url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    # 根据API格式解析代理
                    # 这里需要根据具体API格式调整
                    pass
        except Exception as e:
            logger.error(f"Failed to load proxies from API: {str(e)}")

    async def load_from_file(self, file_path: str):
        """从文件加载代理"""
        try:
            with open(file_path, 'r') as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith('#'):
                        continue

                    # 解析代理格式：host:port 或 host:port:username:password
                    parts = line.split(':')
                    if len(parts) >= 2:
                        host = parts[0]
                        port = int(parts[1])
                        username = parts[2] if len(parts) > 2 else None
                        password = parts[3] if len(parts) > 3 else None

                        proxy = Proxy(
                            host=host,
                            port=port,
                            proxy_type=ProxyType.HTTP,
                            username=username,
                            password=password
                        )
                        await self.add_proxy(proxy)

            logger.info(f"Loaded {len(self.proxies)} proxies from {file_path}")

        except Exception as e:
            logger.error(f"Failed to load proxies from file: {str(e)}")

    def get_stats(self) -> Dict:
        """获取代理池统计信息"""
        return {
            "total_proxies": len(self.proxies),
            "active_proxies": len(self.active_proxies),
            "high_quality": sum(1 for p in self.proxies if p.quality == ProxyQuality.HIGH),
            "medium_quality": sum(1 for p in self.proxies if p.quality == ProxyQuality.MEDIUM),
            "low_quality": sum(1 for p in self.proxies if p.quality == ProxyQuality.LOW),
            "dead_proxies": sum(1 for p in self.proxies if p.quality == ProxyQuality.DEAD)
        }


class FingerprintGenerator:
    """浏览器指纹生成器"""

    def __init__(self):
        self.ua = UserAgent()

    def random_headers(self) -> Dict[str, str]:
        """生成随机请求头"""
        return {
            "User-Agent": self.ua.random,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": self._random_language(),
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
            "DNT": "1",
        }

    def _random_language(self) -> str:
        """生成随机语言设置"""
        languages = [
            "en-US,en;q=0.9",
            "zh-CN,zh;q=0.9,en;q=0.8",
            "ja-JP,ja;q=0.9,en;q=0.8",
            "de-DE,de;q=0.9,en;q=0.8",
            "fr-FR,fr;q=0.9,en;q=0.8"
        ]
        return random.choice(languages)

    def random_viewport(self) -> Dict[str, int]:
        """生成随机视口大小"""
        viewports = [
            {"width": 1920, "height": 1080},
            {"width": 1366, "height": 768},
            {"width": 1440, "height": 900},
            {"width": 1536, "height": 864},
            {"width": 1280, "height": 720}
        ]
        return random.choice(viewports)

    def random_timezone(self) -> str:
        """生成随机时区"""
        timezones = [
            "America/New_York",
            "Europe/London",
            "Asia/Shanghai",
            "Asia/Tokyo",
            "Europe/Paris",
            "Australia/Sydney"
        ]
        return random.choice(timezones)

    def random_webgl_vendor(self) -> str:
        """生成随机WebGL供应商"""
        vendors = [
            "Google Inc. (NVIDIA)",
            "Google Inc. (AMD)",
            "Google Inc. (Intel)",
            "Microsoft",
            "Mozilla"
        ]
        return random.choice(vendors)

    def random_canvas_fingerprint(self) -> str:
        """生成随机Canvas指纹"""
        # 生成随机哈希值模拟Canvas指纹
        return hashlib.md5(str(random.random()).encode()).hexdigest()


class SessionManager:
    """会话管理器 - 管理cookies和会话状态"""

    def __init__(self, pool_size: int = 50):
        self.pool_size = pool_size
        self.sessions: Dict[str, aiohttp.ClientSession] = {}
        self.session_cookies: Dict[str, Dict] = {}
        self.session_headers: Dict[str, Dict] = {}

    async def get_session(self, session_id: str = None) -> aiohttp.ClientSession:
        """获取或创建会话"""
        if not session_id:
            session_id = f"session_{random.randint(1000, 9999)}"

        if session_id not in self.sessions:
            connector = aiohttp.TCPConnector(limit=100, force_close=True)
            timeout = aiohttp.ClientTimeout(total=30)

            self.sessions[session_id] = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout
            )
            self.session_cookies[session_id] = {}
            self.session_headers[session_id] = FingerprintGenerator().random_headers()

        return self.sessions[session_id]

    async def close_session(self, session_id: str):
        """关闭指定会话"""
        if session_id in self.sessions:
            await self.sessions[session_id].close()
            del self.sessions[session_id]
            del self.session_cookies[session_id]
            del self.session_headers[session_id]

    async def close_all(self):
        """关闭所有会话"""
        for session in self.sessions.values():
            await session.close()
        self.sessions.clear()
        self.session_cookies.clear()
        self.session_headers.clear()

    def update_cookies(self, session_id: str, cookies: Dict):
        """更新会话cookies"""
        if session_id in self.session_cookies:
            self.session_cookies[session_id].update(cookies)

    def get_cookies(self, session_id: str) -> Dict:
        """获取会话cookies"""
        return self.session_cookies.get(session_id, {})


class AntiDetectionManager:
    """反检测管理器 - 整合所有反检测功能"""

    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.proxy_pool = ProxyPool(
            min_size=self.config.get("min_proxies", 50),
            max_size=self.config.get("max_proxies", 200)
        )
        self.fingerprint_gen = FingerprintGenerator()
        self.session_manager = SessionManager(
            pool_size=self.config.get("session_pool_size", 50)
        )

    async def initialize(self):
        """初始化反检测系统"""
        # 启动代理检查器
        await self.proxy_pool.start_checker()

        # 加载代理（可以从文件、API等）
        # await self.proxy_pool.load_from_file("proxies.txt")

        logger.info("Anti-detection system initialized")

    async def shutdown(self):
        """关闭反检测系统"""
        await self.proxy_pool.stop_checker()
        await self.session_manager.close_all()
        logger.info("Anti-detection system shut down")

    async def get_context(self) -> Dict:
        """获取请求上下文（代理、请求头等）"""
        proxy = await self.proxy_pool.get_proxy()
        headers = self.fingerprint_gen.random_headers()

        return {
            "proxy": proxy,
            "headers": headers,
            "fingerprint": {
                "viewport": self.fingerprint_gen.random_viewport(),
                "timezone": self.fingerprint_gen.random_timezone(),
                "canvas": self.fingerprint_gen.random_canvas_fingerprint()
            }
        }

    async def release_context(self, proxy: Proxy, success: bool, response_time: float = 0):
        """释放上下文"""
        if proxy:
            await self.proxy_pool.release_proxy(proxy, success, response_time)
