# Real-Time Stock Quotes - Quick Start Guide

## 快速开始

### 1. 获取雪球Token

访问 https://xueqiu.com，登录后：
1. 按 F12 打开开发者工具
2. 进入 Application → Cookies → https://xueqiu.com
3. 找到 `xq_a_token` 并复制其值

### 2. 配置Token

**方法一：环境变量（推荐）**
```bash
export XUEQIU_TOKEN="your_token_here"
```

**方法二：.env文件**
```env
XUEQIU_TOKEN=your_token_here
```

### 3. 使用实时行情功能

```python
from tradingagents.dataflows.akshare_stock import get_stock_realtime_quote

# A股实时行情
quote = get_stock_realtime_quote("600000")
print(quote)

# 美股实时行情
quote = get_stock_realtime_quote("AAPL")
print(quote)

# 港股实时行情
quote = get_stock_realtime_quote("00700")
print(quote)
```

### 4. 支持的股票代码格式

| 市场 | 格式示例 | 说明 |
|------|---------|------|
| A股 | `600000`, `000001`, `SH600000` | 自动识别交易所 |
| 美股 | `AAPL`, `TSLA`, `MSFT` | 大小写不敏感 |
| 港股 | `00700`, `700`, `00700.HK` | 自动补零和去后缀 |

### 5. 返回数据示例

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

## 详细文档

- 完整设置指南：[docs/XUEQIU_TOKEN_SETUP.md](docs/XUEQIU_TOKEN_SETUP.md)
- 实现总结：[.kiro/specs/realtime-stock-quotes/IMPLEMENTATION_SUMMARY.md](.kiro/specs/realtime-stock-quotes/IMPLEMENTATION_SUMMARY.md)

## 测试

运行测试脚本：
```bash
python test_xueqiu_with_env.py
```

## 故障排除

**问题：获取数据失败**
- 检查token是否正确设置
- 确认token未过期（重新从雪球网站获取）
- 检查网络连接

**问题：环境变量未生效**
```bash
# 验证环境变量
echo $XUEQIU_TOKEN  # Linux/Mac
echo %XUEQIU_TOKEN%  # Windows CMD
```

## 注意事项

- Token会过期，需要定期更新
- 不要将token提交到版本控制系统
- 遵守雪球API使用条款
