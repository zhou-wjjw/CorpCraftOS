"""
增强的代理池管理模块
支持自动获取、验证、轮换代理，代理质量评分系统
"""
import asyncio
import aiohttp
import random
import time
from typing import List, Optional, Dict, Set
from dataclasses import dataclass, field
from enum import Enum
from loguru import logger
import json
from datetime import datetime, timedelta
from urllib.parse import urlparse
import hashlib


class ProxyType(Enum):
    """代理类型"""
    HTTP = "http"
    HTTPS = "https"
    SOCKS5 = "socks5"


class ProxyStatus(Enum):
    """代理状态"""
    UNKNOWN = "unknown"
    WORKING = "working"
    FAILED = "failed"
    TESTING = "testing"


@dataclass
class ProxyInfo:
    """代理信息数据类"""
    proxy_url: str
    proxy_type: ProxyType
    source: str = "manual"  # manual, api, free, paid

    # 统计信息
    success_count: int = 0
    failure_count: int = 0
    total_requests: int = 0

    # 性能指标
    avg_response_time: float = 0.0
    last_check_time: Optional[datetime] = None
    last_success_time: Optional[datetime] = None

    # 评分 (0-100)
    quality_score: float = 50.0

    # 状态
    status: ProxyStatus = ProxyStatus.UNKNOWN

    # 失败原因追踪
    recent_errors: List[str] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        """成功率"""
        if self.total_requests == 0:
            return 0.0
        return self.success_count / self.total_requests

    @property
    def proxy(self) -> str:
        """获取代理地址（去掉协议前缀）"""
        parsed = urlparse(self.proxy_url)
        return f"{parsed.hostname}:{parsed.port}"

    def update_quality_score(self):
        """更新质量评分"""
        # 成功率权重 40%
        success_rate_score = self.success_rate * 40

        # 响应时间权重 30% (越快越好，<1s满分)
        response_time_score = max(0, 30 - (self.avg_response_time * 30))

        # 最近成功权重 20% (最近成功过加分)
        recent_success_score = 0
        if self.last_success_time:
            hours_since_success = (datetime.now() - self.last_success_time).total_seconds() / 3600
            recent_success_score = max(0, 20 - hours_since_success)

        # 稳定性权重 10% (失败次数越少越好)
        stability_score = max(0, 10 - (self.failure_count * 0.5))

        self.quality_score = success_rate_score + response_time_score + recent_success_score + stability_score

    def record_success(self, response_time: float):
        """记录成功请求"""
        self.success_count += 1
        self.total_requests += 1
        self.last_success_time = datetime.now()
        self.last_check_time = datetime.now()
        self.status = ProxyStatus.WORKING

        # 更新平均响应时间 (移动平均)
        if self.avg_response_time == 0:
            self.avg_response_time = response_time
        else:
            self.avg_response_time = (self.avg_response_time * 0.8) + (response_time * 0.2)

        # 清空最近的错误记录
        self.recent_errors.clear()
        self.update_quality_score()

    def record_failure(self, error: str = ""):
        """记录失败请求"""
        self.failure_count += 1
        self.total_requests += 1
        self.last_check_time = datetime.now()

        # 记录最近的错误
        if error:
            self.recent_errors.append(error)
            if len(self.recent_errors) > 5:
                self.recent_errors.pop(0)

        # 如果连续失败超过3次，标记为失败
        if self.failure_count >= 3 and self.failure_count > self.success_count:
            self.status = ProxyStatus.FAILED

        self.update_quality_score()


