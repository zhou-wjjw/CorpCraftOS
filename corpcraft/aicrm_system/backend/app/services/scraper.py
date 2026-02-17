"""
AICRM System - Advanced Web Scraper
支持多种爬取策略和反爬虫对抗
"""
import asyncio
import random
import time
from typing import Any, Dict, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import aiohttp
import httpx
from bs4 import BeautifulSoup
from loguru import logger
from playwright.async_api import async_playwright, Browser, Page
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from fake_useragent import UserAgent


class ScrapingStrategy(Enum):
    """爬取策略枚举"""
    HTTP = "http"  # 基于HTTP请求的简单爬取
    SELENIUM = "selenium"  # 基于Selenium的浏览器自动化
    PLAYWRIGHT = "playwright"  # 基于Playwright的现代浏览器自动化
    HYBRID = "hybrid"  # 混合策略，自动选择最佳方法


@dataclass
class ScrapingResult:
    """爬取结果数据类"""
    success: bool
    data: Union[Dict, List, str, None]
    url: str
    status_code: Optional[int] = None
    error: Optional[str] = None
    strategy_used: Optional[ScrapingStrategy] = None
    metadata: Dict = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


class ProxyRotator:
    """代理轮换器"""

    def __init__(self, proxy_list: List[str], rotation_interval: int = 300):
        self.proxy_list = proxy_list
        self.current_index = 0
        self.rotation_interval = rotation_interval
        self.last_rotation = time.time()
        self.failed_proxies = set()

    def get_proxy(self) -> Optional[str]:
        """获取下一个可用代理"""
        if not self.proxy_list:
            return None

        # 检查是否需要轮换
        if time.time() - self.last_rotation > self.rotation_interval:
            self.current_index = (self.current_index + 1) % len(self.proxy_list)
            self.last_rotation = time.time()

        # 跳过失败的代理
        attempts = 0
        max_attempts = len(self.proxy_list)
        while attempts < max_attempts:
            proxy = self.proxy_list[self.current_index]
            if proxy not in self.failed_proxies:
                return proxy

            self.current_index = (self.current_index + 1) % len(self.proxy_list)
            attempts += 1

        return None

    def mark_failed(self, proxy: str):
        """标记代理为失败"""
        self.failed_proxies.add(proxy)

    def mark_success(self, proxy: str):
        """标记代理为成功，从失败列表中移除"""
        self.failed_proxies.discard(proxy)


class RateLimiter:
    """速率限制器"""

    def __init__(self, rate_per_second: float = 2, burst: int = 10):
        self.rate_per_second = rate_per_second
        self.burst = burst
        self.tokens = burst
        self.last_update = time.time()
        self._lock = asyncio.Lock()

    async def acquire(self):
        """获取令牌"""
        async with self._lock:
            now = time.time()
            elapsed = now - self.last_update
            self.tokens = min(self.burst, self.tokens + elapsed * self.rate_per_second)
            self.last_update = now

            if self.tokens < 1:
                wait_time = (1 - self.tokens) / self.rate_per_second
                await asyncio.sleep(wait_time)
                self.tokens = 0
            else:
                self.tokens -= 1


