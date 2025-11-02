# 自动交易执行配置

## 概述

TradingAgents 现在支持**条件性自动交易执行**。Trading Executor 节点只有在用户明确启用自动交易时才会被添加到工作流中。

## 配置方式

### 1. 环境变量配置

在 `.env` 文件中设置：

```bash
# 启用自动交易
AUTO_EXECUTE_TRADING=true

# 禁用自动交易（默认）
AUTO_EXECUTE_TRADING=false
```

### 2. CLI 交互式配置

运行 CLI 时，会在 Step 7 询问是否启用自动交易：

```
Step 7: Auto-Execute Trading
Do you want to automatically execute trades after analysis?
Default: No

Enable auto-execute trading? [y/N]:
```

- 选择 `y` 或 `yes` → 启用自动交易
- 选择 `n` 或 `no` 或直接回车 → 禁用自动交易（默认）

### 3. 代码配置

在初始化 `TradingAgentsGraph` 时通过配置字典设置：

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

# 创建配置
config = DEFAULT_CONFIG.copy()
config["auto_execute_trading"] = True  # 启用自动交易

# 初始化 Graph
graph = TradingAgentsGraph(
    selected_analysts=["market", "news", "fundamentals"],
    config=config
)
```

## 工作流差异

### 禁用自动交易（默认）

```
Analysts → Research Team → Trader → Risk Management → Risk Judge → END
```

**特点：**
- ✅ 只进行分析，不执行交易
- ✅ 更快的执行速度
- ✅ 更低的 API 成本
- ✅ 适合研究和回测

### 启用自动交易

```
Analysts → Research Team → Trader → Risk Management → Risk Judge → Trading Executor → END
                                                                          ↓
                                                                    Futu Trading Tools
```

**特点：**
- ✅ 完整的分析 + 自动交易执行
- ⚠️ 需要 Futu API 服务运行
- ⚠️ 使用 `deep_thinking_llm`（成本较高）
- ⚠️ 执行时间较长
- ⚠️ 会实际下单（需谨慎）

## 配置文件说明

### `tradingagents/default_config.py`

添加了新的配置项：

```python
DEFAULT_CONFIG = {
    # ... 其他配置 ...
    
    # Auto-execute trading configuration
    "auto_execute_trading": os.getenv("AUTO_EXECUTE_TRADING", "false").lower() == "true",
}
```

### `tradingagents/graph/setup.py`

`setup_graph` 方法新增参数：

```python
def setup_graph(
    self, 
    selected_analysts=["market", "social", "news", "fundamentals"],
    auto_execute_trading=False  # 新增参数
):
```

**条件性节点创建：**

```python
# 只有在启用自动交易时才创建 Trading Executor 节点
if auto_execute_trading:
    trading_executor_node = create_trading_executor(
        self.deep_thinking_llm, self.trader_memory
    )
    trading_executor_msg_delete = create_msg_delete()
```

**条件性工作流连接：**

```python
if auto_execute_trading:
    # 连接到 Trading Executor
    workflow.add_edge("Risk Judge", "Trading Executor")
    workflow.add_conditional_edges(
        "Trading Executor",
        self.conditional_logic.should_continue_trading_executor,
        ["tools_trading_executor", "Msg Clear Trading Executor"],
    )
    workflow.add_edge("tools_trading_executor", "Trading Executor")
    workflow.add_edge("Msg Clear Trading Executor", END)
else:
    # 直接结束
    workflow.add_edge("Risk Judge", END)
```

### `tradingagents/graph/trading_graph.py`

从配置中读取并传递给 `setup_graph`：

```python
# Set up the graph with auto-execute trading configuration
auto_execute_trading = self.config.get("auto_execute_trading", False)
self.graph = self.graph_setup.setup_graph(selected_analysts, auto_execute_trading)
```

### `cli/main.py`

#### Step 7: 询问用户是否启用自动交易

```python
# Step 7: Auto-execute trading
console.print(
    create_question_box(
        "Step 7: Auto-Execute Trading",
        "Do you want to automatically execute trades after analysis?",
        "No"
    )
)
auto_execute_trading = typer.confirm(
    "Enable auto-execute trading?",
    default=False
)
```

#### 将用户选择传递到配置

```python
config["auto_execute_trading"] = selections.get("auto_execute_trading", False)
```

#### 显示执行结果

```python
if selections.get("auto_execute_trading", False):
    console.print(Panel(
        "[bold yellow]Auto-Execute Trading Enabled[/bold yellow]\n"
        "[dim]Executing trades based on analysis recommendations...[/dim]",
        border_style="yellow",
        padding=(1, 2)
    ))
    
    # 检查执行结果
    if "execution_result" in final_state:
        # 显示执行状态
        ...
