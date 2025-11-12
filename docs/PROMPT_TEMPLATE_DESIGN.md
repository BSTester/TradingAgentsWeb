# Agent 提示词模板化设计方案

## 设计目标

将 Agent 提示词分为两层：
1. **工具定义层**：可用工具的元数据（名称、参数、说明）- 系统维护，用户不可编辑
2. **用户提示词层**：完整的系统提示词 - 用户可完全自定义（包括执行流程、输出格式、交易策略等）

**核心理念**：给用户最大自由度，只保护工具定义和运行时变量注入

## 数据库设计

```sql
-- 工具定义表（系统维护，用户只读）
CREATE TABLE agent_tools (
    id INTEGER PRIMARY KEY,
    tool_name VARCHAR(100) UNIQUE NOT NULL,  -- 'get_futu_account_info'
    tool_description TEXT NOT NULL,          -- 工具功能说明
    tool_parameters TEXT NOT NULL,           -- JSON 格式的参数定义
    category VARCHAR(50),                    -- 'account', 'market_data', 'trading'
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 提示词模板表（用户可编辑）
CREATE TABLE agent_prompt_templates (
    id INTEGER PRIMARY KEY,
    agent_type VARCHAR(50) NOT NULL,         -- 'intraday_trader'
    user_id INTEGER,                         -- 用户ID（支持多用户多模板）
    
    -- 用户完全可编辑的提示词
    system_prompt TEXT NOT NULL,             -- 完整的系统提示词
    
    -- 元数据
    template_name VARCHAR(100),
    description TEXT,
    version VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    UNIQUE(agent_type, user_id)
);

-- 模板使用的工具关联表（用户可选择使用哪些工具）
CREATE TABLE template_tools (
    id INTEGER PRIMARY KEY,
    template_id INTEGER NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (template_id) REFERENCES agent_prompt_templates(id),
    FOREIGN KEY (tool_name) REFERENCES agent_tools(tool_name),
    UNIQUE(template_id, tool_name)
);
```

## 提示词结构

### 1. 工具定义层（系统维护 - 只读展示）

在前端以**参考文档**形式展示，用户编辑时可查看：

```markdown
## 📚 可用工具参考

### 账户类工具
- `get_futu_account_info(market_type)` - 获取账户资金信息
  * 参数：market_type (US/HK/CN)
  * 返回：总资产、可用资金、持仓市值等

- `get_futu_positions(market_type)` - 获取当前持仓
  * 参数：market_type (US/HK/CN)
  * 返回：股票代码、数量、成本价、持仓天数等

### 行情数据工具
- `get_futu_quote(stock_code)` - 获取实时行情
- `get_futu_kline(symbol, interval, format)` - 获取K线数据
- `get_futu_technical_analysis(symbol, interval, indicator, format)` - 获取技术指标

### 交易执行工具
- `place_futu_order(stock_code, direction, quantity, price, order_type)` - 下单

### 新闻和热点工具
- `get_futu_hot_news(lang)` - 获取热门新闻
- `get_akshare_news(limit)` - 获取财经新闻
- `get_futu_hot_stocks(market_type)` - 获取热门股票

## 🔧 运行时变量（自动注入）
- `{market_type}` - 市场类型 (US/HK/CN)
- `{session_id}` - 会话ID
- `{timestamp}` - 当前时间戳
- `{user_id}` - 用户ID
```

### 2. 用户提示词层（完全可编辑）

用户可以自由编写，包括：
- ✅ 角色定义
- ✅ 交易哲学和策略
- ✅ 执行流程（Phase 1-N，或完全自定义）
- ✅ 工具使用方式（选择使用哪些工具、如何组合）
- ✅ 输出格式
- ✅ 风险参数
- ✅ 决策逻辑
- ✅ 任何自定义规则

## 实现示例

### 数据库模型

