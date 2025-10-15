# ============================================
# 阶段 1: 构建前端 (Next.js)
# ============================================
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# 复制前端依赖文件
COPY web/frontend/package*.json ./

# 安装前端依赖
RUN npm ci

# 复制前端源代码
COPY web/frontend/ ./

# 设置环境变量
ENV NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 \
    NODE_ENV=production

# 构建前端
RUN npm run build

# ============================================
# 阶段 2: 构建后端 (Python/FastAPI)
# ============================================
FROM python:3.10-slim AS backend

WORKDIR /app

# 设置环境变量
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

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /frontend/.next ./web/frontend/.next
COPY --from=frontend-builder /frontend/public ./web/frontend/public
COPY --from=frontend-builder /frontend/package.json ./web/frontend/package.json
COPY --from=frontend-builder /frontend/next.config.ts ./web/frontend/next.config.ts

# 安装项目
RUN pip install -e .

# 创建必要的目录
RUN mkdir -p eval_results assets web/static web/templates

# 暴露端口
EXPOSE 8000 3000

# 默认启动后端服务
CMD ["uvicorn", "web.backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
