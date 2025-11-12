# 最终架构设计

## ✅ 实现完成

所有需求已按照重新梳理的架构实现完成！

## 📋 架构设计

### 1. 用户配置（前端）

**用户只配置核心策略内容：**
- 交易理念
- 风险控制
- 决策逻辑
- 交易原则

**不包含：**
- ❌ 变量占位符（{market_type}, {session_id} 等）
- ❌ 工具使用说明
- ❌ 系统文档

**默认提示词范本：**
```
You are an aggressive intraday trading agent...

## Role Definition
...

## Trading Philosophy
...

## Your Mission
...

## Trading Principles
...

## Risk Management
...
```

### 2. 后端加载（prompt_loader.py）

**功能：**
- 加载用户配置的核心提示词
- 或加载系统默认提示词
- **不做任何系统注入**

**API：**
```python
def load_user_prompt_template(
    user_id: int,
    agent_type: str = "intraday_trader",
) -> str:
    """
    Load user's core prompt template (strategy and behavior only)
    
    Returns:
        User's core prompt string (without system injections)
    """
```

**返回：**
- 纯净的核心策略提示词
- 长度：~2000-6000 字符

### 3. Agent 内部拼接（intraday_trader.py）

**在 agent_node 函数内部完成：**

#### Step 1: 加载核心提示词
```python
# 从后端加载用户的核心提示词
core_prompt = load_user_prompt_template(user_id, agent_type)
```

#### Step 2: 生成工具文档
```python
# 获取所有可用工具
tools = [get_futu_account_info, get_futu_positions, ...]

# 生成工具文档
tool_documentation = """
## Available Tools

You have access to the following tools:
- `get_futu_account_info`: Get account information...
- `get_futu_positions`: Get current positions...
...
"""
```

#### Step 3: 生成上下文信息
```python
# 从 state 获取运行时信息
market_type = state.get("market_type", "US")
session_id = state.get("session_id", "...")
timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

# 生成上下文文档
context_info = f"""
## Current Context

- Market: {market_type}
- Session ID: {session_id}
- Timestamp: {timestamp}
- User ID: {user_id}

## Market Rules
- US Market: Supports long/short, T+0
- HK Market: Long only, T+0
- CN Market: Long only, T+1

Current market is {market_type}.
"""
```

#### Step 4: 组装完整提示词
```python
# 拼接所有部分
system_message = "\n\n".join([
    tool_documentation,      # 工具说明
    context_info,           # 上下文信息
    "## Trading Strategy\n",
    core_prompt,            # 用户核心策略
    "\nNow execute your trading strategy."
])
```

#### Step 5: 创建 Prompt 并执行
```python
prompt = ChatPromptTemplate.from_messages([
    ("system", system_message),
    MessagesPlaceholder(variable_name="messages"),
])

llm_with_tools = llm.bind_tools(tools)
chain = prompt | llm_with_tools
result = chain.invoke({"messages": state.get("messages", [])})
```

## 🔄 完整流程

```
┌─────────────────────────────────────────┐
│ 1. 用户在前端配置核心策略                │
│    - 交易理念                            │
│    - 风险控制                            │
│    - 决策逻辑                            │
│    (不包含变量和工具说明)                │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 2. 后端保存核心提示词                    │
│    database.agent_prompt_templates       │
│    - user_id                             │
│    - system_prompt (核心策略)            │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 3. 执行分析时                            │
│    - 后端加载核心提示词                  │
│    - 传递给 Agent                        │
└─────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────┐
│ 4. Agent 内部 (agent_node)               │
│    a. 接收核心提示词                     │
│    b. 从 state 获取运行时信息            │
│       - market_type                      │
│       - session_id                       │
│       - timestamp                        │
│       - 历史分析结果 (messages)          │
│    c. 生成工具文档                       │
│    d. 生成上下文信息                     │
│    e. 拼接完整提示词                     │
│    f. 执行分析                           │
└─────────────────────────────────────────┘
```

## 📊 提示词结构对比

### 用户看到的（前端）
```
You are an aggressive intraday trading agent...

## Role Definition
...

## Trading Philosophy
...

## Your Mission
...

(约 2000-6000 字符)
```

### Agent 实际使用的（运行时）
```
## Available Tools

- `get_futu_account_info`: ...
- `get_futu_positions`: ...
...

## Current Context

- Market: US
- Session ID: session_20251112_223045
- Timestamp: 2025-11-12 22:30:45
- User ID: 1

## Market Rules
...

## Trading Strategy

You are an aggressive intraday trading agent...
[用户配置的核心策略]
...

Now execute your trading strategy.

(约 8000-12000 字符)
```

## ✅ 优势

1. **职责分离**
   - 用户：只关注策略
   - 后端：只负责存储和加载
   - Agent：负责完整提示词组装

2. **灵活性**
   - 工具列表可以动态变化
   - 上下文信息实时获取
   - 历史记录自动注入

3. **可维护性**
   - 用户提示词简洁
   - 系统文档集中管理
   - 易于调试和优化

4. **无循环依赖**
   - Agent 可以导入 web.backend
   - 在 agent 内部才需要这些信息
   - 架构清晰合理

## 🎯 关键文件

### 后端
- `web/backend/services/prompt_loader.py` - 加载核心提示词
- `web/backend/models.py` - 数据库模型
- `tradingagents/agents/trader/intraday_trader_default_prompt.txt` - 默认范本

### Agent
- `tradingagents/agents/trader/intraday_trader.py` - Agent 实现
  - `create_intraday_trader()` - 创建 agent
  - `agent_node()` - 核心逻辑，完成提示词拼接

### 测试
- `tests/test_final_implementation.py` - 最终实现测试

## 🚀 系统已完全就绪！

所有功能按照重新梳理的需求实现完成，架构清晰，职责分离，易于维护！
