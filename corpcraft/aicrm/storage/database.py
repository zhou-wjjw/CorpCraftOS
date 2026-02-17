"""
数据库操作模块
封装所有数据库操作
"""
from typing import List, Optional, Dict, Any
from contextlib import contextmanager
from datetime import datetime, timedelta
from loguru import logger

from sqlalchemy import create_engine, and_, or_
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import SQLAlchemyError

from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
from elasticsearch import AsyncElasticsearch

from config.settings import settings
from storage.models import (
    Company, Contact, Interaction, FinancialRecord,
    CompanyCreate, CompanyUpdate, ContactCreate,
    BusinessStatus,
)


class DatabaseManager:
    """数据库管理器"""

    def __init__(self):
        # PostgreSQL
        self.pg_engine = create_engine(settings.postgres_url, pool_pre_ping=True)
        self.SessionLocal = sessionmaker(bind=self.pg_engine)

        # MongoDB
        self.mongo_client: Optional[AsyncIOMotorClient] = None

        # Elasticsearch
        self.es_client: Optional[AsyncElasticsearch] = None

    def init_db(self):
        """初始化数据库"""
        from storage.models import Base
        Base.metadata.create_all(self.pg_engine)
        logger.info("PostgreSQL数据库初始化完成")

    async def init_mongodb(self):
        """初始化MongoDB"""
        self.mongo_client = AsyncIOMotorClient(settings.mongodb_url)
        logger.info("MongoDB初始化完成")

    async def init_elasticsearch(self):
        """初始化Elasticsearch"""
        self.es_client = AsyncElasticsearch(settings.elasticsearch_url)
        logger.info("Elasticsearch初始化完成")

    @contextmanager
    def get_session(self):
        """获取数据库会话"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"数据库操作失败: {e}")
            raise
        finally:
            session.close()

    # 企业相关操作
    def create_company(self, company_data: CompanyCreate) -> Company:
        """创建企业"""
        with self.get_session() as session:
            db_company = Company(**company_data.dict())
            session.add(db_company)
            session.commit()
            session.refresh(db_company)
            logger.info(f"创建企业成功: {db_company.name}")
            return db_company

    def get_company(self, company_id: int) -> Optional[Company]:
        """获取企业"""
        with self.get_session() as session:
            return session.query(Company).filter(Company.id == company_id).first()

    def get_company_by_code(self, unified_credit_code: str) -> Optional[Company]:
        """根据统一社会信用代码获取企业"""
        with self.get_session() as session:
            return session.query(Company).filter(
                Company.unified_credit_code == unified_credit_code
            ).first()

    def update_company(self, company_id: int, company_data: CompanyUpdate) -> Optional[Company]:
        """更新企业"""
        with self.get_session() as session:
            db_company = session.query(Company).filter(Company.id == company_id).first()
            if db_company:
                for key, value in company_data.dict(exclude_unset=True).items():
                    setattr(db_company, key, value)
                db_company.updated_at = datetime.now()
                session.commit()
                session.refresh(db_company)
                logger.info(f"更新企业成功: {db_company.name}")
            return db_company

    def delete_company(self, company_id: int) -> bool:
        """删除企业"""
        with self.get_session() as session:
            db_company = session.query(Company).filter(Company.id == company_id).first()
            if db_company:
                session.delete(db_company)
                session.commit()
                logger.info(f"删除企业成功: {company_id}")
                return True
            return False

    def search_companies(
        self,
        keyword: Optional[str] = None,
        industry: Optional[str] = None,
        province: Optional[str] = None,
        city: Optional[str] = None,
        business_status: Optional[BusinessStatus] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Company]:
        """搜索企业"""
        with self.get_session() as session:
            query = session.query(Company)

            # 关键词搜索
            if keyword:
                query = query.filter(
                    or_(
                        Company.name.ilike(f"%{keyword}%"),
                        Company.business_scope.ilike(f"%{keyword}%"),
                    )
                )

            # 行业筛选
            if industry:
                query = query.filter(Company.industry == industry)

            # 地区筛选
            if province:
                query = query.filter(Company.province == province)
            if city:
                query = query.filter(Company.city == city)

            # 状态筛选
            if business_status:
                query = query.filter(Company.business_status == business_status.value)

            return query.offset(skip).limit(limit).all()

    def get_companies_by_industry(self, industry: str, limit: int = 100) -> List[Company]:
        """按行业获取企业"""
        with self.get_session() as session:
            return session.query(Company).filter(
                Company.industry == industry
            ).limit(limit).all()

    def get_companies_by_region(self, province: str, city: Optional[str] = None, limit: int = 100) -> List[Company]:
        """按地区获取企业"""
        with self.get_session() as session:
            query = session.query(Company).filter(Company.province == province)
            if city:
                query = query.filter(Company.city == city)
            return query.limit(limit).all()

    # 联系人相关操作
    def create_contact(self, contact_data: ContactCreate) -> Contact:
        """创建联系人"""
        with self.get_session() as session:
            db_contact = Contact(**contact_data.dict())
            session.add(db_contact)
            session.commit()
            session.refresh(db_contact)
            logger.info(f"创建联系人成功: {db_contact.name}")
            return db_contact

    def get_contacts_by_company(self, company_id: int) -> List[Contact]:
        """获取企业联系人"""
        with self.get_session() as session:
            return session.query(Contact).filter(
                Contact.company_id == company_id
            ).all()

    # 统计相关操作
    def get_company_stats(self) -> Dict[str, Any]:
        """获取企业统计信息"""
        with self.get_session() as session:
            total = session.query(Company).count()

            # 按行业统计
            industry_stats = session.query(
                Company.industry,
                session.query(Company).filter(Company.industry == Company.industry).count()
            ).distinct().all()

            # 按地区统计
            province_stats = session.query(
                Company.province,
                session.query(Company).filter(Company.province == Company.province).count()
            ).distinct().all()

            # 按状态统计
            status_stats = session.query(
                Company.business_status,
                session.query(Company).filter(Company.business_status == Company.business_status).count()
            ).distinct().all()

            return {
                'total': total,
                'by_industry': {k: v for k, v in industry_stats},
                'by_province': {k: v for k, v in province_stats},
                'by_status': {k: v for k, v in status_stats},
            }

    def get_recent_companies(self, days: int = 7, limit: int = 100) -> List[Company]:
        """获取最近添加的企业"""
        with self.get_session() as session:
            start_date = datetime.now() - timedelta(days=days)
            return session.query(Company).filter(
                Company.crawled_at >= start_date
            ).order_by(Company.crawled_at.desc()).limit(limit).all()

    # MongoDB操作
    async def save_raw_data(self, collection: str, data: Dict[str, Any]) -> str:
        """保存原始数据到MongoDB"""
        if not self.mongo_client:
            await self.init_mongodb()

        db = self.mongo_client[settings.MONGODB_DB]
        collection = db[collection]

        result = await collection.insert_one(data)
        return str(result.inserted_id)

    async def get_raw_data(self, collection: str, query: Dict[str, Any]) -> List[Dict[str, Any]]:
        """从MongoDB获取原始数据"""
        if not self.mongo_client:
            await self.init_mongodb()

        db = self.mongo_client[settings.MONGODB_DB]
        collection = db[collection]

        cursor = collection.find(query)
        return await cursor.to_list(length=1000)

    # Elasticsearch操作
    async def index_company(self, company: Company) -> bool:
        """索引企业到Elasticsearch"""
        if not self.es_client:
            await self.init_elasticsearch()

        from storage.models import CompanyDocument

        doc = CompanyDocument(
            id=company.id,
            name=company.name,
            business_scope=company.business_scope or "",
            industry=company.industry or "",
            tags=company.tags or [],
        )

        try:
            await self.es_client.index(
                index='companies',
                id=company.id,
                body=doc.to_dict()
            )
            return True
        except Exception as e:
            logger.error(f"索引企业失败: {e}")
            return False

    async def search_companies_fulltext(self, query: str, size: int = 10) -> List[Dict[str, Any]]:
        """全文搜索企业"""
        if not self.es_client:
            await self.init_elasticsearch()

        try:
            response = await self.es_client.search(
                index='companies',
                body={
                    'query': {
                        'multi_match': {
                            'query': query,
                            'fields': ['name^2', 'business_scope', 'industry'],
                        }
                    },
                    'size': size,
                }
            )

            return [hit['_source'] for hit in response['hits']['hits']]

        except Exception as e:
            logger.error(f"全文搜索失败: {e}")
            return []

    async def close(self):
        """关闭所有数据库连接"""
        if self.mongo_client:
            self.mongo_client.close()
        if self.es_client:
            await self.es_client.close()
        logger.info("数据库连接已关闭")


# 单例模式
_db_manager: Optional[DatabaseManager] = None


def get_db_manager() -> DatabaseManager:
    """获取数据库管理器单例"""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
    return _db_manager


# 便捷函数
def init_database():
    """初始化数据库"""
    db = get_db_manager()
    db.init_db()


async def init_async_databases():
    """初始化异步数据库"""
    db = get_db_manager()
    await db.init_mongodb()
    await db.init_elasticsearch()


# 依赖注入（用于FastAPI）
def get_db():
    """FastAPI依赖注入 - 获取数据库会话"""
    db = get_db_manager()
    with db.get_session() as session:
        yield session


__all__ = [
    'DatabaseManager',
    'get_db_manager',
    'init_database',
    'init_async_databases',
    'get_db',
]