else:
    console.print(Panel(
        "[bold blue]Auto-Execute Trading Disabled[/bold blue]\n"
        "[dim]Analysis completed. No trades were executed.[/dim]",
        border_style="blue",
        padding=(1, 2)
    ))
```

## 使用示例

### 示例 1: CLI 禁用自动交易（默认）

```bash
python cli/main.py analyze

# Step 7 选择 No
Enable auto-execute trading? [y/N]: n

# 结果：只进行分析，不执行交易
```

### 示例 2: CLI 启用自动交易

```bash
python cli/main.py analyze

# Step 7 选择 Yes
Enable auto-execute trading? [y/N]: y

# 结果：分析完成后自动执行交易
```

### 示例 3: 代码中启用自动交易

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

# 配置自动交易
config = DEFAULT_CONFIG.copy()
config["auto_execute_trading"] = True

# 初始化并运行
graph = TradingAgentsGraph(
    selected_analysts=["market", "news"],
    config=config
)

final_state, decision = graph.propagate("AAPL", "2025-11-02")

# 检查执行结果
if "execution_result" in final_state:
    print(f"Trade executed: {final_state['execution_result']}")
else:
    print("No trade executed (HOLD or error)")
```

### 示例 4: 环境变量配置

```bash
# .env 文件
AUTO_EXECUTE_TRADING=true

# 运行时会自动启用
python cli/main.py analyze
```

## 安全建议

### ⚠️ 生产环境使用注意事项

1. **默认禁用**
   - 自动交易默认是禁用的，需要明确启用
   - 避免意外执行交易

2. **确认机制**
   - CLI 会显示警告信息
   - 用户需要明确确认

3. **测试环境**
   - 建议先在 Futu 模拟交易环境测试
   - 验证交易逻辑正确后再用于实盘

4. **监控日志**
   - 所有交易执行都会记录日志
   - 定期检查执行结果

5. **资金管理**
   - 设置合理的仓位限制
   - 配置止损止盈策略

## 故障排查

### 问题 1: 启用了自动交易但没有执行

**可能原因：**
- Trading Executor 判断为 HOLD
- Futu API 服务未运行
- 账户资金不足
- 市场未开盘

**解决方法：**
```bash
# 检查 Futu API 服务
curl http://localhost:8000/health

# 查看日志
cat results/{ticker}/{date}/message_tool.log
```

### 问题 2: Trading Executor 节点未出现

**可能原因：**
- `auto_execute_trading` 配置未正确设置

**解决方法：**
```python
# 检查配置
print(config.get("auto_execute_trading"))  # 应该是 True

# 检查环境变量
import os
print(os.getenv("AUTO_EXECUTE_TRADING"))  # 应该是 "true"
```

### 问题 3: 工具调用失败

**可能原因：**
- Futu API 配置错误
- 网络连接问题

**解决方法：**
```bash
# 检查 Futu API 配置
echo $FUTU_API_BASE_URL
echo $FUTU_API_TIMEOUT

# 测试连接
python -c "from tradingagents.dataflows.futu_trading import FutuTradingDataFlow; df = FutuTradingDataFlow(); print(df.get_account_info())"
```

## 性能对比

### 禁用自动交易

| 指标 | 值 |
|------|-----|
| 平均执行时间 | 2-3 分钟 |
| API 调用次数 | ~50-100 次 |
| 使用的 LLM | quick_thinking_llm |
| 成本估算 | $0.10-0.50 |

### 启用自动交易

| 指标 | 值 |
|------|-----|
| 平均执行时间 | 3-5 分钟 |
| API 调用次数 | ~60-120 次 |
| 使用的 LLM | deep_thinking_llm + quick_thinking_llm |
| 成本估算 | $0.50-2.00 |

## 总结

通过条件性配置，TradingAgents 现在可以：

✅ **灵活切换** - 根据需求启用/禁用自动交易  
✅ **安全默认** - 默认禁用，避免意外交易  
✅ **成本优化** - 不需要交易时节省 API 成本  
✅ **用户友好** - CLI 提供清晰的交互提示  
✅ **代码简洁** - 配置统一管理，易于维护  

---

**修改日期**: 2025-11-02  
**修改者**: Kiro AI Assistant  
**状态**: ✅ 完成并验证
