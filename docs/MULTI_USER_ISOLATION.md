# 多用户隔离机制说明

## 现有隔离机制（已实现）

你的项目已经有完善的多用户隔离架构，各个层面都做了隔离：

### 1. 调度器层面（Scheduler）

**文件**: `web/backend/services/user_intraday_scheduler.py`

```python
class UserIntradaySchedulerManager:
    def __init__(self):
        self._schedulers: Dict[int, IntradayScheduler] = {}  # user_id -> scheduler
        self._user_configs: Dict[int, dict] = {}             # user_id -> config
```

**隔离机制**：
- 每个用户有独立的 `IntradayScheduler` 实例
- 通过 `user_id` 作为 key 存储在字典中
- 用户 A 的调度器完全独立于用户 B

**示例**：
```python
# 用户 1 的调度器
scheduler_1 = await manager.create_scheduler(user_id=1, interval_minutes=5)
await manager.start_scheduler(user_id=1)

# 用户 2 的调度器（完全独立）
scheduler_2 = await manager.create_scheduler(user_id=2, interval_minutes=10)
await manager.start_scheduler(user_id=2)

# 互不干扰
await manager.stop_scheduler(user_id=1)  # 只停止用户 1，不影响用户 2
```

### 2. WebSocket 层面（实时通信）

**文件**: `web/backend/app.py`

```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # analysis_id -> connections
```

**隔离机制**：
- 每个分析任务有唯一的 `analysis_id`
- WebSocket 消息通过 `analysis_id` 路由到对应用户
- 用户 A 的 WebSocket 不会收到用户 B 的消息

**示例**：
```python
# 用户 1 的分析
await manager.send_message(
    {"type": "log", "message": "User 1 analysis started"},
    analysis_id="intraday_user_1"  # 只发送给用户 1
)

# 用户 2 的分析（完全隔离）
await manager.send_message(
    {"type": "log", "message": "User 2 analysis started"},
    analysis_id="intraday_user_2"  # 只发送给用户 2
)
```

### 3. 数据库层面（数据隔离）

**文件**: `web/backend/models.py`

```python
class AnalysisRecord(Base):
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    # 查询时自动过滤
    # db.query(AnalysisRecord).filter(AnalysisRecord.user_id == current_user.id)
```

**隔离机制**：
- 所有数据表都有 `user_id` 字段
- API 路由通过 JWT 认证获取 `current_user`
- 查询时自动过滤，用户只能看到自己的数据

### 4. 任务队列层面（执行隔离）

**文件**: `web/backend/services/task_manager.py`

```python
class TaskManager:
    def __init__(self):
        self._user_queues: Dict[int, asyncio.Queue] = {}  # user_id -> queue
        self._user_tasks: Dict[int, asyncio.Task] = {}    # user_id -> worker task
```

**隔离机制**：
- 每个用户有独立的任务队列
- 用户 A 的任务不会阻塞用户 B
- 并发执行，互不影响

## 提示词配置的多用户隔离（新增）

### 数据库设计

```python
class AgentPromptTemplate(Base):
    __tablename__ = "agent_prompt_templates"
    
    id = Column(Integer, primary_key=True)
    agent_type = Column(String(50), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)  # 关键：用户隔离
    
    system_prompt = Column(Text, nullable=False)
    
    # 唯一约束：每个用户每种 agent 只能有一个激活的模板
    __table_args__ = (
        UniqueConstraint('agent_type', 'user_id', name='uq_agent_user'),
    )
```

### 加载逻辑（用户隔离）

```python
def load_system_prompt(user_id: int, market_type: str, session_id: str) -> tuple[str, list]:
    """
    加载用户专属的提示词配置
    
    关键：通过 user_id 过滤，确保用户只能加载自己的配置
    """
    db = SessionLocal()
    try:
        # 查询时必须带 user_id 过滤
        template = db.query(AgentPromptTemplate).filter(
            AgentPromptTemplate.agent_type == "intraday_trader",
            AgentPromptTemplate.user_id == user_id,  # 用户隔离
            AgentPromptTemplate.is_active == True
        ).first()
        
        if not template:
            # 用户首次使用，创建默认模板
            template = create_default_template_for_user(user_id)
        
        # 获取用户启用的工具列表
        enabled_tools = db.query(TemplateTools).filter(
            TemplateTools.template_id == template.id,
            TemplateTools.is_enabled == True
        ).all()
        
        tool_names = [t.tool_name for t in enabled_tools]
        
        # 注入运行时变量
        system_prompt = template.system_prompt.format(
            market_type=market_type,
            session_id=session_id,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            user_id=user_id
        )
        
        return system_prompt, tool_names
    
    finally:
        db.close()
```

### Agent 创建（用户隔离）

```python
def create_intraday_trader(llm, memory, user_id: int):
    """
    为特定用户创建 Agent
    
    关键：user_id 贯穿整个流程
    """
    
    def agent_node(state):
        # 从 state 中获取 user_id
        user_id = state.get("user_id")
        market_type = state.get("market_type", "US")
        session_id = state.get("session_id")
        
        # 加载该用户的专属配置
        system_prompt, enabled_tools = load_system_prompt(user_id, market_type, session_id)
        
        # 使用用户配置的工具
        from tradingagents.agents.utils.futu_trading_tools import ALL_TOOLS
        tools = [t for t in ALL_TOOLS if t.name in enabled_tools]
        llm_with_tools = llm.bind_tools(tools)
        
        # 创建提示词
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),  # 用户专属提示词
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        chain = prompt | llm_with_tools
        result = chain.invoke({"messages": state.get("messages", [])})
        
        return {"messages": [result]}
    
    # ... 构建 graph
    return app
```

