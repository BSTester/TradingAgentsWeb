# LLM 配置初始化脚本

## 概述

`scripts/init_llm_config.py` 是一个数据库初始化脚本，用于根据 `config_routes.py` 中的配置自动初始化 LLM 供应商和模型数据。

## 功能特性

- ✅ 自动创建 8 个 LLM 供应商
- ✅ 自动创建 100+ 个预配置模型
- ✅ 支持两种模型类型（shallow_thinker / deep_thinker）
- ✅ 使用环境变量中的数据库连接
- ✅ 支持强制重新初始化
- ✅ 详细的初始化统计信息

## 使用方法

### 基本用法

```bash
# 首次初始化
python scripts/init_llm_config.py

# 强制重新初始化（会删除现有数据）
python scripts/init_llm_config.py --force
```

### 环境变量

脚本会自动读取 `DATABASE_URL` 环境变量：

```bash
# SQLite（默认）
export DATABASE_URL="sqlite+aiosqlite:///./db/tradingagents.db"

# MySQL
export DATABASE_URL="mysql+aiomysql://user:password@localhost:3306/tradingagents"

# PostgreSQL
export DATABASE_URL="postgresql+asyncpg://user:password@localhost:5432/tradingagents"
```

## 初始化的数据

### LLM 供应商（8个）

| 供应商名称 | 显示名称 | 描述 | Base URL | 状态 |
|-----------|---------|------|----------|------|
| `openai` | OpenAI | GPT系列模型 | https://api.openai.com/v1 | ✅ 已启用 |
| `anthropic` | Anthropic | Claude系列模型 | https://api.anthropic.com/ | ✅ 已启用 |
| `google` | Google | Gemini系列模型 | https://generativelanguage.googleapis.com/v1 | ✅ 已启用 |
| `openrouter` | OpenRouter | 多模型聚合平台 | https://openrouter.ai/api/v1 | ✅ 已启用 |
| `deepseek` | DeepSeek | DeepSeek系列模型 | https://api.deepseek.com/v1 | ✅ 已启用 |
| `qwen` | Qwen | 阿里千问系列模型 | https://dashscope.aliyuncs.com/compatible-mode/v1 | ✅ 已启用 |
| `oneai` | OneAI | 多模型聚合平台 | https://api.bstester.com/v1 | ✅ 已启用 |
| `ollama` | Ollama | 本地模型服务 | http://localhost:11434/v1 | ⚪ 已禁用 |

### 模型分类

#### 快速响应模型（shallow_thinker）
适合快速任务、常规对话、基础分析等场景。

**OpenAI 快速响应模型（4个）**
- gpt-4o-mini
- gpt-4.1-nano
- gpt-4.1-mini
- gpt-4o

**Anthropic 快速响应模型（4个）**
- claude-3-5-haiku-latest
- claude-3-5-sonnet-latest
- claude-3-7-sonnet-latest
- claude-sonnet-4-0

**Google 快速响应模型（3个）**
- gemini-2.0-flash-lite
- gemini-2.0-flash
- gemini-2.5-flash-preview-05-20

**DeepSeek 快速响应模型（1个）**
- deepseek-chat

**其他供应商...**

#### 深度思考模型（deep_thinker）
适合复杂推理、深度分析、策略规划等场景。

**OpenAI 深度思考模型（7个）**
- gpt-4.1-nano
- gpt-4.1-mini
- gpt-4o
- o4-mini
- o3-mini
- o3
- o1

**Anthropic 深度思考模型（5个）**
- claude-3-5-haiku-latest
- claude-3-5-sonnet-latest
- claude-3-7-sonnet-latest
- claude-sonnet-4-0
- claude-opus-4-0

**OpenRouter 深度思考模型（11个）**
- deepseek/deepseek-v3.2-exp
- deepseek/deepseek-r1
- google/gemini-2.5-pro
- openai/gpt-5
- openai/o1-pro
- openai/o3
- anthropic/claude-sonnet-4
- anthropic/claude-opus-4.1
- x-ai/grok-4
- x-ai/grok-3
- qwen/qwen3-max

**其他供应商...**

## 执行流程

```mermaid
graph TD
    A[开始] --> B{检查表是否存在}
    B -->|不存在| C[提示运行迁移脚本]
    B -->|存在| D{force 参数?}
    D -->|是| E[删除现有数据]
    D -->|否| F{已有数据?}
    F -->|是| G[提示使用 --force]
    F -->|否| H[初始化供应商]
    E --> H
    H --> I[初始化模型]
    I --> J[显示统计信息]
    J --> K[完成]
    C --> L[退出]
    G --> L
```

## 输出示例

