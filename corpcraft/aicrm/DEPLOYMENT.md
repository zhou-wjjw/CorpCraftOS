# AICRM 系统部署指南

## 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [详细安装](#详细安装)
- [配置说明](#配置说明)
- [运行服务](#运行服务)
- [生产部署](#生产部署)
- [常见问题](#常见问题)

---

## 系统要求

### 最低配置

- **操作系统**: Ubuntu 20.04+ / CentOS 8+ / macOS 11+ / Windows 10+
- **Python**: 3.9 或更高版本
- **内存**: 4GB RAM
- **存储**: 20GB 可用空间
- **CPU**: 2核心

### 推荐配置

- **内存**: 8GB+ RAM
- **存储**: 50GB+ SSD
- **CPU**: 4核心+
- **网络**: 稳定的互联网连接

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/your-repo/aicrm.git
cd aicrm
```

### 2. 一键安装启动

```bash
chmod +x start.sh
./start.sh install
./start.sh start
```

### 3. 访问服务

- **API服务**: http://localhost:8000
- **API文档**: http://localhost:8000/docs
- **系统状态**: http://localhost:8000/health

---

## 详细安装

### 方式一: 使用Docker Compose (推荐)

#### 1. 安装Docker和Docker Compose

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install docker.io docker-compose

# macOS (使用Homebrew)
brew install docker docker-compose

# 启动Docker服务
sudo systemctl start docker
```

#### 2. 配置环境变量

```bash
cp .env.example .env
vi .env  # 编辑配置文件
```

必填配置项：

```env
# 数据库密码
POSTGRES_PASSWORD=your_secure_password
MONGODB_PASSWORD=your_secure_password

# JWT密钥
JWT_SECRET_KEY=your-secret-key-change-in-production

# API密钥 (可选)
OPENAI_API_KEY=your_openai_api_key
TWO_CAPTCHA_API_KEY=your_2captcha_api_key
```

#### 3. 启动所有服务

```bash
docker-compose up -d
```

#### 4. 查看服务状态

```bash
docker-compose ps
```

### 方式二: 手动安装

#### 1. 安装系统依赖

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    python3.9 \
    python3.9-venv \
    postgresql \
    mongodb \
    redis-server \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    libtesseract-dev

# macOS
brew install python3 postgresql mongodb redis tesseract
```

#### 2. 创建Python虚拟环境

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows
```

#### 3. 安装Python依赖

```bash
pip install -r requirements.txt
```

#### 4. 配置数据库

##### PostgreSQL

```bash
# 创建数据库和用户
sudo -u postgres psql

CREATE DATABASE aicrm;
CREATE USER aicrm WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE aicrm TO aicrm;
\q
```

##### MongoDB

```bash
# 创建管理员用户
mongo
> use aicrm
> db.createUser({
    user: "aicrm",
    pwd: "your_password",
    roles: ["readWrite"]
})
> exit
```

##### Redis

```bash
# 启动Redis
sudo systemctl start redis
# 或
redis-server
```

##### Elasticsearch

```bash
# 下载并安装Elasticsearch
wget https://artifacts.elastic.co/downloads/elasticsearch/elasticsearch-8.11.0-linux-x86_64.tar.gz
tar -xzf elasticsearch-8.11.0-linux-x86_64.tar.gz
cd elasticsearch-8.11.0
./bin/elasticsearch
```

#### 5. 初始化数据库

```bash
python -c "from storage.database import init_database; init_database()"
```

---

## 配置说明

### 环境变量配置

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `POSTGRES_HOST` | PostgreSQL主机 | localhost | 否 |
| `POSTGRES_PORT` | PostgreSQL端口 | 5432 | 否 |
| `POSTGRES_USER` | PostgreSQL用户名 | aicrm | 否 |
| `POSTGRES_PASSWORD` | PostgreSQL密码 | - | **是** |
| `POSTGRES_DB` | PostgreSQL数据库名 | aicrm | 否 |
| `MONGODB_HOST` | MongoDB主机 | localhost | 否 |
| `MONGODB_PORT` | MongoDB端口 | 27017 | 否 |
| `REDIS_HOST` | Redis主机 | localhost | 否 |
| `REDIS_PORT` | Redis端口 | 6379 | 否 |
| `ELASTICSEARCH_HOST` | Elasticsearch主机 | localhost | 否 |
| `ELASTICSEARCH_PORT` | Elasticsearch端口 | 9200 | 否 |
| `JWT_SECRET_KEY` | JWT密钥 | - | **是** |
| `OPENAI_API_KEY` | OpenAI API密钥 | - | 否 |
| `TWO_CAPTCHA_API_KEY` | 2Captcha API密钥 | - | 否 |
| `PROXY_API_URL` | 代理API地址 | - | 否 |

### 代理配置

如果需要使用代理池，可以配置代理API：

```env
PROXY_POOL_ENABLED=True
PROXY_API_URL=https://api.proxy-service.com/proxies
```

支持的代理服务：
- 自建代理池
- 付费代理服务（如阿布云、芝麻代理等）
- 免费代理源（不推荐生产使用）

---

## 运行服务

### 启动API服务

```bash
# 开发模式（自动重载）
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000

# 生产模式
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 启动Celery Worker

```bash
celery -A tasks worker --loglevel=info
```

### 启动Celery Beat（定时任务）

```bash
celery -A tasks beat --loglevel=info
```

### 运行爬虫

```bash
# 方式1: 使用Scrapy命令
scrapy crawl company_spider

# 方式2: 使用Python脚本
python spiders/company_spider.py
```

### 使用启动脚本

```bash
# 安装
./start.sh install

# 启动所有服务
./start.sh start

# 停止服务
./start.sh stop

# 查看状态
./start.sh status

# 查看日志
./start.sh logs
```

---

## 生产部署

### 使用Nginx反向代理

#### 1. 安装Nginx

```bash
sudo apt-get install nginx
```

#### 2. 配置Nginx

创建配置文件 `/etc/nginx/sites-available/aicrm`:

```nginx
upstream aicrm_backend {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://aicrm_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /static {
        alias /path/to/aicrm/static;
    }

    location /media {
        alias /path/to/aicrm/media;
    }
}
```

#### 3. 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/aicrm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 配置HTTPS

#### 使用Let's Encrypt

```bash
# 安装Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

### 使用Supervisor管理进程

#### 1. 安装Supervisor

```bash
sudo apt-get install supervisor
```

#### 2. 创建配置文件

`/etc/supervisor/conf.d/aicrm-api.conf`:

```ini
[program:aicrm-api]
command=/path/to/aicrm/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 8000
directory=/path/to/aicrm
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/aicrm-api.log
```

`/etc/supervisor/conf.d/aicrm-celery.conf`:

```ini
[program:aicrm-celery]
command=/path/to/aicrm/venv/bin/celery -A tasks worker --loglevel=info
directory=/path/to/aicrm
user=www-data
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/aicrm-celery.log
```

#### 3. 启动服务

```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

### 使用Docker Compose (生产环境)

#### 1. 修改docker-compose.yml

- 设置正确的环境变量
- 挂载卷用于数据持久化
- 配置网络和端口

#### 2. 启动服务

```bash
docker-compose up -d
```

#### 3. 查看日志

```bash
docker-compose logs -f
```

---

## 监控和维护

### 日志管理

日志文件位置：

```
logs/
├── aicrm.log          # 主日志
├── api.log            # API日志
├── crawler.log        # 爬虫日志
└── celery.log         # Celery日志
```

### 数据备份

#### PostgreSQL备份

```bash
# 备份
pg_dump -U aicrm aicrm > backup_$(date +%Y%m%d).sql

# 恢复
psql -U aicrm aicrm < backup_20240101.sql
```

#### MongoDB备份

```bash
# 备份
mongodump --host localhost --db aicrm --out /backup/mongodb/

# 恢复
mongorestore --host localhost --db aicrm /backup/mongodb/aicrm
```

### 性能监控

推荐工具：

- **Prometheus**: 指标收集
- **Grafana**: 可视化监控
- **Sentry**: 错误追踪

### 安全建议

1. **修改默认密码**
2. **启用HTTPS**
3. **配置防火墙**
4. **定期更新依赖**
5. **启用日志审计**
6. **限制API访问频率**

---

## 常见问题

### 1. 数据库连接失败

```bash
# 检查PostgreSQL是否运行
sudo systemctl status postgresql

# 检查连接
psql -U aicrm -d aicrm -h localhost
```

### 2. Redis连接失败

```bash
# 检查Redis是否运行
redis-cli ping
```

### 3. 爬虫验证码识别失败

- 检查Tesseract是否正确安装
- 配置2Captcha API密钥
- 调整图片预处理参数

### 4. API响应慢

- 增加Worker数量
- 启用缓存
- 优化数据库查询
- 使用CDN

### 5. 内存不足

- 增加服务器内存
- 限制并发请求数
- 使用消息队列处理异步任务

---

## 技术支持

- **文档**: https://docs.aicrm.com
- **Issues**: https://github.com/your-repo/aicrm/issues
- **讨论**: https://github.com/your-repo/aicrm/discussions

---

## 许可证

MIT License - 详见 LICENSE 文件
