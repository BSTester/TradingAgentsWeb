#!/bin/bash

# TradingAgents 启动脚本

set -e

echo "======================================"
echo "TradingAgents Docker 部署脚本"
echo "======================================"
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "错误: Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "错误: Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "警告: .env 文件不存在，正在从 .env.example 复制..."
    cp .env.example .env
    echo "请编辑 .env 文件并填入你的 API 密钥"
    echo ""
fi

# 检查前端 .env.local 文件
if [ ! -f web/frontend/.env.local ]; then
    echo "警告: web/frontend/.env.local 文件不存在，正在从 .env.local.example 复制..."
    cp web/frontend/.env.local.example web/frontend/.env.local
    echo ""
fi

# 询问用户要启动的服务
echo "请选择启动模式:"
echo "1) 完整服务 (前端 + 后端)"
echo "2) 仅后端服务"
echo "3) 完整服务 + Nginx"
echo "4) 停止所有服务"
echo "5) 重新构建并启动"
echo ""
read -p "请输入选项 (1-5): " choice

case $choice in
    1)
        echo ""
        echo "正在启动完整服务 (前端 + 后端)..."
        docker-compose up -d backend frontend
        ;;
    2)
        echo ""
        echo "正在启动后端服务..."
        docker-compose up -d backend
        ;;
    3)
        echo ""
        echo "正在启动完整服务 + Nginx..."
        docker-compose up -d
        ;;
    4)
        echo ""
        echo "正在停止所有服务..."
        docker-compose down
        echo "所有服务已停止"
        exit 0
        ;;
    5)
        echo ""
        echo "正在重新构建并启动..."
        docker-compose down
        docker-compose build --no-cache
        docker-compose up -d backend frontend
        ;;
    *)
        echo "无效选项"
        exit 1
        ;;
esac

echo ""
echo "======================================"
echo "服务启动完成！"
echo "======================================"
echo ""

# 等待服务启动
echo "等待服务启动..."
sleep 5

# 检查服务状态
echo ""
echo "服务状态:"
docker-compose ps

echo ""
echo "访问地址:"
if docker-compose ps | grep -q "frontend.*Up"; then
    echo "  前端: http://localhost:3000"
fi
if docker-compose ps | grep -q "backend.*Up"; then
    echo "  后端: http://localhost:8000"
    echo "  API 文档: http://localhost:8000/docs"
fi
if docker-compose ps | grep -q "nginx.*Up"; then
    echo "  Nginx: http://localhost"
fi

echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo ""
