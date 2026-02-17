"""
反爬虫中间件
实现User-Agent轮换、请求频率控制、Cookie管理等反爬虫策略
"""
import random
import time
from typing import Dict, Set
from urllib.parse import urlparse
from loguru import logger
from fake_useragent import UserAgent
from scrapy import signals
from scrapy.exceptions import NotConfigured
from scrapy.downloadermiddlewares.retry import RetryMiddleware as ScrapyRetryMiddleware
from w3lib.http import basic_auth_header
from datetime import datetime, timedelta


class AntiSpiderMiddleware:
    """反爬虫中间件"""

    def __init__(self, settings):
        self.ua = UserAgent()
        self.delay = settings.getfloat('DOWNLOAD_DELAY', 1.0)
        self.concurrent_requests = settings.getint('CONCURRENT_REQUESTS_PER_DOMAIN', 8)

        # 域名访问记录
        self.domain_last_access: Dict[str, float] = {}
        self.domain_request_count: Dict[str, int] = {}

        # 自定义User-Agent列表
        self.user_agents = self._load_user_agents()

    @classmethod
    def from_crawler(cls, crawler):
        middleware = cls(crawler.settings)
        crawler.signals.connect(
            middleware.spider_opened, signal=signals.spider_opened
        )
        return middleware

    def spider_opened(self, spider):
        """爬虫启动时的处理"""
        logger.info(f"反爬虫中间件已启用: {spider.name}")

    def _load_user_agents(self) -> list:
        """加载User-Agent列表"""
        # 常用的真实浏览器User-Agent
        return [
            # Chrome
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',

            # Firefox
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',

            # Safari
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',

            # Edge
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',

            # Opera
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
        ]

    def process_request(self, request, spider):
        """处理请求 - 添加反爬虫措施"""
        # 1. 设置随机User-Agent
        if 'User-Agent' not in request.headers:
            request.headers['User-Agent'] = random.choice(self.user_agents)

        # 2. 添加常见浏览器请求头
        request.headers.update({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0',
        })

        # 3. 请求频率控制
        domain = self._get_domain(request.url)
        self._throttle_request(domain)

        # 4. 添加Referer（如果不是第一个请求）
        if request.meta.get('referer'):
            request.headers['Referer'] = request.meta['referer']

        return None

    def process_response(self, request, response, spider):
        """处理响应 - 检测反爬虫措施"""
        # 检测是否被重定向到验证码页面
        if 'captcha' in response.url.lower() or 'verify' in response.url.lower():
            logger.warning(f"检测到验证码页面: {response.url}")
            # 可以在这里触发验证码处理流程
            request.meta['captcha_detected'] = True

        # 检测是否被限流
        if response.status == 429:
            logger.warning(f"请求被限流: {response.url}")
            # 可以增加延迟时间
            self.delay = min(self.delay * 2, 10)  # 最多增加到10秒

        # 检测是否被封禁
        if response.status == 403:
            logger.warning(f"请求被拒绝(403): {response.url}")
            # 可以在这里切换代理或采取其他措施

        return response

    def _get_domain(self, url: str) -> str:
        """获取域名"""
        parsed = urlparse(url)
        return parsed.netloc

    def _throttle_request(self, domain: str):
        """控制请求频率"""
        now = time.time()

        if domain in self.domain_last_access:
            elapsed = now - self.domain_last_access[domain]
            if elapsed < self.delay:
                # 休眠剩余时间
                sleep_time = self.delay - elapsed
                time.sleep(sleep_time)

        self.domain_last_access[domain] = time.time()

        # 增加请求计数
        self.domain_request_count[domain] = self.domain_request_count.get(domain, 0) + 1

        # 如果请求次数过多，增加延迟
        if self.domain_request_count[domain] > 100:
            self.delay = min(self.delay * 1.1, 5.0)  # 最多5秒


