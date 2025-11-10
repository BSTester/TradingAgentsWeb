#!/bin/bash
# 静态部署脚本 - 使用 Nginx 托管静态文件

set -e

echo "=========================================="
echo "TradingAgents 静态部署脚本"
echo "=========================================="
echo ""

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: Docker 未安装"
    echo "请先安装 Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: Docker Compose 未安装"
    echo "请先安装 Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 和 Docker Compose 已安装"
echo ""

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "⚠️  警告: .env 文件不存在"
    if [ -f .env.example ]; then
        echo "📝 从 .env.example 创建 .env 文件..."
        cp .env.example .env
        echo "✅ .env 文件已创建，请根据需要修改配置"
    else
        echo "❌ 错误: .env.example 文件也不存在"
        exit 1
    fi
fi

echo "✅ 环境配置文件已就绪"
echo ""

# 询问是否停止现有容器
read -p "是否停止并删除现有容器？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 停止现有容器..."
    docker-compose -f docker-compose.static.yml down || true
    echo "✅ 现有容器已停止"
    echo ""
fi

# 询问是否清理旧镜像
read -p "是否清理旧的 Docker 镜像？(y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 清理旧镜像..."
    docker-compose -f docker-compose.static.yml down --rmi all || true
    echo "✅ 旧镜像已清理"
    echo ""
fi

# 构建镜像
echo "🔨 开始构建 Docker 镜像..."
echo "这可能需要几分钟时间，请耐心等待..."
echo ""

docker-compose -f docker-compose.static.yml build --no-cache

echo ""
echo "✅ Docker 镜像构建完成"
echo ""

# 启动服务
echo "🚀 启动服务..."
docker-compose -f docker-compose.static.yml up -d

echo ""
echo "✅ 服务启动成功！"
echo ""

# 等待服务就绪
echo "⏳ 等待服务就绪..."
sleep 5

# 检查服务状态
echo ""
echo "📊 服务状态："
docker-compose -f docker-compose.static.yml ps

echo ""
echo "=========================================="
echo "✅ 部署完成！"
echo "=========================================="
echo ""
echo "📝 访问信息："
echo "   前端地址: http://localhost:8000"
echo "   后端 API: http://localhost:8000/api"
echo "   WebSocket: ws://localhost:8000/ws"
echo ""
echo "📋 常用命令："
echo "   查看日志: docker-compose -f docker-compose.static.yml logs -f"
echo "   停止服务: docker-compose -f docker-compose.static.yml down"
echo "   重启服务: docker-compose -f docker-compose.static.yml restart"
echo ""
echo "📖 详细文档: 查看 STATIC_DEPLOYMENT.md"
echo ""
