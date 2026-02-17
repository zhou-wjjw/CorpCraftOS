# AICRM 智能客户关系管理系统

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Python](https://img.shields.io/badge/python-3.9+-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

一个基于 AI 的智能 CRM 系统，具备强大的数据采集、反爬虫对策、验证码处理和智能分析能力。

[功能特性](#-核心功能) • [快速开始](#-快速开始) • [文档](#-文档) • [演示](#-演示)

</div>

---

## ✨ 核心功能

### 🕷️ 智能数据采集

- **多源数据爬取**：企业信息、工商数据、社交媒体等
- **分布式架构**：基于 Scrapy + Celery 的分布式爬虫
- **动态页面支持**：Playwright 渲染 JavaScript 页面
- **智能重试**：自动重试失败的请求

### 🛡️ 反爬虫系统

- **IP 代理池**：自动获取、验证、轮换代理
- **User-Agent 轮换**：模拟真实浏览器
- **请求频率控制**：自适应限速避免封禁
- **Cookie 管理**：自动处理 Cookie
- **浏览器指纹模拟**：完整的浏览器特征

### 🔐 验证码处理

- **本地 OCR 识别**：基于 Tesseract 的免费识别
- **第三方打码**：集成 2Captcha 人工打码
- **混合策略**：本地优先，失败时使用第三方
- **多种类型支持**：文本、图像、滑动、点击等

### 🤖 AI 智能分析

- **企业画像**：多维度构建企业档案（规模、风险、推荐度）
- **意向评分**：基于行为、内容、互动、时效的综合评分
- **聚类分析**：自动将企业分组
- **购买预测**：预测客户购买概率

### 💾 数据存储

- **PostgreSQL**：结构化数据存储
- **MongoDB**：原始数据和非结构化数据
- **Elasticsearch**：全文搜索
- **Redis**：缓存和消息队列

---

## 📊 技术栈

```
后端框架：
  FastAPI + Pydantic + SQLAlchemy

爬虫技术：
  Scrapy + Playwright

数据存储：
  PostgreSQL + MongoDB + Elasticsearch + Redis

任务队列：
  Celery + Redis

AI/ML：
  Scikit-learn + jieba

验证码识别：
  Tesseract OCR + 2Captcha

容器化：
  Docker + Docker Compose
```

---

## 🚀 快速开始

### 方式一：使用启动脚本（推荐）

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/aicrm.git
cd aicrm

# 2. 一键安装
chmod +x start.sh
./start.sh install

# 3. 启动服务
./start.sh start

# 4. 访问服务
open http://localhost:8000/docs
```

### 方式二：使用 Docker

```bash
# 1. 配置环境变量
cp .env.example .env
vi .env  # 编辑配置

# 2. 启动所有服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

### 方式三：手动安装

```bash
# 1. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 2. 安装依赖
pip install -r requirements.txt

# 3. 配置数据库
# (参考 DEPLOYMENT.md)

# 4. 初始化数据库
python -c "from storage.database import init_database; init_database()"

# 5. 启动API
uvicorn api.main:app --reload

# 6. 启动Celery Worker
celery -A tasks worker --loglevel=info
```

---

## 📖 API 示例

### 创建企业

```bash
curl -X POST http://localhost:8000/api/v1/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "示例科技有限公司",
    "unified_credit_code": "91110000123456789X",
    "legal_representative": "张三",
    "registered_capital": 10000000.0,
    "industry": "软件和信息技术服务业"
  }'
```

### 构建企业画像

```bash
curl -X POST http://localhost:8000/api/v1/analytics/company-profile/1
```

**响应示例**：

```json
{
  "company_id": 1,
  "name": "示例科技有限公司",
  "industry": "软件和信息技术服务业",
  "scale": "中型",
  "operation_score": 75.5,
  "financial_score": 82.3,
  "credit_score": 68.0,
  "risk_level": "低",
  "recommended": true,
  "priority": 4
}
```

### 计算意向评分

```bash
curl -X POST http://localhost:8000/api/v1/analytics/intent-score/1
```

**响应示例**：

```json
{
  "company_id": 1,
  "company_name": "示例科技有限公司",
  "overall_score": 78.5,
  "intent_level": "高",
  "purchase_probability": 0.85,
  "next_action": "安排上门拜访或视频会议",
  "recommended_channel": "meeting"
}
```

---

## 📁 项目结构

```
aicrm/
├── 📁 analyzers/              # AI分析模块
│   ├── company_profile.py    # 企业画像
│   └── intent_score.py       # 意向评分
├── 📁 api/                    # FastAPI接口
│   └── main.py
├── 📁 config/                 # 配置管理
│   └── settings.py
├── 📁 middleware/             # 中间件
│   ├── anti_spider.py        # 反爬虫
│   ├── captcha.py            # 验证码
│   └── proxy.py              # 代理池
├── 📁 spiders/                # 爬虫
│   ├── base.py               # 基础类
│   └── company_spider.py     # 企业爬虫
├── 📁 storage/                # 数据存储
│   ├── database.py           # 数据库操作
│   └── models.py             # 数据模型
├── 📁 docs/                   # 文档
├── 📁 logs/                   # 日志
├── 📁 tests/                  # 测试
├── docker-compose.yml         # Docker编排
├── Dockerfile                 # Docker镜像
├── start.sh                   # 启动脚本
├── requirements.txt           # 依赖列表
├── .env.example               # 环境变量模板
├── DEPLOYMENT.md              # 部署指南
├── STRUCTURE.md               # 项目结构
└── PROJECT_SUMMARY.md         # 项目总结
```

[查看详细结构 →](./STRUCTURE.md)

---

## 🎯 核心指标

| 指标 | 数值 |
|------|------|
| 总代码行数 | ~5,000 |
| 核心模块数 | 10 |
| API接口数 | 15+ |
| 数据表数 | 4 |
| 中间件数 | 4 |
| 分析模型数 | 2 |
| 支持的验证码类型 | 5 |
| 反爬虫策略数 | 7 |

---

## 🔧 配置说明

主要配置项（`.env` 文件）：

```env
# 数据库配置
POSTGRES_PASSWORD=your_secure_password
MONGODB_PASSWORD=your_secure_password

# JWT密钥
JWT_SECRET_KEY=your-secret-key

# 可选配置
OPENAI_API_KEY=your_openai_api_key
TWO_CAPTCHA_API_KEY=your_2captcha_api_key
PROXY_API_URL=https://api.proxy-service.com/proxies
```

---

## 📚 文档

- [README.md](./README.md) - 项目概述
- [STRUCTURE.md](./STRUCTURE.md) - 项目结构详解
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) - 完成总结
- [DEPLOYMENT.md](./DEPLOYMENT.md) - 部署指南
- [API 文档](http://localhost:8000/docs) - 接口文档（启动后访问）

---

## 🛠️ 开发指南

### 添加新的爬虫

```python
from spiders.base import BaseSpider

class MySpider(BaseSpider):
    name = "my_spider"
    start_urls = ["https://example.com"]

    def parse(self, response):
        # 实现解析逻辑
        pass
```

### 添加新的分析器

```python
from analyzers.company_profile import CompanyProfileBuilder

class CustomAnalyzer(CompanyProfileBuilder):
    def _custom_score(self, company_data):
        # 自定义评分逻辑
        pass
```

### 运行测试

```bash
pytest tests/ -v
```

---

## 🚧 路线图

### ✅ 已完成 (v1.0)

- [x] 分布式爬虫框架
- [x] 反爬虫中间件系统
- [x] 代理池管理
- [x] 验证码识别
- [x] 数据存储层
- [x] 企业画像分析
- [x] 客户意向评分
- [x] RESTful API

### 🚧 开发中 (v1.1)

- [ ] React 管理后台
- [ ] 数据可视化大屏
- [ ] 更多数据源爬虫
- [ ] 邮件自动化

### 📋 计划中 (v2.0)

- [ ] AI 智能客服
- [ ] 销售预测模型
- [ ] 营销自动化
- [ ] 移动端应用

---

## 🤝 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目基于 MIT 许可证开源 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Scrapy](https://scrapy.org/) - 强大的爬虫框架
- [FastAPI](https://fastapi.tiangolo.com/) - 现代化的 Python Web 框架
- [Scikit-learn](https://scikit-learn.org/) - 机器学习库
- 以及所有开源贡献者

---

## 📮 联系方式

- **Issues**: [GitHub Issues](https://github.com/your-repo/aicrm/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/aicrm/discussions)
- **Email**: your-email@example.com

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐️**

Made with ❤️ by AICRM Team

</div>
