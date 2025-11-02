# TradingAgents CLI

命令行界面工具，用于运行 TradingAgents 多代理金融交易分析框架。

## 功能特性

### 核心功能

- 🤖 **多代理分析** - 支持市场、社交媒体、新闻、基本面分析师
- 📊 **实时进度显示** - 美观的终端界面显示分析进度
- 📈 **深度研究** - 可配置的研究深度（1-3轮）
- 🔄 **多 LLM 支持** - OpenAI、Anthropic、Google 等
- 💾 **完整报告** - 自动保存分析报告和日志
- 🎯 **自动交易** - 可选的自动交易执行功能 (NEW!)

### 新功能: 自动交易执行

CLI 现在支持在分析完成后自动执行交易：

- ✅ 可选启用/禁用（默认禁用）
- ✅ 基于分析建议自动下单
- ✅ 实时显示执行状态
- ✅ 完整的错误处理
- ✅ 详细的执行日志

详见: [CLI Auto-Trading Documentation](../docs/CLI_AUTO_TRADING.md)

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 配置环境变量

创建 `.env` 文件：

```bash
# LLM 配置
OPENAI_API_KEY=your_key_here
LLM_PROVIDER=openai

# Futu 交易 API (如果使用自动交易)
FUTU_API_BASE_URL=http://localhost:8000
FUTU_API_TIMEOUT=30
```

### 运行分析

```bash
# 从项目根目录运行
python cli/main.py analyze

# 或使用模块方式
python -m cli.main analyze
```

## 使用指南

### 交互式配置

运行 CLI 后，会依次提示配置以下选项：

#### Step 1: 股票代码
```
Enter the ticker symbol to analyze
Default: SPY
: AAPL
```

#### Step 2: 分析日期
```
Enter the analysis date (YYYY-MM-DD)
Default: 2025-11-02
: 2025-11-02
```

#### Step 3: 选择分析师
```
[1] Market Analyst
[2] Social Media Analyst
[3] News Analyst
[4] Fundamentals Analyst
[5] All Analysts
Select analysts (comma-separated numbers): 5
```

#### Step 4: 研究深度
```
[1] Quick (1 round)
[2] Standard (2 rounds)
[3] Deep (3 rounds)
Select depth: 2
```

#### Step 5: LLM 提供商
```
[1] OpenAI
[2] Anthropic
[3] Google
Select provider: 1
```

#### Step 6: 思考模型
```
Quick thinking model: gpt-4o-mini
Deep thinking model: o4-mini
```

#### Step 7: 自动交易 (NEW!)
```
Enable auto-execute trading? [y/N]: N
```

- **N (默认)**: 只执行分析，不执行交易
- **Y**: 分析完成后自动执行交易

### 进度显示

分析过程中会显示实时进度：

```
┌─────────────────────────────────────────────────────────────┐
│ Progress                                                     │
├──────────────────┬──────────────────┬──────────────────────┤
│ Team             │ Agent            │ Status               │
├──────────────────┼──────────────────┼──────────────────────┤
│ Analyst Team     │ Market Analyst   │ completed            │
│                  │ Social Analyst   │ completed            │
│                  │ News Analyst     │ in_progress          │
│                  │ Fundamentals     │ pending              │
├──────────────────┼──────────────────┼──────────────────────┤
│ Research Team    │ Bull Researcher  │ pending              │
│                  │ Bear Researcher  │ pending              │
│                  │ Research Manager │ pending              │
└──────────────────┴──────────────────┴──────────────────────┘
```

### 输出文件

分析完成后，结果保存在：

```
results/
└── {ticker}/
    └── {date}/
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

## 自动交易功能

### 启用自动交易

在 Step 7 选择 `y` 启用自动交易：

```bash
Enable auto-execute trading? [y/N]: y

⚠️  Auto-execute trading is enabled. Trades will be executed automatically after analysis.
```

### 执行结果

#### 成功执行
```
┌─────────────────────────────────────────────────────────────┐
│ ✓ Trading Execution Completed                                │
│ Trade executed successfully                                  │
└─────────────────────────────────────────────────────────────┘
```

#### 无交易 (HOLD)
```
┌─────────────────────────────────────────────────────────────┐
│ ℹ No Trade Executed                                          │
│ Analysis completed but no trade action was taken             │
└─────────────────────────────────────────────────────────────┘
```

#### 执行失败
```
┌─────────────────────────────────────────────────────────────┐
│ ✗ Trading Execution Failed                                   │
│ Trade execution encountered an error                         │
└─────────────────────────────────────────────────────────────┘
```

### 配置要求

使用自动交易功能需要：

1. **配置 Futu API**
   ```bash
   FUTU_API_BASE_URL=http://localhost:8000
   FUTU_API_TIMEOUT=30
   ```

2. **确保 API 服务运行**
   ```bash
   curl http://localhost:8000/health
   ```

详细配置指南: [Futu Trading Setup](../docs/FUTU_TRADING_SETUP.md)

## 示例

### 示例 1: 仅分析

```bash
$ python cli/main.py analyze

