"""
AICRM System - FastAPI Main Application
主应用入口和API路由
"""
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uvicorn
from contextlib import asynccontextmanager
from loguru import logger

from .core.config import settings
from .models.database import DatabaseManager, get_db
from .services.crm import CRMService
from .services.analytics import DataAnalyzer
from .services.scraper import WebScraper, ScrapingStrategy
from .services.captcha_solver import CaptchaSolver, CaptchaType
from .services.anti_detection import AntiDetectionManager
from .models.database import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    InteractionCreate, InteractionResponse,
    DealCreate, DealUpdate, DealResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    ScrapingJobCreate, ScrapingJobResponse
)


# 初始化数据库管理器
db_manager = DatabaseManager(settings.database_url)

# 初始化AI分析器
analyzer = DataAnalyzer(config={
    "openai_api_key": settings.OPENAI_API_KEY,
    "anthropic_api_key": settings.ANTHROPIC_API_KEY
})

# 初始化反检测管理器
anti_detection = AntiDetectionManager()

# 全局爬虫实例（懒加载）
scraper = None
captcha_solver = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("Starting AICRM System...")

    # 初始化数据库
    try:
        db_manager.init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")

    # 初始化反检测系统
    try:
        await anti_detection.initialize()
        logger.info("Anti-detection system initialized")
    except Exception as e:
        logger.warning(f"Failed to initialize anti-detection: {str(e)}")

    yield

    # 关闭时
    logger.info("Shutting down AICRM System...")
    await anti_detection.shutdown()
    db_manager.close()


# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI-powered CRM system with web scraping, anti-detection, and advanced analytics",
    lifespan=lifespan
)

# CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================== Health Check ==================

@app.get("/health")
async def health_check():
    """健康检查端点"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.APP_VERSION
    }


# ================== Customer Endpoints ==================

@app.post("/api/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
async def create_customer(
    customer_data: CustomerCreate,
    db: Session = Depends(get_db)
):
    """创建新客户"""
    crm_service = CRMService(db, analyzer)
    try:
        return crm_service.create_customer(customer_data)
    except Exception as e:
        logger.error(f"Error creating customer: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, db: Session = Depends(get_db)):
    """获取单个客户"""
    crm_service = CRMService(db, analyzer)
    customer = crm_service.get_customer(customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer


@app.get("/api/customers", response_model=List[CustomerResponse])
async def get_customers(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取客户列表"""
    crm_service = CRMService(db, analyzer)

    from .models.database import CustomerStatus
    customer_status = CustomerStatus(status) if status else None

    return crm_service.get_customers(
        skip=skip,
        limit=limit,
        status=customer_status,
        search=search
    )


@app.put("/api/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: str,
    customer_data: CustomerUpdate,
    db: Session = Depends(get_db)
):
    """更新客户信息"""
    crm_service = CRMService(db, analyzer)
    customer = crm_service.update_customer(customer_id, customer_data)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return customer