```
======================================================================
LLM 配置数据库初始化
======================================================================

数据库: sqlite:///./db/tradingagents.db

📦 初始化 LLM 供应商...
   ✅ 已启用 OpenAI (openai)
   ✅ 已启用 Anthropic (anthropic)
   ✅ 已启用 Google (google)
   ✅ 已启用 OpenRouter (openrouter)
   ✅ 已启用 DeepSeek (deepseek)
   ✅ 已启用 Qwen (qwen)
   ✅ 已启用 OneAI (oneai)
   ⚪ 已禁用 Ollama (ollama)

   ✅ 已创建 8 个供应商

🤖 初始化 LLM 模型...
   ✅ OpenAI: 11 个模型
   ✅ OneAI: 15 个模型
   ✅ DeepSeek: 2 个模型
   ✅ Qwen: 2 个模型
   ✅ Anthropic: 9 个模型
   ✅ Google: 7 个模型
   ✅ OpenRouter: 21 个模型
   ✅ Ollama: 4 个模型

   ✅ 总计创建 71 个模型

======================================================================
📊 初始化完成统计
======================================================================

供应商总数: 8
  - 已启用: 7
  - 已禁用: 1

模型总数: 71
  - 快速响应 (shallow_thinker): 34
  - 深度思考 (deep_thinker): 37
  - 已启用: 67
  - 已禁用: 4

======================================================================
✅ LLM 配置初始化成功！
======================================================================

💡 提示:
   - 访问 /admin/llm-config 页面查看和管理配置
   - 记得为每个供应商配置 API Key
```

## 前置条件

### 1. 运行数据库迁移

在首次初始化之前，需要先创建数据库表：

```bash
python web/backend/migrations/add_llm_providers_models.py
```

### 2. 确保数据库可访问

脚本会自动检测数据库类型并转换为同步连接字符串：

- `sqlite+aiosqlite://` → `sqlite://`
- `mysql+aiomysql://` → `mysql+pymysql://`

## 参数说明

### `--force`

强制重新初始化数据库。

**⚠️ 警告**: 此操作会删除所有现有的供应商和模型数据！

```bash
python scripts/init_llm_config.py --force
```

**使用场景**:
- 配置文件更新，需要重新初始化
- 数据损坏，需要重建
- 测试环境重置

## 数据来源

脚本从 `web/backend/routes/config_routes.py` 中提取配置：

```python
# 供应商配置
LLM_PROVIDERS_CONFIG = [
    {
        "provider_name": "openai",
        "display_name": "OpenAI",
        "description": "GPT系列模型",
        "base_url": "https://api.openai.com/v1",
        "is_active": True
    },
    # ...
]

# 模型配置
MODELS_CONFIG = {
    "openai": {
        "shallow_thinker": [...],
        "deep_thinker": [...]
    },
    # ...
}
```

## 常见问题

### Q1: 提示"LLM 配置表不存在"

**A**: 需要先运行数据库迁移脚本：

```bash
python web/backend/migrations/add_llm_providers_models.py
```

### Q2: 提示"数据库中已有供应商"

**A**: 使用 `--force` 参数强制重新初始化：

```bash
python scripts/init_llm_config.py --force
```

### Q3: 如何修改初始化的数据？

**A**: 有两种方式：

1. **修改脚本配置** - 编辑 `scripts/init_llm_config.py` 中的配置字典
2. **使用管理后台** - 访问 `/admin/llm-config` 页面手动修改

### Q4: 支持哪些数据库？

**A**: 支持所有 SQLAlchemy 兼容的数据库：
- SQLite（默认）
- MySQL
- PostgreSQL
- 其他（需要安装相应驱动）

## 后续操作

初始化完成后，建议执行以下步骤：

1. **配置 API Keys**
   - 访问 `/admin/llm-config` 管理页面
   - 为每个供应商添加 API Key

2. **调整模型状态**
   - 启用/禁用特定供应商
   - 启用/禁用特定模型

3. **测试连接**
   - 使用"测试连接"功能验证 API Key
   - 确保配置正确可用

## 相关文档

- [LLM 配置管理文档](./LLM_CONFIG_MANAGEMENT.md)
- [管理员快速入门](../web/ADMIN_LLM_CONFIG_QUICKSTART.md)
- [数据库迁移说明](./DATABASE_MIGRATIONS.md)

## 技术细节

### 数据库会话管理

```python
# 自动处理同步/异步 URL 转换
sync_db_url = get_sync_database_url()
engine = create_engine(sync_db_url, echo=False)
Session = sessionmaker(bind=engine)
```

### 事务处理

```python
# 先添加供应商，获取 ID
session.add(provider)
session.flush()  # 获取自增 ID

# 再添加关联的模型
model = LLMModel(provider_id=provider.id, ...)
session.add(model)

# 最后提交事务
session.commit()
```

### 错误处理

```python
try:
    # 初始化逻辑
    session.commit()
except Exception as e:
    session.rollback()  # 出错时回滚
    print(f"❌ 初始化失败: {e}")
    raise
finally:
    session.close()  # 确保关闭会话
```

## 维护建议

1. **定期同步配置** - 当 `config_routes.py` 更新时，同步更新初始化脚本
2. **版本控制** - 记录每次初始化的数据版本
3. **备份数据** - 在使用 `--force` 前备份重要数据
4. **测试验证** - 初始化后验证数据完整性

## 许可证

与项目主体保持一致。
