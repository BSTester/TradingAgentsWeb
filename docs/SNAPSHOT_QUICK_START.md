# 资产快照功能 - 快速启动指南

## 快速开始

### 1. 启动后端服务

```bash
cd web/backend
python app.py
```

启动后你会看到：
```
✅ Snapshot scheduler started (daily account snapshots)
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

**注意**: 美股时间会根据夏令时/冬令时自动调整（北京时间 04:00 或 05:00）。

### 2. 配置用户

确保用户配置了 Futu API：

```sql
-- 查看用户配置
SELECT id, username, futu_api_base_url, intraday_futu_api_url 
FROM users u
LEFT JOIN user_configs uc ON u.id = uc.user_id;

-- 更新用户配置（如果需要）
UPDATE user_configs 
SET futu_api_base_url = 'http://localhost:11111'
WHERE user_id = 1;
```

### 3. 查看快照数据

```sql
-- 查看最新快照
SELECT * FROM account_snapshots 
ORDER BY snapshot_date DESC 
LIMIT 10;

-- 查看特定用户的快照
SELECT 
    snapshot_date,
    market_type,
    total_assets,
    cash,
    market_value,
    realized_pnl,
    unrealized_pnl
FROM account_snapshots 
WHERE user_id = 1 
ORDER BY snapshot_date DESC;
```

### 4. 查看趋势图

1. 访问智能盯盘页面：`http://localhost:3000/intraday-trading`
2. 在账户信息卡片中，点击任意指标右下角的图表图标
3. 选择时间范围（7天、30天、自定义）
4. 查看资产变化趋势

注：快照仅在收盘时自动创建，无需手动操作。

## 测试定时任务

### 方法1：修改时间测试

编辑 `web/backend/services/snapshot_scheduler.py`：

```python
# 修改为当前时间后几分钟（使用北京时间）
MARKET_CLOSE_TIMES = {
    'US': {
        'hour': 14,           # 例如：当前是14:30，设置为14:35
        'minute': 35,
        'timezone': 'Asia/Shanghai',  # 临时改为北京时区方便测试
        'description': '测试时间'
    },
    # ... 其他市场
}
```

重启服务，等待定时任务执行。

**注意**: 测试完成后记得恢复为市场本地时区。

### 方法2：手动触发

```python
# 在 Python 控制台中
import asyncio
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler

scheduler = get_snapshot_scheduler()
asyncio.run(scheduler._create_snapshots_for_market('US'))
```

## 常见问题

### Q1: 定时任务没有执行？

**检查**：
1. 后端启动日志是否显示调度器已启动
2. 当前时间是否已过定时任务时间
3. 是否有多个后端进程（只有 leader 执行）
4. 后端日志是否有错误

### Q2: 快照数据不准确？

**检查**：
1. Futu API 返回的数据是否正确
2. 账户和持仓数据是否同步
3. 市场类型是否匹配

### Q3: 趋势图没有数据？

**检查**：
1. 是否已创建至少一个快照
2. 时间范围是否包含快照数据
3. API 请求是否成功

## 监控命令

### 查看快照统计

```sql
-- 每个市场的快照数量
SELECT market_type, COUNT(*) as count
FROM account_snapshots
GROUP BY market_type;

-- 每个用户的快照数量
SELECT user_id, market_type, COUNT(*) as count
FROM account_snapshots
GROUP BY user_id, market_type;

-- 今天创建的快照
SELECT * FROM account_snapshots
WHERE DATE(snapshot_date) = CURRENT_DATE;
```

### 查看调度器状态

```python
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler

scheduler = get_snapshot_scheduler()

# 查看所有任务
for job in scheduler.scheduler.get_jobs():
    print(f"{job.name}: next run at {job.next_run_time}")

# 查看特定市场的下次运行时间
next_run = scheduler.get_next_run_time('US')
print(f"US market next snapshot: {next_run}")
```

## 性能优化

### 1. 数据库索引

```sql
-- 确保有以下索引
CREATE INDEX idx_account_snapshots_user_market 
ON account_snapshots(user_id, market_type);

CREATE INDEX idx_account_snapshots_date 
ON account_snapshots(snapshot_date);
```

### 2. 数据清理

```sql
-- 删除6个月前的快照（可选）
DELETE FROM account_snapshots 
WHERE snapshot_date < DATE_SUB(NOW(), INTERVAL 6 MONTH);
```

### 3. 批量查询优化

```python
# 使用批量查询而不是循环查询
snapshots = await db.execute(
    select(AccountSnapshot)
    .where(AccountSnapshot.user_id.in_(user_ids))
    .order_by(AccountSnapshot.snapshot_date.desc())
)
```

## 日志位置

- **应用日志**：控制台输出
- **调度器日志**：包含在应用日志中，前缀为 `INFO:` 或 `ERROR:`
- **数据库日志**：根据数据库配置

## 下一步

1. ✅ 验证定时任务正常运行
2. ✅ 测试手动快照功能
3. ✅ 查看趋势图显示
4. ⏭️ 配置数据备份
5. ⏭️ 设置监控告警
6. ⏭️ 优化查询性能

## 支持

如有问题，请查看：
- `docs/ASSET_SNAPSHOT_FEATURE.md` - 详细功能文档
- `docs/SNAPSHOT_IMPLEMENTATION_SUMMARY.md` - 实现总结
- 后端日志 - 错误信息和调试信息
