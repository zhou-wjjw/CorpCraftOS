"""
AICRM System - CRM Business Logic Service
CRM业务逻辑服务层
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from loguru import logger

from ..models.database import (
    Customer, Interaction, Deal, Task, ScrapingJob,
    CustomerStatus, DealStage, TaskStatus, Priority,
    CustomerCreate, CustomerUpdate, CustomerResponse,
    InteractionCreate, InteractionResponse,
    DealCreate, DealUpdate, DealResponse,
    TaskCreate, TaskUpdate, TaskResponse
)
from .analytics import DataAnalyzer, AnalysisType


class CRMService:
    """CRM服务类 - 处理所有CRM相关业务逻辑"""

    def __init__(self, db: Session, analyzer: DataAnalyzer = None):
        self.db = db
        self.analyzer = analyzer or DataAnalyzer()

    # ================== Customer Management ==================

    def create_customer(self, customer_data: CustomerCreate) -> CustomerResponse:
        """创建新客户"""
        try:
            customer = Customer(**customer_data.dict())
            customer.first_contact_at = datetime.utcnow()
            customer.last_contact_at = datetime.utcnow()

            self.db.add(customer)
            self.db.commit()
            self.db.refresh(customer)

            logger.info(f"Created customer: {customer.id} - {customer.name}")
            return self._customer_to_response(customer)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create customer: {str(e)}")
            raise

    def get_customer(self, customer_id: str) -> Optional[CustomerResponse]:
        """获取单个客户"""
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return None
        return self._customer_to_response(customer)

    def get_customers(
        self,
        skip: int = 0,
        limit: int = 100,
        status: Optional[CustomerStatus] = None,
        search: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[CustomerResponse]:
        """获取客户列表"""
        query = self.db.query(Customer)

        # 状态过滤
        if status:
            query = query.filter(Customer.status == status)

        # 搜索过滤
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    Customer.name.ilike(search_pattern),
                    Customer.email.ilike(search_pattern),
                    Customer.company.ilike(search_pattern),
                    Customer.phone.ilike(search_pattern)
                )
            )

        # 标签过滤
        if tags:
            for tag in tags:
                query = query.filter(Customer.tags.contains([tag]))

        # 分页和排序
        query = query.order_by(Customer.created_at.desc()).offset(skip).limit(limit)
        customers = query.all()

        return [self._customer_to_response(c) for c in customers]

    def update_customer(self, customer_id: str, customer_data: CustomerUpdate) -> Optional[CustomerResponse]:
        """更新客户信息"""
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return None

        try:
            update_data = customer_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(customer, field, value)

            customer.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(customer)

            logger.info(f"Updated customer: {customer_id}")
            return self._customer_to_response(customer)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update customer {customer_id}: {str(e)}")
            raise

    def delete_customer(self, customer_id: str) -> bool:
        """删除客户"""
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return False

        try:
            self.db.delete(customer)
            self.db.commit()
            logger.info(f"Deleted customer: {customer_id}")
            return True

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to delete customer {customer_id}: {str(e)}")
            raise

    async def analyze_customer(self, customer_id: str) -> Optional[Dict]:
        """分析客户数据（情感、参与度等）"""
        customer = self.db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            return None

        try:
            # 获取最近的所有交互
            interactions = self.db.query(Interaction).filter(
                Interaction.customer_id == customer_id
            ).order_by(Interaction.created_at.desc()).limit(50).all()

            if not interactions:
                return {"error": "No interactions to analyze"}

            # 分析所有交互内容
            sentiment_scores = []
            total_sentiment = 0

            for interaction in interactions:
                if interaction.content:
                    result = await self.analyzer.analyze_sentiment(interaction.content)
                    if result.success and result.data:
                        score = result.data.get('score', 0)
                        sentiment_scores.append(score)
                        total_sentiment += score

            # 计算平均情感分数
            avg_sentiment = total_sentiment / len(sentiment_scores) if sentiment_scores else 0

            # 计算参与度分数（基于交互频率和最近活动）
            now = datetime.utcnow()
            recent_interactions = [i for i in interactions if (now - i.created_at).days <= 30]
            engagement_score = min(100, len(recent_interactions) * 10)

            # 更新客户
            customer.sentiment_score = avg_sentiment
            customer.engagement_score = engagement_score
            customer.updated_at = now
            self.db.commit()

            return {
                "customer_id": customer_id,
                "sentiment_score": avg_sentiment,
                "engagement_score": engagement_score,
                "total_interactions_analyzed": len(interactions),
                "recent_interactions": len(recent_interactions)
            }

        except Exception as e:
            logger.error(f"Failed to analyze customer {customer_id}: {str(e)}")
            raise

    def _customer_to_response(self, customer: Customer) -> CustomerResponse:
        """将Customer模型转换为响应模型"""
        return CustomerResponse(
            id=str(customer.id),
            name=customer.name,
            email=customer.email,
            phone=customer.phone,
            wechat=customer.wechat,
            company=customer.company,
            company_size=customer.company_size,
            industry=customer.industry,
            title=customer.title,
            status=CustomerStatus(customer.status),
            priority=Priority(customer.priority),
            source=customer.source,
            tags=customer.tags or [],
            sentiment_score=customer.sentiment_score,
            engagement_score=customer.engagement_score,
            cluster_id=customer.cluster_id,
            custom_fields=customer.custom_fields or {},
            created_at=customer.created_at,
            updated_at=customer.updated_at,
            first_contact_at=customer.first_contact_at,
            last_contact_at=customer.last_contact_at
        )

    # ================== Interaction Management ==================

    def create_interaction(self, interaction_data: InteractionCreate) -> InteractionResponse:
        """创建新交互记录"""
        try:
            interaction = Interaction(**interaction_data.dict())
            if not interaction.interaction_date:
                interaction.interaction_date = datetime.utcnow()

            self.db.add(interaction)

            # 更新客户的最后联系时间
            customer = self.db.query(Customer).filter(Customer.id == interaction.customer_id).first()
            if customer:
                customer.last_contact_at = datetime.utcnow()

            self.db.commit()
            self.db.refresh(interaction)

            logger.info(f"Created interaction: {interaction.id} for customer {interaction.customer_id}")
            return self._interaction_to_response(interaction)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create interaction: {str(e)}")
            raise

    def get_interactions(
        self,
        customer_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[InteractionResponse]:
        """获取交互记录列表"""
        query = self.db.query(Interaction)

        if customer_id:
            query = query.filter(Interaction.customer_id == customer_id)

        interactions = query.order_by(
            Interaction.created_at.desc()
        ).offset(skip).limit(limit).all()

        return [self._interaction_to_response(i) for i in interactions]

    def _interaction_to_response(self, interaction: Interaction) -> InteractionResponse:
        """将Interaction模型转换为响应模型"""
        return InteractionResponse(
            id=str(interaction.id),
            customer_id=str(interaction.customer_id),
            interaction_type=interaction.interaction_type,
            direction=interaction.direction,
            subject=interaction.subject,
            content=interaction.content,
            summary=interaction.summary,
            sentiment=interaction.sentiment,
            sentiment_score=interaction.sentiment_score,
            created_at=interaction.created_at,
            interaction_date=interaction.interaction_date
        )

    # ================== Deal Management ==================

    def create_deal(self, deal_data: DealCreate) -> DealResponse:
        """创建新交易"""
        try:
            deal = Deal(**deal_data.dict())
            self.db.add(deal)
            self.db.commit()
            self.db.refresh(deal)

            logger.info(f"Created deal: {deal.id} - {deal.name}")
            return self._deal_to_response(deal)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create deal: {str(e)}")
            raise

    def get_deals(
        self,
        customer_id: Optional[str] = None,
        stage: Optional[DealStage] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[DealResponse]:
        """获取交易列表"""
        query = self.db.query(Deal)

        if customer_id:
            query = query.filter(Deal.customer_id == customer_id)

        if stage:
            query = query.filter(Deal.stage == stage)

        deals = query.order_by(Deal.created_at.desc()).offset(skip).limit(limit).all()

        return [self._deal_to_response(d) for d in deals]

    def update_deal(self, deal_id: str, deal_data: DealUpdate) -> Optional[DealResponse]:
        """更新交易"""
        deal = self.db.query(Deal).filter(Deal.id == deal_id).first()
        if not deal:
            return None

        try:
            update_data = deal_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(deal, field, value)

            # 如果阶段变为closed_won或closed_lost，设置实际关闭日期
            if deal.stage in [DealStage.CLOSED_WON, DealStage.CLOSED_LOST] and not deal.actual_close_date:
                deal.actual_close_date = datetime.utcnow()

            deal.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(deal)

            logger.info(f"Updated deal: {deal_id}")
            return self._deal_to_response(deal)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update deal {deal_id}: {str(e)}")
            raise

    def _deal_to_response(self, deal: Deal) -> DealResponse:
        """将Deal模型转换为响应模型"""
        return DealResponse(
            id=str(deal.id),
            customer_id=str(deal.customer_id),
            name=deal.name,
            description=deal.description,
            amount=deal.amount,
            currency=deal.currency,
            stage=DealStage(deal.stage),
            probability=deal.probability,
            expected_close_date=deal.expected_close_date,
            actual_close_date=deal.actual_close_date,
            lost_reason=deal.lost_reason,
            tags=deal.tags or [],
            custom_fields=deal.custom_fields or {},
            created_at=deal.created_at,
            updated_at=deal.updated_at
        )

    # ================== Task Management ==================

    def create_task(self, task_data: TaskCreate) -> TaskResponse:
        """创建新任务"""
        try:
            task = Task(**task_data.dict())
            self.db.add(task)
            self.db.commit()
            self.db.refresh(task)

            logger.info(f"Created task: {task.id} - {task.title}")
            return self._task_to_response(task)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to create task: {str(e)}")
            raise

    def get_tasks(
        self,
        customer_id: Optional[str] = None,
        status: Optional[TaskStatus] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[TaskResponse]:
        """获取任务列表"""
        query = self.db.query(Task)

        if customer_id:
            query = query.filter(Task.customer_id == customer_id)

        if status:
            query = query.filter(Task.status == status)

        tasks = query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()

        return [self._task_to_response(t) for t in tasks]

    def update_task(self, task_id: str, task_data: TaskUpdate) -> Optional[TaskResponse]:
        """更新任务"""
        task = self.db.query(Task).filter(Task.id == task_id).first()
        if not task:
            return None

        try:
            update_data = task_data.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(task, field, value)

            # 如果状态变为completed，设置完成时间
            if task.status == TaskStatus.COMPLETED and not task.completed_at:
                task.completed_at = datetime.utcnow()

            task.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(task)

            logger.info(f"Updated task: {task_id}")
            return self._task_to_response(task)

        except Exception as e:
            self.db.rollback()
            logger.error(f"Failed to update task {task_id}: {str(e)}")
            raise

    def get_overdue_tasks(self) -> List[TaskResponse]:
        """获取逾期任务"""
        now = datetime.utcnow()
        tasks = self.db.query(Task).filter(
            and_(
                Task.due_date < now,
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
            )
        ).all()

        return [self._task_to_response(t) for t in tasks]

    def _task_to_response(self, task: Task) -> TaskResponse:
        """将Task模型转换为响应模型"""
        return TaskResponse(
            id=str(task.id),
            customer_id=str(task.customer_id) if task.customer_id else None,
            title=task.title,
            description=task.description,
            task_type=task.task_type,
            status=TaskStatus(task.status),
            priority=Priority(task.priority),
            due_date=task.due_date,
            assigned_to=task.assigned_to,
            completed_at=task.completed_at,
            created_at=task.created_at,
            updated_at=task.updated_at
        )

    # ================== Dashboard & Analytics ==================

    def get_dashboard_stats(self) -> Dict[str, Any]:
        """获取仪表板统计数据"""
        total_customers = self.db.query(func.count(Customer.id)).scalar()
        total_deals = self.db.query(func.count(Deal.id)).scalar()
        total_tasks = self.db.query(func.count(Task.id)).scalar()

        # 按状态统计客户
        customers_by_status = self.db.query(
            Customer.status,
            func.count(Customer.id)
        ).group_by(Customer.status).all()

        # 按阶段统计交易
        deals_by_stage = self.db.query(
            Deal.stage,
            func.count(Deal.id),
            func.sum(Deal.amount)
        ).group_by(Deal.stage).all()

        # 最近30天的新客户
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        new_customers_30d = self.db.query(func.count(Customer.id)).filter(
            Customer.created_at >= thirty_days_ago
        ).scalar()

        # 总交易价值
        total_deal_value = self.db.query(func.sum(Deal.amount)).scalar() or 0

        # 逾期任务数
        overdue_tasks_count = len(self.get_overdue_tasks())

        return {
            "total_customers": total_customers,
            "total_deals": total_deals,
            "total_tasks": total_tasks,
            "new_customers_last_30_days": new_customers_30d,
            "total_deal_value": float(total_deal_value),
            "overdue_tasks": overdue_tasks_count,
            "customers_by_status": [
                {"status": status, "count": count}
                for status, count in customers_by_status
            ],
            "deals_by_stage": [
                {
                    "stage": stage,
                    "count": count,
                    "total_value": float(value) if value else 0
                }
                for stage, count, value in deals_by_stage
            ]
        }

    def get_customer_segments(self) -> List[Dict]:
        """获取客户细分数据"""
        segments = self.db.query(
            Customer.cluster_id,
            func.count(Customer.id).label('count')
        ).filter(Customer.cluster_id.isnot(None)).group_by(Customer.cluster_id).all()

        return [
            {"cluster_id": cluster_id, "count": count}
            for cluster_id, count in segments
        ]
