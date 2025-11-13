# 资产快照数据流程

## 概述

资产快照系统在每个市场收盘后自动从 Futu API 获取最新的账户数据，并保存为快照记录。

## 完整数据流程

```
┌─────────────────────────────────────────────────────────────┐
│              定时任务触发（市场收盘时间）                    │
│  - 美股: 美东 16:00                                         │
│  - 港股: 香港 16:00                                         │
│  - A股: 北京 15:00                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              查询所有配置了 Futu API 的用户                  │
│  SELECT * FROM users u                                      │
│  JOIN user_configs uc ON u.id = uc.user_id                 │
│  WHERE uc.futu_api_base_url IS NOT NULL                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              遍历每个用户，执行以下步骤                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 1: 获取账户信息（实时数据，使用用户配置）             │
│  account_info = await get_account_info_async(              │
│      market_type, user_id=user.id)                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 2: 处理账户信息                                       │
│  从 account_info 中提取数据                                 │
│                                                             │
│  返回数据包含:                                              │
│  - total_assets: 总资产                                     │
│  - cash: 可用资金                                           │
│  - market_value: 持仓市值                                   │
│  - currency: 货币类型                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 3: 获取持仓信息（实时数据）                           │
│  positions = await client.get_positions(market_type)       │
│                                                             │
│  返回数据包含:                                              │
│  - stock_code: 股票代码                                     │
│  - quantity: 持仓数量                                       │
│  - cost_price: 成本价                                       │
│  - current_price: 当前价                                    │
│  - realized_pnl: 已实现盈亏                                 │
│  - unrealized_pnl: 未实现盈亏                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 4: 计算汇总数据                                       │
│  - 总资产 = account_info.total_assets                       │
│  - 可用资金 = account_info.cash                             │
│  - 持仓市值 = account_info.market_value                     │
│  - 已实现盈亏 = sum(pos.realized_pnl for pos in positions) │
│  - 未实现盈亏 = sum(pos.unrealized_pnl for pos in positions)│
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 5: 检查是否已存在今日快照（防重复）                   │
│  - 使用市场本地日期                                         │
│  - 查询数据库                                               │
│  - 如果存在 → 跳过此用户                                    │
│  - 如果不存在 → 继续                                        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 6: 创建快照记录                                       │
│  snapshot = AccountSnapshot(                               │
│      user_id=user.id,                                      │
│      market_type=market_type,                              │
│      snapshot_date=datetime.now(),                         │
│      total_assets=total_assets,                            │
│      cash=cash,                                            │
│      market_value=market_value,                            │
│      realized_pnl=realized_pnl,                            │
│      unrealized_pnl=unrealized_pnl                         │
│  )                                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  步骤 7: 保存到数据库                                       │
│  db.add(snapshot)                                          │
│  await db.commit()                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              记录日志并继续处理下一个用户                    │
│  logger.info(f"Created snapshot for user {user.id}")      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              所有用户处理完成                                │
│  logger.info(f"✅ {market_type} snapshot job completed")   │
└─────────────────────────────────────────────────────────────┘
```

## 数据来源

### 1. Futu API 账户信息接口

**接口**: `GET /api/account/info?market={market_type}`

**请求示例**:
```http
GET http://localhost:11111/api/account/info?market=US
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "total_assets": 50000.00,
    "cash": 20000.00,
    "market_value": 30000.00,
    "currency": "$",
    "account_type": "CASH",
    "buying_power": 20000.00
  }
}
```

### 2. Futu API 持仓信息接口

**接口**: `GET /api/positions?market={market_type}`

**请求示例**:
```http
GET http://localhost:11111/api/positions?market=US
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "stock_code": "AAPL",
      "stock_name": "Apple Inc.",
      "quantity": 100,
      "cost_price": 150.00,
      "current_price": 155.00,
      "market_value": 15500.00,
      "realized_pnl": 0.00,
      "unrealized_pnl": 500.00,
      "pnl_percent": 3.33
    },
    {
      "stock_code": "TSLA",
      "stock_name": "Tesla Inc.",
      "quantity": 50,
      "cost_price": 200.00,
      "current_price": 195.00,
      "market_value": 9750.00,
      "realized_pnl": 0.00,
      "unrealized_pnl": -250.00,
      "pnl_percent": -2.50
    }
  ]
}
```

## 数据处理

### 账户数据提取

```python
# 从 API 响应中提取数据
total_assets = account_info.get("total_assets", 0.0)
cash = account_info.get("cash", 0.0)
market_value = account_info.get("market_value", 0.0)
```

### 盈亏计算

```python
# 汇总所有持仓的盈亏
realized_pnl = 0.0
unrealized_pnl = 0.0

if positions:
    for pos in positions:
        realized_pnl += pos.get("realized_pnl", 0.0)
        unrealized_pnl += pos.get("unrealized_pnl", 0.0)
```

### 数据验证

```python
# 检查账户信息是否有效
if not account_info:
    logger.warning(f"No account info for user {user.id} in {market_type} market")
    continue  # 跳过此用户

# 检查数据完整性
if total_assets < 0:
    logger.error(f"Invalid total_assets for user {user.id}: {total_assets}")
    continue
```

## 数据保存

### 快照记录结构

```python
snapshot = AccountSnapshot(
    user_id=1,                          # 用户ID
    market_type='US',                   # 市场类型
    snapshot_date=datetime.now(),       # 快照时间
    total_assets=50000.00,              # 总资产
    cash=20000.00,                      # 可用资金
    market_value=30000.00,              # 持仓市值
    realized_pnl=0.00,                  # 已实现盈亏
    unrealized_pnl=250.00,              # 未实现盈亏
)
```

