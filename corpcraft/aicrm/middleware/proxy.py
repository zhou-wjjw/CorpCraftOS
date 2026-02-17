"""
代理池管理模块
实现代理获取、验证、轮换等功能
"""
import random
import asyncio
from typing import Optional, List, Dict
from loguru import logger
import aiohttp
import requests
from datetime import datetime, timedelta
import json
from dataclasses import dataclass


@dataclass
class ProxyInfo:
    """代理信息类"""
    proxy: str  # 代理地址，格式: ip:port
    protocol: str  # http 或 https
    username: Optional[str] = None
    password: Optional[str] = None
    score: float = 100.0  # 代理评分
    success_count: int = 0  # 成功次数
    fail_count: int = 0  # 失败次数
    last_check_time: Optional[datetime] = None
    last_used_time: Optional[datetime] = None
    avg_response_time: float = 0.0  # 平均响应时间（毫秒）

    @property
    def success_rate(self) -> float:
        """成功率"""
        total = self.success_count + self.fail_count
        if total == 0:
            return 0.0
        return self.success_count / total

    @property
    def is_valid(self) -> bool:
        """是否有效"""
        # 1小时内检查过 且 成功率大于50%
        if self.last_check_time:
            time_since_check = datetime.now() - self.last_check_time
            if time_since_check > timedelta(hours=1):
                return False
        return self.success_rate > 0.5

    @property
    def proxy_url(self) -> str:
        """生成代理URL"""
        if self.username and self.password:
            return f"{self.protocol}://{self.username}:{self.password}@{self.proxy}"
        return f"{self.protocol}://{self.proxy}"

    def to_dict(self) -> Dict:
        """转换为字典"""
        return {
            'proxy': self.proxy,
            'protocol': self.protocol,
            'score': self.score,
            'success_rate': self.success_rate,
            'success_count': self.success_count,
            'fail_count': self.fail_count,
            'last_check_time': self.last_check_time.isoformat() if self.last_check_time else None,
            'avg_response_time': self.avg_response_time,
        }