```python
class AgentTool(Base):
    """工具定义表（系统维护）"""
    __tablename__ = "agent_tools"
    
    id = Column(Integer, primary_key=True)
    tool_name = Column(String(100), unique=True, nullable=False)
    tool_description = Column(Text, nullable=False)
    tool_parameters = Column(Text, nullable=False)  # JSON
    category = Column(String(50))  # 'account', 'market_data', 'trading', 'news'
    is_available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AgentPromptTemplate(Base):
    """提示词模板表（用户可编辑）"""
    __tablename__ = "agent_prompt_templates"
    
    id = Column(Integer, primary_key=True)
    agent_type = Column(String(50), nullable=False)
    user_id = Column(Integer)  # 支持多用户
    
    # 用户完全可编辑的提示词
    system_prompt = Column(Text, nullable=False)
    
    # 元数据
    template_name = Column(String(100))
    description = Column(Text)
    version = Column(String(20), default="1.0")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        UniqueConstraint('agent_type', 'user_id', name='uq_agent_user'),
    )


class TemplateTools(Base):
    """模板使用的工具关联表"""
    __tablename__ = "template_tools"
    
    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey('agent_prompt_templates.id'), nullable=False)
    tool_name = Column(String(100), ForeignKey('agent_tools.tool_name'), nullable=False)
    is_enabled = Column(Boolean, default=True)
    
    __table_args__ = (
        UniqueConstraint('template_id', 'tool_name', name='uq_template_tool'),
    )
```

### Agent 加载逻辑

```python
def load_system_prompt(user_id: int, market_type: str, session_id: str) -> tuple[str, list]:
    """
    加载系统提示词和可用工具列表
    
    Returns:
        (system_prompt, enabled_tools)
    """
    db = SessionLocal()
    try:
        # 1. 加载用户的提示词模板
        template = db.query(AgentPromptTemplate).filter(
            AgentPromptTemplate.agent_type == "intraday_trader",
            AgentPromptTemplate.user_id == user_id,
            AgentPromptTemplate.is_active == True
        ).first()
        
        if not template:
            # 使用默认模板
            template = get_default_template()
        
        # 2. 获取用户启用的工具列表
        enabled_tools = db.query(TemplateTools).filter(
            TemplateTools.template_id == template.id,
            TemplateTools.is_enabled == True
        ).all()
        
        tool_names = [t.tool_name for t in enabled_tools]
        
        # 如果没有配置，使用所有可用工具
        if not tool_names:
            all_tools = db.query(AgentTool).filter(
                AgentTool.is_available == True
            ).all()
            tool_names = [t.tool_name for t in all_tools]
        
        # 3. 注入运行时变量
        system_prompt = template.system_prompt.format(
            market_type=market_type,
            session_id=session_id,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            user_id=user_id
        )
        
        return system_prompt, tool_names
    
    finally:
        db.close()


def create_intraday_trader(llm, memory, user_id: int):
    """创建 Agent 时根据用户配置加载提示词和工具"""
    
    def agent_node(state):
        market_type = state.get("market_type", "US")
        session_id = state.get("session_id", f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        
        # 加载用户的提示词和工具配置
        system_prompt, enabled_tool_names = load_system_prompt(user_id, market_type, session_id)
        
        # 根据配置筛选工具
        from tradingagents.agents.utils.futu_trading_tools import ALL_TOOLS
        enabled_tools = [t for t in ALL_TOOLS if t.name in enabled_tool_names]
        
        # 绑定工具到 LLM
        llm_with_tools = llm.bind_tools(enabled_tools)
        
        # 创建提示词
        prompt = ChatPromptTemplate.from_messages([
            ("system", system_prompt),
            MessagesPlaceholder(variable_name="messages"),
        ])
        
        chain = prompt | llm_with_tools
        result = chain.invoke({"messages": state.get("messages", [])})
        
        return {"messages": [result]}
    
    # ... 构建 graph
```

### 前端编辑界面

