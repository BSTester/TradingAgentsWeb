# 智能盯盘任务快照功能修复总结

## 问题描述

智能盯盘任务完成后，账户快照没有正确生成。经过检查发现以下问题：

1. **市场开放检查限制**：快照创建函数 `create_account_snapshot()` 默认会检查市场是否开放，如果市场关闭则不创建快照
2. **盯盘任务执行时间**：盯盘任务可能在市场关闭后才完成分析，导致快照创建被跳过
3. **日期级别唯一性约束**：数据库有 `DATE(snapshot_date)` 级别的唯一性约束，限制每天只能有一个快照，无法支持同一天多次盯盘任务

## 修复方案

### 1. 添加 `skip_market_check` 参数

**文件**: `web/backend/services/snapshot_scheduler.py`

在 `create_account_snapshot()` 函数中添加 `skip_market_check` 参数：

```python
async def create_account_snapshot(
    user_id: int, 
    market_type: str, 
    skip_market_check: bool = False
) -> bool:
    """
    Create an account snapshot for a specific user and market.
    
    Args:
        user_id: User ID
        market_type: Market type (US, HK, CN)
        skip_market_check: If True, create snapshot regardless of market status
                          Set to True when called after intraday analysis completion
    """
```

**逻辑**：
- 默认情况下（`skip_market_check=False`）：保持原有行为，只在市场开放时创建快照
- 盯盘任务完成时（`skip_market_check=True`）：跳过市场检查，无论市场是否开放都创建快照

### 2. 移除日期级别唯一性约束

**文件**: `web/backend/migrations/remove_snapshot_date_constraint.py`

移除数据库中的 `uq_user_market_date` 约束，该约束限制每天只能有一个快照：

```sql
DROP INDEX IF EXISTS uq_user_market_date
```

**新行为**：
- ✅ 同一天可以创建多个快照（不同时间点）
- ✅ 支持每小时或更频繁的盯盘任务
- ✅ 可以记录日内账户变化趋势

### 3. 处理同一秒的重复快照

**文件**: `web/backend/services/snapshot_scheduler.py`

修改快照创建逻辑，检查是否存在相同时间戳（精确到秒）的快照：

```python
# Round to nearest second to avoid microsecond differences
snapshot_date_naive = local_now.replace(tzinfo=None, microsecond=0)

# Check if a snapshot already exists at this exact time (same second)
existing_query = select(AccountSnapshot).where(
    and_(
        AccountSnapshot.user_id == user_id,
        AccountSnapshot.market_type == market_type.upper(),
        AccountSnapshot.snapshot_date == snapshot_date_naive  # Exact timestamp match
    )
)

if existing_snapshot:
    # Update existing snapshot at this exact time
    existing_snapshot.total_assets = total_assets
    # ... update other fields
else:
    # Create new snapshot
    snapshot = AccountSnapshot(...)
```

**好处**：
- 允许同一天的多个快照（不同时间）
- 防止同一秒的重复记录
- 自动更新相同时间点的快照

### 4. 在盯盘任务完成时创建快照

**文件**: `web/backend/services/intraday_executor.py`

修改盯盘任务执行器，在任务完成后调用快照创建：

```python
# Create account snapshot after analysis completes
# Skip market check since we want to capture the state after analysis
snapshot_created = await create_account_snapshot(
    user_id, 
    market_type, 
    skip_market_check=True  # 关键：跳过市场检查
)
```

### 5. 将快照信息保存到决策记录

**文件**: `web/backend/services/intraday_executor.py`

在创建快照后，将快照 ID 和关键信息保存到决策记录中：

```python
if snapshot_created:
    # Get the snapshot ID that was just created/updated
    latest_snapshot = await db.execute(snapshot_query)
    
    if latest_snapshot:
        snapshot_id = latest_snapshot.id
        # Add snapshot reference to decision record
        decision_record.account_snapshot['snapshot_id'] = snapshot_id
        decision_record.account_snapshot['snapshot_date'] = latest_snapshot.snapshot_date.isoformat()
        decision_record.account_snapshot['total_assets'] = latest_snapshot.total_assets
        decision_record.account_snapshot['cash'] = latest_snapshot.cash
        decision_record.account_snapshot['market_value'] = latest_snapshot.market_value
        await db.commit()
```

## 测试验证

### 测试 1：市场关闭时创建快照
```bash
python test_snapshot_fix.py
```

**结果**：
- ✅ 市场关闭时，使用 `skip_market_check=True` 可以成功创建快照

### 测试 2：同一天多个快照
```bash
python test_multiple_snapshots.py
```

**结果**：
- ✅ 同一天可以创建多个快照（不同时间点）
- ✅ 每次创建都生成新的快照记录
- ✅ 示例：09:49:33、09:58:00、09:58:02 三个快照

### 测试 3：同一秒重复快照
```bash
python test_same_second_snapshot.py
```

**结果**：
- ✅ 同一秒的快照会更新现有记录，不创建重复
- ✅ 快照 ID 保持不变，只更新数据
- ✅ 避免了数据库中的重复记录

### 测试 4：快照信息保存到决策记录
- ✅ 快照 ID 正确保存到决策记录的 `account_snapshot` 字段
- ✅ 包含快照日期、总资产、现金、市值等信息

## 影响范围

### 修改的文件
1. `web/backend/services/snapshot_scheduler.py` - 快照创建逻辑
2. `web/backend/services/intraday_executor.py` - 盯盘任务执行器
3. `web/backend/migrations/remove_snapshot_date_constraint.py` - 数据库迁移（移除约束）

### 数据库变更
- ❌ 移除约束：`uq_user_market_date` (user_id, market_type, DATE(snapshot_date))
- ✅ 新行为：允许同一天多个快照，但同一秒只能有一个

### 不影响的功能
- 定时快照调度器（每日收盘时自动创建快照）仍然正常工作
- 快照 API 路由（查询、统计等）不受影响
- 前端显示逻辑不受影响

## 使用场景

### 场景 1：定时快照（收盘时）
```python
# 由 SnapshotScheduler 自动调用
# 使用默认参数，只在市场开放时创建
await create_account_snapshot(user_id, market_type)
```

**特点**：
- 每天收盘时自动执行
- 检查市场是否开放
- 记录当日收盘账户状态

### 场景 2：盯盘任务完成后
```python
# 由 IntradayExecutor 调用
# 跳过市场检查，确保快照创建
await create_account_snapshot(user_id, market_type, skip_market_check=True)
```

**特点**：
- 每次盯盘任务完成后执行
- 跳过市场开放检查
- 可以一天多次执行（如每小时盯盘）
- 记录任务完成时的账户状态

### 场景 3：日内多次快照
```python
# 示例：每小时执行一次盯盘任务
# 09:00 - 快照 1
# 10:00 - 快照 2
# 11:00 - 快照 3
# ...
# 16:00 - 快照 N
```

**好处**：
- 可以追踪日内账户变化趋势
- 支持更精细的性能分析
- 便于回溯特定时间点的账户状态

## 后续建议

1. **监控日志**：观察生产环境中快照创建的日志，确认修复有效
2. **数据验证**：定期检查快照数据的完整性和准确性
3. **性能优化**：如果快照创建频繁，考虑添加缓存或批量处理

## 相关文档

- [账户快照功能文档](./ACCOUNT_SNAPSHOT_FEATURE.md)
- [盯盘任务实现文档](./SCHEDULED_TASKS_IMPLEMENTATION.md)
- [数据库迁移文档](./DATABASE_SETUP.md)

---

**修复日期**: 2025-11-13  
**修复人员**: Kiro AI Assistant  
**测试状态**: ✅ 通过