class ProxyPool:
    """代理池管理类"""

    def __init__(
        self,
        api_url: Optional[str] = None,
        test_url: str = "http://httpbin.org/ip",
        min_pool_size: int = 10,
        max_pool_size: int = 100,
        validate_interval: int = 300,  # 验证间隔（秒）
    ):
        self.api_url = api_url
        self.test_url = test_url
        self.min_pool_size = min_pool_size
        self.max_pool_size = max_pool_size
        self.validate_interval = validate_interval

        self.proxies: List[ProxyInfo] = []
        self.current_index = 0

    async def initialize(self):
        """初始化代理池"""
        logger.info("初始化代理池...")
        await self.fetch_proxies()
        await self.validate_proxies()
        logger.info(f"代理池初始化完成，有效代理数: {len(self.proxies)}")

    async def fetch_proxies(self) -> List[ProxyInfo]:
        """获取代理列表"""
        proxies = []

        # 如果配置了API，从API获取
        if self.api_url:
            try:
                proxies = await self._fetch_from_api()
            except Exception as e:
                logger.error(f"从API获取代理失败: {e}")

        # 如果代理数量不足，可以使用免费代理源
        if len(proxies) < self.min_pool_size:
            logger.warning("代理数量不足，尝试从免费源获取...")
            # 这里可以添加免费代理源
            # proxies.extend(await self._fetch_free_proxies())

        self.proxies = proxies
        return proxies

    async def _fetch_from_api(self) -> List[ProxyInfo]:
        """从API获取代理"""
        proxies = []
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.api_url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()

                        # 假设API返回格式: {"data": [{"ip": "1.2.3.4", "port": 8080, ...}]}
                        for item in data.get('data', []):
                            proxy_str = f"{item['ip']}:{item['port']}"
                            proxy = ProxyInfo(
                                proxy=proxy_str,
                                protocol=item.get('protocol', 'http'),
                                username=item.get('username'),
                                password=item.get('password'),
                            )
                            proxies.append(proxy)

                        logger.info(f"从API获取到 {len(proxies)} 个代理")
        except Exception as e:
            logger.error(f"从API获取代理失败: {e}")

        return proxies

    async def validate_proxies(self):
        """验证代理有效性"""
        logger.info("开始验证代理...")

        tasks = []
        for proxy in self.proxies:
            tasks.append(self._validate_proxy(proxy))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid_count = sum(1 for r in results if r is True)
        logger.info(f"代理验证完成: 有效 {valid_count}/{len(self.proxies)}")

        # 移除无效代理
        self.proxies = [p for p in self.proxies if p.is_valid]

    async def _validate_proxy(self, proxy: ProxyInfo) -> bool:
        """验证单个代理"""
        try:
            start_time = datetime.now()

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.test_url,
                    proxy=proxy.proxy_url,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    response_time = (datetime.now() - start_time).total_seconds() * 1000

                    if response.status == 200:
                        proxy.success_count += 1
                        proxy.last_check_time = datetime.now()
                        proxy.avg_response_time = response_time
                        return True
                    else:
                        proxy.fail_count += 1
                        return False

        except Exception as e:
            proxy.fail_count += 1
            logger.debug(f"代理验证失败 {proxy.proxy}: {e}")
            return False

    def get_proxy(self) -> Optional[ProxyInfo]:
        """获取一个代理（轮询方式）"""
        if not self.proxies:
            return None

        # 过滤有效代理
        valid_proxies = [p for p in self.proxies if p.is_valid]

        if not valid_proxies:
            logger.warning("没有可用的有效代理")
            return None

        # 按评分排序，优先使用高分代理
        valid_proxies.sort(key=lambda x: (x.score, x.success_rate), reverse=True)

        # 轮询获取
        proxy = valid_proxies[self.current_index % len(valid_proxies)]
        self.current_index += 1

        proxy.last_used_time = datetime.now()
        return proxy

    def get_proxy_random(self) -> Optional[ProxyInfo]:
        """随机获取一个代理"""
        valid_proxies = [p for p in self.proxies if p.is_valid]
        if not valid_proxies:
            return None
        return random.choice(valid_proxies)

    def mark_success(self, proxy: ProxyInfo, response_time: float = 0):
        """标记代理成功"""
        proxy.success_count += 1
        if response_time > 0:
            # 更新平均响应时间（加权平均）
            if proxy.avg_response_time == 0:
                proxy.avg_response_time = response_time
            else:
                proxy.avg_response_time = (
                    proxy.avg_response_time * 0.7 + response_time * 0.3
                )
        # 增加评分
        proxy.score = min(100, proxy.score + 1)

    def mark_failure(self, proxy: ProxyInfo):
        """标记代理失败"""
        proxy.fail_count += 1
        # 降低评分
        proxy.score = max(0, proxy.score - 5)

        # 如果成功率太低，移除代理
        if proxy.success_rate < 0.2 and (proxy.success_count + proxy.fail_count) > 10:
            logger.warning(f"移除低质量代理: {proxy.proxy} (成功率: {proxy.success_rate:.2%})")
            if proxy in self.proxies:
                self.proxies.remove(proxy)

    def get_stats(self) -> Dict:
        """获取代理池统计信息"""
        valid_proxies = [p for p in self.proxies if p.is_valid]

        return {
            'total_proxies': len(self.proxies),
            'valid_proxies': len(valid_proxies),
            'avg_success_rate': sum(p.success_rate for p in valid_proxies) / len(valid_proxies) if valid_proxies else 0,
            'avg_response_time': sum(p.avg_response_time for p in valid_proxies) / len(valid_proxies) if valid_proxies else 0,
        }

    def save_to_file(self, filename: str = "proxies.json"):
        """保存代理到文件"""
        data = {
            'proxies': [p.to_dict() for p in self.proxies],
            'stats': self.get_stats(),
            'saved_at': datetime.now().isoformat(),
        }

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"代理池已保存到: {filename}")

    def load_from_file(self, filename: str = "proxies.json"):
        """从文件加载代理"""
        try:
            with open(filename, 'r', encoding='utf-8') as f:
                data = json.load(f)

            self.proxies = []
            for item in data.get('proxies', []):
                proxy = ProxyInfo(
                    proxy=item['proxy'],
                    protocol=item['protocol'],
                    score=item['score'],
                    success_count=item['success_count'],
                    fail_count=item['fail_count'],
                )
                if item.get('last_check_time'):
                    proxy.last_check_time = datetime.fromisoformat(item['last_check_time'])
                self.proxies.append(proxy)

            logger.info(f"从文件加载了 {len(self.proxies)} 个代理")
        except FileNotFoundError:
            logger.warning(f"代理文件不存在: {filename}")
        except Exception as e:
            logger.error(f"加载代理文件失败: {e}")


# 单例模式
_proxy_pool: Optional[ProxyPool] = None


def get_proxy_pool() -> Optional[ProxyPool]:
    """获取代理池单例"""
    return _proxy_pool


def init_proxy_pool(
    api_url: Optional[str] = None,
    test_url: str = "http://httpbin.org/ip",
) -> ProxyPool:
    """初始化代理池"""
    global _proxy_pool

    _proxy_pool = ProxyPool(
        api_url=api_url,
        test_url=test_url,
    )

    return _proxy_pool