### 数据库表结构

```sql
CREATE TABLE account_snapshots (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    market_type VARCHAR(10) NOT NULL,
    snapshot_date DATETIME NOT NULL,
    total_assets FLOAT NOT NULL,
    cash FLOAT NOT NULL,
    market_value FLOAT NOT NULL,
    realized_pnl FLOAT DEFAULT 0.0,
    unrealized_pnl FLOAT DEFAULT 0.0,
    account_data JSON,
    positions_data JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- 唯一约束
    UNIQUE INDEX uq_user_market_date (user_id, market_type, DATE(snapshot_date))
);
```

## 错误处理

### API 调用失败

```python
try:
    account_info = await client.get_account_info(market_type)
    if not account_info:
        logger.warning(f"No account info for user {user.id}")
        continue
except Exception as e:
    logger.error(f"Error fetching account info: {e}")
    error_count += 1
    continue
```

### 数据库保存失败

```python
try:
    db.add(snapshot)
    await db.commit()
    snapshot_count += 1
except IntegrityError as e:
    await db.rollback()
    logger.error(f"Duplicate snapshot detected: {e}")
    error_count += 1
except Exception as e:
    await db.rollback()
    logger.error(f"Error saving snapshot: {e}")
    error_count += 1
```

## 数据时效性

### 实时性保证

1. **定时触发**: 在市场收盘时立即触发
2. **实时获取**: 每次都从 Futu API 获取最新数据
3. **即时保存**: 获取后立即保存到数据库

### 数据新鲜度

```
市场收盘时间 → API 调用 → 数据保存
     ↓            ↓           ↓
  16:00:00    16:00:05    16:00:10

总延迟: 约 10 秒
```

## 数据一致性

### 防重复机制

1. **应用层检查**: 查询数据库是否已存在当天快照
2. **数据库约束**: 唯一索引防止重复插入
3. **市场本地日期**: 使用市场时区确保准确性

### 事务保证

```python
async with AsyncSessionLocal() as db:
    try:
        # 查询、创建、保存都在同一个事务中
        existing = await db.execute(...)
        if not existing:
            snapshot = AccountSnapshot(...)
            db.add(snapshot)
            await db.commit()  # 提交事务
    except Exception as e:
        await db.rollback()  # 回滚事务
        raise
```

## 性能优化

### 批量处理

```python
# 一次性查询所有用户
users_with_config = result.all()

# 逐个处理，但使用异步IO
for user, config in users_with_config:
    # 异步API调用，不阻塞
    account_info = await client.get_account_info(market_type)
    positions = await client.get_positions(market_type)
```

### 并发控制

```python
# 使用信号量限制并发数
semaphore = asyncio.Semaphore(10)  # 最多10个并发请求

async with semaphore:
    account_info = await client.get_account_info(market_type)
```

## 监控指标

### 执行统计

```python
logger.info(
    f"✅ {market_type} market snapshot job completed: "
    f"{snapshot_count} created, {error_count} errors"
)
```

### 关键指标

- **成功率**: `snapshot_count / total_users`
- **失败率**: `error_count / total_users`
- **执行时间**: 从开始到结束的总时间
- **API 响应时间**: 每个 API 调用的耗时

## 日志示例

### 正常执行

```
INFO: Creating US market snapshots...
INFO: Created snapshot for user 1 (john_doe) in US market: $50000.00
INFO: Created snapshot for user 2 (jane_smith) in US market: $75000.00
INFO: Created snapshot for user 3 (bob_wilson) in US market: $100000.00
INFO: ✅ US market snapshot job completed: 3 created, 0 errors
```

### 检测到重复

```
INFO: Creating US market snapshots...
INFO: Snapshot already exists for user 1 in US market on 2025-11-13 (market local date)
INFO: Created snapshot for user 2 (jane_smith) in US market: $75000.00
INFO: ✅ US market snapshot job completed: 1 created, 0 errors
```

### API 调用失败

```
INFO: Creating US market snapshots...
WARNING: No account info for user 1 in US market
INFO: Created snapshot for user 2 (jane_smith) in US market: $75000.00
ERROR: Error fetching account info for user 3: Connection timeout
INFO: ✅ US market snapshot job completed: 1 created, 1 errors
```

## 数据验证

### 验证快照数据

```sql
-- 查看最新快照
SELECT 
    user_id,
    market_type,
    snapshot_date,
    total_assets,
    cash,
    market_value,
    unrealized_pnl
FROM account_snapshots
WHERE DATE(snapshot_date) = CURRENT_DATE
ORDER BY snapshot_date DESC;
```

### 对比实时数据

```python
# 获取实时账户信息
real_time = await client.get_account_info('US')

# 获取最新快照
snapshot = await db.execute(
    select(AccountSnapshot)
    .where(AccountSnapshot.user_id == user_id)
    .order_by(AccountSnapshot.snapshot_date.desc())
    .limit(1)
)

# 对比数据
print(f"Real-time: ${real_time['total_assets']}")
print(f"Snapshot:  ${snapshot.total_assets}")
```

## 总结

资产快照系统通过以下方式确保数据准确性和可靠性：

1. ✅ **实时获取**: 从 Futu API 获取最新数据
2. ✅ **定时执行**: 在市场收盘时自动触发
3. ✅ **防重复**: 应用层检查 + 数据库约束
4. ✅ **错误处理**: 单个用户失败不影响其他用户
5. ✅ **事务保证**: 确保数据一致性
6. ✅ **详细日志**: 便于监控和调试

快照数据为趋势分析、收益计算和风险监控提供了可靠的历史数据基础。
