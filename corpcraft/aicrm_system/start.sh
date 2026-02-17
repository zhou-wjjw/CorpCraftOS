#!/bin/bash

# AICRM System 快速启动脚本

set -e

echo "🚀 AICRM System 启动脚本"
echo "========================"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker未安装，请先安装Docker${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose未安装，请先安装Docker Compose${NC}"
    exit 1
fi

# 检查.env文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到.env文件，从示例创建...${NC}"
    cp .env.example .env 2>/dev/null || cat > .env << EOF
# 数据库配置
POSTGRES_PASSWORD=changeme

# AI服务配置（可选）
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# 验证码服务配置（可选）
2CAPTCHA_API_KEY=
EOF
    echo -e "${GREEN}✅ .env文件已创建${NC}"
fi

# 创建必要的目录
echo -e "${YELLOW}📁 创建必要的目录...${NC}"
mkdir -p data logs ssl

# 启动服务
echo -e "${YELLOW}🐳 启动Docker容器...${NC}"
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}⏳ 等待服务启动...${NC}"
sleep 10

# 检查服务状态
echo -e "${YELLOW}🔍 检查服务状态...${NC}"
docker-compose ps

# 初始化数据库
echo -e "${YELLOW}🗄️  初始化数据库...${NC}"
docker-compose exec -T backend python -c "
from app.models.database import DatabaseManager
from app.core.config import settings
try:
    db = DatabaseManager(settings.database_url)
    db.init_db()
    print('✅ 数据库初始化成功')
except Exception as e:
    print(f'❌ 数据库初始化失败: {e}')
" 2>/dev/null || echo -e "${YELLOW}⚠️  数据库初始化跳过（可能是首次启动）${NC}"

echo ""
echo -e "${GREEN}✅ AICRM System 启动完成！${NC}"
echo ""
echo "📋 服务访问地址："
echo "   - 前端界面: http://localhost:3000"
echo "   - 后端API:  http://localhost:8000"
echo "   - API文档:  http://localhost:8000/docs"
echo "   - Grafana:  http://localhost:3001"
echo ""
echo "📝 有用的命令："
echo "   - 查看日志: docker-compose logs -f [service_name]"
echo "   - 停止服务: docker-compose down"
echo "   - 重启服务: docker-compose restart [service_name]"
echo "   - 进入容器: docker-compose exec backend bash"
echo ""
echo -e "${GREEN}🎉 现在可以开始使用AICRM System了！${NC}"
