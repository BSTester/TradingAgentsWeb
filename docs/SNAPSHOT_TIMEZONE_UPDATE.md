# 资产快照时区处理更新

## 更新日期
2025-11-13

## 更新原因

原有实现使用北京时间作为基准，手动计算各市场的快照时间。这种方式存在以下问题：

1. **美股夏令时问题**: 美国每年3月和11月会切换夏令时，导致快照时间需要手动调整
2. **维护困难**: 需要记住每个市场与北京时间的时差
3. **不够准确**: 硬编码的时间可能与市场实际收盘时间不符

## 更新内容

### 核心改进

使用市场本地时区代替北京时间，让 APScheduler 自动处理时区转换和夏令时切换。

### 配置变更

#### 之前（使用北京时间）

```python
MARKET_CLOSE_TIMES = {
    'US': {'hour': 5, 'minute': 0},    # 北京时间 05:00
    'HK': {'hour': 16, 'minute': 30},  # 北京时间 16:30
    'CN': {'hour': 15, 'minute': 30},  # 北京时间 15:30
}

# 调度器使用北京时区
self.scheduler = AsyncIOScheduler(timezone='Asia/Shanghai')

# 触发器使用北京时区
trigger = CronTrigger(
    hour=close_time['hour'],
    minute=close_time['minute'],
    timezone='Asia/Shanghai'
)
```

**问题**:
- 美股时间固定为北京时间 05:00，但实际应该是：
  - 夏令时: 04:00
  - 冬令时: 05:00
- 需要手动调整配置

#### 现在（使用市场本地时区）

```python
MARKET_CLOSE_TIMES = {
    'US': {
        'hour': 16,           # 美东时间 16:00
        'minute': 0,
        'timezone': 'America/New_York',  # 使用市场时区
        'description': '美东时间 16:00 (自动处理夏令时/冬令时)'
    },
    'HK': {
        'hour': 16,           # 香港时间 16:00
        'minute': 0,
        'timezone': 'Asia/Hong_Kong',
        'description': '香港时间 16:00'
    },
    'CN': {
        'hour': 15,           # 北京时间 15:00
        'minute': 0,
        'timezone': 'Asia/Shanghai',
        'description': '北京时间 15:00'
    },
}

# 调度器使用 UTC 作为基准
self.scheduler = AsyncIOScheduler(timezone='UTC')

# 触发器使用市场本地时区
trigger = CronTrigger(
    hour=close_time['hour'],
    minute=close_time['minute'],
    timezone=close_time['timezone']  # 关键改变
)
```

**优势**:
- APScheduler 自动处理夏令时切换
- 配置更清晰，直接使用市场收盘时间
- 无需手动调整

### 日志增强

#### 之前

```
✅ Snapshot scheduler started
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot: next run at 2025-11-14 05:00:00+08:00
  - Daily HK Market Snapshot: next run at 2025-11-14 16:30:00+08:00
  - Daily CN Market Snapshot: next run at 2025-11-14 15:30:00+08:00
```

#### 现在

```
✅ Snapshot scheduler started
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot:
    Next run: 2025-11-14 16:00:00 EST
    Beijing:  2025-11-15 05:00:00 CST
  - Daily HK Market Snapshot:
    Next run: 2025-11-14 16:00:00 HKT
    Beijing:  2025-11-14 16:00:00 CST
  - Daily CN Market Snapshot:
    Next run: 2025-11-14 15:00:00 CST
    Beijing:  2025-11-14 15:00:00 CST
```

**改进**:
- 显示市场本地时间和时区标识（EST/EDT）
- 同时显示北京时间，方便中国用户查看
- 更详细的时区信息

## 技术细节

### 时区库

使用 `pytz` 库处理时区：

```python
import pytz

# 获取时区对象
ny_tz = pytz.timezone('America/New_York')
beijing_tz = pytz.timezone('Asia/Shanghai')

# 时区转换
next_run_beijing = next_run.astimezone(beijing_tz)
```

### 夏令时自动处理

APScheduler 内部使用 pytz 的时区数据库：
- 自动识别夏令时切换日期
- 自动调整触发时间
- 无需应用程序干预

### 时区数据库

使用 IANA 时区数据库（tzdata）：
- `America/New_York`: 美东时区（包含 EDT/EST 规则）
- `Asia/Hong_Kong`: 香港时区
- `Asia/Shanghai`: 中国标准时间

## 影响分析

### 对现有部署的影响

**无影响**:
- 快照数据格式不变
- API 接口不变
- 数据库结构不变

