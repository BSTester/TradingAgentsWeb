# 时区处理说明

## 概述

TradingAgentsWeb 系统需要正确处理不同市场的交易时间，这涉及到时区转换。系统可能部署在中国（UTC+8），但需要判断美国（EST/EDT）、香港（HKT）、中国（CST）市场是否开盘。

## 时区转换流程

### 1. 系统时间获取

系统使用 `datetime.now()` 获取的是本地时间（通常是北京时间 UTC+8）。

### 2. 转换为 UTC

为了统一处理，首先将本地时间转换为 UTC：

```python
import pytz
from datetime import datetime

# 获取 UTC 时间
utc_now = datetime.now(pytz.UTC)
```

### 3. 传递给市场时间检查

`is_market_open()` 函数接受 UTC 时间或带时区的 datetime，并自动转换为市场本地时间：

```python
from tradingagents.agents.utils.market_utils import is_market_open

# 检查美股是否开盘
is_open, message = is_market_open("US", utc_now)
```

### 4. 内部转换

`is_market_open()` 函数内部会：
1. 将传入的时间转换为市场本地时间
2. 检查是否在交易时段内
3. 返回结果和说明信息

## 市场交易时间

### 美国市场 (US)
- **时区**: EST/EDT (America/New_York)
- **交易时间**: 09:30-16:00
- **工作日**: 周一至周五

### 香港市场 (HK)
- **时区**: HKT (Asia/Hong_Kong)
- **交易时间**: 09:30-12:00, 13:00-16:00（有午休）
- **工作日**: 周一至周五

### 中国市场 (CN)
- **时区**: CST (Asia/Shanghai)
- **交易时间**: 09:30-11:30, 13:00-15:00（有午休）
- **工作日**: 周一至周五

## 时区对应关系

### 北京时间与各市场时间对应

| 北京时间 | 美东时间 (EST) | 香港时间 (HKT) | 上海时间 (CST) |
|---------|---------------|---------------|---------------|
| 22:30   | 09:30 (当天)   | 22:30 (当天)   | 22:30 (当天)   |
| 05:00   | 16:00 (前一天) | 05:00 (当天)   | 05:00 (当天)   |

**注意**: 
- 北京时间与香港时间、上海时间相同（都是 UTC+8）
- 美东时间比北京时间晚 13 小时（EST）或 12 小时（EDT）

### 美股交易时间（北京时间）

- **冬令时 (EST)**: 北京时间 22:30 - 次日 05:00
- **夏令时 (EDT)**: 北京时间 21:30 - 次日 04:00

## 代码示例

### Trading Executor 中的使用

```python
import pytz
from datetime import datetime
from tradingagents.agents.utils.market_utils import is_market_open

# 获取 UTC 时间
utc_now = datetime.now(pytz.UTC)

# 获取市场时区
market_timezones = {
    "US": pytz.timezone("America/New_York"),
    "HK": pytz.timezone("Asia/Hong_Kong"),
    "CN": pytz.timezone("Asia/Shanghai"),
}
market_tz = market_timezones.get(market_type, pytz.UTC)
market_local_time = utc_now.astimezone(market_tz)

# 检查市场是否开盘
is_open, market_status_msg = is_market_open(market_type, market_local_time)

if not is_open:
    # 生成报告，显示系统时间和市场本地时间
    report = f"""
    系统时间（北京）: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    市场本地时间: {market_local_time.strftime('%Y-%m-%d %H:%M:%S %Z')}
    市场状态: 休市
    """
```

## 测试场景

### 场景 1: 美股开盘时间
- **北京时间**: 2025-11-04 22:30 (周二晚上)
- **美东时间**: 2025-11-04 09:30 EST (周二早上)
- **预期结果**: 开盘 ✓

### 场景 2: 美股关闭时间
- **北京时间**: 2025-11-04 14:00 (周二下午)
- **美东时间**: 2025-11-04 01:00 EST (周二凌晨)
- **预期结果**: 关闭 ✓

### 场景 3: 港股午休时间
- **北京时间**: 2025-11-04 12:30 (周二中午)
- **香港时间**: 2025-11-04 12:30 HKT (周二中午)
- **预期结果**: 关闭（午休）✓

## 注意事项

1. **始终使用 UTC 时间**: 在系统内部传递时间时，使用 UTC 可以避免时区混淆
2. **显示本地时间**: 在报告中同时显示系统时间和市场本地时间，便于用户理解
3. **夏令时处理**: pytz 会自动处理夏令时转换（EST/EDT）
4. **周末检查**: 所有市场周末都不开盘
5. **节假日**: 当前实现不检查节假日，可以在未来扩展

## 相关文件

- `tradingagents/agents/utils/market_utils.py` - 市场时间检查函数
- `tradingagents/agents/trader/trading_executor.py` - 交易执行器（使用时区转换）

## 更新日期

2025-11-04