class ProxyValidator:
    """代理验证器"""

    def __init__(self, timeout: int = 10, test_urls: List[str] = None):
        self.timeout = timeout
        self.test_urls = test_urls or [
            'http://httpbin.org/ip',
            'https://api.ipify.org?format=json',
            'http://ip-api.com/json/',
        ]

    async def validate_proxy(self, proxy_url: str) -> Dict[str, any]:
        """
        验证代理是否可用

        Args:
            proxy_url: 代理URL

        Returns:
            验证结果字典
        """
        start_time = time.time()

        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=self.timeout)) as session:
                # 尝试通过代理访问测试URL
                test_url = random.choice(self.test_urls)

                async with session.get(
                    test_url,
                    proxy=proxy_url,
                    ssl=False  # 忽略SSL证书验证
                ) as response:
                    response_time = time.time() - start_time

                    if response.status == 200:
                        return {
                            'valid': True,
                            'response_time': response_time,
                            'status_code': response.status,
                            'error': None
                        }
                    else:
                        return {
                            'valid': False,
                            'response_time': response_time,
                            'status_code': response.status,
                            'error': f'HTTP {response.status}'
                        }

        except asyncio.TimeoutError:
            return {
                'valid': False,
                'response_time': self.timeout,
                'status_code': None,
                'error': 'Timeout'
            }
        except Exception as e:
            return {
                'valid': False,
                'response_time': time.time() - start_time,
                'status_code': None,
                'error': str(e)
            }


