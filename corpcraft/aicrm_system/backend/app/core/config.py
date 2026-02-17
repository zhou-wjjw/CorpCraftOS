"""
AICRM System - Core Configuration Management
"""
import os
import yaml
from pathlib import Path
from typing import Any, Dict, Optional
from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application Settings"""

    # Basic App Configuration
    APP_NAME: str = "AICRM System"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = Field(default="your-secret-key-change-in-production")

    # Server Configuration
    SERVER_HOST: str = "0.0.0.0"
    SERVER_PORT: int = 8000
    SERVER_WORKERS: int = 4

    # Database Configuration
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "aicrm_db"
    POSTGRES_USER: str = "aicrm_user"
    POSTGRES_PASSWORD: str = "changeme"
    POSTGRES_POOL_SIZE: int = 20

    MONGODB_HOST: str = "localhost"
    MONGODB_PORT: int = 27017
    MONGODB_DB: str = "aicrm_mongo"

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None

    # Scraping Configuration
    REQUEST_TIMEOUT: int = 30
    MAX_RETRIES: int = 3
    RETRY_DELAY: int = 5
    CONCURRENT_REQUESTS: int = 16
    DOWNLOAD_DELAY: float = 0.5

    # Proxy Configuration
    PROXY_ENABLED: bool = True
    PROXY_POOL_SIZE: int = 100
    PROXY_ROTATION_INTERVAL: int = 300

    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_SECOND: int = 2
    RATE_LIMIT_BURST: int = 10

    # Captcha Configuration
    CAPTCHA_OCR_ENABLED: bool = True
    CAPTCHA_ENGINE: str = "tesseract"
    TESSERACT_PATH: str = "/usr/bin/tesseract"

    # AI Services
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"

    # Storage
    DATA_DIR: str = "./data"
    LOG_DIR: str = "./logs"

    class Config:
        env_file = ".env"
        case_sensitive = True

    @classmethod
    def load_from_yaml(cls, yaml_path: str) -> "Settings":
        """Load settings from YAML file"""
        config_path = Path(yaml_path)
        if not config_path.exists():
            return cls()

        with open(config_path, "r", encoding="utf-8") as f:
            config_data = yaml.safe_load(f)

        # Flatten nested configuration
        flat_config = cls._flatten_config(config_data)
        return cls(**flat_config)

    @staticmethod
    def _flatten_config(config: Dict[str, Any], parent_key: str = "", sep: str = "_") -> Dict[str, Any]:
        """Flatten nested dictionary"""
        items = []
        for k, v in config.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(Settings._flatten_config(v, new_key, sep=sep).items())
            else:
                items.append((new_key.upper(), v))
        return dict(items)

    @property
    def database_url(self) -> str:
        """Get PostgreSQL database URL"""
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def redis_url(self) -> str:
        """Get Redis URL"""
        password_part = f":{self.REDIS_PASSWORD}@" if self.REDIS_PASSWORD else ""
        return f"redis://{password_part}{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"

    @property
    def mongodb_url(self) -> str:
        """Get MongoDB URL"""
        return f"mongodb://{self.MONGODB_HOST}:{self.MONGODB_PORT}/{self.MONGODB_DB}"


# Global settings instance
settings = Settings.load_from_yaml("./config/settings.yaml")


def get_settings() -> Settings:
    """Get settings instance"""
    return settings
