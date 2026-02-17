"""
基础爬虫类
提供所有爬虫的通用功能
"""
import scrapy
from scrapy import signals
from scrapy.http import Request, Response
from scrapy.exceptions import IgnoreRequest
from typing import Generator, Optional, Dict, Any
from loguru import logger
import time
import random


class BaseSpider(scrapy.Spider):
    """基础爬虫类"""

    # 自定义配置
    custom_settings = {
        'DOWNLOAD_DELAY': 1,
        'CONCURRENT_REQUESTS': 16,
        'CONCURRENT_REQUESTS_PER_DOMAIN': 8,
        'COOKIES_ENABLED': True,
        'RETRY_TIMES': 3,
        'RETRY_HTTP_CODES': [500, 502, 503, 504, 522, 524, 408, 429],
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.failed_urls = []
        self.success_count = 0
        self.start_time = time.time()

    @classmethod
    def from_crawler(cls, crawler, *args, **kwargs):
        """创建爬虫实例"""
        spider = super().from_crawler(crawler, *args, **kwargs)
        crawler.signals.connect(
            spider.spider_error, signal=signals.spider_error
        )
        crawler.signals.connect(
            spider.spider_closed, signal=signals.spider_closed
        )
        return spider

    def spider_error(self, failure, response, spider):
        """爬虫错误处理"""
        logger.error(f"Spider error: {failure.value}")
        if hasattr(response, 'url'):
            self.failed_urls.append(response.url)

    def spider_closed(self, spider, reason):
        """爬虫关闭时的处理"""
        elapsed_time = time.time() - self.start_time
        logger.info(f"""
        爬虫统计:
        - 成功请求数: {self.success_count}
        - 失败URL数: {len(self.failed_urls)}
        - 运行时长: {elapsed_time:.2f}秒
        - 关闭原因: {reason}
        """)

        # 保存失败的URL
        if self.failed_urls:
            self.save_failed_urls()

    def save_failed_urls(self):
        """保存失败的URL"""
        filename = f"failed_urls_{self.name}_{int(time.time())}.txt"
        with open(filename, 'w', encoding='utf-8') as f:
            for url in self.failed_urls:
                f.write(f"{url}\n")
        logger.info(f"失败的URL已保存到: {filename}")

    def start_requests(self) -> Generator[Request, None, None]:
        """生成初始请求"""
        for url in self.start_urls:
            yield self.create_request(url)

    def create_request(
        self,
        url: str,
        callback: Optional[callable] = None,
        meta: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Request:
        """创建请求对象"""
        if callback is None:
            callback = self.parse

        # 默认meta配置
        default_meta = {
            'handle_httpstatus_all': True,
            'download_timeout': 30,
            'dont_filter': False,
            'retry_enabled': True,
        }

        if meta:
            default_meta.update(meta)

        return Request(
            url=url,
            callback=callback,
            meta=default_meta,
            errback=self.errback_httpbin,
            **kwargs
        )

    def errback_httpbin(self, failure):
        """请求失败回调"""
        logger.error(f"请求失败: {failure.request.url} - {failure.value}")
        self.failed_urls.append(failure.request.url)

    def parse(self, response: Response):
        """默认解析方法 - 需要子类重写"""
        raise NotImplementedError("子类必须实现parse方法")

    def extract_text(self, element, default: str = "") -> str:
        """提取文本内容"""
        try:
            return element.get(default).strip()
        except (AttributeError, TypeError):
            return default

    def extract_number(self, text: str, default: float = 0.0) -> float:
        """提取数字"""
        import re
        try:
            numbers = re.findall(r'[\d.]+', str(text).replace(',', ''))
            if numbers:
                return float(numbers[-1])
            return default
        except (ValueError, IndexError):
            return default

    def clean_text(self, text: str) -> str:
        """清理文本"""
        if not text:
            return ""
        return ' '.join(text.split())

    def get_proxy(self) -> Optional[Dict[str, str]]:
        """获取代理"""
        # 这里可以从代理池获取代理
        # 暂时返回None，后续集成代理池
        return None


class RetryMiddleware:
    """重试中间件"""

    def __init__(self, settings):
        self.max_retry_times = settings.getint('RETRY_TIMES')
        self.retry_http_codes = set(
            int(x) for x in settings.getlist('RETRY_HTTP_CODES')
        )

    @classmethod
    def from_crawler(cls, crawler):
        return cls(crawler.settings)

    def process_response(self, request, response, spider):
        """处理响应"""
        if request.meta.get('dont_retry', False):
            return response

        if response.status in self.retry_http_codes:
            reason = f'response status {response.status}'
            return self._retry(request, reason, spider) or response

        return response

    def process_exception(self, request, exception, spider):
        """处理异常"""
        if isinstance(exception, Exception):
            return self._retry(request, exception, spider)

    def _retry(self, request, reason, spider):
        """执行重试"""
        retries = request.meta.get('retry_times', 0) + 1

        if retries <= self.max_retry_times:
            logger.debug(f"重试 {retries}/{self.max_retry_times}: {request.url}")

            retry_request = request.copy()
            retry_request.meta['retry_times'] = retries
            retry_request.dont_filter = True

            # 添加延迟
            retry_request.priority = request.priority - 1

            return retry_request
        else:
            logger.error(f"达到最大重试次数: {request.url}")
            spider.failed_urls.append(request.url)