```typescript
interface PromptEditorProps {
  userId: number;
  agentType: string;
}

function PromptEditor({ userId, agentType }: PromptEditorProps) {
  const [prompt, setPrompt] = useState('');
  const [availableTools, setAvailableTools] = useState<Tool[]>([]);
  const [enabledTools, setEnabledTools] = useState<string[]>([]);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  
  return (
    <div className="grid grid-cols-12 gap-4">
      {/* 左侧：工具参考面板（可折叠） */}
      <div className={`col-span-3 ${showToolsPanel ? '' : 'hidden'}`}>
        <Card>
          <CardHeader>
            <CardTitle>📚 可用工具参考</CardTitle>
          </CardHeader>
          <CardContent>
            {availableTools.map(tool => (
              <div key={tool.name} className="mb-4">
                <Checkbox
                  checked={enabledTools.includes(tool.name)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setEnabledTools([...enabledTools, tool.name]);
                    } else {
                      setEnabledTools(enabledTools.filter(t => t !== tool.name));
                    }
                  }}
                />
                <code className="text-sm">{tool.name}</code>
                <p className="text-xs text-muted-foreground">{tool.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      
      {/* 右侧：提示词编辑器 */}
      <div className={showToolsPanel ? 'col-span-9' : 'col-span-12'}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>🤖 Agent 提示词配置</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowToolsPanel(!showToolsPanel)}
              >
                {showToolsPanel ? '隐藏' : '显示'}工具面板
              </Button>
            </div>
            <CardDescription>
              完全自定义 Agent 的行为、执行流程和输出格式
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">编辑</TabsTrigger>
                <TabsTrigger value="preview">预览</TabsTrigger>
                <TabsTrigger value="variables">变量说明</TabsTrigger>
              </TabsList>
              
              <TabsContent value="edit">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="font-mono text-sm min-h-[700px]"
                  placeholder="输入完整的系统提示词..."
                />
                
                <div className="mt-4 flex gap-2">
                  <Button onClick={handleSave}>保存配置</Button>
                  <Button variant="outline" onClick={handleReset}>重置为默认</Button>
                  <Button variant="ghost" onClick={handleExport}>导出</Button>
                  <Button variant="ghost" onClick={handleImport}>导入</Button>
                </div>
              </TabsContent>
              
              <TabsContent value="preview">
                <div className="prose prose-sm max-w-none p-4 bg-muted rounded-lg min-h-[700px]">
                  <pre className="whitespace-pre-wrap">{prompt}</pre>
                </div>
              </TabsContent>
              
              <TabsContent value="variables">
                <Alert>
                  <AlertDescription>
                    <h4 className="font-semibold mb-2">可用的运行时变量：</h4>
                    <ul className="list-disc list-inside space-y-1">
                      <li><code>{'{market_type}'}</code> - 市场类型 (US/HK/CN)</li>
                      <li><code>{'{session_id}'}</code> - 会话ID</li>
                      <li><code>{'{timestamp}'}</code> - 当前时间戳</li>
                      <li><code>{'{user_id}'}</code> - 用户ID</li>
                    </ul>
                    <p className="mt-4 text-sm text-muted-foreground">
                      这些变量会在 Agent 执行时自动替换为实际值
                    </p>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## 用户可编辑的完整示例

用户可以完全自定义，包括执行流程、输出格式等：

```markdown
You are an aggressive intraday trading agent.

## Your Mission
Maximize returns through strategic trading.

## Available Tools (你可以选择使用哪些工具)
- get_futu_account_info
- get_futu_positions
- get_futu_quote
- place_futu_order

## My Custom Workflow (完全自定义执行流程)

### Step 1: Quick Check
Call get_futu_account_info and get_futu_positions in parallel.

### Step 2: Simple Analysis
For each position, just check current price with get_futu_quote.

### Step 3: Make Decision
If profit > 5%, sell.
If loss > 3%, sell.
Otherwise, hold.

### Step 4: Execute
Use place_futu_order to execute.

## Output Format (自定义输出格式)
Just give me:
- What you did
- Why you did it
- Final P&L

Current market: {market_type}
Session: {session_id}
```

## 优势

1. **最大自由度**：用户可以完全控制 Agent 行为
2. **工具安全**：工具定义由系统维护，用户只能选择使用哪些
3. **变量保护**：运行时变量自动注入，用户不会误改
4. **多用户支持**：每个用户可以有自己的策略
5. **模板管理**：可以保存、导入、导出多套模板
6. **版本控制**：支持历史版本回滚

## API 设计

```
# 工具管理（系统级，用户只读）
GET  /api/tools/list
     返回所有可用工具的定义

# 提示词管理（用户级）
GET  /api/prompts/templates/{agent_type}
     返回：{ system_prompt, enabled_tools, metadata }

PUT  /api/prompts/templates/{agent_type}
     更新：{ system_prompt, enabled_tools }

POST /api/prompts/templates/{agent_type}/reset
     重置为默认模板

GET  /api/prompts/templates/{agent_type}/preview
     返回注入变量后的完整提示词（用于预览）

POST /api/prompts/templates/{agent_type}/export
     导出模板为 JSON

POST /api/prompts/templates/{agent_type}/import
     从 JSON 导入模板
```