class ProxyMiddleware:
    """代理中间件"""

    def __init__(self, settings):
        from .proxy import get_proxy_pool
        self.proxy_pool = get_proxy_pool()
        self.proxy_enabled = settings.getbool('PROXY_POOL_ENABLED', True)

        # 失败统计
        self.failed_proxies: Set[str] = set()

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request, spider):
        """为请求添加代理"""
        if not self.proxy_enabled:
            return None

        # 如果请求已经指定了代理，跳过
        if 'proxy' in request.meta:
            return None

        # 从代理池获取代理
        if self.proxy_pool:
            proxy_info = self.proxy_pool.get_proxy()

            if proxy_info:
                request.meta['proxy'] = proxy_info.proxy_url
                request.meta['proxy_info'] = proxy_info
                logger.debug(f"使用代理: {proxy_info.proxy}")

        return None

    def process_response(self, request, response, spider):
        """处理响应，标记代理成功或失败"""
        if 'proxy_info' in request.meta:
            proxy_info = request.meta['proxy_info']

            if response.status == 200:
                # 计算响应时间
                response_time = response.meta.get('download_latency', 0) * 1000
                self.proxy_pool.mark_success(proxy_info, response_time)
            else:
                self.proxy_pool.mark_failure(proxy_info)

        return response

    def process_exception(self, request, exception, spider):
        """处理代理异常"""
        if 'proxy_info' in request.meta:
            proxy_info = request.meta['proxy_info']
            self.proxy_pool.mark_failure(proxy_info)

            # 如果代理连续失败，从临时列表中移除
            if proxy_info.proxy not in self.failed_proxies:
                self.failed_proxies.add(proxy_info.proxy)
            else:
                # 已经失败过，尝试换一个
                logger.debug(f"代理连续失败，尝试更换: {proxy_info.proxy}")


class CookieMiddleware:
    """Cookie管理中间件"""

    def __init__(self, settings):
        self.cookie_jar: Dict[str, Dict] = {}
        self.cookie_enabled = settings.getbool('COOKIES_ENABLED', True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request, spider):
        """为请求添加Cookie"""
        if not self.cookie_enabled:
            return None

        domain = self._get_domain(request.url)

        # 如果该域名有保存的Cookie，使用它
        if domain in self.cookie_jar:
            request.headers['Cookie'] = self._format_cookies(self.cookie_jar[domain])

        return None

    def process_response(self, request, response, spider):
        """保存响应中的Cookie"""
        if not self.cookie_enabled:
            return response

        # 从响应头获取Cookie
        if 'Set-Cookie' in response.headers:
            domain = self._get_domain(request.url)
            cookies = self._parse_cookies(response.headers.getlist('Set-Cookie'))

            if domain not in self.cookie_jar:
                self.cookie_jar[domain] = {}

            self.cookie_jar[domain].update(cookies)

        return response

    def _get_domain(self, url: str) -> str:
        """获取域名"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc

    def _parse_cookies(self, cookie_headers: list) -> Dict[str, str]:
        """解析Cookie"""
        cookies = {}
        for cookie in cookie_headers:
            # 简单的Cookie解析
            if b';' in cookie:
                parts = cookie.split(b';')[0]
            else:
                parts = cookie

            if b'=' in parts:
                key, value = parts.split(b'=', 1)
                cookies[key.decode()] = value.decode()

        return cookies

    def _format_cookies(self, cookies: Dict[str, str]) -> str:
        """格式化Cookie为请求头格式"""
        return '; '.join([f"{k}={v}" for k, v in cookies.items()])


class HeadersMiddleware:
    """请求头增强中间件"""

    # 常见的请求头组合
    HEADER_SETS = [
        {  # Chrome
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
        },
        {  # Firefox
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
            'DNT': '1',
        },
    ]

    def __init__(self, settings):
        self.use_random_headers = settings.getbool('RANDOM_HEADERS', True)

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_request(self, request, spider):
        """添加增强的请求头"""
        if self.use_random_headers:
            # 随机选择一组请求头
            extra_headers = random.choice(self.HEADER_SETS)
            for key, value in extra_headers.items():
                if key not in request.headers:
                    request.headers[key] = value

        return None


# 导出所有中间件
__all__ = [
    'AntiSpiderMiddleware',
    'ProxyMiddleware',
    'CookieMiddleware',
    'HeadersMiddleware',
]
