# AICRM System - AI驱动的客户关系管理系统

一个功能完整的AICRM系统，集成了网络爬虫、反爬虫对抗、验证码识别、AI数据分析等先进功能。

## 🌟 核心功能

### 1. 数据爬取模块
- **多种爬取策略**: HTTP请求、Selenium、Playwright
- **智能策略选择**: 根据目标网站自动选择最佳爬取方式
- **并发爬取**: 支持批量URL并发爬取
- **数据提取**: 支持CSS选择器提取结构化数据
- **动态内容**: 支持JavaScript渲染页面

### 2. 反爬虫对策
- **代理池管理**
  - 自动获取和验证代理
  - 代理轮换和健康检查
  - 支持HTTP/HTTPS/SOCKS5代理
  - 代理质量评分系统

- **请求头伪装**
  - 随机User-Agent生成
  - 完整的浏览器请求头模拟
  - Cookie和Session管理

- **浏览器指纹对抗**
  - Canvas指纹随机化
  - WebGL指纹随机化
  - 时区和语言随机化
  - 窗口大小随机化

- **速率限制**
  - 智能请求速率控制
  - 自适应延迟
  - 突发流量处理

### 3. 验证码识别
- **本地OCR识别**
  - Tesseract OCR引擎
  - DDDDOCR深度学习识别
  - 图像预处理和增强

- **第三方API集成**
  - 2captcha
  - Anti-Captcha
  - DeathByCaptcha

- **支持的验证码类型**
  - 文本图片验证码
  - reCAPTCHA v2/v3
  - hCaptcha
  - 滑块验证码
  - 点击验证码

### 4. AI数据分析
- **情感分析**: 分析客户交互情感倾向
- **实体识别**: 自动提取邮箱、电话、微信等联系信息
- **客户细分**: 基于行为和特征的K-means聚类
- **关键词提取**: 从文本中提取关键信息
- **预测分析**: 客户流失预测、成交概率预测

### 5. CRM数据管理
- **客户管理**: 完整的客户信息管理
- **交互记录**: 跟踪所有客户交互
- **交易管理**: 销售机会和交易流程管理
- **任务管理**: 任务创建、分配和跟踪
- **数据可视化**: 直观的仪表板和图表

## 🏗️ 技术架构

### 后端技术栈
```
- FastAPI: 高性能异步Web框架
- SQLAlchemy: ORM和数据库管理
- PostgreSQL: 主数据库
- MongoDB: 文档存储
- Redis: 缓存和消息队列
- Celery: 异步任务处理
```

### 爬虫技术栈
```
- Scrapy: 分布式爬虫框架
- Selenium: 浏览器自动化
- Playwright: 现代浏览器自动化
- BeautifulSoup: HTML解析
- aiohttp/httpx: 异步HTTP客户端
```

### AI/ML技术栈
```
- OpenAI API: GPT-4模型
- Anthropic API: Claude模型
- scikit-learn: 机器学习
- Pandas: 数据处理
- NumPy: 数值计算
```

### 前端技术栈
```
- React 18: UI框架
- TypeScript: 类型安全
- Ant Design: UI组件库
- ECharts: 数据可视化
- React Router: 路由管理
- TanStack Query: 数据获取
```

## 📦 安装部署

### 1. 克隆项目
```bash
git clone <repository-url>
cd aicrm_system
```

### 2. 后端安装

#### 安装Python依赖
```bash
cd backend
pip install -r requirements.txt
```

#### 配置环境变量
创建 `.env` 文件：
```bash
# 数据库配置
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=aicrm_db
POSTGRES_USER=aicrm_user
POSTGRES_PASSWORD=your_password

# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379

# AI服务配置
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# 验证码服务配置（可选）
2CAPTCHA_API_KEY=your_2captcha_key
```

#### 初始化数据库
```bash
python -c "from app.models.database import DatabaseManager; from app.core.config import settings; db = DatabaseManager(settings.database_url); db.init_db()"
```

#### 启动后端服务
```bash
cd backend/app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 前端安装

#### 安装Node.js依赖
```bash
cd frontend
npm install
```

#### 启动开发服务器
```bash
npm start
```

前端将在 http://localhost:3000 启动

### 4. Docker部署 (可选)

#### 使用Docker Compose
```bash
docker-compose up -d
```

## 🚀 使用指南

### 1. 数据爬取

#### 单URL爬取
```python
from app.services.scraper import WebScraper, ScrapingStrategy

scraper = await WebScraper.create_scraper(
    strategy="http",
    proxy_list=["http://proxy1:port", "http://proxy2:port"],
    rate_limit=2.0
)

result = await scraper.scrape(
    url="https://example.com",
    wait_for_selector=".content"
)

