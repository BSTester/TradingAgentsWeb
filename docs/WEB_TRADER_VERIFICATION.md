# Web服务 Trader 节点验证

## 验证结果

✅ **Web服务的前后端实现是正确的，不存在CLI中的问题。**

## 后端验证

### 1. agent_execution_order 定义

**文件**: `web/backend/analysis_task.py` (第463-470行)

```python
fixed_order = ['bull', 'bear', 'invest_judge', 'trader', 'risky', 'safe', 'neutral', 'risk_manager']
if request_data.get('enable_trading_executor', False):
    fixed_order.append('trading_executor')
agent_execution_order.extend(fixed_order)
```

✅ `trader` 正确包含在执行顺序中

### 2. 节点名称映射

**文件**: `web/backend/analysis_task.py` (第409-425行)

```python
node_to_agent_map = {
    'Research Manager': 'invest_judge',
    'Trader': 'trader',  # ✅ 正确映射
    'Risky Analyst': 'risky',
    ...
}
```

✅ 'Trader' 节点正确映射到 'trader' 智能体

### 3. 报告字段检测

**文件**: `web/backend/analysis_task.py` (第674-685行)

```python
if "trader_investment_plan" in state_update and state_update["trader_investment_plan"]:
    report_sections["trader_investment_plan"] = state_update["trader_investment_plan"]
    print(f"  📊 收集到 trader_investment_plan")
    if current_agent == 'trader' and not agent_completed:
        agent_completed = True
        print(f"  ✅ trader 节点完成（收集到报告）")
        # 立即触发切换到下一个智能体
        if current_agent_index < len(agent_execution_order) - 1:
            next_agent_index = current_agent_index + 1
            next_agent = agent_execution_order[next_agent_index]
            detected_agent = next_agent
            print(f"  🔄 触发切换: {current_agent} -> {next_agent} (收集到报告)")
```

✅ 正确检测 `trader_investment_plan` 并触发切换

### 4. 智能体切换日志

**文件**: `web/backend/analysis_task.py` (第730-760行)

```python
if detected_agent and detected_agent != last_agent:
    # 上一个智能体完成
    if last_agent:
        agent_display_name = agent_name_map.get(last_agent, last_agent)
        send_log('info', f'✅ {agent_display_name} 完成分析', last_agent, '完成', progress, '分析阶段')
        current_analyst_index += 1
    
    # 新智能体开始
    current_agent = detected_agent
    agent_display_name = agent_name_map.get(current_agent, current_agent)
    send_log('info', f'🔍 {agent_display_name} 开始分析...', current_agent, '开始', progress, '分析阶段')
```

✅ 正确发送智能体切换的日志消息

## 前端验证

### 1. Agent 到 Phase 的映射

**文件**: `web/frontend/src/components/analysis/AnalysisProgress.tsx` (第287-302行)

```typescript
const agentToPhaseMap: { [key: string]: number } = {
    'invest_judge': 1,
    'trader': 2,  // ✅ 正确映射到阶段2（交易团队）
    'risky': 3,
    'risk_manager': 3,
    'trading_executor': 4,
};
```

✅ `trader` 正确映射到阶段索引 2（对应 id=3 的交易团队）

### 2. Agent 名称映射

**文件**: `web/frontend/src/components/analysis/AnalysisProgress.tsx` (第348-360行)

```typescript
const agentNameMap: { [key: string]: string } = {
    'invest_judge': '投资评审',
    'trader': '交易员',  // ✅ 正确映射
    'risky': '激进风险分析师',
    ...
};
```

✅ `trader` 正确映射到显示名称 "交易员"

### 3. 状态更新逻辑

**文件**: `web/frontend/src/components/analysis/AnalysisProgress.tsx` (第360-420行)

前端会：
1. 根据 agent 名称查找或创建智能体
2. 如果是完成消息（step === '完成' 或包含 '✅'），标记为 completed
3. 否则如果是 pending，标记为 running

✅ 状态更新逻辑正确

## 执行流程

```
Research Manager (invest_judge)
    ↓ (收到 investment_plan)
    ✅ invest_judge 完成
    🔄 触发切换: invest_judge -> trader
    ↓
Trader (trader)
    🔍 交易员 开始分析
    ↓ (收到 trader_investment_plan)
    ✅ trader 完成
    🔄 触发切换: trader -> risky
    ↓
Risky Analyst (risky)
    🔍 激进风险分析师 开始分析
    ...
```

## 与 CLI 的区别

| 方面 | Web服务 | CLI |
|------|---------|-----|
| 后端逻辑 | ✅ 正确 | N/A |
| 节点切换检测 | ✅ 自动检测 | ❌ 需要手动更新状态 |
| 日志发送 | ✅ 自动发送 | ❌ 需要手动处理 |
| 状态更新 | ✅ 基于日志自动更新 | ❌ 需要显式调用 update_agent_status |

## 结论

Web服务的实现是正确的，不需要修改。CLI的问题是因为它需要手动处理状态更新，而Web服务是基于后端发送的日志消息自动更新状态。

## 更新日期

2025-11-04
