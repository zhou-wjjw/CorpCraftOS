"""
企业信息爬虫示例
演示如何使用基础爬虫类爬取企业信息
"""
import scrapy
from typing import Generator
from datetime import datetime
from loguru import logger

from spiders.base import BaseSpider
from storage.models import CompanyCreate
from storage.database import get_db_manager


class CompanyInfoSpider(BaseSpider):
    """企业信息爬虫示例"""

    name = "company_info"
    allowed_domains = ["example-qcc.com"]  # 示例域名
    start_urls = [
        "https://www.example-qcc.com/search",
    ]

    custom_settings = {
        'DOWNLOAD_DELAY': 2,
        'CONCURRENT_REQUESTS': 8,
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.db = get_db_manager()

    def parse(self, response):
        """
        解析企业列表页
        """
        # 示例：提取企业列表
        # 注意：这是示例代码，实际选择器需要根据目标网站调整

        # 假设企业列表在.company-item中
        company_items = response.css('.company-item')

        for item in company_items:
            # 提取企业详情页链接
            detail_url = item.css('a::attr(href)').get()

            if detail_url:
                # 请求详情页
                yield response.follow(
                    detail_url,
                    callback=self.parse_company_detail,
                    meta={'company_list_item': item.get()}
                )

        # 翻页
        next_page = response.css('.next-page::attr(href)').get()
        if next_page:
            yield response.follow(next_page, callback=self.parse)

    def parse_company_detail(self, response):
        """
        解析企业详情页
        """
        try:
            # 提取企业信息（示例选择器，实际需要根据目标网站调整）
            company_data = {
                'name': self.extract_text(response.css('.company-name::text')),
                'unified_credit_code': self.extract_text(response.css('.credit-code::text')),
                'legal_representative': self.extract_text(response.css('.legal-rep::text')),
                'registered_capital': self.extract_number(
                    response.css('.registered-capital::text')
                ),
                'business_status': self.extract_text(response.css('.business-status::text')),
                'establishment_date': self._parse_date(
                    response.css('.establishment-date::text').get()
                ),
                'business_scope': self.extract_text(response.css('.business-scope::text')),
                'industry': self.extract_text(response.css('.industry::text')),
                'registration_address': self.extract_text(response.css('.address::text')),
                'phone': self.extract_text(response.css('.phone::text')),
                'email': self.extract_text(response.css('.email::text')),
                'website': self.extract_text(response.css('.website::attr(href)')),
                'data_source': self.name,
                'source_url': response.url,
                'crawled_at': datetime.now(),
            }

            # 清理数据
            company_data = {k: v for k, v in company_data.items() if v}

            # 保存到数据库
            self._save_company(company_data)

            # 也可以返回item供pipeline处理
            yield company_data

            self.success_count += 1

        except Exception as e:
            logger.error(f"解析企业详情失败: {e}")
            self.failed_urls.append(response.url)

    def _parse_date(self, date_str: str) -> datetime:
        """解析日期字符串"""
        if not date_str:
            return None

        # 这里可以实现更复杂的日期解析逻辑
        try:
            return datetime.strptime(date_str.strip(), '%Y-%m-%d')
        except (ValueError, TypeError):
            return None

    def _save_company(self, company_data: dict):
        """保存企业到数据库"""
        try:
            # 检查是否已存在
            existing = self.db.get_company_by_code(
                company_data.get('unified_credit_code')
            )

            if existing:
                logger.info(f"企业已存在，跳过: {company_data.get('name')}")
                return

            # 创建新企业
            company_create = CompanyCreate(**company_data)
            self.db.create_company(company_create)

            logger.info(f"保存企业成功: {company_data.get('name')}")

        except Exception as e:
            logger.error(f"保存企业失败: {e}")


class ContactInfoSpider(BaseSpider):
    """联系人信息爬虫示例"""

    name = "contact_info"
    allowed_domains = ["example-linkedin.com"]
    start_urls = [
        "https://www.example-linkedin.com/search",
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.db = get_db_manager()

    def parse(self, response):
        """
        解析联系人列表页
        """
        # 示例：提取联系人列表
        contact_items = response.css('.contact-item')

        for item in contact_items:
            contact_data = {
                'name': self.extract_text(item.css('.name::text')),
                'title': self.extract_text(item.css('.title::text')),
                'company_name': self.extract_text(item.css('.company::text')),
                'email': self.extract_text(item.css('.email::text')),
                'phone': self.extract_text(item.css('.phone::text')),
            }

            # 这里需要先查找或创建企业，然后创建联系人
            # self._save_contact(contact_data)

            yield contact_data

    def _save_contact(self, contact_data: dict):
        """保存联系人到数据库"""
        # 实现联系人的保存逻辑
        pass


# 便捷函数
def run_spider(spider_name: str, **kwargs):
    """运行爬虫"""
    from scrapy.crawler import CrawlerProcess

    process = CrawlerProcess({
        'USER_AGENT': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'ITEM_PIPELINES': {
            '__main__.JsonWriterPipeline': 1,
        },
    })

    process.crawl(spider_name, **kwargs)
    process.start()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        spider_name = sys.argv[1]
        run_spider(spider_name)
    else:
        logger.error("请指定爬虫名称")
