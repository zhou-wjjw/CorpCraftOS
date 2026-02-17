"""
数据模型定义
定义所有数据库表结构和数据模型
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field
from enum import Enum


Base = declarative_base()


# SQLAlchemy模型
class Company(Base):
    """企业信息表"""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    unified_credit_code = Column(String(50), unique=True, index=True, comment="统一社会信用代码")
    registration_number = Column(String(50), comment="注册号")
    organization_code = Column(String(50), comment="组织机构代码")
    tax_number = Column(String(50), comment="税务登记号")

    # 基本信息
    legal_representative = Column(String(100), comment="法定代表人")
    registered_capital = Column(Float, comment="注册资本")
    paid_in_capital = Column(Float, comment="实收资本")
    business_status = Column(String(50), index=True, comment="经营状态")
    company_type = Column(String(100), comment="公司类型")
    establishment_date = Column(DateTime, comment="成立日期")
    approval_date = Column(DateTime, comment="核准日期")
    business_term_start = Column(DateTime, comment="营业期限起始")
    business_term_end = Column(DateTime, comment="营业期限结束")
    registration_authority = Column(String(255), comment="登记机关")

    # 地址信息
    registration_address = Column(Text, comment="注册地址")
    business_address = Column(Text, comment="经营地址")
    province = Column(String(50), index=True, comment="省份")
    city = Column(String(50), index=True, comment="城市")
    district = Column(String(50), comment="区县")

    # 经营范围
    business_scope = Column(Text, comment="经营范围")
    industry = Column(String(100), index=True, comment="所属行业")
    industry_class = Column(String(100), comment="行业分类")

    # 联系方式
    phone = Column(String(50), comment="电话")
    email = Column(String(100), comment="邮箱")
    website = Column(String(255), comment="官网")

    # 财务信息
    annual_revenue = Column(Float, comment="年营业额")
    employee_count = Column(Integer, comment="员工数量")
    tax_rating = Column(String(20), comment="纳税评级")

    # 数据来源
    data_source = Column(String(100), comment="数据来源")
    source_url = Column(String(500), comment="来源URL")
    crawled_at = Column(DateTime, default=datetime.now, comment="爬取时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")

    # 扩展字段
    extra_data = Column(JSON, comment="额外数据")
    tags = Column(JSON, comment="标签")

    # 关系
    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")
    financial_records = relationship("FinancialRecord", back_populates="company", cascade="all, delete-orphan")


class Contact(Base):
    """联系人表"""
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    # 基本信息
    name = Column(String(100), nullable=False, index=True)
    title = Column(String(100), comment="职位")
    department = Column(String(100), comment="部门")

    # 联系方式
    phone = Column(String(50), index=True)
    mobile = Column(String(50), index=True)
    email = Column(String(100), index=True)
    wechat = Column(String(100), comment="微信")
    linkedin = Column(String(255), comment="领英")

    # 决策权
    decision_level = Column(String(50), comment="决策层级")
    influence_level = Column(String(50), comment="影响力层级")

    # 其他信息
    gender = Column(String(10), comment="性别")
    age_range = Column(String(20), comment="年龄范围")
    education = Column(String(50), comment="学历")

    # 数据来源
    data_source = Column(String(100), comment="数据来源")
    crawled_at = Column(DateTime, default=datetime.now, comment="爬取时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")

    # 关系
    company = relationship("Company", back_populates="contacts")
    interactions = relationship("Interaction", back_populates="contact", cascade="all, delete-orphan")


class Interaction(Base):
    """互动记录表"""
    __tablename__ = "interactions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, index=True)

    # 互动信息
    interaction_type = Column(String(50), index=True, comment="互动类型：call/email/meeting/social")
    interaction_date = Column(DateTime, index=True, comment="互动时间")
    duration = Column(Integer, comment="持续时间（分钟）")
    subject = Column(String(255), comment="主题")
    description = Column(Text, comment="描述")

    # 结果
    outcome = Column(String(50), comment="结果")
    next_step = Column(Text, comment="下一步计划")
    next_followup_date = Column(DateTime, comment="下次跟进时间")

    # 评分
    interest_level = Column(Integer, comment="意向度：1-5")
    sentiment = Column(String(20), comment="情感倾向：positive/neutral/negative")

    # 创建人
    created_by = Column(String(100), comment="创建人")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")

    # 关系
    contact = relationship("Contact", back_populates="interactions")


class FinancialRecord(Base):
    """财务记录表"""
    __tablename__ = "financial_records"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, index=True)

    # 基本信息
    report_year = Column(Integer, index=True, comment="报告年度")
    report_type = Column(String(50), comment="报告类型")

    # 财务指标
    total_assets = Column(Float, comment="总资产")
    total_liabilities = Column(Float, comment="总负债")
    net_assets = Column(Float, comment="净资产")
    revenue = Column(Float, comment="营业收入")
    net_profit = Column(Float, comment="净利润")
    operating_cash_flow = Column(Float, comment="经营现金流")

    # 比率指标
    asset_liability_ratio = Column(Float, comment="资产负债率")
    current_ratio = Column(Float, comment="流动比率")
    quick_ratio = Column(Float, comment="速动比率")
    gross_margin = Column(Float, comment="毛利率")
    net_margin = Column(Float, comment="净利率")
    roe = Column(Float, comment="净资产收益率")
    roa = Column(Float, comment="总资产收益率")

    # 数据来源
    data_source = Column(String(100), comment="数据来源")
    crawled_at = Column(DateTime, default=datetime.now, comment="爬取时间")

    # 关系
    company = relationship("Company", back_populates="financial_records")


# Pydantic模型（用于API）
class CompanyBase(BaseModel):
    """企业基础模型"""
    name: str
    unified_credit_code: Optional[str] = None
    legal_representative: Optional[str] = None
    registered_capital: Optional[float] = None
    business_status: Optional[str] = None
    establishment_date: Optional[datetime] = None
    business_scope: Optional[str] = None
    industry: Optional[str] = None


class CompanyCreate(CompanyBase):
    """创建企业模型"""
    registration_address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None


class CompanyUpdate(BaseModel):
    """更新企业模型"""
    name: Optional[str] = None
    legal_representative: Optional[str] = None
    registered_capital: Optional[float] = None
    business_status: Optional[str] = None
    business_scope: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class CompanyResponse(CompanyBase):
    """企业响应模型"""
    id: int
    registration_address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    crawled_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContactBase(BaseModel):
    """联系人基础模型"""
    name: str
    title: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class ContactCreate(ContactBase):
    """创建联系人模型"""
    company_id: int
    mobile: Optional[str] = None
    wechat: Optional[str] = None


class ContactResponse(ContactBase):
    """联系人响应模型"""
    id: int
    company_id: int
    mobile: Optional[str] = None
    wechat: Optional[str] = None
    crawled_at: datetime

    class Config:
        from_attributes = True


# MongoDB模型（非结构化数据）
class RawData:
    """原始数据模型（MongoDB）"""

    def __init__(
        self,
        url: str,
        html: str,
        metadata: dict,
        crawled_at: datetime = None,
    ):
        self.url = url
        self.html = html
        self.metadata = metadata
        self.crawled_at = crawled_at or datetime.now()

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            'url': self.url,
            'html': self.html,
            'metadata': self.metadata,
            'crawled_at': self.crawled_at,
        }


# Elasticsearch模型
class CompanyDocument:
    """企业搜索文档"""

    def __init__(
        self,
        id: int,
        name: str,
        business_scope: str,
        industry: str,
        tags: List[str],
    ):
        self.id = id
        self.name = name
        self.business_scope = business_scope
        self.industry = industry
        self.tags = tags

    def to_dict(self) -> dict:
        """转换为Elasticsearch文档"""
        return {
            'id': self.id,
            'name': self.name,
            'business_scope': self.business_scope,
            'industry': self.industry,
            'tags': self.tags,
            'suggest': self._generate_suggestions(),
        }

    def _generate_suggestions(self) -> List[str]:
        """生成搜索建议"""
        return [
            self.name,
            self.industry,
        ]


# 枚举类型
class BusinessStatus(str, Enum):
    """经营状态"""
    ACTIVE = "在业"
    SUSPENDED = "吊销"
    REVOKED = "注销"
    LIQUIDATION = "清算"
    MERGED = "合并"
    NORMAL = "正常"


class InteractionType(str, Enum):
    """互动类型"""
    CALL = "call"
    EMAIL = "email"
    MEETING = "meeting"
    SOCIAL = "social"
    VISIT = "visit"


class InterestLevel(int, Enum):
    """意向度"""
    VERY_LOW = 1
    LOW = 2
    MEDIUM = 3
    HIGH = 4
    VERY_HIGH = 5


# 导出所有模型
__all__ = [
    # SQLAlchemy模型
    'Base',
    'Company',
    'Contact',
    'Interaction',
    'FinancialRecord',

    # Pydantic模型
    'CompanyBase',
    'CompanyCreate',
    'CompanyUpdate',
    'CompanyResponse',
    'ContactBase',
    'ContactCreate',
    'ContactResponse',

    # 其他模型
    'RawData',
    'CompanyDocument',

    # 枚举
    'BusinessStatus',
    'InteractionType',
    'InterestLevel',
]
