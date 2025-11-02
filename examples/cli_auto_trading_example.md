# CLI Auto-Trading Example

## 完整使用示例

### 场景 1: 仅分析 (默认行为)

```bash
$ python cli/main.py analyze

# 或者使用别名
$ python -m cli.main analyze
```

**交互过程:**

```
┌─────────────────────────────────────────────────────────────┐
│ Welcome to TradingAgents                                     │
│ TradingAgents: Multi-Agents LLM Financial Trading Framework │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ Step 1: Ticker Symbol                                        │
│ Enter the ticker symbol to analyze                          │
│ Default: SPY                                                 │
└─────────────────────────────────────────────────────────────┘
: AAPL

┌─────────────────────────────────────────────────────────────┐
│ Step 2: Analysis Date                                        │
│ Enter the analysis date (YYYY-MM-DD)                        │
│ Default: 2025-11-02                                         │
└─────────────────────────────────────────────────────────────┘
: 2025-11-02

┌─────────────────────────────────────────────────────────────┐
│ Step 3: Analysts Team                                        │
│ Select your LLM analyst agents for the analysis            │
└─────────────────────────────────────────────────────────────┘
[1] Market Analyst
[2] Social Media Analyst
[3] News Analyst
[4] Fundamentals Analyst
[5] All Analysts
Select analysts (comma-separated numbers): 5

┌─────────────────────────────────────────────────────────────┐
│ Step 4: Research Depth                                       │
│ Select your research depth level                            │
└─────────────────────────────────────────────────────────────┘
[1] Quick (1 round)
[2] Standard (2 rounds)
[3] Deep (3 rounds)
Select depth: 2

┌─────────────────────────────────────────────────────────────┐
│ Step 5: OpenAI backend                                       │
│ Select which service to talk to                             │
└─────────────────────────────────────────────────────────────┘
[1] OpenAI
[2] Anthropic
[3] Google
Select provider: 1

┌─────────────────────────────────────────────────────────────┐
│ Step 6: Thinking Agents                                      │
│ Select your thinking agents for analysis                    │
└─────────────────────────────────────────────────────────────┘
Quick thinking model: gpt-4o-mini
Deep thinking model: o4-mini

┌─────────────────────────────────────────────────────────────┐
│ Step 7: Auto-Execute Trading                                 │
│ Do you want to automatically execute trades after analysis? │
│ Default: No                                                  │
└─────────────────────────────────────────────────────────────┘
Enable auto-execute trading? [y/N]: N

✓ Auto-execute trading is disabled. Only analysis will be performed.

[分析开始...]

[分析完成后显示完整报告]

┌─────────────────────────────────────────────────────────────┐
│ Auto-Execute Trading Disabled                                │
│ Analysis completed. No trades were executed.                 │
└─────────────────────────────────────────────────────────────┘
```

---

### 场景 2: 分析并自动执行交易

```bash
$ python cli/main.py analyze
```

**交互过程:**

```
[前面的步骤 1-6 相同...]

┌─────────────────────────────────────────────────────────────┐
│ Step 7: Auto-Execute Trading                                 │
│ Do you want to automatically execute trades after analysis? │
│ Default: No                                                  │
└─────────────────────────────────────────────────────────────┘
Enable auto-execute trading? [y/N]: y

⚠️  Auto-execute trading is enabled. Trades will be executed automatically after analysis.

[分析开始...]

[分析完成后显示完整报告]

┌─────────────────────────────────────────────────────────────┐
│ Auto-Execute Trading Enabled                                 │
│ Executing trades based on analysis recommendations...        │
└─────────────────────────────────────────────────────────────┘

[进度显示更新，显示 Trading Executor 状态]

┌─────────────────────────────────────────────────────────────┐
│ Progress                                                     │
├──────────────────┬──────────────────┬──────────────────────┤
│ Team             │ Agent            │ Status               │
├──────────────────┼──────────────────┼──────────────────────┤
│ Trading Execution│ Trading Executor │ in_progress          │
└──────────────────┴──────────────────┴──────────────────────┘

[交易执行完成]

┌─────────────────────────────────────────────────────────────┐
│ ✓ Trading Execution Completed                                │
│ Trade executed successfully                                  │
│                                                              │
│ Order Details:                                               │
│ - Stock: AAPL                                               │
│ - Action: BUY                                               │
│ - Quantity: 10 shares                                       │
│ - Price: $180.50                                            │
│ - Order ID: 123456789                                       │
└─────────────────────────────────────────────────────────────┘
```

