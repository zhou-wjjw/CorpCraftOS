"""
AICRM System - Database Models & CRM Data Management
数据库模型和CRM数据管理系统
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey,
    JSON, Index, UniqueConstraint, create_engine
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker, Session
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pydantic import BaseModel, Field, EmailStr, validator
from uuid import uuid4
import json

Base = declarative_base()


# ================== SQLAlchemy Models ==================

class CustomerStatus(str, Enum):
    """客户状态"""
    LEAD = "lead"  # 潜在客户
    PROSPECT = "prospect"  # 意向客户
    ACTIVE = "active"  # 活跃客户
    INACTIVE = "inactive"  # 非活跃客户
    CHURNED = "churned"  # 流失客户


class Priority(str, Enum):
    """优先级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Customer(Base):
    """客户表"""
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    external_id = Column(String(100), unique=True, nullable=True)  # 外部系统ID

    # 基本信息
    name = Column(String(200), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)
    phone = Column(String(50), nullable=True, index=True)
    wechat = Column(String(100), nullable=True)

    # 公司信息
    company = Column(String(200), nullable=True)
    company_size = Column(String(50), nullable=True)  # small, medium, large, enterprise
    industry = Column(String(100), nullable=True)
    title = Column(String(100), nullable=True)  # 职位

    # 客户状态
    status = Column(String(20), default=CustomerStatus.LEAD, index=True)
    priority = Column(String(20), default=Priority.MEDIUM)
    source = Column(String(100), nullable=True)  # 客户来源：website, referral, advertising等
    tags = Column(JSONB, default=list)  # 标签列表

    # 分析数据
    sentiment_score = Column(Float, default=0.0)  # 情感评分
    engagement_score = Column(Float, default=0.0)  # 参与度评分
    cluster_id = Column(Integer, nullable=True)  # 聚类ID（来自客户细分）

    # 元数据
    custom_fields = Column(JSONB, default=dict)  # 自定义字段
    metadata = Column(JSONB, default=dict)  # 额外元数据

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    first_contact_at = Column(DateTime, nullable=True)
    last_contact_at = Column(DateTime, nullable=True)

    # 关系
    interactions = relationship("Interaction", back_populates="customer", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="customer", cascade="all, delete-orphan")
    deals = relationship("Deal", back_populates="customer", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Customer(id={self.id}, name='{self.name}', status={self.status})>"


class InteractionType(str, Enum):
    """交互类型"""
    EMAIL = "email"
    PHONE_CALL = "phone_call"
    MEETING = "meeting"
    CHAT = "chat"
    WEBSITE_VISIT = "website_visit"
    FORM_SUBMISSION = "form_submission"
    SOCIAL_MEDIA = "social_media"
    OTHER = "other"


class Interaction(Base):
    """客户交互记录表"""
    __tablename__ = "interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)

    # 交互信息
    interaction_type = Column(String(50), nullable=False, index=True)
    direction = Column(String(20), nullable=True)  # inbound, outbound
    subject = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)  # AI生成的摘要

    # 情感分析
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral
    sentiment_score = Column(Float, nullable=True)

    # 元数据
    metadata = Column(JSONB, default=dict)  # 存储附加信息
    attachments = Column(JSONB, default=list)  # 附件列表

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    interaction_date = Column(DateTime, nullable=True)

    # 关系
    customer = relationship("Customer", back_populates="interactions")

    def __repr__(self):
        return f"<Interaction(id={self.id}, type={self.interaction_type}, customer_id={self.customer_id})>"


class DealStage(str, Enum):
    """交易阶段"""
    PROSPECTING = "prospecting"
    QUALIFICATION = "qualification"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    CLOSED_WON = "closed_won"
    CLOSED_LOST = "closed_lost"


class Deal(Base):
    """交易/商机表"""
    __tablename__ = "deals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False, index=True)
    external_id = Column(String(100), unique=True, nullable=True)

    # 交易信息
    name = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    amount = Column(Float, nullable=True)  # 交易金额
    currency = Column(String(10), default="CNY")

    # 阶段和概率
    stage = Column(String(50), default=DealStage.PROSPECTING, index=True)
    probability = Column(Integer, default=0)  # 成交概率 0-100

    # 时间
    expected_close_date = Column(DateTime, nullable=True)
    actual_close_date = Column(DateTime, nullable=True)

    # 元数据
    lost_reason = Column(String(500), nullable=True)
    tags = Column(JSONB, default=list)
    custom_fields = Column(JSONB, default=dict)

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    customer = relationship("Customer", back_populates="deals")

    def __repr__(self):
        return f"<Deal(id={self.id}, name='{self.name}', stage={self.stage}, amount={self.amount})>"


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=True, index=True)
    deal_id = Column(UUID(as_uuid=True), nullable=True)  # 可以关联到交易

    # 任务信息
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    task_type = Column(String(50), nullable=True)  # call, email, meeting, follow_up等

    # 状态
    status = Column(String(20), default=TaskStatus.PENDING, index=True)
    priority = Column(String(20), default=Priority.MEDIUM)

    # 时间
    due_date = Column(DateTime, nullable=True, index=True)
    completed_at = Column(DateTime, nullable=True)

    # 分配
    assigned_to = Column(String(200), nullable=True)  # 负责人

    # 元数据
    metadata = Column(JSONB, default=dict)

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关系
    customer = relationship("Customer", back_populates="tasks")

    def __repr__(self):
        return f"<Task(id={self.id}, title='{self.title}', status={self.status})>"


