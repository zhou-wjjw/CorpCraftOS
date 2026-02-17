# AICRM System 项目结构

```
aicrm_system/
├── backend/                        # 后端服务
│   ├── app/
│   │   ├── api/                    # API路由模块
│   │   │   └── __init__.py
│   │   ├── core/                   # 核心配置
│   │   │   └── config.py           # 配置管理
│   │   ├── models/                 # 数据模型
│   │   │   └── database.py         # SQLAlchemy模型和Pydantic schemas
│   │   ├── services/               # 业务逻辑服务
│   │   │   ├── scraper.py          # 网页爬虫服务
│   │   │   ├── anti_detection.py   # 反爬虫检测系统
│   │   │   ├── captcha_solver.py   # 验证码解决器
│   │   │   ├── analytics.py        # AI数据分析
│   │   │   └── crm.py              # CRM业务逻辑
│   │   ├── utils/                  # 工具函数
│   │   │   └── __init__.py
│   │   ├── tests/                  # 测试用例
│   │   │   └── __init__.py
│   │   ├── __init__.py
│   │   └── main.py                 # FastAPI主应用
│   ├── requirements.txt            # Python依赖
│   └── Dockerfile                  # Docker镜像配置
│
├── frontend/                       # 前端应用
│   ├── public/                     # 静态资源
│   │   └── index.html
│   ├── src/
│   │   ├── components/             # React组件
│   │   │   └── Layout/
│   │   │       └── MainLayout.tsx  # 主布局组件
│   │   ├── pages/                  # 页面组件
│   │   │   ├── Dashboard/          # 仪表板
│   │   │   ├── Customers/          # 客户管理
│   │   │   ├── Deals/              # 交易管理
│   │   │   ├── Tasks/              # 任务管理
│   │   │   ├── Scraping/           # 数据爬取
│   │   │   └── Analytics/          # 数据分析
│   │   ├── services/               # API服务
│   │   │   └── api.ts
│   │   ├── utils/                  # 工具函数
│   │   │   └── helpers.ts
│   │   ├── App.tsx                 # 应用入口
│   │   ├── App.css                 # 全局样式
│   │   └── index.tsx               # React入口
│   ├── package.json                # Node依赖
│   └── Dockerfile                  # Docker镜像配置
│
├── config/                         # 配置文件
│   └── settings.yaml               # 主配置文件
│
├── data/                           # 数据存储目录
│   ├── exports/                    # 导出数据
│   ├── imports/                    # 导入数据
│   └── cache/                      # 缓存数据
│
├── logs/                           # 日志文件
│   ├── aicrm.log                   # 应用日志
│   ├── scraper.log                 # 爬虫日志
│   └── error.log                   # 错误日志
│
├── docker-compose.yml              # Docker Compose配置
├── Dockerfile                      # Docker镜像配置
├── start.sh                        # 快速启动脚本
├── .env                            # 环境变量
├── .env.example                    # 环境变量示例
├── .gitignore                      # Git忽略文件
├── README.md                       # 项目文档
└── PROJECT_STRUCTURE.md            # 本文件
```

## 核心模块说明

### 1. 后端服务 (backend/)

#### app/main.py
- FastAPI应用主入口
- 定义所有API路由
- 处理CORS和中间件
- 应用生命周期管理

#### app/core/config.py
- 配置管理
- 环境变量加载
- YAML配置解析
- 数据库连接配置

#### app/services/scraper.py
- 多策略网页爬虫
- 支持HTTP/Selenium/Playwright
- 代理轮换
- 速率限制
- 并发爬取

#### app/services/anti_detection.py
- 代理池管理
- 请求头伪装
- 浏览器指纹对抗
- Session管理
- 自动代理验证

#### app/services/captcha_solver.py
- OCR验证码识别
- 第三方API集成
- 多种验证码类型支持
- 图像预处理

#### app/services/analytics.py
- AI情感分析
- 实体提取
- 客户细分
- 数据预处理
- 机器学习模型

#### app/services/crm.py
- 客户管理
- 交互记录
- 交易管理
- 任务管理
- 数据分析

#### app/models/database.py
- SQLAlchemy ORM模型
- Pydantic验证模型
- 数据库关系定义
- 数据库管理器

### 2. 前端应用 (frontend/)

#### src/App.tsx
- React应用入口
- 路由配置
- 全局主题设置

#### src/components/Layout/MainLayout.tsx
- 主布局组件
- 侧边栏导航
- 顶部栏
- 内容区域

#### src/pages/Dashboard/
- 仪表板页面
- 统计卡片
- 图表展示
- 数据汇总

#### src/pages/Scraping/
- 数据爬取页面
- URL输入
- 策略选择
- 结果展示

### 3. 配置文件 (config/)

#### settings.yaml
- 爬虫配置
- 代理配置
- 验证码配置
- AI服务配置
- 数据库配置

### 4. 部署文件

#### docker-compose.yml
- 服务编排
- 容器配置
- 网络配置
- 卷挂载

#### start.sh
- 快速启动脚本
- 环境检查
- 服务初始化

## 数据流图

```
用户 → 前端界面 → API端点 → 服务层 → 数据库
                    ↓
                爬虫服务 → 反检测系统 → 目标网站
                    ↓
                验证码解决器
                    ↓
                AI分析服务
```

## 技术栈总结

### 后端
- Web框架: FastAPI
- ORM: SQLAlchemy
- 数据库: PostgreSQL + MongoDB
- 缓存: Redis
- 任务队列: Celery
- 爬虫: Scrapy + Selenium + Playwright
- AI: OpenAI + Anthropic + scikit-learn

### 前端
- 框架: React 18
- 语言: TypeScript
- UI库: Ant Design
- 图表: ECharts
- 状态管理: TanStack Query
- 路由: React Router

### DevOps
- 容器: Docker + Docker Compose
- 代理: Nginx
- 监控: Prometheus + Grafana
- 日志: ELK Stack (可选)

## 扩展指南

### 添加新的爬虫策略
1. 在 `scraper.py` 中添加新的爬取方法
2. 更新 `ScrapingStrategy` 枚举
3. 添加相应的配置选项

### 添加新的AI功能
1. 在 `analytics.py` 中添加分析方法
2. 更新 `AnalysisType` 枚举
3. 添加API端点

### 添加新的CRM功能
1. 在 `database.py` 中定义数据模型
2. 在 `crm.py` 中实现业务逻辑
3. 在 `main.py` 中添加API路由
4. 在前端创建对应页面

## 性能优化建议

1. **数据库优化**
   - 添加适当索引
   - 使用连接池
   - 定期清理日志

2. **爬虫优化**
   - 使用异步IO
   - 合理设置并发数
   - 启用缓存

3. **前端优化**
   - 代码分割
   - 懒加载
   - 图片优化

4. **系统优化**
   - 使用Redis缓存
   - 异步任务处理
   - 负载均衡