if result.success:
    print(result.data['html'])
```

#### 批量爬取
```python
urls = ["https://example1.com", "https://example2.com", "https://example3.com"]
results = await scraper.scrape_multiple(urls, concurrency=5)
```

### 2. 验证码解决

```python
from app.services.captcha_solver import CaptchaSolver, CaptchaType
from PIL import Image

solver = CaptchaSolver(config={
    "ocr_enabled": True,
    "ddddocr_enabled": True
})

# 解决图片验证码
image = Image.open("captcha.png")
result = await solver.solve(image=image, captcha_type=CaptchaType.TEXT_IMAGE)

if result.success:
    print(f"验证码答案: {result.answer}")
```

### 3. AI数据分析

```python
from app.services.analytics import DataAnalyzer, AnalysisType

analyzer = DataAnalyzer(config={
    "openai_api_key": "your_api_key"
})

# 情感分析
result = await analyzer.analyze_sentiment("客户对产品非常满意")
print(result.data)  # {"sentiment": "positive", "score": 0.8}

# 实体提取
result = await analyzer.extract_entities("请联系张三，电话13800138000")
print(result.data)  # {"phones": ["13800138000"], "people": ["张三"]}

# 客户细分
import pandas as pd
df = pd.read_csv("customers.csv")
result = await analyzer.segment_customers(df, n_clusters=5)
print(result.data)
```

### 4. CRM操作

#### 创建客户
```bash
curl -X POST http://localhost:8000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "email": "zhangsan@example.com",
    "phone": "13800138000",
    "company": "ABC公司",
    "status": "lead"
  }'
```

#### 创建交互记录
```bash
curl -X POST http://localhost:8000/api/interactions \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "uuid",
    "interaction_type": "email",
    "subject": "产品介绍",
    "content": "您好，这是我们的产品介绍..."
  }'
```

#### 分析客户
```bash
curl -X POST http://localhost:8000/api/customers/{customer_id}/analyze
```

## 📊 API文档

启动后端后，访问以下地址查看完整API文档：

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

主要API端点：

```
GET    /api/customers           # 获取客户列表
POST   /api/customers           # 创建客户
GET    /api/customers/{id}      # 获取客户详情
PUT    /api/customers/{id}      # 更新客户
DELETE /api/customers/{id}      # 删除客户

GET    /api/interactions        # 获取交互记录
POST   /api/interactions        # 创建交互记录

GET    /api/deals               # 获取交易列表
POST   /api/deals               # 创建交易

GET    /api/tasks               # 获取任务列表
POST   /api/tasks               # 创建任务

POST   /api/scrape              # 爬取网页
POST   /api/captcha/solve       # 解决验证码
POST   /api/analyze/sentiment   # 情感分析
GET    /api/dashboard/stats     # 仪表板统计
```

## 🔧 配置说明

主配置文件：`config/settings.yaml`

```yaml
scraping:
  timeout: 30
  max_retries: 3
  concurrent_requests: 16
  download_delay: 0.5

  proxy:
    enabled: true
    pool_size: 100
    rotation_interval: 300

  rate_limit:
    enabled: true
    requests_per_second: 2

captcha:
  ocr:
    enabled: true
    engine: "tesseract"

ai_services:
  openai:
    enabled: true
    model: "gpt-4-turbo-preview"

anti_detection:
  headers:
    random: true
  fingerprint:
    random_canvas: true
    random_webgl: true
```

## 🛡️ 安全说明

1. **API密钥管理**: 永远不要在代码中硬编码API密钥
2. **代理使用**: 使用代理时请确保遵守当地法律法规
3. **数据隐私**: 爬取数据时遵守robots.txt和隐私政策
4. **速率限制**: 设置合理的请求速率，避免对目标网站造成压力

## 📝 开发指南

### 添加新的爬虫策略
1. 继承 `WebScraper` 类
2. 实现 `_scrape_xxx` 方法
3. 添加到 `ScrapingStrategy` 枚举

### 添加新的验证码解决器
1. 继承 `APICaptchaSolver` 或实现自定义解决器
2. 在 `CaptchaSolver` 中注册
3. 添加相应的配置选项

### 添加新的AI分析功能
1. 在 `AnalysisType` 中添加新类型
2. 在 `DataAnalyzer` 中实现分析方法
3. 添加对应的API端点

## 🧪 测试

```bash
# 后端测试
cd backend
pytest tests/

# 前端测试
cd frontend
npm test
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📧 联系方式

- 项目地址: [GitHub Repository]
- 文档: [Documentation Site]
- 邮箱: support@aicrm.example.com

## 🙏 致谢

感谢所有开源项目的贡献者！
