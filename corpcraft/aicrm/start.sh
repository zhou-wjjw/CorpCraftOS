#!/bin/bash

# AICRM 系统启动脚本

set -e

echo "=========================================="
echo "  AICRM 智能CRM系统 - 启动脚本"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Python版本
check_python() {
    echo -e "${YELLOW}检查Python版本...${NC}"
    python_version=$(python3 --version 2>&1 | awk '{print $2}')
    required_version="3.9"

    if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
        echo -e "${RED}Python版本过低，需要3.9或更高版本${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Python版本: $python_version${NC}"
}

# 检查依赖
check_dependencies() {
    echo -e "${YELLOW}检查系统依赖...${NC}"

    # 检查Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker未安装${NC}"
    else
        echo -e "${GREEN}✓ Docker已安装${NC}"
    fi

    # 检查Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose未安装${NC}"
    else
        echo -e "${GREEN}✓ Docker Compose已安装${NC}"
    fi
}

# 创建虚拟环境
create_venv() {
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}创建虚拟环境...${NC}"
        python3 -m venv venv
        echo -e "${GREEN}✓ 虚拟环境创建完成${NC}"
    else
        echo -e "${GREEN}✓ 虚拟环境已存在${NC}"
    fi
}

# 激活虚拟环境
activate_venv() {
    echo -e "${YELLOW}激活虚拟环境...${NC}"
    source venv/bin/activate
    echo -e "${GREEN}✓ 虚拟环境已激活${NC}"
}

# 安装依赖
install_dependencies() {
    echo -e "${YELLOW}安装Python依赖...${NC}"
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Python依赖安装完成${NC}"
}

# 配置环境变量
setup_env() {
    if [ ! -f ".env" ]; then
        echo -e "${YELLOW}创建环境配置文件...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}请编辑 .env 文件配置数据库等信息${NC}"
        read -p "是否现在配置? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-vi} .env
        fi
    else
        echo -e "${GREEN}✓ 环境配置文件已存在${NC}"
    fi
}

# 初始化数据库
init_database() {
    echo -e "${YELLOW}初始化数据库...${NC}"
    python -c "from storage.database import init_database; init_database()"
    echo -e "${GREEN}✓ 数据库初始化完成${NC}"
}

# 启动服务
start_services() {
    echo -e "${YELLOW}启动服务...${NC}"

    # 使用Docker Compose启动
    if command -v docker-compose &> /dev/null; then
        echo -e "${GREEN}使用Docker Compose启动服务...${NC}"
        docker-compose up -d
    else
        # 手动启动各服务
        echo -e "${YELLOW}启动API服务...${NC}"
        python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload &
        API_PID=$!

        echo -e "${YELLOW}启动Celery Worker...${NC}"
        celery -A tasks worker --loglevel=info &
        CELERY_PID=$!

        echo $API_PID > .api_pid
        echo $CELERY_PID > .celery_pid
    fi

    echo -e "${GREEN}✓ 服务启动完成${NC}"
}

# 停止服务
stop_services() {
    echo -e "${YELLOW}停止服务...${NC}"

    if command -v docker-compose &> /dev/null; then
        docker-compose down
    else
        if [ -f ".api_pid" ]; then
            kill $(cat .api_pid) 2>/dev/null || true
            rm .api_pid
        fi

        if [ -f ".celery_pid" ]; then
            kill $(cat .celery_pid) 2>/dev/null || true
            rm .celery_pid
        fi
    fi

    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# 显示状态
show_status() {
    echo -e "${YELLOW}系统状态:${NC}"
    echo

    if command -v docker-compose &> /dev/null; then
        docker-compose ps
    else
        echo "API服务: $(if [ -f .api_pid ]; then echo '运行中'; else echo '已停止'; fi)"
        echo "Celery服务: $(if [ -f .celery_pid ]; then echo '运行中'; else echo '已停止'; fi)"
    fi
}

# 显示帮助
show_help() {
    cat << EOF
AICRM 系统管理脚本

用法: ./start.sh [命令]

命令:
  install     安装依赖并初始化系统
  start       启动所有服务
  stop        停止所有服务
  restart     重启所有服务
  status      查看系统状态
  logs        查看服务日志
  shell       进入Python shell
  test        运行测试

示例:
  ./start.sh install   # 首次安装
  ./start.sh start     # 启动服务
  ./start.sh stop      # 停止服务

EOF
}

# 主逻辑
main() {
    case "${1:-install}" in
        install)
            check_python
            check_dependencies
            create_venv
            activate_venv
            install_dependencies
            setup_env
            init_database
            echo -e "${GREEN}=========================================="
            echo -e "  安装完成！"
            echo -e "  运行 './start.sh start' 启动服务"
            echo -e "==========================================${NC}"
            ;;
        start)
            activate_venv
            start_services
            echo
            echo -e "${GREEN}=========================================="
            echo -e "  服务已启动！"
            echo -e "  API地址: http://localhost:8000"
            echo -e "  API文档: http://localhost:8000/docs"
            echo -e "==========================================${NC}"
            ;;
        stop)
            stop_services
            ;;
        restart)
            stop_services
            sleep 2
            start_services
            ;;
        status)
            show_status
            ;;
        logs)
            if command -v docker-compose &> /dev/null; then
                docker-compose logs -f
            else
                tail -f logs/*.log
            fi
            ;;
        shell)
            activate_venv
            python -i
            ;;
        test)
            activate_venv
            pytest tests/ -v
            ;;
        *)
            show_help
            ;;
    esac
}

# 执行主函数
main "$@"