**需要注意**:
- 美股快照时间会根据当前是否为夏令时而变化
- 日志格式有所变化（更详细）

### 对用户的影响

**透明**:
- 用户无需了解时区细节
- 快照仍在市场收盘后创建
- 趋势图显示不受影响

**改进**:
- 更准确的快照时间
- 自动适应夏令时变化

## 测试验证

### 1. 验证时区配置

```python
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler
import pytz

scheduler = get_snapshot_scheduler()

# 检查每个市场的下次运行时间
for market in ['US', 'HK', 'CN']:
    job = scheduler.get_job(market)
    if job:
        next_run = job.next_run_time
        beijing_tz = pytz.timezone('Asia/Shanghai')
        next_run_beijing = next_run.astimezone(beijing_tz)
        
        print(f"{market} Market:")
        print(f"  Local: {next_run.strftime('%Y-%m-%d %H:%M:%S %Z')}")
        print(f"  Beijing: {next_run_beijing.strftime('%Y-%m-%d %H:%M:%S %Z')}")
```

### 2. 验证夏令时切换

```python
from datetime import datetime
import pytz

ny_tz = pytz.timezone('America/New_York')
beijing_tz = pytz.timezone('Asia/Shanghai')

# 测试夏令时期间（7月）
summer = ny_tz.localize(datetime(2025, 7, 15, 16, 0))
print(f"Summer: {summer.strftime('%H:%M %Z')} = {summer.astimezone(beijing_tz).strftime('%H:%M %Z')}")

# 测试冬令时期间（1月）
winter = ny_tz.localize(datetime(2025, 1, 15, 16, 0))
print(f"Winter: {winter.strftime('%H:%M %Z')} = {winter.astimezone(beijing_tz).strftime('%H:%M %Z')}")
```

预期输出：
```
Summer: 16:00 EDT = 04:00 CST
Winter: 16:00 EST = 05:00 CST
```

### 3. 验证日志输出

启动服务后检查日志：
- 确认显示市场本地时间
- 确认显示北京时间
- 确认时区标识正确（EDT/EST/HKT/CST）

## 迁移步骤

### 对于新部署

直接使用新版本，无需额外操作。

### 对于现有部署

1. **更新代码**:
   ```bash
   git pull
   ```

2. **确认依赖**:
   ```bash
   pip install -r requirements.txt
   # 确保 pytz 已安装
   ```

3. **重启服务**:
   ```bash
   # 停止服务
   # 启动服务
   python web/backend/app.py
   ```

4. **验证日志**:
   检查启动日志，确认时区配置正确

5. **监控首次执行**:
   等待下次快照任务执行，确认时间正确

## 回滚方案

如果需要回滚到旧版本：

```bash
git checkout <previous-commit>
pip install -r requirements.txt
# 重启服务
```

## 2025年关键日期

### 美国夏令时切换

**开始**: 2025年3月9日 02:00 (周日)
- 美东 16:00 = 北京 04:00 (次日)

**结束**: 2025年11月2日 02:00 (周日)
- 美东 16:00 = 北京 05:00 (次日)

### 监控建议

在以下日期前后监控快照执行：
- 2025-03-09 (夏令时开始)
- 2025-11-02 (冬令时开始)

## 相关文档

- `docs/SNAPSHOT_TIMEZONE_HANDLING.md` - 详细的时区处理说明
- `docs/ASSET_SNAPSHOT_FEATURE.md` - 功能文档（已更新）
- `docs/SNAPSHOT_IMPLEMENTATION_SUMMARY.md` - 实现总结（已更新）
- `docs/SNAPSHOT_QUICK_START.md` - 快速启动指南（已更新）

## 常见问题

### Q: 为什么美股快照时间会变化？

A: 美国使用夏令时，每年3月和11月会调整时钟。系统使用市场本地时区，自动跟随这些变化。

### Q: 需要手动调整配置吗？

A: 不需要。APScheduler 会自动处理夏令时切换。

### Q: 如何确认当前是夏令时还是冬令时？

A: 查看日志中的时区标识：
- `EDT` = 夏令时（北京时间 04:00）
- `EST` = 冬令时（北京时间 05:00）

### Q: 港股和A股会受影响吗？

A: 不会。香港和中国不使用夏令时，快照时间全年固定。

## 总结

本次更新通过使用市场本地时区，实现了：

1. ✅ 自动处理美股夏令时切换
2. ✅ 更准确的快照时间
3. ✅ 更清晰的配置
4. ✅ 更详细的日志
5. ✅ 更好的可维护性

无需手动干预，系统会自动适应时区变化。
