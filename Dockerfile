# ============================================
# 后端 (FastAPI) Dockerfile - 单阶段精简版
# ============================================
FROM python:3.10-slim AS backend

WORKDIR /app

# 环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt pyproject.toml setup.py ./

# 安装 Python 依赖
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# 复制项目文件
COPY tradingagents/ ./tradingagents/
COPY web/backend/ ./web/backend/
COPY web/__init__.py ./web/
COPY cli/ ./cli/
COPY main.py ./
COPY .env.example ./.env

# 安装项目
RUN pip install -e .

# 创建必要的目录
RUN mkdir -p eval_results assets web/static web/templates

# 暴露端口
EXPOSE 8000

# 默认启动后端服务
CMD ["uvicorn", "web.backend.app:app", "--host", "0.0.0.0", "--port", "8000"]