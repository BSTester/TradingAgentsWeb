# 交易执行节点快速开始指南

## 🚀 快速启动

### 1. 启动CLI
```bash
python cli/main.py
```

### 2. 配置步骤
按照提示完成以下配置：

1. **Step 1**: 输入股票代码（如：AAPL, 00700, 600519）
2. **Step 2**: 输入分析日期（YYYY-MM-DD）
3. **Step 3**: 选择分析师团队
4. **Step 4**: 选择研究深度
5. **Step 5**: 选择LLM提供商
6. **Step 6**: 选择思考模型
7. **Step 7**: **启用自动交易执行** ← 选择 `y`

### 3. 监控进度
CLI会实时显示交易执行状态：

```
┌─ Progress ─────────────────────────────────────┐
│ Team                │ Agent              │ Status      │
├─────────────────────┼────────────────────┼─────────────┤
│ Trading Execution   │ Trading Executor   │ in_progress │
└────────────────────────────────────────────────┘
```

### 4. 查看结果
分析完成后会显示完整报告，包括交易执行结果。

## 📁 输出文件

### 报告文件
```
results/{ticker}/{date}/reports/execution_report.md
```

### 日志文件
```
results/{ticker}/{date}/message_tool.log
eval_results/{ticker}/TradingAgentsStrategy_logs/full_states_log_{date}.json
```

## 📊 报告内容

交易执行报告包含：

1. **当前市场状态** - 实时行情和技术指标
2. **账户信息与持仓** - 资金和持仓情况
3. **执行决策** - 决策依据和时机选择
4. **交易执行详情** - 订单信息和执行状态
5. **账户影响** - 资金变化和风险评估
6. **风险控制** - 止损止盈建议
7. **后续行动** - 具体操作建议

## ⚙️ 配置选项

### 启用自动交易（默认禁用）
在CLI的Step 7选择启用，或在代码中配置：

```python
config = {
    "auto_execute_trading": True,
    # ... 其他配置
}
```

### 禁用自动交易
在CLI的Step 7选择禁用（默认），或：

```python
config = {
    "auto_execute_trading": False,
    # ... 其他配置
}
```

## ⚠️ 注意事项

### 使用前确保：
- ✅ Futu OpenD已启动并配置
- ✅ 在市场交易时间内
- ✅ 账户有足够资金
- ✅ 了解交易风险

### 风险控制：
- 单笔交易 ≤ 账户净值的5%
- 设置止损止盈
- 密切监控持仓

## 🔍 状态说明

| 状态 | 含义 |
|------|------|
| `pending` | 等待执行 |
| `in_progress` | 正在执行 |
| `completed` | 执行成功 |
| `error` | 执行失败 |

## 📖 详细文档

- `IMPLEMENTATION_SUMMARY.md` - 实现总结
- `TRADING_EXECUTOR_IMPLEMENTATION.md` - 完整实现文档
- `test_trading_executor.md` - 功能测试说明

## 🆘 常见问题

### Q: 如何禁用自动交易？
A: 在Step 7选择 `N`，或设置 `auto_execute_trading: False`

### Q: 报告保存在哪里？
A: `results/{ticker}/{date}/reports/execution_report.md`

### Q: 如何查看执行日志？
A: 查看 `results/{ticker}/{date}/message_tool.log`

### Q: 交易执行失败怎么办？
A: 检查Futu OpenD连接、市场时间、账户资金，查看错误日志

### Q: 可以批量执行吗？
A: 当前版本不支持批量执行，每次分析执行一笔交易

## 💡 最佳实践

1. **先模拟测试** - 使用模拟账户测试功能
2. **小额开始** - 实盘测试时使用小额资金
3. **检查日志** - 仔细查看执行日志
4. **验证报告** - 确认报告内容准确
5. **风险控制** - 严格遵守风险管理原则

## 🎯 示例命令

```bash
# 启动CLI
python cli/main.py

# 示例配置
Ticker: AAPL
Date: 2025-11-02
Analysts: market, news, fundamentals
Research Depth: 2
LLM Provider: openai
Deep Thinker: gpt-4
Quick Thinker: gpt-3.5-turbo
Auto-Execute Trading: Yes  ← 启用自动交易
```

## 📞 支持

如有问题，请查看：
- 项目文档：`docs/` 目录
- 测试结果：`tests/TEST_RESULTS.md`
- GitHub Issues

---

**祝交易顺利！** 🎉