### API 路由（用户隔离）

```python
@router.get("/api/prompts/templates/{agent_type}")
async def get_prompt_template(
    agent_type: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)  # JWT 认证
):
    """
    获取当前用户的提示词模板
    
    关键：通过 current_user 自动隔离
    """
    template = db.query(AgentPromptTemplate).filter(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,  # 只能访问自己的
        AgentPromptTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template.to_dict()


@router.put("/api/prompts/templates/{agent_type}")
async def update_prompt_template(
    agent_type: str,
    data: PromptTemplateUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    更新当前用户的提示词模板
    
    关键：只能更新自己的模板
    """
    template = db.query(AgentPromptTemplate).filter(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,  # 只能修改自己的
        AgentPromptTemplate.is_active == True
    ).first()
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # 更新
    template.system_prompt = data.system_prompt
    template.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(template)
    
    return template.to_dict()
```

## 完整的隔离流程示例

### 场景：用户 1 和用户 2 同时使用智能盯盘

```
时间线：

T0: 用户 1 登录，编辑提示词
    ├─ JWT Token: user_id=1
    ├─ PUT /api/prompts/templates/intraday_trader
    └─ 更新 agent_prompt_templates (user_id=1)

T1: 用户 2 登录，编辑提示词
    ├─ JWT Token: user_id=2
    ├─ PUT /api/prompts/templates/intraday_trader
    └─ 更新 agent_prompt_templates (user_id=2)

T2: 用户 1 启动智能盯盘
    ├─ POST /api/intraday/start
    ├─ 创建 IntradayScheduler(user_id=1)
    ├─ 加载 AgentPromptTemplate(user_id=1)  ← 用户 1 的配置
    ├─ 创建 Agent with user_1_prompt
    ├─ WebSocket: analysis_id="intraday_user_1"
    └─ 开始执行（使用用户 1 的策略）

T3: 用户 2 启动智能盯盘（同时进行）
    ├─ POST /api/intraday/start
    ├─ 创建 IntradayScheduler(user_id=2)
    ├─ 加载 AgentPromptTemplate(user_id=2)  ← 用户 2 的配置
    ├─ 创建 Agent with user_2_prompt
    ├─ WebSocket: analysis_id="intraday_user_2"
    └─ 开始执行（使用用户 2 的策略）

T4: 两个 Agent 并行运行
    ├─ User 1 Agent:
    │   ├─ 使用用户 1 的提示词
    │   ├─ 使用用户 1 启用的工具
    │   ├─ 消息发送到 "intraday_user_1"
    │   └─ 结果保存到 analysis_records (user_id=1)
    │
    └─ User 2 Agent:
        ├─ 使用用户 2 的提示词
        ├─ 使用用户 2 启用的工具
        ├─ 消息发送到 "intraday_user_2"
        └─ 结果保存到 analysis_records (user_id=2)

完全隔离，互不干扰！
```

## 隔离保证

### 1. 数据隔离
- ✅ 每个用户的提示词存储在独立的数据库记录中
- ✅ 通过 `user_id` 外键关联
- ✅ 查询时自动过滤

### 2. 执行隔离
- ✅ 每个用户有独立的 Scheduler 实例
- ✅ 每个用户有独立的任务队列
- ✅ Agent 实例在运行时创建，使用用户专属配置

### 3. 通信隔离
- ✅ WebSocket 通过 `analysis_id` 路由
- ✅ 用户 A 的消息不会发送给用户 B
- ✅ 前端通过 JWT 认证连接到自己的 WebSocket

### 4. 配置隔离
- ✅ 提示词配置按 `user_id` 隔离
- ✅ 工具选择按 `user_id` 隔离
- ✅ API 路由通过 JWT 自动过滤

## 安全性

### 防止越权访问

```python
# ❌ 错误：没有用户过滤
template = db.query(AgentPromptTemplate).filter(
    AgentPromptTemplate.agent_type == agent_type
).first()  # 可能返回其他用户的模板！

# ✅ 正确：必须带 user_id 过滤
template = db.query(AgentPromptTemplate).filter(
    AgentPromptTemplate.agent_type == agent_type,
    AgentPromptTemplate.user_id == current_user.id  # 只能访问自己的
).first()
```

### JWT 认证

```python
@router.get("/api/prompts/templates/{agent_type}")
async def get_prompt_template(
    agent_type: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)  # 必须认证
):
    # current_user 由 JWT token 解析得到
    # 无法伪造或访问其他用户的数据
    pass
```

## 总结

你的项目已经有完善的多用户隔离架构，提示词配置只需要：

1. **数据库层**：添加 `user_id` 字段和唯一约束
2. **加载逻辑**：查询时带上 `user_id` 过滤
3. **API 路由**：使用 `current_user` 自动隔离
4. **Agent 创建**：传入 `user_id` 参数

**结论**：✅ 完全可以做到多用户执行时互不干扰！

每个用户：
- 有自己的提示词配置
- 有自己的工具选择
- 有自己的调度器
- 有自己的 WebSocket 连接
- 有自己的执行结果

用户 A 修改提示词不会影响用户 B，用户 A 的 Agent 执行也不会干扰用户 B。
