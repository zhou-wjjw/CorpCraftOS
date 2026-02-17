# AICRM 快速入门指南

本指南将帮助你在 10 分钟内启动并运行 AICRM 系统。

---

## 前置要求

确保你的系统已安装以下软件：

- **Python 3.9+**
- **Docker** (可选，推荐)
- **Docker Compose** (可选，推荐)
- **Git**

---

## 🚀 快速开始（3步启动）

### 步骤 1：获取代码

```bash
git clone https://github.com/your-repo/aicrm.git
cd aicrm
```

### 步骤 2：配置环境

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置（至少修改数据库密码）
vi .env  # 或使用你喜欢的编辑器
```

**必填配置项**：

```env
# 修改这些值
POSTGRES_PASSWORD=your_secure_password_here
MONGODB_PASSWORD=your_secure_password_here
JWT_SECRET_KEY=your-secret-key-change-in-production
```

### 步骤 3：启动系统

```bash
# 使用启动脚本
chmod +x start.sh
./start.sh install  # 首次安装
./start.sh start    # 启动服务
```

或者使用 Docker：

```bash
docker-compose up -d
```

---

## ✅ 验证安装

### 1. 检查服务状态

```bash
./start.sh status
```

或查看 Docker 容器：

```bash
docker-compose ps
```

### 2. 访问 API 文档

打开浏览器访问：

```
http://localhost:8000/docs
```

### 3. 测试健康检查

```bash
curl http://localhost:8000/health
```

应该返回：

```json
{"status":"healthy"}
```

---

## 📝 第一个 API 调用

### 创建一个企业

```bash
curl -X POST "http://localhost:8000/api/v1/companies" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "示例科技有限公司",
    "unified_credit_code": "91110000999999999X",
    "legal_representative": "张三",
    "registered_capital": 10000000.0,
    "business_status": "在业",
    "industry": "软件和信息技术服务业",
    "business_scope": "软件开发、技术服务",
    "registration_address": "北京市海淀区中关村",
    "phone": "010-12345678",
    "email": "contact@example.com"
  }'
```

**响应示例**：

```json
{
  "id": 1,
  "name": "示例科技有限公司",
  "unified_credit_code": "91110000999999999X",
  "industry": "软件和信息技术服务业",
  "crawled_at": "2025-01-15T10:30:00",
  "updated_at": "2025-01-15T10:30:00"
}
```

### 查询企业

```bash
curl "http://localhost:8000/api/v1/companies/1"
```

### 搜索企业

```bash
curl "http://localhost:8000/api/v1/companies?keyword=科技&industry=软件和信息技术服务业"
```

---

## 🤖 使用 AI 分析功能

### 构建企业画像

```bash
curl -X POST "http://localhost:8000/api/v1/analytics/company-profile/1"
```

**返回示例**：

```json
{
  "company_id": 1,
  "name": "示例科技有限公司",
  "industry": "软件和信息技术服务业",
  "scale": "中型",
  "business_status": "在业",
  "operation_score": 65.5,
  "financial_score": 70.0,
  "credit_score": 60.0,
  "risk_level": "低",
  "risk_tags": ["新成立企业"],
  "tags": ["软件和信息技术服务业", "北京市", "中型"],
  "recommended": true,
  "priority": 3
}
```

### 计算客户意向评分

```bash
curl -X POST "http://localhost:8000/api/v1/analytics/intent-score/1"
```

**返回示例**：

```json
{
  "company_id": 1,
  "company_name": "示例科技有限公司",
  "overall_score": 50.0,
  "behavior_score": 30.0,
  "content_score": 0.0,
  "interaction_score": 0.0,
  "timing_score": 50.0,
  "intent_level": "低",
  "key_factors": ["需要培养"],
  "purchase_probability": 0.5,
  "next_action": "添加到培育池，定期触达",
  "recommended_channel": "social"
}
```

---

## 🕷️ 运行爬虫

### 方式 1：通过 API 启动

```bash
curl -X POST "http://localhost:8000/api/v1/crawler/start" \
  -H "Content-Type: application/json" \
  -d '{"spider_name": "company_info"}'
```

### 方式 2：直接运行

```bash
# 激活虚拟环境
source venv/bin/activate

# 运行爬虫
scrapy crawl company_info
```

---

## 📊 查看数据统计

```bash
curl "http://localhost:8000/api/v1/companies/stats/overview"
```

**返回示例**：

```json
{
  "total": 150,
  "by_industry": {
    "软件和信息技术服务业": 45,
    "批发和零售业": 30,
    "制造业": 25
  },
  "by_province": {
    "北京市": 50,
    "上海市": 40,
    "广东省": 30
  },
  "by_status": {
    "在业": 120,
    "吊销": 20,
    "注销": 10
  }
}
```

---

## 🔧 常用命令

### 服务管理

```bash
# 启动所有服务
./start.sh start

# 停止所有服务
./start.sh stop

# 重启服务
./start.sh restart

# 查看状态
./start.sh status

# 查看日志
./start.sh logs
```

### Docker 命令

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down

# 查看日志
docker-compose logs -f

# 重启服务
docker-compose restart

# 查看状态
docker-compose ps
```

### 数据库操作

```bash
# 进入 PostgreSQL
docker exec -it aicrm_postgres psql -U aicrm -d aicrm

# 进入 MongoDB
docker exec -it aicrm_mongodb mongosh -u aicrm -p aicrm_password

# 进入 Redis
docker exec -it aicrm_redis redis-cli
```

---

## 🐛 故障排查

### 问题 1：端口被占用

```bash
# 检查端口占用
lsof -i :8000

# 修改端口
# 编辑 .env 文件
API_PORT=8001
```

### 问题 2：数据库连接失败

```bash
# 检查数据库状态
docker-compose ps

# 查看数据库日志
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### 问题 3：内存不足

```bash
# 减少并发数
# 编辑 .env 文件
CONCURRENT_REQUESTS=8
DOWNLOAD_DELAY=2.0
```

---

## 📚 下一步

现在你已经成功启动了 AICRM 系统，可以：

1. **阅读详细文档**
   - [部署指南](./DEPLOYMENT.md)
   - [项目结构](./STRUCTURE.md)
   - [项目总结](./PROJECT_SUMMARY.md)

2. **添加数据源**
   - 修改 `spiders/company_spider.py`
   - 添加你自己的爬虫

3. **开发前端**
   - API 已就绪，可以开发前端界面

4. **配置代理池**
   - 编辑 `.env` 文件
   - 添加代理 API 地址

5. **集成 AI 模型**
   - 配置 OpenAI API Key
   - 使用 GPT 进行高级分析

---

## 💡 提示

- 首次启动可能需要几分钟下载 Docker 镜像
- 建议在生产环境修改默认密码
- 定期备份数据库数据
- 监控日志文件大小

---

## 🆘 获取帮助

- **GitHub Issues**: [报告问题](https://github.com/your-repo/aicrm/issues)
- **文档**: 查看 `/docs` 目录
- **示例代码**: 查看 `tests/` 目录

---

**祝你使用愉快！** 🎉
