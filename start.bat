@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ======================================
echo TradingAgents Docker 部署脚本
echo ======================================
echo.

REM 检查 Docker 是否安装
docker --version >nul 2>&1
if errorlevel 1 (
    echo 错误: Docker 未安装，请先安装 Docker Desktop
    pause
    exit /b 1
)

REM 检查 Docker Compose 是否安装
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo 错误: Docker Compose 未安装
    pause
    exit /b 1
)

REM 检查 .env 文件
if not exist .env (
    echo 警告: .env 文件不存在，正在从 .env.example 复制...
    copy .env.example .env >nul
    echo 请编辑 .env 文件并填入你的 API 密钥
    echo.
)

REM 检查前端 .env.local 文件
if not exist web\frontend\.env.local (
    echo 警告: web\frontend\.env.local 文件不存在，正在从 .env.local.example 复制...
    copy web\frontend\.env.local.example web\frontend\.env.local >nul
    echo.
)

REM 询问用户要启动的服务
echo 请选择启动模式:
echo 1^) 完整服务 ^(前端 + 后端^)
echo 2^) 仅后端服务
echo 3^) 完整服务 + Nginx
echo 4^) 停止所有服务
echo 5^) 重新构建并启动
echo.
set /p choice="请输入选项 (1-5): "

if "%choice%"=="1" (
    echo.
    echo 正在启动完整服务 ^(前端 + 后端^)...
    docker-compose up -d backend frontend
) else if "%choice%"=="2" (
    echo.
    echo 正在启动后端服务...
    docker-compose up -d backend
) else if "%choice%"=="3" (
    echo.
    echo 正在启动完整服务 + Nginx...
    docker-compose up -d
) else if "%choice%"=="4" (
    echo.
    echo 正在停止所有服务...
    docker-compose down
    echo 所有服务已停止
    pause
    exit /b 0
) else if "%choice%"=="5" (
    echo.
    echo 正在重新构建并启动...
    docker-compose down
    docker-compose build --no-cache
    docker-compose up -d backend frontend
) else (
    echo 无效选项
    pause
    exit /b 1
)

echo.
echo ======================================
echo 服务启动完成！
echo ======================================
echo.

REM 等待服务启动
echo 等待服务启动...
timeout /t 5 /nobreak >nul

REM 检查服务状态
echo.
echo 服务状态:
docker-compose ps

echo.
echo 访问地址:
docker-compose ps | findstr "frontend" | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo   前端: http://localhost:3000
)
docker-compose ps | findstr "backend" | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo   后端: http://localhost:8000
    echo   API 文档: http://localhost:8000/docs
)
docker-compose ps | findstr "nginx" | findstr "Up" >nul 2>&1
if not errorlevel 1 (
    echo   Nginx: http://localhost
)

echo.
echo 查看日志: docker-compose logs -f
echo 停止服务: docker-compose down
echo.
pause