# 在 Step 7 选择 No
Enable auto-execute trading? [y/N]: N

# 结果：只显示分析报告
```

### 示例 2: 分析并交易

```bash
$ python cli/main.py analyze

# 在 Step 7 选择 Yes
Enable auto-execute trading? [y/N]: y

# 结果：显示分析报告 + 执行交易
```

完整示例: [CLI Auto-Trading Examples](../examples/cli_auto_trading_example.md)

## 工作流程

### 标准分析流程

```
用户输入配置
    ↓
Analyst Team (市场、社交、新闻、基本面)
    ↓
Research Team (多头、空头研究员 + 研究经理)
    ↓
Trading Team (交易员)
    ↓
Risk Management (风险分析师 + 投资组合经理)
    ↓
显示完整报告
```

### 启用自动交易流程

```
用户输入配置 (启用自动交易)
    ↓
Analyst Team
    ↓
Research Team
    ↓
Trading Team
    ↓
Risk Management
    ↓
显示完整报告
    ↓
Trading Executor (自动执行交易)
    ↓
显示执行结果
```

## 代码结构

```
cli/
├── __init__.py
├── main.py              # 主程序入口
├── models.py            # 数据模型
├── utils.py             # 工具函数
├── static/
│   └── welcome.txt      # 欢迎界面 ASCII 艺术
└── README.md            # 本文档
```

### 主要组件

- **MessageBuffer**: 管理消息、工具调用和报告
- **create_layout()**: 创建终端显示布局
- **update_display()**: 更新实时显示
- **get_user_selections()**: 获取用户配置
- **run_analysis()**: 执行分析流程
- **display_complete_report()**: 显示完整报告

## 技术栈

- **CLI 框架**: Typer
- **终端 UI**: Rich
- **分析引擎**: TradingAgentsGraph
- **LLM 集成**: LangChain
- **交易执行**: Futu Trading API

## 故障排查

### 问题 1: 导入错误

```
ModuleNotFoundError: No module named 'tradingagents'
```

**解决方案**: 从项目根目录运行
```bash
cd /path/to/TradingAgentsWeb
python cli/main.py analyze
```

### 问题 2: API 密钥错误

```
Error: OpenAI API key not found
```

**解决方案**: 配置 `.env` 文件
```bash
OPENAI_API_KEY=your_key_here
```

### 问题 3: 交易执行失败

```
✗ Trading Execution Failed
```

**解决方案**:
1. 检查 Futu API 配置
2. 确认 API 服务运行
3. 查看日志文件获取详细错误

### 问题 4: 显示乱码

**解决方案**: 确保终端支持 UTF-8
```bash
# Windows
chcp 65001

# Linux/Mac
export LANG=en_US.UTF-8
```

## 性能优化

### 提高分析速度

1. **减少研究深度**: 选择 Quick (1 round)
2. **减少分析师数量**: 只选择必要的分析师
3. **使用更快的模型**: 选择 gpt-4o-mini 而不是 o4-mini

### 减少 API 调用

1. **缓存数据**: 使用本地数据源
2. **批量请求**: 启用批量处理（如果支持）

## 最佳实践

### 1. 首次使用

- 从简单配置开始（Quick depth, 少量分析师）
- 观察输出格式和内容
- 逐步增加复杂度

### 2. 生产使用

- 使用 Standard 或 Deep 研究深度
- 启用所有相关分析师
- 定期检查日志文件

### 3. 自动交易

- 首次使用时禁用自动交易
- 验证分析结果合理后再启用
- 在模拟账户中测试

### 4. 错误处理

- 保存日志文件
- 记录错误模式
- 及时更新配置

## 相关文档

- [CLI Auto-Trading Guide](../docs/CLI_AUTO_TRADING.md) - 自动交易功能详解
- [Futu Trading Setup](../docs/FUTU_TRADING_SETUP.md) - Futu API 配置
- [TradingAgents Documentation](../docs/) - 完整文档

## 贡献

欢迎贡献！请查看主项目的贡献指南。

## 许可证

与主项目相同的许可证。

## 支持

如有问题，请：
1. 查看故障排查部分
2. 检查日志文件
3. 提交 Issue

---

**Built by [Tauric Research](https://github.com/TauricResearch)**
