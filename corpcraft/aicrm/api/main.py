"""
AICRM FastAPI 主应用
提供RESTful API接口
"""
from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import List, Optional
from datetime import datetime
from loguru import logger

from config.settings import settings
from storage.database import get_db_manager, get_db
from storage.models import (
    Company, CompanyCreate, CompanyUpdate, CompanyResponse,
    Contact, ContactCreate, ContactResponse,
    Interaction,
)

# 创建FastAPI应用
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI驱动的智能CRM系统",
)

# CORS中间件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 启动事件
@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    logger.info("AICRM API服务启动中...")

    # 初始化数据库
    db = get_db_manager()
    db.init_db()

    # 初始化异步数据库
    from storage.database import init_async_databases
    await init_async_databases()

    logger.info("AICRM API服务启动完成")


# 关闭事件
@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    logger.info("AICRM API服务关闭中...")

    db = get_db_manager()
    await db.close()

    logger.info("AICRM API服务已关闭")


# 根路由
@app.get("/")
async def root():
    """根路由"""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "timestamp": datetime.now().isoformat(),
    }


# 健康检查
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "healthy"}


# ==================== 企业相关接口 ====================

@app.post("/api/v1/companies", response_model=CompanyResponse)
async def create_company(company: CompanyCreate):
    """创建企业"""
    db = get_db_manager()
    try:
        db_company = db.create_company(company)
        return CompanyResponse.from_orm(db_company)
    except Exception as e:
        logger.error(f"创建企业失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/companies/{company_id}", response_model=CompanyResponse)
async def get_company(company_id: int):
    """获取企业详情"""
    db = get_db_manager()
    db_company = db.get_company(company_id)
    if not db_company:
        raise HTTPException(status_code=404, detail="企业不存在")
    return CompanyResponse.from_orm(db_company)


@app.put("/api/v1/companies/{company_id}", response_model=CompanyResponse)
async def update_company(company_id: int, company: CompanyUpdate):
    """更新企业信息"""
    db = get_db_manager()
    db_company = db.update_company(company_id, company)
    if not db_company:
        raise HTTPException(status_code=404, detail="企业不存在")
    return CompanyResponse.from_orm(db_company)


@app.delete("/api/v1/companies/{company_id}")
async def delete_company(company_id: int):
    """删除企业"""
    db = get_db_manager()
    success = db.delete_company(company_id)
    if not success:
        raise HTTPException(status_code=404, detail="企业不存在")
    return {"message": "删除成功"}


@app.get("/api/v1/companies", response_model=List[CompanyResponse])
async def search_companies(
    keyword: Optional[str] = None,
    industry: Optional[str] = None,
    province: Optional[str] = None,
    city: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """搜索企业"""
    db = get_db_manager()
    companies = db.search_companies(
        keyword=keyword,
        industry=industry,
        province=province,
        city=city,
        skip=skip,
        limit=limit,
    )
    return [CompanyResponse.from_orm(c) for c in companies]


@app.get("/api/v1/companies/stats/overview")
async def get_company_stats():
    """获取企业统计概览"""
    db = get_db_manager()
    stats = db.get_company_stats()
    return stats


@app.get("/api/v1/companies/recent", response_model=List[CompanyResponse])
async def get_recent_companies(
    days: int = Query(7, ge=1, le=365),
    limit: int = Query(20, ge=1, le=100),
):
    """获取最近添加的企业"""
    db = get_db_manager()
    companies = db.get_recent_companies(days=days, limit=limit)
    return [CompanyResponse.from_orm(c) for c in companies]


# ==================== 联系人相关接口 ====================

@app.post("/api/v1/contacts", response_model=ContactResponse)
async def create_contact(contact: ContactCreate):
    """创建联系人"""
    db = get_db_manager()
    try:
        db_contact = db.create_contact(contact)
        return ContactResponse.from_orm(db_contact)
    except Exception as e:
        logger.error(f"创建联系人失败: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/companies/{company_id}/contacts", response_model=List[ContactResponse])
async def get_company_contacts(company_id: int):
    """获取企业联系人列表"""
    db = get_db_manager()
    contacts = db.get_contacts_by_company(company_id)
    return [ContactResponse.from_orm(c) for c in contacts]


# ==================== 分析相关接口 ====================

@app.post("/api/v1/analytics/company-profile/{company_id}")
async def build_company_profile(company_id: int):
    """构建企业画像"""
    from analyzers.company_profile import build_company_profile

    db = get_db_manager()
    company = db.get_company(company_id)

    if not company:
        raise HTTPException(status_code=404, detail="企业不存在")

    # 转换为字典
    company_dict = {
        'id': company.id,
        'name': company.name,
        'industry': company.industry,
        'business_status': company.business_status,
        'registered_capital': company.registered_capital,
        'paid_in_capital': company.paid_in_capital,
        'employee_count': company.employee_count,
        'annual_revenue': company.annual_revenue,
        'tax_rating': company.tax_rating,
        'establishment_date': company.establishment_date,
        'province': company.province,
        'city': company.city,
    }

    profile = build_company_profile(company_dict)
    return profile.to_dict()


@app.post("/api/v1/analytics/intent-score/{company_id}")
async def calculate_intent_score(company_id: int):
    """计算客户意向评分"""
    from analyzers.intent_score import calculate_intent_score

    db = get_db_manager()
    company = db.get_company(company_id)

    if not company:
        raise HTTPException(status_code=404, detail="企业不存在")

    # 获取互动记录
    with db.get_session() as session:
        interactions = session.query(Interaction).filter(
            Interaction.company_id == company_id
        ).all()
        interactions_list = [
            {
                'interaction_type': i.interaction_type,
                'interaction_date': i.interaction_date.isoformat(),
                'interest_level': i.interest_level or 0,
            }
            for i in interactions
        ]

    # 转换为字典
    company_dict = {
        'id': company.id,
        'name': company.name,
        'business_scope': company.business_scope,
        'website': company.website,
    }

    score = calculate_intent_score(company_dict, interactions_list)
    return score.to_dict()


# ==================== 爬虫相关接口 ====================

@app.post("/api/v1/crawler/start")
async def start_crawler(
    spider_name: str,
    background_tasks: BackgroundTasks,
):
    """启动爬虫任务"""
    # 这里可以集成Celery任务
    background_tasks.add_task(run_crawler_task, spider_name)
    return {"message": f"爬虫 {spider_name} 已启动"}


async def run_crawler_task(spider_name: str):
    """执行爬虫任务（后台任务）"""
    from scrapy.crawler import CrawlerProcess
    from spiders.base import BaseSpider

    # 这里需要根据spider_name导入对应的爬虫类
    # 示例代码，实际需要调整
    logger.info(f"启动爬虫: {spider_name}")

    # process = CrawlerProcess()
    # process.crawl(spider_name)
    # process.start()


# ==================== 全局异常处理 ====================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """全局异常处理"""
    logger.error(f"未处理的异常: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "服务器内部错误"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "api.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG,
    )
