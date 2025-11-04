# Trading Executor 循环调用工具问题修复

## 问题描述

Trading Executor 节点一直循环调用工具，导致：
1. 执行时间过长
2. 重复调用相同的工具
3. 浪费API调用次数
4. 可能达到 recursion_limit 限制

## 根本原因

Trading Executor 使用标准的 LangGraph 工具调用模式：
```
LLM -> 调用工具 -> 获取结果 -> LLM -> 调用工具 -> ...
```

这个循环会一直持续，直到LLM决定不再调用工具。但是：
1. LLM可能没有理解"一次性完成"的指令
2. LLM可能认为需要多次调用工具来获取更多信息
3. 没有明确的停止机制

## 解决方案

### 修改 Prompt 策略

**文件**: `tradingagents/agents/trader/trading_executor.py`

**修改前**:
```python
"You are a helpful AI assistant working with other assistants."
" Use the provided tools to progress on the task."
...
"IMPORTANT RESPONSE RULES:"
"1. When making tool calls, return ONLY tool calls with NO text content"
"2. Only generate text content (in Chinese) when you have completed all tool calls"
"3. Review previous tool results in the message history before making new calls"
```

**修改后**:
```python
"You are a professional trading execution agent."
"CRITICAL EXECUTION RULES:"
"1. ONE-TIME EXECUTION: You will be called ONLY ONCE. Complete all steps in a single response."
"2. TOOL CALL PHASE: In your FIRST response, call ALL necessary tools at once (parallel tool calls):"
"   - get_futu_account_info(...)"
"   - get_futu_positions(...)"
"   - get_futu_orders(...)"
"   - get_futu_quote(...)"
"   DO NOT call tools one by one. Call them ALL at once in parallel."
"3. REPORT PHASE: In your SECOND response (after receiving tool results), generate the final Chinese report."
"4. NO LOOPS: Do NOT make additional tool calls after the first batch."
"5. REVIEW HISTORY: Check message history - if tools have been called, generate the report immediately."
```

### 关键改进

1. **明确一次性执行**: "You will be called ONLY ONCE"
2. **要求并行调用**: "call ALL necessary tools at once (parallel tool calls)"
3. **列出必需工具**: 明确列出需要调用的工具
4. **禁止循环**: "Do NOT make additional tool calls after the first batch"
5. **检查历史**: "Check message history - if tools have been called, generate the report immediately"

## 预期行为

### 第一次调用 (工具调用阶段)

LLM 应该返回：
```python
[
    ToolCall(name="get_futu_account_info", args={"market_type": "US"}),
    ToolCall(name="get_futu_positions", args={"market_type": "US"}),
    ToolCall(name="get_futu_orders", args={"market_type": "US", "filter_status": 0}),
    ToolCall(name="get_futu_quote", args={"stock_code": "AAPL"}),
]
```

### 第二次调用 (报告生成阶段)

LLM 应该返回：
```python
AIMessage(content="## 交易执行报告\n\n### I. 执行决策\n...")
```

### 不应该有第三次调用

如果有第三次调用，说明LLM没有理解指令。

## 额外的安全措施

### 1. Recursion Limit

**文件**: `tradingagents/graph/propagation.py`

```python
def __init__(self, max_recur_limit=100):
    self.max_recur_limit = max_recur_limit
```

当前设置为100次迭代，这应该足够了。

### 2. 条件边检查

**文件**: `tradingagents/graph/conditional_logic.py`

```python
def should_continue_trading_executor(self, state: AgentState):
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools_trading_executor"
    return "Msg Clear Trading Executor"
```

这个检查确保只有当LLM返回工具调用时才继续循环。

## 监控和调试

### 日志输出

在执行过程中，应该看到：
```
🔍 执行交易员 开始分析...
[Tool Call] get_futu_account_info(market_type=US)
[Tool Call] get_futu_positions(market_type=US)
[Tool Call] get_futu_orders(market_type=US, filter_status=0)
[Tool Call] get_futu_quote(stock_code=AAPL)
[Tool Results] ...
✅ 执行交易员 完成分析
```

### 异常情况

如果看到重复的工具调用：
```
[Tool Call] get_futu_account_info(market_type=US)
[Tool Results] ...
[Tool Call] get_futu_account_info(market_type=US)  # ❌ 重复调用
```

这说明LLM没有遵守指令，需要进一步调整 prompt。

## 替代方案

如果 prompt 修改不能解决问题，可以考虑：

### 方案A: 预先调用工具

在 trading_executor_node 函数中，预先调用所有必需的工具，然后将结果传递给LLM：

```python
def trading_executor_node(state, name):
    # 预先调用工具
    account_info = get_futu_account_info(market_type=market_type)
    positions = get_futu_positions(market_type=market_type)
    orders = get_futu_orders(market_type=market_type, filter_status=0)
    quote = get_futu_quote(stock_code=ticker)
    
    # 构建包含所有数据的 prompt
    prompt = f"""
    Account Info: {account_info}
    Positions: {positions}
    Orders: {orders}
    Quote: {quote}
    
    Based on the above data, generate the execution report.
    """
    
    # 调用LLM生成报告（不使用工具）
    result = llm.invoke(prompt)
    return {"execution_report": result.content}
```

### 方案B: 限制工具调用次数

在 conditional_logic 中添加计数器：

```python
def should_continue_trading_executor(self, state: AgentState):
    # 检查已经调用了多少次工具
    tool_call_count = sum(1 for msg in state["messages"] 
                          if hasattr(msg, "tool_calls") and msg.tool_calls)
    
    if tool_call_count >= 1:  # 只允许一次工具调用
        return "Msg Clear Trading Executor"
    
    messages = state["messages"]
    last_message = messages[-1]
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        return "tools_trading_executor"
    return "Msg Clear Trading Executor"
```

## 更新日期

2025-11-04
