# 环境变量配置说明

## 快速开始

1. **复制示例文件**
   ```bash
   cp .env.example .env
   ```

2. **编辑 .env 文件**
   根据你的需求修改配置

3. **启动服务**
   ```bash
   docker-compose up -d
   ```

## 环境变量说明

### Docker 部署配置

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `BACKEND_URL` | 后端服务地址（Docker 内部） | `backend:8000` | ✅ |
| `NODE_ENV` | 运行环境 | `production` | ✅ |

### 数据库配置

| 变量名 | 说明 | 默认值 | 必需 |
|--------|------|--------|------|
| `DATABASE_URL` | 数据库连接字符串 | `sqlite:///./tradingagents.db` | ✅ |

### LLM API Keys

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 | ❌ |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | ❌ |
| `GOOGLE_API_KEY` | Google API 密钥 | ❌ |
| `OPENROUTER_API_KEY` | OpenRouter API 密钥 | ❌ |

### 数据源 API Keys

| 变量名 | 说明 | 必需 |
|--------|------|------|
| `ALPHA_VANTAGE_API_KEY` | Alpha Vantage API 密钥 | ❌ |

## 配置示例

### 最小配置（使用 Ollama 本地模型）

```env
BACKEND_URL=backend:8000
DATABASE_URL=sqlite:///./tradingagents.db
NODE_ENV=production
```

### 完整配置（使用云端 LLM）

```env
# Docker 配置
BACKEND_URL=backend:8000
NODE_ENV=production

# 数据库
DATABASE_URL=sqlite:///./tradingagents.db

# LLM API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
OPENROUTER_API_KEY=sk-or-...

# 数据源
ALPHA_VANTAGE_API_KEY=YOUR_KEY
```

## 注意事项

1. **不要提交 .env 文件到 Git**
   - `.env` 文件已在 `.gitignore` 中
   - 只提交 `.env.example` 作为模板

2. **API Keys 安全**
   - 不要在代码中硬编码 API Keys
   - 不要分享包含真实 API Keys 的 .env 文件

3. **Docker 网络**
   - `BACKEND_URL=backend:8000` 使用 Docker 内部网络
   - 不要改为 `localhost`，容器间通信使用服务名

4. **环境变量优先级**
   - docker-compose.yml 中的 `env_file` 会加载 .env
   - 所有服务共享同一个 .env 文件
   - 可以在 docker-compose.yml 中覆盖特定变量

## 故障排查

### 问题：容器无法连接后端

**原因**：`BACKEND_URL` 配置错误

**解决**：
```env
# ❌ 错误
BACKEND_URL=localhost:8000

# ✅ 正确
BACKEND_URL=backend:8000
```

### 问题：API Keys 不生效

**原因**：.env 文件未正确加载

**解决**：
1. 确认 .env 文件在项目根目录
2. 重启容器：`docker-compose restart`
3. 检查环境变量：`docker-compose exec backend env | grep API_KEY`

## 更多信息

- [Docker Compose 环境变量文档](https://docs.docker.com/compose/environment-variables/)
- [Next.js 环境变量文档](https://nextjs.org/docs/basic-features/environment-variables)
