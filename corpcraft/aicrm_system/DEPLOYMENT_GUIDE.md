# AICRM System - 部署指南

## 目录
1. [系统要求](#系统要求)
2. [本地开发部署](#本地开发部署)
3. [Docker部署](#docker部署)
4. [生产环境部署](#生产环境部署)
5. [云平台部署](#云平台部署)
6. [监控和维护](#监控和维护)
7. [安全最佳实践](#安全最佳实践)

---

## 系统要求

### 最低配置

- **CPU**: 4核心
- **内存**: 8GB RAM
- **存储**: 50GB 可用空间
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+), macOS, Windows with WSL2

### 推荐配置

- **CPU**: 8核心或更多
- **内存**: 16GB RAM 或更多
- **存储**: 200GB SSD
- **网络**: 稳定的互联网连接（用于爬虫和AI服务）

### 软件依赖

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Python**: 3.10+ (本地开发)
- **Node.js**: 18+ (本地开发)
- **Git**: 2.30+

---

## 本地开发部署

### 1. 克隆项目

```bash
git clone <repository-url>
cd aicrm_system
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

必填配置项：
```env
POSTGRES_PASSWORD=your_secure_password
OPENAI_API_KEY=sk-...  # 可选
ANTHROPIC_API_KEY=sk-ant-...  # 可选
```

### 3. 后端设置

```bash
cd backend

# 创建虚拟环境
python3.10 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 安装 Playwright 浏览器
playwright install chromium
```

### 4. 数据库初始化

```bash
# 确保PostgreSQL运行
sudo systemctl start postgresql  # Linux
# 或使用Docker
docker run -d --name postgres \
  -e POSTGRES_PASSWORD=changeme \
  -e POSTGRES_DB=aicrm_db \
  -p 5432:5432 postgres:15

# 初始化数据库
python -c "
from app.models.database import DatabaseManager
from app.core.config import settings
db = DatabaseManager(settings.database_url)
db.init_db()
"
```

### 5. 启动后端服务

```bash
cd backend/app
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. 前端设置（可选）

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm start
```

### 7. 访问服务

- 后端API: http://localhost:8000
- API文档: http://localhost:8000/docs
- 前端界面: http://localhost:3000

---

## Docker部署

### 1. 使用快速启动脚本

```bash
# 一键启动所有服务
./start.sh
```

### 2. 使用Docker Compose

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down

# 停止并删除数据
docker-compose down -v
```

### 3. Docker Compose 配置

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: aicrm_db
      POSTGRES_USER: aicrm_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  mongodb:
    image: mongo:7
    environment:
      MONGO_INITDB_DATABASE: aicrm_mongo
    volumes:
      - mongodb_data:/data/db
    ports:
      - "27017:27017"

  backend:
    build: ./backend
    depends_on:
      - postgres
      - redis
      - mongodb
    environment:
      - DATABASE_URL=postgresql://aicrm_user:${POSTGRES_PASSWORD}@postgres:5432/aicrm_db
      - REDIS_URL=redis://redis:6379/0
    volumes:
      - ./backend:/app
      - ./data:/app/data
      - ./logs:/app/logs
    ports:
      - "8000:8000"

  frontend:
    build: ./frontend
    depends_on:
      - backend
    ports:
      - "3000:3000"

  celery:
    build: ./backend
    command: celery -A app.tasks worker --loglevel=info
    depends_on:
      - postgres
      - redis
    environment:
      - DATABASE_URL=postgresql://aicrm_user:${POSTGRES_PASSWORD}@postgres:5432/aicrm_db
      - CELERY_BROKER_URL=redis://redis:6379/1
    volumes:
      - ./backend:/app

volumes:
  postgres_data:
  redis_data:
  mongodb_data:
```

---

## 生产环境部署

### 1. 使用Nginx反向代理

#### Nginx配置示例

```nginx
# /etc/nginx/sites-available/aicrm

upstream backend {
    server 127.0.0.1:8000;
}

upstream frontend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/aicrm.crt;
    ssl_certificate_key /etc/ssl/private/aicrm.key;

    # 后端API
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

启用配置：
```bash
sudo ln -s /etc/nginx/sites-available/aicrm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. 使用Systemd管理服务

#### Backend服务

```ini
# /etc/systemd/system/aicrm-backend.service

[Unit]
Description=AICRM Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=aicrm
WorkingDirectory=/opt/aicrm/backend
Environment="PATH=/opt/aicrm/backend/venv/bin"
ExecStart=/opt/aicrm/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### Celery Worker服务

```ini
# /etc/systemd/system/aicrm-celery.service

[Unit]
Description=AICRM Celery Worker
After=network.target redis.service

[Service]
Type=simple
User=aicrm
WorkingDirectory=/opt/aicrm/backend
Environment="PATH=/opt/aicrm/backend/venv/bin"
ExecStart=/opt/aicrm/backend/venv/bin/celery -A app.tasks worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl enable aicrm-backend
sudo systemctl enable aicrm-celery
sudo systemctl start aicrm-backend
sudo systemctl start aicrm-celery
```

### 3. 使用Supervisor（备选方案）

```ini
# /etc/supervisor/conf.d/aicrm.conf

[program:aicrm-backend]
command=/opt/aicrm/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
directory=/opt/aicrm/backend
user=aicrm
autostart=true
autorestart=true
stderr_logfile=/var/log/aicrm/backend.err.log
stdout_logfile=/var/log/aicrm/backend.out.log

[program:aicrm-celery]
command=/opt/aicrm/backend/venv/bin/celery -A app.tasks worker --loglevel=info
directory=/opt/aicrm/backend
user=aicrm
autostart=true
autorestart=true
stderr_logfile=/var/log/aicrm/celery.err.log
stdout_logfile=/var/log/aicrm/celery.out.log
```

---

## 云平台部署

### 1. AWS部署

#### 使用ECS+Fargate

```bash
# 创建ECS集群
aws ecs create-cluster --cluster-name aicrm-cluster

# 创建任务定义
aws ecs register-task-definition --cli-input-json file://ecs-task-definition.json

# 创建服务
aws ecs create-service \
  --cluster aicrm-cluster \
  --service-name aicrm-service \
  --task-definition aicrm-task:1 \
  --desired-count 2 \
  --launch-type FARGATE
```

#### 使用RDS数据库

```bash
# 创建PostgreSQL实例
aws rds create-db-instance \
  --db-instance-identifier aicrm-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username aicrm \
  --master-user-password yourpassword \
  --allocated-storage 20
```

### 2. Google Cloud Platform部署

#### 使用Cloud Run

```bash
# 构建并推送镜像
gcloud builds submit --tag gcr.io/PROJECT_ID/aicrm-backend

# 部署到Cloud Run
gcloud run deploy aicrm-backend \
  --image gcr.io/PROJECT_ID/aicrm-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

#### 使用Cloud SQL

```bash
# 创建Cloud SQL实例
gcloud sql instances create aicrm-db \
  --tier db-f1-micro \
  --region us-central1 \
  --database-version POSTGRES_14
```

### 3. Azure部署

#### 使用Container Instances

```bash
# 创建资源组
az group create --name aicrm-rg --location eastus

# 创建容器实例
az container create \
  --resource-group aicrm-rg \
  --name aicrm-backend \
  --image your-registry/aicrm-backend:latest \
  --cpu 2 \
  --memory 4 \
  --ports 8000
```

---

## 监控和维护

### 1. 日志管理

#### 使用ELK Stack

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data
    ports:
      - "9200:9200"

  logstash:
    image: logstash:8.11.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
    ports:
      - "5044:5044"
    depends_on:
      - elasticsearch

  kibana:
    image: kibana:8.11.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

### 2. 性能监控

#### Prometheus配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'aicrm_backend'
    static_configs:
      - targets: ['backend:8000']
    metrics_path: '/metrics'

  - job_name: 'postgres'
    static_configs:
      - targets: ['postgres:5432']
```

#### Grafana仪表板

导入预配置的仪表板：
- 系统性能监控
- API响应时间
- 数据库查询性能
- 爬虫成功率
- 代理池健康状态

### 3. 健康检查

```bash
#!/bin/bash
# health_check.sh

services=("http://localhost:8000/health")

for service in "${services[@]}"; do
    response=$(curl -s -o /dev/null -w "%{http_code}" $service)
    if [ $response -eq 200 ]; then
        echo "✅ $service is healthy"
    else
        echo "❌ $service is unhealthy (HTTP $response)"
        # 发送告警
        curl -X POST "https://api.slack.com/..." \
          -d '{"text":"Alert: Service unhealthy"}'
    fi
done
```

---

## 安全最佳实践

### 1. 环境变量管理

```bash
# 使用加密的secrets管理
# Kubernetes secrets
kubectl create secret generic aicrm-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --from-literal=POSTGRES_PASSWORD=...

# AWS Secrets Manager
aws secretsmanager create-secret \
  --name aicrm/prod \
  --secret-string file://secrets.json
```

### 2. 网络安全

```yaml
# docker-compose安全配置
services:
  backend:
    networks:
      - internal
    ports:
      - "127.0.0.1:8000:8000"  # 仅本地访问

networks:
  internal:
    driver: bridge
    internal: true  # 隔离网络
```

### 3. 数据备份

```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/aicrm"

# PostgreSQL备份
docker exec postgres pg_dump -U aicrm_user aicrm_db \
  > $BACKUP_DIR/postgres_$DATE.sql

# MongoDB备份
docker exec mongodb mongodump --out $BACKUP_DIR/mongo_$DATE

# 压缩备份
tar czf $BACKUP_DIR/aicrm_$DATE.tar.gz $BACKUP_DIR/*_$DATE

# 上传到云存储
aws s3 cp $BACKUP_DIR/aicrm_$DATE.tar.gz \
  s3://aicrm-backups/

# 删除30天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

### 4. 安全头配置

```python
# FastAPI安全中间件
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["yourdomain.com", "*.yourdomain.com"]
)

app.add_middleware(HTTPSRedirectMiddleware)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000"
    return response
```

---

## 性能优化

### 1. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_customers_status ON customers(status);
CREATE INDEX idx_customers_created_at ON customers(created_at);
CREATE INDEX idx_interactions_customer_id ON interactions(customer_id);

-- 配置连接池
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '4GB';
```

### 2. 缓存策略

```python
# 使用Redis缓存
from functools import lru_cache
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cache_get(key):
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    return None

def cache_set(key, value, ttl=3600):
    redis_client.setex(key, ttl, json.dumps(value))
```

### 3. 负载均衡

```nginx
upstream backend_cluster {
    least_conn;
    server backend1:8000 weight=3;
    server backend2:8000 weight=2;
    server backend3:8000 weight=1;

    keepalive 32;
}

server {
    location /api/ {
        proxy_pass http://backend_cluster;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

---

## 故障恢复

### 1. 数据恢复

```bash
# PostgreSQL恢复
docker exec -i postgres psql -U aicrm_user aicrm_db \
  < /backup/aicrm/postgres_20240201.sql

# MongoDB恢复
docker exec mongodb mongorestore --drop /backup/aicrm/mongo_20240201
```

### 2. 服务重启脚本

```bash
#!/bin/bash
# emergency_restart.sh

echo "🔄 重启AICRM服务..."

# 重启后端
docker-compose restart backend

# 等待服务就绪
sleep 10

# 健康检查
curl -f http://localhost:8000/health || {
    echo "❌ 服务不健康，执行回滚"
    docker-compose rollback
    exit 1
}

echo "✅ 服务恢复成功"
```

---

## 更新和升级

### 1. 滚动更新

```bash
#!/bin/bash
# rolling_update.sh

# 1. 拉取最新代码
git pull origin main

# 2. 构建新镜像
docker-compose build

# 3. 逐个更新服务
for service in backend celery; do
    echo "更新 $service ..."
    docker-compose up -d --no-deps $service
    sleep 30  # 等待服务稳定
done

# 4. 验证更新
curl -f http://localhost:8000/health || {
    echo "更新失败，回滚"
    git reset --hard HEAD@{1}
    docker-compose up -d
    exit 1
}

echo "✅ 更新成功"
```

---

需要帮助？查看完整文档：[README.md](README.md)