class ProxyFetcher:
    """代理获取器 - 从各种来源获取代理"""

    async def fetch_from_api(self, api_url: str) -> List[str]:
        """从API获取代理"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(api_url, timeout=10) as response:
                    if response.status == 200:
                        data = await response.text()
                        return self._parse_proxy_list(data)
        except Exception as e:
            logger.error(f"从API获取代理失败: {e}")
        return []

    async def fetch_from_free_sources(self) -> List[str]:
        """从免费代理网站获取代理"""
        proxy_list = []

        # 免费代理API列表
        free_apis = [
            'https://www.proxy-list.download/api/v1/get?type=http',
            'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all',
            # 可以添加更多免费代理源
        ]

        tasks = [self.fetch_from_api(api) for api in free_apis]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, list):
                proxy_list.extend(result)

        return proxy_list

    def _parse_proxy_list(self, data: str) -> List[str]:
        """解析代理列表"""
        proxies = []

        for line in data.strip().split('\n'):
            line = line.strip()

            # 跳过空行和注释
            if not line or line.startswith('#'):
                continue

            # 简单格式: ip:port
            if ':' in line and not line.startswith('http'):
                proxies.append(f'http://{line}')

            # 完整格式: http://ip:port
            elif line.startswith('http'):
                proxies.append(line)

        return proxies


class ProxyPool:
    """增强的代理池管理器"""

    def __init__(
        self,
        min_size: int = 50,
        max_size: int = 500,
        validation_interval: int = 300,  # 5分钟
        auto_fetch: bool = True,
        save_path: str = "data/proxies.json"
    ):
        self.min_size = min_size
        self.max_size = max_size
        self.validation_interval = validation_interval
        self.auto_fetch = auto_fetch
        self.save_path = save_path

        # 代理存储
        self.proxies: Dict[str, ProxyInfo] = {}

        # 验证器和获取器
        self.validator = ProxyValidator()
        self.fetcher = ProxyFetcher()

        # 运行状态
        self._running = False
        self._validation_task = None

        # 锁
        self._lock = asyncio.Lock()

    async def initialize(self):
        """初始化代理池"""
        logger.info("初始化代理池...")

        # 加载已保存的代理
        await self._load_proxies()

        # 如果代理不足，自动获取
        if self.auto_fetch and len(self.proxies) < self.min_size:
            logger.info("代理数量不足，开始自动获取...")
            await self.auto_fetch_proxies()

        # 启动定期验证任务
        if self._validation_task is None:
            self._running = True
            self._validation_task = asyncio.create_task(self._validation_loop())

        logger.info(f"代理池初始化完成，当前代理数: {len(self.proxies)}")

    async def shutdown(self):
        """关闭代理池"""
        logger.info("关闭代理池...")
        self._running = False

        if self._validation_task:
            self._validation_task.cancel()
            try:
                await self._validation_task
            except asyncio.CancelledError:
                pass

        # 保存代理数据
        await self._save_proxies()

    async def get_proxy(self, quality_threshold: float = 30.0) -> Optional[ProxyInfo]:
        """
        获取一个可用的代理

        Args:
            quality_threshold: 最低质量分数要求

        Returns:
            ProxyInfo对象，如果没有可用代理返回None
        """
        async with self._lock:
            # 筛选可用代理
            available = [
                p for p in self.proxies.values()
                if p.status == ProxyStatus.WORKING
                and p.quality_score >= quality_threshold
            ]

            if not available:
                # 如果没有高质量代理，尝试获取新代理
                if self.auto_fetch:
                    await self.auto_fetch_proxies()

                # 降低要求重试
                available = [
                    p for p in self.proxies.values()
                    if p.status != ProxyStatus.FAILED
                ]

            if not available:
                logger.warning("没有可用代理")
                return None

            # 根据质量分数加权随机选择
            weights = [p.quality_score for p in available]
            total_weight = sum(weights)

            if total_weight == 0:
                return random.choice(available)

            rand = random.uniform(0, total_weight)
            current = 0

            for proxy, weight in zip(available, weights):
                current += weight
                if rand <= current:
                    return proxy

            return available[-1]

    async def mark_success(self, proxy_info: ProxyInfo, response_time: float):
        """标记代理成功"""
        proxy_info.record_success(response_time)
        logger.debug(f"代理成功: {proxy_info.proxy}, 响应时间: {response_time:.2f}s")

    async def mark_failure(self, proxy_info: ProxyInfo, error: str = ""):
        """标记代理失败"""
        proxy_info.record_failure(error)
        logger.debug(f"代理失败: {proxy_info.proxy}, 错误: {error}")

        # 如果代理完全失效，从池中移除
        if proxy_info.failure_count >= 10:
            logger.warning(f"移除失效代理: {proxy_info.proxy}")
            await self.remove_proxy(proxy_info.proxy_url)

    async def add_proxy(self, proxy_url: str, source: str = "manual") -> bool:
        """添加代理到池中"""
        async with self._lock:
            proxy_hash = hashlib.md5(proxy_url.encode()).hexdigest()

            if proxy_hash in self.proxies:
                return False

            # 解析代理类型
            proxy_type = ProxyType.HTTP
            if proxy_url.startswith('https'):
                proxy_type = ProxyType.HTTPS
            elif proxy_url.startswith('socks5'):
                proxy_type = ProxyType.SOCKS5

            proxy_info = ProxyInfo(
                proxy_url=proxy_url,
                proxy_type=proxy_type,
                source=source
            )

            self.proxies[proxy_hash] = proxy_info
            logger.debug(f"添加代理: {proxy_url}")
            return True

    async def remove_proxy(self, proxy_url: str):
        """从池中移除代理"""
        proxy_hash = hashlib.md5(proxy_url.encode()).hexdigest()

        if proxy_hash in self.proxies:
            del self.proxies[proxy_hash]
            logger.debug(f"移除代理: {proxy_url}")

    async def auto_fetch_proxies(self):
        """自动获取新代理"""
        logger.info("开始自动获取代理...")

        # 从免费源获取
        new_proxies = await self.fetcher.fetch_from_free_sources()

        # 添加到池中
        added_count = 0
        for proxy_url in new_proxies:
            if await self.add_proxy(proxy_url, source="free"):
                added_count += 1

        logger.info(f"自动获取完成，新增代理: {added_count}")

        # 验证新获取的代理
        if added_count > 0:
            await self.validate_all()

    async def validate_all(self):
        """验证所有代理"""
        logger.info("开始验证所有代理...")

        tasks = []
        for proxy_hash, proxy_info in list(self.proxies.items()):
            if proxy_info.status != ProxyStatus.FAILED:
                tasks.append(self._validate_single(proxy_info))

        # 并发验证，但限制并发数
        BATCH_SIZE = 50
        for i in range(0, len(tasks), BATCH_SIZE):
            batch = tasks[i:i + BATCH_SIZE]
            await asyncio.gather(*batch, return_exceptions=True)

        # 统计结果
        working = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.WORKING)
        failed = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.FAILED)

        logger.info(f"验证完成 - 可用: {working}, 失败: {failed}, 总计: {len(self.proxies)}")

        # 自动保存
        await self._save_proxies()

    async def _validate_single(self, proxy_info: ProxyInfo):
        """验证单个代理"""
        proxy_info.status = ProxyStatus.TESTING
        result = await self.validator.validate_proxy(proxy_info.proxy_url)

        if result['valid']:
            proxy_info.record_success(result['response_time'])
        else:
            proxy_info.record_failure(result.get('error', 'Unknown error'))

    async def _validation_loop(self):
        """定期验证循环"""
        while self._running:
            try:
                await asyncio.sleep(self.validation_interval)

                if self._running:
                    # 只验证最近使用过的代理
                    await self._validate_active_proxies()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"验证循环出错: {e}")

    async def _validate_active_proxies(self):
        """验证活跃代理"""
        active_proxies = [
            p for p in self.proxies.values()
            if p.total_requests > 0
            and p.status != ProxyStatus.FAILED
        ]

        logger.info(f"验证 {len(active_proxies)} 个活跃代理...")

        for proxy_info in active_proxies:
            await self._validate_single(proxy_info)

    async def _load_proxies(self):
        """从文件加载代理"""
        try:
            import os
            if os.path.exists(self.save_path):
                with open(self.save_path, 'r') as f:
                    data = json.load(f)

                for proxy_data in data:
                    proxy_info = ProxyInfo(**proxy_data)

                    # 转换datetime字符串
                    if proxy_info.last_check_time:
                        proxy_info.last_check_time = datetime.fromisoformat(proxy_info.last_check_time)
                    if proxy_info.last_success_time:
                        proxy_info.last_success_time = datetime.fromisoformat(proxy_info.last_success_time)

                    proxy_hash = hashlib.md5(proxy_info.proxy_url.encode()).hexdigest()
                    self.proxies[proxy_hash] = proxy_info

                logger.info(f"加载了 {len(self.proxies)} 个已保存的代理")
        except Exception as e:
            logger.error(f"加载代理失败: {e}")

    async def _save_proxies(self):
        """保存代理到文件"""
        try:
            import os
            os.makedirs(os.path.dirname(self.save_path), exist_ok=True)

            data = []
            for proxy_info in self.proxies.values():
                proxy_dict = {
                    'proxy_url': proxy_info.proxy_url,
                    'proxy_type': proxy_info.proxy_type.value,
                    'source': proxy_info.source,
                    'success_count': proxy_info.success_count,
                    'failure_count': proxy_info.failure_count,
                    'total_requests': proxy_info.total_requests,
                    'avg_response_time': proxy_info.avg_response_time,
                    'last_check_time': proxy_info.last_check_time.isoformat() if proxy_info.last_check_time else None,
                    'last_success_time': proxy_info.last_success_time.isoformat() if proxy_info.last_success_time else None,
                    'quality_score': proxy_info.quality_score,
                    'status': proxy_info.status.value,
                    'recent_errors': proxy_info.recent_errors,
                }
                data.append(proxy_dict)

            with open(self.save_path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            logger.debug(f"保存了 {len(self.proxies)} 个代理")
        except Exception as e:
            logger.error(f"保存代理失败: {e}")

    def get_stats(self) -> Dict:
        """获取代理池统计信息"""
        working = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.WORKING)
        failed = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.FAILED)
        testing = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.TESTING)
        unknown = sum(1 for p in self.proxies.values() if p.status == ProxyStatus.UNKNOWN)

        avg_quality = sum(p.quality_score for p in self.proxies.values()) / len(self.proxies) if self.proxies else 0

        return {
            'total': len(self.proxies),
            'working': working,
            'failed': failed,
            'testing': testing,
            'unknown': unknown,
            'avg_quality_score': avg_quality,
            'auto_fetch_enabled': self.auto_fetch,
        }


# 全局代理池实例
_proxy_pool: Optional[ProxyPool] = None


def get_proxy_pool() -> ProxyPool:
    """获取全局代理池实例"""
    global _proxy_pool
    if _proxy_pool is None:
        _proxy_pool = ProxyPool()
    return _proxy_pool


async def init_proxy_pool(**config):
    """初始化全局代理池"""
    global _proxy_pool
    _proxy_pool = ProxyPool(**config)
    await _proxy_pool.initialize()
    return _proxy_pool
