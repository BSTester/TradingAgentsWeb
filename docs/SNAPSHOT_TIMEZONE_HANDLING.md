# 资产快照时区处理说明

## 概述

资产快照系统使用市场本地时区来调度定时任务，确保快照在每个市场的实际收盘时间创建。系统自动处理夏令时 (Daylight Saving Time, DST) 切换，无需手动干预。

## 市场时区配置

### 美股市场 (US)

**时区**: `America/New_York` (美东时区)

**收盘时间**: 16:00 ET (Eastern Time)

**夏令时 (EDT - Eastern Daylight Time)**:
- 时间段: 3月第二个周日 02:00 - 11月第一个周日 02:00
- 与 UTC 时差: UTC-4
- 与北京时间时差: 北京时间 - 12小时
- 快照时间: 北京时间 **04:00**

**冬令时 (EST - Eastern Standard Time)**:
- 时间段: 11月第一个周日 02:00 - 3月第二个周日 02:00
- 与 UTC 时差: UTC-5
- 与北京时间时差: 北京时间 - 13小时
- 快照时间: 北京时间 **05:00**

**示例**:
```
2025年3月9日 (夏令时开始):
  美东 16:00 = 北京 04:00 (次日)

2025年11月2日 (冬令时开始):
  美东 16:00 = 北京 05:00 (次日)
```

### 港股市场 (HK)

**时区**: `Asia/Hong_Kong` (香港时区)

**收盘时间**: 16:00 HKT (Hong Kong Time)

**时差**:
- 与 UTC 时差: UTC+8
- 与北京时间时差: 相同
- 快照时间: 北京时间 **16:00**

**特点**:
- 香港不使用夏令时
- 与北京时间完全一致
- 全年快照时间固定

### A股市场 (CN)

**时区**: `Asia/Shanghai` (中国标准时间)

**收盘时间**: 15:00 CST (China Standard Time)

**时差**:
- 与 UTC 时差: UTC+8
- 快照时间: 北京时间 **15:00**

**特点**:
- 中国不使用夏令时
- 全年快照时间固定

## 技术实现

### APScheduler 时区配置

```python
# 市场收盘时间配置
MARKET_CLOSE_TIMES = {
    'US': {
        'hour': 16,           # 4:00 PM Eastern Time
        'minute': 0,
        'timezone': 'America/New_York',  # 自动处理 EDT/EST
        'description': '美东时间 16:00 (自动处理夏令时/冬令时)'
    },
    'HK': {
        'hour': 16,           # 4:00 PM Hong Kong Time
        'minute': 0,
        'timezone': 'Asia/Hong_Kong',
        'description': '香港时间 16:00'
    },
    'CN': {
        'hour': 15,           # 3:00 PM China Standard Time
        'minute': 0,
        'timezone': 'Asia/Shanghai',
        'description': '北京时间 15:00'
    },
}
```

### Cron 触发器

```python
from apscheduler.triggers.cron import CronTrigger

# 创建触发器，使用市场本地时区
trigger = CronTrigger(
    hour=close_time['hour'],
    minute=close_time['minute'],
    timezone=close_time['timezone']  # 关键：使用市场时区
)
```

### 自动 DST 处理

APScheduler 使用 `pytz` 库处理时区：
- 自动识别夏令时切换日期
- 自动调整触发时间
- 无需手动干预

## 日志输出

### 启动日志示例

```
✅ Snapshot scheduler started
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot:
    Next run: 2025-03-15 16:00:00 EDT
    Beijing:  2025-03-16 04:00:00 CST
  - Daily HK Market Snapshot:
    Next run: 2025-03-15 16:00:00 HKT
    Beijing:  2025-03-15 16:00:00 CST
  - Daily CN Market Snapshot:
    Next run: 2025-03-15 15:00:00 CST
    Beijing:  2025-03-15 15:00:00 CST
```

### 夏令时切换日志

```
# 夏令时开始 (3月第二个周日)
INFO: Registered snapshot job for US market: 美东时间 16:00 (自动处理夏令时/冬令时)
INFO:   Next run: 2025-03-09 16:00:00 EDT (Beijing time)
INFO: Creating US market snapshots...
INFO: ✅ US market snapshot job completed: 5 created, 0 errors

# 冬令时开始 (11月第一个周日)
INFO: Registered snapshot job for US market: 美东时间 16:00 (自动处理夏令时/冬令时)
INFO:   Next run: 2025-11-02 16:00:00 EST (Beijing time)
INFO: Creating US market snapshots...
INFO: ✅ US market snapshot job completed: 5 created, 0 errors
```

## 验证时区配置

### 方法1：查看下次运行时间

