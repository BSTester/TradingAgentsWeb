# 实时行情工具ToolNode配置修复

## 问题描述

### 错误信息
```
Error: get_realtime_quote is not a valid tool, try one of [get_stock_data, get_indicators].
```

### 问题原因
虽然在Agent的代码中（`market_analyst.py` 和 `trader.py`）已经添加了 `get_realtime_quote` 工具，但在图执行层（`trading_graph.py`）的 `_create_tool_nodes()` 方法中，ToolNode的工具列表没有包含这个新工具。

LangGraph使用ToolNode来管理工具的执行，如果工具不在ToolNode中注册，即使Agent代码中有这个工具，LLM也无法调用它。

## 修复内容

### 文件：`tradingagents/graph/trading_graph.py`

#### 1. 添加导入

**修改前**：
```python
from tradingagents.agents.utils.agent_utils import (
    get_stock_data,
    get_indicators,
    get_fundamentals,
    # ...
)
```

**修改后**：
```python
from tradingagents.agents.utils.agent_utils import (
    get_stock_data,
    get_indicators,
    get_realtime_quote,  # 新增
    get_fundamentals,
    # ...
)
```

#### 2. 更新market ToolNode

**修改前**：
```python
"market": ToolNode(
    [
        # Core stock data tools
        get_stock_data,
        # Technical indicators
        get_indicators,
    ]
),
```

**修改后**：
```python
"market": ToolNode(
    [
        # Core stock data tools
        get_stock_data,
        get_realtime_quote,  # 新增
        # Technical indicators
        get_indicators,
    ]
),
```

#### 3. 更新trader ToolNode

**修改前**：
```python
"trader": ToolNode(
    [
        # Trader tools for final decision making
        get_stock_data,
        get_indicators,
    ]
),
```

**修改后**：
```python
"trader": ToolNode(
    [
        # Trader tools for final decision making
        get_stock_data,
        get_realtime_quote,  # 新增
        get_indicators,
    ]
),
```

## ToolNode架构说明

### 什么是ToolNode？

ToolNode是LangGraph中用于管理和执行工具的节点。它：
1. 注册可用的工具
2. 验证工具调用
3. 执行工具并返回结果

### 工具注册层次

```
1. 工具定义层
   realtime_quote_tools.py
   ↓ @tool装饰器

2. 工具导出层
   agent_utils.py
   ↓ 导入导出

3. Agent使用层
   market_analyst.py / trader.py
   ↓ tools = [get_realtime_quote]

4. 图执行层 ⚠️ 关键！
   trading_graph.py
   ↓ ToolNode([get_realtime_quote])
   
5. LLM调用
   ↓ 通过ToolNode验证和执行
```

**关键点**：即使在Agent层添加了工具，如果没有在ToolNode中注册，LLM也无法调用！

## 完整的工具配置清单

### Market Analyst的工具
- ✅ `get_stock_data` - 历史价格数据
- ✅ `get_realtime_quote` - 实时行情数据（新增）
- ✅ `get_indicators` - 技术指标

### Trader的工具
- ✅ `get_stock_data` - 历史价格数据
- ✅ `get_realtime_quote` - 实时行情数据（新增）
- ✅ `get_indicators` - 技术指标

### 其他Analyst的工具
- Social Analyst: `get_news`
- News Analyst: `get_news`, `get_global_news`, `get_insider_sentiment`, `get_insider_transactions`
- Fundamentals Analyst: `get_fundamentals`, `get_balance_sheet`, `get_cashflow`, `get_income_statement`

## 验证方法

### 1. 检查工具是否在ToolNode中
```python
# 在trading_graph.py中
tool_nodes = self._create_tool_nodes()
market_tools = tool_nodes["market"].tools_by_name
print(market_tools.keys())
# 应该包含: dict_keys(['get_stock_data', 'get_realtime_quote', 'get_indicators'])
```

### 2. 运行完整分析
```bash
export XUEQIU_TOKEN="your_token"
python main.py --ticker 600000 --date 2025-11-01
```