class ScrapingJob(Base):
    """爬取任务表"""
    __tablename__ = "scraping_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # 任务信息
    name = Column(String(500), nullable=False)
    target_url = Column(Text, nullable=False)
    scraping_type = Column(String(50), nullable=False)  # http, selenium, playwright

    # 配置
    config = Column(JSONB, default=dict)  # 爬取配置

    # 状态
    status = Column(String(20), default="pending", index=True)  # pending, running, completed, failed
    progress = Column(Float, default=0.0)  # 进度 0-100

    # 结果
    total_items = Column(Integer, default=0)
    success_items = Column(Integer, default=0)
    failed_items = Column(Integer, default=0)

    # 数据
    results = Column(JSONB, default=list)  # 爬取结果
    error_message = Column(Text, nullable=True)

    # 时间戳
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<ScrapingJob(id={self.id}, name='{self.name}', status={self.status})>"


# ================== Pydantic Schemas ==================

class CustomerBase(BaseModel):
    """客户基础模型"""
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    wechat: Optional[str] = None
    company: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    title: Optional[str] = None
    status: CustomerStatus = CustomerStatus.LEAD
    priority: Priority = Priority.MEDIUM
    source: Optional[str] = None
    tags: List[str] = []

    @validator('phone')
    def validate_phone(cls, v):
        if v and len(v) > 50:
            raise ValueError('Phone number too long')
        return v


class CustomerCreate(CustomerBase):
    """创建客户请求模型"""
    pass


class CustomerUpdate(BaseModel):
    """更新客户请求模型"""
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    wechat: Optional[str] = None
    company: Optional[str] = None
    company_size: Optional[str] = None
    industry: Optional[str] = None
    title: Optional[str] = None
    status: Optional[CustomerStatus] = None
    priority: Optional[Priority] = None
    source: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    sentiment_score: Optional[float] = None
    engagement_score: Optional[float] = None


class CustomerResponse(CustomerBase):
    """客户响应模型"""
    id: str
    sentiment_score: float
    engagement_score: float
    cluster_id: Optional[int] = None
    custom_fields: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime
    first_contact_at: Optional[datetime] = None
    last_contact_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InteractionBase(BaseModel):
    """交互基础模型"""
    interaction_type: InteractionType
    direction: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None
    summary: Optional[str] = None
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None


class InteractionCreate(InteractionBase):
    """创建交互请求模型"""
    customer_id: str
    interaction_date: Optional[datetime] = None


class InteractionResponse(InteractionBase):
    """交互响应模型"""
    id: str
    customer_id: str
    created_at: datetime
    interaction_date: Optional[datetime] = None

    class Config:
        from_attributes = True


class DealBase(BaseModel):
    """交易基础模型"""
    name: str
    description: Optional[str] = None
    amount: Optional[float] = None
    currency: str = "CNY"
    stage: DealStage = DealStage.PROSPECTING
    probability: int = Field(default=0, ge=0, le=100)
    expected_close_date: Optional[datetime] = None


class DealCreate(DealBase):
    """创建交易请求模型"""
    customer_id: str


class DealUpdate(BaseModel):
    """更新交易请求模型"""
    name: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    stage: Optional[DealStage] = None
    probability: Optional[int] = None
    expected_close_date: Optional[datetime] = None
    actual_close_date: Optional[datetime] = None
    lost_reason: Optional[str] = None


class DealResponse(DealBase):
    """交易响应模型"""
    id: str
    customer_id: str
    actual_close_date: Optional[datetime] = None
    lost_reason: Optional[str] = None
    tags: List[str] = []
    custom_fields: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskBase(BaseModel):
    """任务基础模型"""
    title: str
    description: Optional[str] = None
    task_type: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: Priority = Priority.MEDIUM
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None


class TaskCreate(TaskBase):
    """创建任务请求模型"""
    customer_id: Optional[str] = None


class TaskUpdate(BaseModel):
    """更新任务请求模型"""
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None
    assigned_to: Optional[str] = None


class TaskResponse(TaskBase):
    """任务响应模型"""
    id: str
    customer_id: Optional[str] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ScrapingJobCreate(BaseModel):
    """创建爬取任务请求模型"""
    name: str
    target_url: str
    scraping_type: str = "http"
    config: Dict[str, Any] = {}


class ScrapingJobResponse(BaseModel):
    """爬取任务响应模型"""
    id: str
    name: str
    target_url: str
    scraping_type: str
    status: str
    progress: float
    total_items: int
    success_items: int
    failed_items: int
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ================== Database Manager ==================

class DatabaseManager:
    """数据库管理器"""

    def __init__(self, database_url: str):
        self.engine = create_engine(database_url)
        self.SessionLocal = sessionmaker(bind=self.engine, autocommit=False, autoflush=False)

    def create_tables(self):
        """创建所有表"""
        Base.metadata.create_all(self.engine)

    def drop_tables(self):
        """删除所有表"""
        Base.metadata.drop_all(self.engine)

    def get_session(self) -> Session:
        """获取数据库会话"""
        return self.SessionLocal()

    def init_db(self):
        """初始化数据库"""
        self.create_tables()

    def close(self):
        """关闭数据库连接"""
        self.engine.dispose()