@app.delete("/api/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    """删除客户"""
    crm_service = CRMService(db, analyzer)
    if not crm_service.delete_customer(customer_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )


@app.post("/api/customers/{customer_id}/analyze")
async def analyze_customer(customer_id: str, db: Session = Depends(get_db)):
    """分析客户数据"""
    crm_service = CRMService(db, analyzer)
    result = await crm_service.analyze_customer(customer_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Customer not found"
        )
    return result


# ================== Interaction Endpoints ==================

@app.post("/api/interactions", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_interaction(
    interaction_data: InteractionCreate,
    db: Session = Depends(get_db)
):
    """创建新交互记录"""
    crm_service = CRMService(db, analyzer)
    try:
        return crm_service.create_interaction(interaction_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/interactions", response_model=List[InteractionResponse])
async def get_interactions(
    customer_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取交互记录列表"""
    crm_service = CRMService(db, analyzer)
    return crm_service.get_interactions(customer_id=customer_id, skip=skip, limit=limit)


# ================== Deal Endpoints ==================

@app.post("/api/deals", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    deal_data: DealCreate,
    db: Session = Depends(get_db)
):
    """创建新交易"""
    crm_service = CRMService(db, analyzer)
    try:
        return crm_service.create_deal(deal_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/deals", response_model=List[DealResponse])
async def get_deals(
    customer_id: Optional[str] = None,
    stage: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取交易列表"""
    crm_service = CRMService(db, analyzer)

    from .models.database import DealStage
    deal_stage = DealStage(stage) if stage else None

    return crm_service.get_deals(customer_id=customer_id, stage=deal_stage, skip=skip, limit=limit)


@app.put("/api/deals/{deal_id}", response_model=DealResponse)
async def update_deal(
    deal_id: str,
    deal_data: DealUpdate,
    db: Session = Depends(get_db)
):
    """更新交易"""
    crm_service = CRMService(db, analyzer)
    deal = crm_service.update_deal(deal_id, deal_data)
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Deal not found"
        )
    return deal


# ================== Task Endpoints ==================

@app.post("/api/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db)
):
    """创建新任务"""
    crm_service = CRMService(db, analyzer)
    try:
        return crm_service.create_task(task_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """获取任务列表"""
    crm_service = CRMService(db, analyzer)

    from .models.database import TaskStatus
    task_status = TaskStatus(status) if status else None

    return crm_service.get_tasks(customer_id=customer_id, status=task_status, skip=skip, limit=limit)


@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_data: TaskUpdate,
    db: Session = Depends(get_db)
):
    """更新任务"""
    crm_service = CRMService(db, analyzer)
    task = crm_service.update_task(task_id, task_data)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found"
        )
    return task


@app.get("/api/tasks/overdue", response_model=List[TaskResponse])
async def get_overdue_tasks(db: Session = Depends(get_db)):
    """获取逾期任务"""
    crm_service = CRMService(db, analyzer)
    return crm_service.get_overdue_tasks()


# ================== Scraping Endpoints ==================

@app.post("/api/scrape")
async def scrape_url(
    url: str,
    strategy: str = "http",
    wait_for_selector: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """爬取网页"""
    global scraper

    if not scraper:
        scraper = await WebScraper.create_scraper(
            strategy=strategy,
            proxy_list=[],  # 可以从配置加载
            rate_limit=settings.RATE_LIMIT_PER_SECOND
        )

    try:
        result = await scraper.scrape(
            url=url,
            wait_for_selector=wait_for_selector
        )

        if result.success:
            return {
                "success": True,
                "url": result.url,
                "data": str(result.data.get("html", ""))[:1000],  # 返回前1000字符
                "strategy_used": result.strategy_used.value if result.strategy_used else None
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.error
            )

    except Exception as e:
        logger.error(f"Scraping error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@app.post("/api/scrape/batch")
async def scrape_multiple_urls(
    urls: List[str],
    strategy: str = "http",
    concurrency: int = 5,
    background_tasks: BackgroundTasks = None
):
    """批量爬取多个URL（后台任务）"""
    async def run_batch_scraping():
        global scraper

        if not scraper:
            scraper = await WebScraper.create_scraper(
                strategy=strategy,
                proxy_list=[]
            )

        results = await scraper.scrape_multiple(urls, concurrency=concurrency)
        # 这里可以保存结果到数据库或文件
        return results

    if background_tasks:
        background_tasks.add_task(run_batch_scraping)
        return {"message": "Batch scraping started in background"}
    else:
        results = await run_batch_scraping()
        return {"results": len(results), "data": results}


# ================== Captcha Solving Endpoints ==================

@app.post("/api/captcha/solve")
async def solve_captcha(
    image_url: Optional[str] = None,
    captcha_type: str = "text_image",
    site_key: Optional[str] = None,
    page_url: Optional[str] = None
):
    """解决验证码"""
    global captcha_solver

    if not captcha_solver:
        captcha_solver = CaptchaSolver(config={
            "ocr_enabled": True,
            "ddddocr_enabled": True
        })

    try:
        from .models.database import CaptchaType as CType
        from PIL import Image
        import httpx

        captcha_type_enum = CType(captcha_type)

        # 加载图片
        if image_url:
            async with httpx.AsyncClient() as client:
                response = await client.get(image_url)
                image = Image.open(httpx.ByteStream(response.content))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Image URL is required"
            )

        result = await captcha_solver.solve(
            image=image,
            captcha_type=captcha_type_enum,
            site_key=site_key,
            page_url=page_url
        )

        if result.success:
            return {
                "success": True,
                "answer": result.answer,
                "solver_used": result.solver_used.value if result.solver_used else None,
                "confidence": result.confidence,
                "solve_time": result.solve_time
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=result.error or "Failed to solve captcha"
            )

    except Exception as e:
        logger.error(f"Captcha solving error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ================== Analytics Endpoints ==================

@app.post("/api/analyze/sentiment")
async def analyze_sentiment(text: str):
    """情感分析"""
    result = await analyzer.analyze_sentiment(text)
    if result.success:
        return {
            "success": True,
            "data": result.data,
            "model_used": result.model_used,
            "confidence": result.confidence
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )


@app.post("/api/analyze/entities")
async def extract_entities(text: str):
    """实体提取"""
    result = await analyzer.extract_entities(text)
    if result.success:
        return {
            "success": True,
            "data": result.data,
            "model_used": result.model_used
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.error
        )


# ================== Dashboard Endpoints ==================

@app.get("/api/dashboard/stats")
async def get_dashboard_stats(db: Session = Depends(get_db)):
    """获取仪表板统计数据"""
    crm_service = CRMService(db, analyzer)
    return crm_service.get_dashboard_stats()


# ================== Root Endpoints ==================

@app.get("/")
async def root():
    """根路径"""
    return {
        "message": "Welcome to AICRM System API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/health"
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG
    )
