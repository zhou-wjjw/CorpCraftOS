"""
AICRM 系统配置文件
"""
from typing import Optional
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """系统配置类"""

    # 应用配置
    APP_NAME: str = "AICRM"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # 数据库配置
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "aicrm"
    POSTGRES_PASSWORD: str = "aicrm_password"
    POSTGRES_DB: str = "aicrm"

    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_USER: str = "aicrm"
    MONGODB_PASSWORD: str = "aicrm_password"
    MONGODB_DB: str = "aicrm"

    ELASTICSEARCH_HOST: str = "localhost"
    ELASTICSEARCH_PORT: int = 9200

    # Redis配置
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # Celery配置
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # API配置
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    API_PREFIX: str = "/api/v1"

    # JWT配置
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7天

    # 爬虫配置
    SCRAPY_USER_AGENT: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    DOWNLOAD_DELAY: float = 1.0
    CONCURRENT_REQUESTS: int = 16
    CONCURRENT_REQUESTS_PER_DOMAIN: int = 8
    RETRY_TIMES: int = 3
    RETRY_HTTP_CODES: list = [500, 502, 503, 504, 522, 524, 408, 429]

    # 代理配置
    PROXY_POOL_ENABLED: bool = True
    PROXY_API_URL: Optional[str] = None  # 代理API地址
    PROXY_TEST_URL: str = "http://httpbin.org/ip"
    PROXY_VALID_SECONDS: int = 300  # 代理有效期（秒）

    # 验证码配置
    CAPTCHA_SOLVER: str = "tesseract"  # tesseract, 2captcha, both
    TESSERACT_PATH: str = "/usr/bin/tesseract"
    TWO_CAPTCHA_API_KEY: Optional[str] = None

    # AI模型配置
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    ANTHROPIC_API_KEY: Optional[str] = None

    # 日志配置
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/aicrm.log"
    LOG_ROTATION: str = "500 MB"
    LOG_RETENTION: str = "30 days"

    # 监控配置
    SENTRY_DSN: Optional[str] = None
    PROMETHEUS_PORT: int = 9090

    class Config:
        env_file = ".env"
        case_sensitive = True

    @property
    def postgres_url(self) -> str:
        """PostgreSQL连接URL"""
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def mongodb_url(self) -> str:
        """MongoDB连接URL"""
        return f"mongodb://{self.MONGODB_USER}:{self.MONGODB_PASSWORD}@{self.MONGODB_HOST}:{self.MONGODB_PORT}/{self.MONGODB_DB}"

    @property
    def elasticsearch_url(self) -> str:
        """Elasticsearch连接URL"""
        return f"http://{self.ELASTICSEARCH_HOST}:{self.ELASTICSEARCH_PORT}"


@lru_cache()
def get_settings() -> Settings:
    """获取配置单例"""
    return Settings()


# 全局配置实例
settings = get_settings()