### 3. 检查日志
应该看到类似的日志：
```
Market Analyst calling tool: get_realtime_quote
Tool execution successful
```

## 常见错误模式

### 错误1：只在Agent层添加工具
```python
# ❌ 只在market_analyst.py中添加
tools = [get_realtime_quote]

# ✅ 还需要在trading_graph.py的ToolNode中添加
"market": ToolNode([get_realtime_quote])
```

### 错误2：导入了但没有使用
```python
# ❌ 导入了但ToolNode中没有
from agent_utils import get_realtime_quote

"market": ToolNode([
    get_stock_data,
    get_indicators,
    # 忘记添加get_realtime_quote
])
```

### 错误3：ToolNode名称不匹配
```python
# ❌ Agent使用market，但ToolNode定义为market_data
def market_analyst_node(state):
    tools = [get_realtime_quote]
    # 会路由到tool_nodes["market"]

tool_nodes = {
    "market_data": ToolNode([...])  # 名称不匹配！
}
```

## 相关文件

### 需要同步更新的文件
1. ✅ `tradingagents/agents/analysts/market_analyst.py` - Agent工具列表
2. ✅ `tradingagents/agents/trader/trader.py` - Agent工具列表
3. ✅ `tradingagents/graph/trading_graph.py` - ToolNode配置（本次修复）

### 工具定义文件
4. ✅ `tradingagents/agents/utils/realtime_quote_tools.py` - 工具定义
5. ✅ `tradingagents/agents/utils/agent_utils.py` - 工具导出

### 数据层文件
6. ✅ `tradingagents/dataflows/akshare_stock.py` - 实现
7. ✅ `tradingagents/dataflows/akshare.py` - 统一入口
8. ✅ `tradingagents/dataflows/interface.py` - 路由配置

## 测试验证

### 单元测试
```python
from tradingagents.graph.trading_graph import TradingGraph

# 创建图实例
graph = TradingGraph(...)

# 检查ToolNode
tool_nodes = graph.tool_nodes
assert "get_realtime_quote" in tool_nodes["market"].tools_by_name
assert "get_realtime_quote" in tool_nodes["trader"].tools_by_name
```

### 集成测试
```bash
# 运行完整分析
python main.py --ticker 600000 --date 2025-11-01

# 检查是否成功调用get_realtime_quote
# 查看日志或输出结果
```

## 经验教训

### 添加新工具的完整步骤

1. **定义工具** (`*_tools.py`)
   ```python
   @tool
   def get_new_tool(...):
       pass
   ```

2. **导出工具** (`agent_utils.py`)
   ```python
   from .new_tools import get_new_tool
   ```

3. **Agent使用** (`*_analyst.py`, `trader.py`)
   ```python
   tools = [get_new_tool]
   ```

4. **ToolNode注册** (`trading_graph.py`) ⚠️ 关键！
   ```python
   "analyst_name": ToolNode([get_new_tool])
   ```

5. **测试验证**
   - 单元测试
   - 集成测试
   - 端到端测试

### 检查清单

添加新工具时，确保：
- [ ] 工具定义正确（@tool装饰器）
- [ ] 工具导出到agent_utils
- [ ] Agent代码中添加到tools列表
- [ ] **ToolNode中注册工具** ⚠️
- [ ] 导入语句正确
- [ ] 语法检查通过
- [ ] 运行测试验证

## 总结

本次修复解决了 `get_realtime_quote` 工具无法被LLM调用的问题。

**根本原因**：工具虽然在Agent层定义，但没有在图执行层的ToolNode中注册。

**解决方案**：在 `trading_graph.py` 的 `_create_tool_nodes()` 方法中，将 `get_realtime_quote` 添加到 "market" 和 "trader" 的ToolNode中。

**关键要点**：在LangGraph架构中，工具必须在ToolNode中注册才能被LLM调用，仅在Agent代码中添加是不够的。

---

**修复执行者**：Kiro AI Assistant  
**修复日期**：2025-11-01  
**文档版本**：1.0