---

### 场景 3: HOLD 决策 (无交易执行)

```bash
$ python cli/main.py analyze
```

**交互过程:**

```
[前面的步骤相同，选择启用自动交易...]

Enable auto-execute trading? [y/N]: y

⚠️  Auto-execute trading is enabled. Trades will be executed automatically after analysis.

[分析开始...]

[分析建议为 HOLD]

┌─────────────────────────────────────────────────────────────┐
│ Auto-Execute Trading Enabled                                 │
│ Executing trades based on analysis recommendations...        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ℹ No Trade Executed                                          │
│ Analysis completed but no trade action was taken             │
│ (possibly HOLD recommendation)                               │
│                                                              │
│ Reason: Current market conditions suggest holding position  │
└─────────────────────────────────────────────────────────────┘
```

---

### 场景 4: 交易执行失败

```bash
$ python cli/main.py analyze
```

**交互过程:**

```
[前面的步骤相同，选择启用自动交易...]

Enable auto-execute trading? [y/N]: y

⚠️  Auto-execute trading is enabled. Trades will be executed automatically after analysis.

[分析开始...]

[尝试执行交易但失败]

┌─────────────────────────────────────────────────────────────┐
│ Auto-Execute Trading Enabled                                 │
│ Executing trades based on analysis recommendations...        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ✗ Trading Execution Failed                                   │
│ Trade execution encountered an error                         │
│                                                              │
│ Error: Insufficient funds                                    │
│ Available: $5,000                                           │
│ Required: $18,050                                           │
│                                                              │
│ Suggestion: Reduce order quantity or add funds              │
└─────────────────────────────────────────────────────────────┘
```

---

## 命令行参数 (未来扩展)

虽然当前版本使用交互式提示，但未来可以添加命令行参数支持：

```bash
# 未来可能的用法
python cli/main.py analyze \
  --ticker AAPL \
  --date 2025-11-02 \
  --analysts all \
  --depth 2 \
  --auto-trade  # 启用自动交易
```

## 环境变量配置

在使用自动交易功能前，确保配置了 Futu API：

```bash
# .env 文件
FUTU_API_BASE_URL=http://localhost:8000
FUTU_API_TIMEOUT=30

# 其他必要的配置
OPENAI_API_KEY=your_key_here
LLM_PROVIDER=openai
```

## 日志文件位置

分析和交易执行的日志保存在：

```
results/
└── AAPL/
    └── 2025-11-02/
        ├── message_tool.log          # 消息和工具调用日志
        └── reports/
            ├── market_report.md
            ├── sentiment_report.md
            ├── news_report.md
            ├── fundamentals_report.md
            ├── investment_plan.md
            ├── trader_investment_plan.md
            └── final_trade_decision.md
```

## 最佳实践

### 1. 首次使用

首次使用自动交易功能时，建议：
- 先不启用自动交易，查看分析结果
- 确认分析建议合理后，再启用自动交易

### 2. 测试环境

在生产环境使用前：
- 在模拟账户中测试
- 验证所有配置正确
- 检查日志文件

### 3. 监控执行

启用自动交易后：
- 观察进度显示
- 查看执行结果
- 检查订单状态

### 4. 错误处理

如果遇到错误：
- 查看错误消息
- 检查日志文件
- 验证 API 配置
- 确认账户状态

## 常见问题

### Q: 如何取消自动交易？

A: 在 Step 7 选择 No (默认值) 或直接按 Enter。

### Q: 交易会立即执行吗？

A: 是的，分析完成后会立即尝试执行交易（如果启用）。

### Q: 如果我改变主意了怎么办？

A: 在分析开始前，你可以按 Ctrl+C 取消。分析开始后无法中断。

### Q: 交易失败会影响分析结果吗？

A: 不会。分析结果已经保存，交易失败只影响执行部分。

### Q: 可以查看历史交易记录吗？

A: 可以，所有交易记录都保存在日志文件中。

## 总结

CLI 自动交易功能提供了：

✅ **灵活性** - 可选择是否自动执行  
✅ **透明性** - 清晰的执行反馈  
✅ **安全性** - 默认禁用，需明确启用  
✅ **可追溯** - 完整的日志记录  
✅ **易用性** - 简单的交互流程  

这使得 TradingAgents CLI 成为一个强大的端到端交易工具！
