# 实时股票行情功能实现文档

## 概述

本文档描述了实时股票行情功能的完整实现，包括A股、美股和港股的实时行情获取能力。

## 功能特性

### 支持的市场
- **A股**：上海、深圳、科创板、创业板、北交所
- **美股**：纳斯达克、纽交所等
- **港股**：香港交易所

### 核心功能
1. **实时行情获取**：通过雪球（XueQiu）API获取最新股票行情
2. **智能代码识别**：自动识别股票代码所属市场
3. **代码标准化**：统一不同格式的股票代码
4. **数据映射**：将中文字段映射为英文字段名
5. **环境变量支持**：灵活的Token配置方式

## 实现文件

### 核心代码
- `tradingagents/dataflows/akshare_stock.py`
  - `_normalize_xueqiu_symbol()`: 股票代码标准化
  - `get_stock_realtime_quote()`: 实时行情获取

- `tradingagents/dataflows/akshare_fundamentals.py`
  - 更新了基本面数据获取，支持雪球Token

### 测试代码
- `tests/test_realtime_quotes.py`: 功能测试脚本
- `tests/README.md`: 测试说明文档

### 文档
- `docs/XUEQIU_TOKEN_SETUP.md`: Token获取和配置详细指南
- `docs/REALTIME_QUOTES_QUICKSTART.md`: 快速开始指南
- `docs/REALTIME_QUOTES_IMPLEMENTATION.md`: 本文档

### 配置
- `.env.example`: 添加了 `XUEQIU_TOKEN` 配置项

## 使用方法

### 1. 配置Token

#### 获取Token
1. 访问 https://xueqiu.com 并登录
2. 打开浏览器开发者工具（F12）
3. 进入 Application → Cookies → https://xueqiu.com
4. 找到 `xq_a_token` 并复制其值

#### 设置Token
```bash
# Linux/Mac
export XUEQIU_TOKEN="your_token_here"

# Windows CMD
set XUEQIU_TOKEN=your_token_here

# Windows PowerShell
$env:XUEQIU_TOKEN="your_token_here"

# .env 文件
XUEQIU_TOKEN=your_token_here
```

### 2. 使用实时行情API

```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

# A股
quote = get_stock_realtime_quote("600000")
print(quote)

# 美股
quote = get_stock_realtime_quote("AAPL")
print(quote)

# 港股
quote = get_stock_realtime_quote("00700")
print(quote)
```

**注意**：Token必须通过环境变量 `XUEQIU_TOKEN` 设置，不支持参数传入。

### 3. 返回数据格式

```
# Real-time quote for 600000
# Data source: AKShare - XueQiu (雪球)
# Market: A股市场 (深圳/上海/科创板/创业板/北交所)
# Retrieved: 2025-10-31 15:30:00

Symbol: SH600000
Name: 浦发银行
Current_Price: 10.20
Open: 9.77
High: 10.29
Low: 9.75
Previous_Close: 9.65
Volume: 149422915
Amount: 1501459278.0
Change: 0.55
Change_Percent: 5.7%
PE_Ratio_TTM: 6.615
PB_Ratio: 0.456
Market_Cap: 299392225759.0
Turnover_Rate: 0.51%
...
```

## 技术细节

### 股票代码标准化

| 输入格式 | 市场 | 标准化输出 |
|---------|------|-----------|
| 600000 | A股 | SH600000 |
| 000001 | A股 | SZ000001 |
| 688001 | A股 | SH688001 |
| AAPL | 美股 | AAPL |
| aapl | 美股 | AAPL |
| 00700 | 港股 | 00700 |
| 700 | 港股 | 00700 |
| 00700.HK | 港股 | 00700 |

### 字段映射

实现了35+个中文字段到英文字段的映射：

**基础交易数据**
- 代码 → Symbol
- 名称 → Name
- 现价 → Current_Price
- 今开 → Open
- 最高 → High
- 最低 → Low
- 昨收 → Previous_Close
- 成交量 → Volume
- 成交额 → Amount

