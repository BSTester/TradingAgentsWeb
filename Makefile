.PHONY: help build up down logs restart clean ps shell-backend shell-frontend test

# 默认目标
help:
	@echo "TradingAgents Docker 管理命令"
	@echo ""
	@echo "使用方法: make [target]"
	@echo ""
	@echo "可用命令:"
	@echo "  build          - 构建所有 Docker 镜像"
	@echo "  build-backend  - 仅构建后端镜像"
	@echo "  build-frontend - 仅构建前端镜像"
	@echo "  up             - 启动所有服务"
	@echo "  up-backend     - 仅启动后端服务"
	@echo "  up-frontend    - 启动前端和后端服务"
	@echo "  down           - 停止所有服务"
	@echo "  logs           - 查看所有服务日志"
	@echo "  logs-backend   - 查看后端日志"
	@echo "  logs-frontend  - 查看前端日志"
	@echo "  restart        - 重启所有服务"
	@echo "  ps             - 查看服务状态"
	@echo "  shell-backend  - 进入后端容器"
	@echo "  shell-frontend - 进入前端容器"
	@echo "  clean          - 清理所有容器和镜像"
	@echo "  test           - 运行测试"
	@echo "  init           - 初始化环境（复制配置文件）"

# 初始化环境
init:
	@echo "初始化环境..."
	@if [ ! -f .env ]; then cp .env.example .env; echo "已创建 .env 文件"; fi
	@if [ ! -f web/frontend/.env.local ]; then cp web/frontend/.env.local.example web/frontend/.env.local; echo "已创建 web/frontend/.env.local 文件"; fi
	@echo "请编辑 .env 文件并填入你的 API 密钥"

# 构建镜像
build:
	docker-compose build

build-backend:
	docker-compose build backend

build-frontend:
	docker-compose build frontend

# 启动服务
up:
	docker-compose up -d

up-backend:
	docker-compose up -d backend

up-frontend:
	docker-compose up -d backend frontend

# 停止服务
down:
	docker-compose down

# 查看日志
logs:
	docker-compose logs -f

logs-backend:
	docker-compose logs -f backend

logs-frontend:
	docker-compose logs -f frontend

# 重启服务
restart:
	docker-compose restart

restart-backend:
	docker-compose restart backend

restart-frontend:
	docker-compose restart frontend

# 查看状态
ps:
	docker-compose ps

# 进入容器
shell-backend:
	docker-compose exec backend bash

shell-frontend:
	docker-compose exec frontend sh

# 清理
clean:
	docker-compose down -v --rmi all
	@echo "已清理所有容器、卷和镜像"

# 重新构建
rebuild:
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d

# 测试
test:
	docker-compose exec backend pytest

# 数据库迁移
migrate:
	docker-compose exec backend python web/backend/init_db.py

# 查看资源使用
stats:
	docker stats

# 健康检查
health:
	@echo "检查后端健康状态..."
	@curl -f http://localhost:8000/health || echo "后端服务未响应"
	@echo ""
	@echo "检查前端健康状态..."
	@curl -f http://localhost:3000 || echo "前端服务未响应"