```python
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler
import pytz

scheduler = get_snapshot_scheduler()

# 获取美股市场的下次运行时间
job = scheduler.get_job('US')
next_run = job.next_run_time

# 转换为北京时间
beijing_tz = pytz.timezone('Asia/Shanghai')
next_run_beijing = next_run.astimezone(beijing_tz)

print(f"US market next run:")
print(f"  Local: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"  Beijing: {next_run_beijing.strftime('%Y-%m-%d %H:%M:%S %Z')}")
```

### 方法2：检查时区信息

```python
import pytz
from datetime import datetime

# 检查美东时区当前是否为夏令时
ny_tz = pytz.timezone('America/New_York')
now = datetime.now(ny_tz)
is_dst = bool(now.dst())

print(f"Current time in New York: {now.strftime('%Y-%m-%d %H:%M:%S %Z')}")
print(f"Is DST active: {is_dst}")
print(f"UTC offset: {now.strftime('%z')}")
```

### 方法3：测试时区转换

```python
from datetime import datetime
import pytz

# 美东时间 16:00
ny_tz = pytz.timezone('America/New_York')
beijing_tz = pytz.timezone('Asia/Shanghai')

# 夏令时期间
summer_date = datetime(2025, 7, 15, 16, 0, 0)
summer_ny = ny_tz.localize(summer_date)
summer_beijing = summer_ny.astimezone(beijing_tz)
print(f"Summer: NY {summer_ny.strftime('%H:%M %Z')} = Beijing {summer_beijing.strftime('%H:%M %Z')}")

# 冬令时期间
winter_date = datetime(2025, 1, 15, 16, 0, 0)
winter_ny = ny_tz.localize(winter_date)
winter_beijing = winter_ny.astimezone(beijing_tz)
print(f"Winter: NY {winter_ny.strftime('%H:%M %Z')} = Beijing {winter_beijing.strftime('%H:%M %Z')}")
```

## 常见问题

### Q1: 为什么美股快照时间会变化？

A: 美国使用夏令时制度，每年3月和11月会调整时钟：
- 3月第二个周日：时钟拨快1小时（进入夏令时）
- 11月第一个周日：时钟拨慢1小时（进入冬令时）

系统使用市场本地时区，自动跟随这些变化。

### Q2: 如何确认当前是夏令时还是冬令时？

A: 查看启动日志中的时区标识：
- `EDT` (Eastern Daylight Time) = 夏令时
- `EST` (Eastern Standard Time) = 冬令时

或者查看北京时间：
- 04:00 = 夏令时
- 05:00 = 冬令时

### Q3: 夏令时切换时会影响快照吗？

A: 不会。APScheduler 会自动处理切换：
- 切换当天的快照会正常创建
- 下次运行时间会自动调整
- 无需重启服务

### Q4: 如果我想修改快照时间怎么办？

A: 修改 `snapshot_scheduler.py` 中的配置：

```python
MARKET_CLOSE_TIMES = {
    'US': {
        'hour': 17,  # 改为 5:00 PM ET
        'minute': 0,
        'timezone': 'America/New_York',
    },
}
```

重启服务后生效。

### Q5: 为什么不直接使用北京时间？

A: 使用市场本地时区的优势：
1. **准确性**: 始终在市场实际收盘时创建快照
2. **自动化**: 无需手动调整夏令时
3. **可维护性**: 配置更清晰，易于理解
4. **扩展性**: 容易添加其他市场

## 2025年夏令时日期

### 美国夏令时

**开始**: 2025年3月9日 02:00 (周日)
- 时钟拨快1小时: 02:00 → 03:00
- 进入 EDT (UTC-4)

**结束**: 2025年11月2日 02:00 (周日)
- 时钟拨慢1小时: 02:00 → 01:00
- 进入 EST (UTC-5)

### 影响

| 日期范围 | 时区 | 美东 16:00 对应北京时间 |
|---------|------|------------------------|
| 2025-01-01 至 2025-03-08 | EST | 05:00 (次日) |
| 2025-03-09 至 2025-11-01 | EDT | 04:00 (次日) |
| 2025-11-02 至 2025-12-31 | EST | 05:00 (次日) |

## 依赖库

- **APScheduler**: 任务调度
- **pytz**: 时区处理
- **Python datetime**: 日期时间操作

确保安装正确版本：
```bash
pip install apscheduler pytz
```

## 最佳实践

1. **使用市场本地时区**: 始终使用市场的官方时区（如 America/New_York）
2. **避免硬编码时差**: 不要手动计算时差，让 pytz 处理
3. **记录时区信息**: 在日志中同时显示本地时间和北京时间
4. **测试切换日期**: 在夏令时切换前后测试系统行为
5. **监控执行时间**: 确认快照在预期时间创建

## 参考资料

- [APScheduler 文档](https://apscheduler.readthedocs.io/)
- [pytz 文档](https://pythonhosted.org/pytz/)
- [美国夏令时规则](https://www.timeanddate.com/time/change/usa)
- [IANA 时区数据库](https://www.iana.org/time-zones)
