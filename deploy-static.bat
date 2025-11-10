@echo off
REM 静态部署脚本 - Windows 版本
REM 使用 Nginx 托管静态文件

echo ==========================================
echo TradingAgents 静态部署脚本 (Windows)
echo ==========================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker 未安装
    echo 请先安装 Docker Desktop: https://docs.docker.com/desktop/install/windows-install/
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: Docker Compose 未安装
    echo Docker Desktop 应该已包含 Docker Compose
    pause
    exit /b 1
)

echo ✅ Docker 和 Docker Compose 已安装
echo.

REM 检查 .env 文件
if not exist .env (
    echo ⚠️  警告: .env 文件不存在
    if exist .env.example (
        echo 📝 从 .env.example 创建 .env 文件...
        copy .env.example .env
        echo ✅ .env 文件已创建，请根据需要修改配置
    ) else (
        echo ❌ 错误: .env.example 文件也不存在
        pause
        exit /b 1
    )
)

echo ✅ 环境配置文件已就绪
echo.

REM 询问是否停止现有容器
set /p STOP_CONTAINERS="是否停止并删除现有容器？(y/n): "
if /i "%STOP_CONTAINERS%"=="y" (
    echo 🛑 停止现有容器...
    docker-compose -f docker-compose.static.yml down 2>nul
    echo ✅ 现有容器已停止
    echo.
)

REM 询问是否清理旧镜像
set /p CLEAN_IMAGES="是否清理旧的 Docker 镜像？(y/n): "
if /i "%CLEAN_IMAGES%"=="y" (
    echo 🧹 清理旧镜像...
    docker-compose -f docker-compose.static.yml down --rmi all 2>nul
    echo ✅ 旧镜像已清理
    echo.
)

REM 构建镜像
echo 🔨 开始构建 Docker 镜像...
echo 这可能需要几分钟时间，请耐心等待...
echo.

docker-compose -f docker-compose.static.yml build --no-cache
if errorlevel 1 (
    echo ❌ 构建失败
    pause
    exit /b 1
)

echo.
echo ✅ Docker 镜像构建完成
echo.

REM 启动服务
echo 🚀 启动服务...
docker-compose -f docker-compose.static.yml up -d
if errorlevel 1 (
    echo ❌ 启动失败
    pause
    exit /b 1
)

echo.
echo ✅ 服务启动成功！
echo.

REM 等待服务就绪
echo ⏳ 等待服务就绪...
timeout /t 5 /nobreak >nul

REM 检查服务状态
echo.
echo 📊 服务状态：
docker-compose -f docker-compose.static.yml ps

echo.
echo ==========================================
echo ✅ 部署完成！
echo ==========================================
echo.
echo 📝 访问信息：
echo    前端地址: http://localhost:8000
echo    后端 API: http://localhost:8000/api
echo    WebSocket: ws://localhost:8000/ws
echo.
echo 📋 常用命令：
echo    查看日志: docker-compose -f docker-compose.static.yml logs -f
echo    停止服务: docker-compose -f docker-compose.static.yml down
echo    重启服务: docker-compose -f docker-compose.static.yml restart
echo.
echo 📖 详细文档: 查看 STATIC_DEPLOYMENT.md
echo.

pause