**技术指标**
- 涨跌 → Change
- 涨幅 → Change_Percent
- 振幅 → Amplitude
- 均价 → Average_Price
- 周转率 → Turnover_Rate

**估值指标**
- 市盈率(TTM) → PE_Ratio_TTM
- 市净率 → PB_Ratio
- 总市值 → Market_Cap
- 流通值 → Circulating_Market_Cap

**其他指标**
- 52周最高 → 52_Week_High
- 52周最低 → 52_Week_Low
- 每股收益 → EPS
- 每股净资产 → Net_Asset_Per_Share
- 股息(TTM) → Dividend_TTM
- 股息率(TTM) → Dividend_Yield_TTM

### Token优先级

系统按以下优先级获取Token：
1. 函数参数 `token`
2. 环境变量 `XUEQIU_TOKEN`
3. akshare默认Token（可能不可用）

### 错误处理

实现了完善的错误处理机制：
- Token无效或过期：返回认证错误信息
- 网络连接失败：返回连接错误信息
- 股票代码无效：返回市场识别错误
- API返回空数据：返回无数据提示

## 测试

### 运行测试
```bash
# 基础测试（无需Token）
python tests/test_realtime_quotes.py

# 完整测试（需要Token）
export XUEQIU_TOKEN="your_token"
python tests/test_realtime_quotes.py
```

### 测试覆盖
- ✓ 股票代码标准化（12个测试用例）
- ✓ A股实时行情获取
- ✓ 美股实时行情获取
- ✓ 港股实时行情获取
- ✓ 错误处理验证

## 集成到现有系统

### 在分析流程中使用

实时行情功能已集成到数据流模块，可以在分析流程中自动调用：

```python
# 在 default_config.py 中配置
tool_vendors = {
    'get_realtime_quote': ['akshare'],  # 使用雪球接口
}

# 在智能体中使用
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

def analyze_stock(symbol):
    # 获取实时行情
    quote = get_stock_realtime_quote(symbol)
    # 进行分析...
```

### 与基本面数据结合

基本面数据获取函数也支持雪球Token：

```python
from tradingagents.dataflows.akshare_fundamentals import get_fundamentals

# 会自动使用环境变量中的Token
fundamentals = get_fundamentals("600000")

# 或直接传入Token
fundamentals = get_fundamentals("600000", token="your_token")
```

## 注意事项

### Token安全
- ⚠️ 不要将Token提交到版本控制系统
- ⚠️ 定期更新Token（Token会过期）
- ⚠️ 不要在公开场合分享Token

### API限制
- 雪球API可能有访问频率限制
- 建议合理控制请求频率
- 考虑实现缓存机制（未来优化）

### 数据时效性
- 实时数据受市场交易时间限制
- 非交易时间可能返回上一交易日数据
- 部分字段可能为N/A

## 故障排除

### 常见问题

**1. Token无效错误**
```
Error: 遇到错误，请刷新页面或者重新登录帐号后再试
```
解决方案：重新从雪球网站获取Token

**2. 环境变量未生效**
```bash
# 验证环境变量
echo $XUEQIU_TOKEN  # Linux/Mac
echo %XUEQIU_TOKEN%  # Windows
```

**3. 网络连接失败**
- 检查防火墙设置
- 确认可以访问 xueqiu.com
- 检查代理配置

## 未来优化方向

1. **缓存机制**：实现短期缓存减少API调用
2. **批量查询**：支持一次查询多个股票
3. **WebSocket推送**：实现实时数据推送
4. **备用数据源**：添加其他实时行情数据源作为备选

## 相关文档

- [快速开始指南](REALTIME_QUOTES_QUICKSTART.md)
- [Token配置详解](XUEQIU_TOKEN_SETUP.md)
- [实现规格说明](../.kiro/specs/realtime-stock-quotes/)

## 更新日志

### 2025-11-01
- ✅ 实现实时行情获取功能
- ✅ 添加股票代码标准化
- ✅ 支持环境变量Token配置
- ✅ 更新基本面数据获取支持Token
- ✅ 创建完整文档和测试

## 贡献者

本功能由 Kiro AI 助手协助实现。

## 许可证

遵循项目主许可证。