class WebScraper:
    """高级网页爬虫"""

    def __init__(
        self,
        strategy: ScrapingStrategy = ScrapingStrategy.HTTP,
        proxy_list: List[str] = None,
        rate_limit: float = 2.0,
        use_stealth: bool = True,
        headless: bool = True
    ):
        self.strategy = strategy
        self.proxy_rotator = ProxyRotator(proxy_list or []) if proxy_list else None
        self.rate_limiter = RateLimiter(rate_per_second=rate_limit)
        self.use_stealth = use_stealth
        self.headless = headless
        self.ua = UserAgent()
        self.session = None
        self.browser = None
        self.playwright = None

        # 初始化请求头池
        self.headers_pool = self._init_headers_pool()

    def _init_headers_pool(self) -> List[Dict]:
        """初始化请求头池"""
        return [
            {
                "User-Agent": self.ua.random,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
                "Accept-Encoding": "gzip, deflate, br",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Cache-Control": "max-age=0",
            }
            for _ in range(10)
        ]

    def get_random_headers(self) -> Dict:
        """获取随机请求头"""
        headers = random.choice(self.headers_pool).copy()
        headers["User-Agent"] = self.ua.random
        return headers

    async def scrape(
        self,
        url: str,
        method: str = "GET",
        data: Dict = None,
        headers: Dict = None,
        wait_for_selector: str = None,
        execute_js: str = None,
        timeout: int = 30000
    ) -> ScrapingResult:
        """
        爬取网页主方法

        Args:
            url: 目标URL
            method: HTTP方法
            data: POST数据
            headers: 自定义请求头
            wait_for_selector: 等待选择器（用于动态内容）
            execute_js: 执行JavaScript代码
            timeout: 超时时间（毫秒）

        Returns:
            ScrapingResult: 爬取结果
        """
        await self.rate_limiter.acquire()

        strategy = self.strategy
        if strategy == ScrapingStrategy.HYBRID:
            strategy = await self._determine_strategy(url)

        try:
            if strategy == ScrapingStrategy.HTTP:
                return await self._scrape_http(url, method, data, headers, timeout)
            elif strategy == ScrapingStrategy.SELENIUM:
                return await self._scrape_selenium(url, wait_for_selector, execute_js, timeout)
            elif strategy == ScrapingStrategy.PLAYWRIGHT:
                return await self._scrape_playwright(url, wait_for_selector, execute_js, timeout)
            else:
                raise ValueError(f"Unknown strategy: {strategy}")

        except Exception as e:
            logger.error(f"Scraping failed for {url}: {str(e)}")
            return ScrapingResult(
                success=False,
                data=None,
                url=url,
                error=str(e),
                strategy_used=strategy
            )

    async def _determine_strategy(self, url: str) -> ScrapingStrategy:
        """自动确定最佳爬取策略"""
        # 这里可以实现智能判断逻辑
        # 例如先尝试HTTP，如果检测到JavaScript渲染再切换到浏览器
        return ScrapingStrategy.HTTP

    async def _scrape_http(
        self,
        url: str,
        method: str,
        data: Dict,
        custom_headers: Dict,
        timeout: int
    ) -> ScrapingResult:
        """使用HTTP请求爬取"""
        if not self.session:
            timeout_obj = httpx.Timeout(timeout / 1000)
            self.session = httpx.AsyncClient(timeout=timeout_obj, follow_redirects=True)

        headers = {**self.get_random_headers(), **(custom_headers or {})}
        proxy = self.proxy_rotator.get_proxy() if self.proxy_rotator else None

        try:
            if method.upper() == "GET":
                response = await self.session.get(url, headers=headers, proxy=proxy)
            elif method.upper() == "POST":
                response = await self.session.post(url, json=data, headers=headers, proxy=proxy)
            else:
                raise ValueError(f"Unsupported method: {method}")

            if proxy and self.proxy_rotator:
                self.proxy_rotator.mark_success(proxy)

            # 解析HTML
            soup = BeautifulSoup(response.text, 'lxml')

            return ScrapingResult(
                success=True,
                data={
                    "html": response.text,
                    "soup": soup,
                    "headers": dict(response.headers),
                    "status_code": response.status_code
                },
                url=str(response.url),
                status_code=response.status_code,
                strategy_used=ScrapingStrategy.HTTP,
                metadata={"proxy_used": proxy}
            )

        except httpx.HTTPError as e:
            if proxy and self.proxy_rotator:
                self.proxy_rotator.mark_failed(proxy)
            raise

    async def _scrape_selenium(
        self,
        url: str,
        wait_for_selector: str,
        execute_js: str,
        timeout: int
    ) -> ScrapingResult:
        """使用Selenium爬取"""
        if not self.browser:
            options = Options()
            if self.headless:
                options.add_argument('--headless')
            options.add_argument('--no-sandbox')
            options.add_argument('--disable-dev-shm-usage')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option("excludeSwitches", ["enable-automation"])
            options.add_experimental_option('useAutomationExtension', False)

            # 设置代理
            proxy = self.proxy_rotator.get_proxy() if self.proxy_rotator else None
            if proxy:
                options.add_argument(f'--proxy-server={proxy}')

            self.browser = webdriver.Chrome(options=options)
            self.browser.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': '''
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined
                    })
                '''
            })

        try:
            self.browser.get(url)

            # 等待元素
            if wait_for_selector:
                WebDriverWait(self.browser, timeout / 1000).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, wait_for_selector))
                )

            # 执行JavaScript
            if execute_js:
                self.browser.execute_script(execute_js)

            # 获取页面内容
            html = self.browser.page_source
            soup = BeautifulSoup(html, 'lxml')

            return ScrapingResult(
                success=True,
                data={
                    "html": html,
                    "soup": soup,
                    "screenshot": self.browser.get_screenshot_as_base64() if not self.headless else None
                },
                url=self.browser.current_url,
                strategy_used=ScrapingStrategy.SELENIUM
            )

        except Exception as e:
            raise

    async def _scrape_playwright(
        self,
        url: str,
        wait_for_selector: str,
        execute_js: str,
        timeout: int
    ) -> ScrapingResult:
        """使用Playwright爬取"""
        if not self.playwright:
            self.playwright = await async_playwright().start()
            self.browser = await self.playwright.chromium.launch(
                headless=self.headless,
                args=['--disable-blink-features=AutomationControlled']
            )

        context = await self.browser.new_context(
            user_agent=self.ua.random,
            viewport={'width': 1920, 'height': 1080}
        )

        # 设置代理
        proxy = self.proxy_rotator.get_proxy() if self.proxy_rotator else None
        if proxy:
            await context.set_geolocation({"longitude": 0, "latitude": 0})
            # 注意：Playwright的代理设置需要在new_context时指定

        page = await context.new_page()

        try:
            await page.goto(url, timeout=timeout, wait_until='networkidle')

            # 等待选择器
            if wait_for_selector:
                await page.wait_for_selector(wait_for_selector, timeout=timeout / 1000)

            # 执行JavaScript
            if execute_js:
                await page.evaluate(execute_js)

            # 获取内容
            html = await page.content()
            soup = BeautifulSoup(html, 'lxml')

            return ScrapingResult(
                success=True,
                data={
                    "html": html,
                    "soup": soup,
                    "screenshot": await page.screenshot() if not self.headless else None
                },
                url=page.url,
                strategy_used=ScrapingStrategy.PLAYWRIGHT
            )

        except Exception as e:
            raise
        finally:
            await context.close()

    async def scrape_multiple(
        self,
        urls: List[str],
        concurrency: int = 5,
        **kwargs
    ) -> List[ScrapingResult]:
        """并发爬取多个URL"""
        semaphore = asyncio.Semaphore(concurrency)

        async def scrape_with_semaphore(url: str) -> ScrapingResult:
            async with semaphore:
                return await self.scrape(url, **kwargs)

        tasks = [scrape_with_semaphore(url) for url in urls]
        return await asyncio.gather(*tasks, return_exceptions=True)

    async def extract_data(
        self,
        result: ScrapingResult,
        selectors: Dict[str, str],
        extract_type: str = "text"
    ) -> Dict[str, List[str]]:
        """
        从爬取结果中提取结构化数据

        Args:
            result: 爬取结果
            selectors: CSS选择器字典 {"field_name": "css.selector"}
            extract_type: 提取类型 (text, attribute, html)

        Returns:
            提取的数据字典
        """
        if not result.success or not result.data:
            return {}

        soup = result.data.get("soup")
        if not soup:
            return {}

        extracted = {}
        for field, selector in selectors.items():
            elements = soup.select(selector)

            if extract_type == "text":
                extracted[field] = [el.get_text(strip=True) for el in elements]
            elif extract_type == "html":
                extracted[field] = [str(el) for el in elements]
            elif extract_type == "attribute":
                # 假设selector格式为 "selector@attribute"
                if "@" in selector:
                    sel, attr = selector.rsplit("@", 1)
                    elements = soup.select(sel)
                    extracted[field] = [el.get(attr) for el in elements if el.get(attr)]
                else:
                    extracted[field] = [el.get_text(strip=True) for el in elements]

        return extracted

    async def close(self):
        """关闭所有连接"""
        if self.session:
            await self.session.aclose()
        if self.browser:
            if hasattr(self.browser, 'quit'):
                self.browser.quit()
            elif hasattr(self.browser, 'close'):
                await self.browser.close()
        if self.playwright:
            await self.playwright.stop()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()


# 使用示例和工厂函数
async def create_scraper(
    strategy: str = "http",
    **kwargs
) -> WebScraper:
    """创建爬虫实例的工厂函数"""
    strategy_map = {
        "http": ScrapingStrategy.HTTP,
        "selenium": ScrapingStrategy.SELENIUM,
        "playwright": ScrapingStrategy.PLAYWRIGHT,
        "hybrid": ScrapingStrategy.HYBRID
    }

    return WebScraper(
        strategy=strategy_map.get(strategy.lower(), ScrapingStrategy.HTTP),
        **kwargs
    )
