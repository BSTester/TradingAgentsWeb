# 排行榜持仓数据从快照读取

## 问题说明

之前的实现尝试实时获取股票价格来计算持仓市值，但这不符合排行榜的设计理念。排行榜应该显示快照数据，而不是实时数据。

## 设计原则

### 排行榜 vs 实时交易

| 特性 | 排行榜 | 实时交易（智能盯盘） |
|------|--------|---------------------|
| 数据来源 | 快照数据 | 实时API |
| 更新频率 | 定时快照（如每天收盘） | 实时/5分钟 |
| 价格 | 快照时的价格 | 当前市场价格 |
| 目的 | 历史对比、排名 | 实时监控、交易决策 |

### 为什么使用快照数据

1. **一致性** - 所有用户在同一时间点的数据，可以公平对比
2. **性能** - 不需要频繁调用外部API获取实时价格
3. **稳定性** - 不受市场API限制和延迟影响
4. **历史性** - 可以查看任意时间点的持仓状态

## 实现方案

### 数据来源

使用`PositionRecord`表中的快照数据：

```python
# 获取未平仓的持仓记录
query = select(PositionRecord).where(
    and_(
        PositionRecord.user_id == user_id,
        PositionRecord.is_closed == False
    )
).order_by(PositionRecord.last_update_time.desc())
```

### 价格计算

使用`last_price`字段（最后更新时的价格）：

```python
# 使用快照中的价格，不是实时价格
current_price = position.last_price if position.last_price else position.first_open_price

# 计算市值和盈亏
market_value = current_price * position.current_quantity
cost_basis = position.first_open_price * position.current_quantity
unrealized_pnl = market_value - cost_basis
pnl_percentage = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0
```

### PositionRecord字段说明

| 字段 | 说明 | 用途 |
|------|------|------|
| `stock_code` | 股票代码 | 标识 |
| `market_type` | 市场类型 | US/HK/CN |
| `current_quantity` | 当前持仓数量 | 计算市值 |
| `first_open_price` | 首次开仓价格 | 成本价 |
| `last_price` | 最后更新价格 | 当前价（快照） |
| `first_open_time` | 首次开仓时间 | 持仓时长 |
| `last_update_time` | 最后更新时间 | 数据新鲜度 |
| `is_closed` | 是否已平仓 | 过滤条件 |

## 数据更新机制

### 1. 定时快照

通过`SnapshotScheduler`在市场收盘时自动创建快照：

```python
# 美股: 16:00 EST
# 港股: 16:00 HKT  
# A股: 15:00 CST
```

### 2. 智能盯盘触发

每次智能盯盘分析完成后，自动创建快照：

```python
# 在intraday_scheduler.py中
if result.get('status') == 'success':
    snapshot_created = await create_account_snapshot(
        self.user_id, 
        market, 
        skip_market_check=True  # 跳过市场时间检查
    )
```

### 3. 持仓记录更新

`PositionRecord`在以下情况更新：
- 执行交易时（买入/卖出）
- 智能盯盘分析时
- 手动触发更新时

## API响应格式

```json
[
  {
    "stock_code": "AAPL",
    "market_type": "US",
    "quantity": 100,
    "current_price": 185.50,
    "market_value": 18550.00,
    "unrealized_pnl": 550.00,
    "pnl_percentage": 3.05,
    "first_open_price": 180.00,
    "first_open_time": "2025-11-01T09:30:00"
  }
]
```

## 与智能盯盘的区别

### 智能盯盘（实时）

```python
# 调用Futu API获取实时数据
response = requests.get(f"{futu_api_url}/positions")
positions = response.json()

# 使用实时价格
current_price = position['current_price']  # 实时市场价格
```

### 排行榜（快照）

```python
# 从数据库读取快照数据
positions = await db.execute(
    select(PositionRecord).where(
        PositionRecord.user_id == user_id,
        PositionRecord.is_closed == False
    )
)

# 使用快照价格
current_price = position.last_price  # 最后更新时的价格
```

## 优点

1. **性能优化**
   - 无需调用外部API
   - 数据库查询速度快
   - 减少网络延迟

2. **数据一致性**
   - 所有用户使用相同时间点的数据
   - 排名公平可比
   - 避免实时价格波动影响

3. **系统稳定性**
   - 不依赖外部API可用性
   - 不受API限流影响
   - 离线也能查看历史数据

4. **成本节约**
   - 减少API调用次数
   - 降低外部服务费用
   - 减少服务器负载

## 数据新鲜度

### 更新时机

- **定时快照**: 每天市场收盘时
- **智能盯盘**: 每次分析完成后
- **手动触发**: 用户可以手动触发更新

### 数据延迟

- 最大延迟: 取决于快照创建频率
- 典型延迟: 5-15分钟（智能盯盘间隔）
- 可接受性: 排行榜不需要秒级实时性

## 未来优化

### 1. 增加快照频率

```python
# 当前: 每天一次（收盘时）
# 优化: 每小时一次或每次交易后

# 在交易执行后立即创建快照
await create_account_snapshot(
    user_id=user_id,
    market_type=market_type,
    skip_market_check=True
)
```

### 2. 添加快照版本

```python
# 支持查看不同时间点的快照
@router.get("/user/{user_id}/positions")
async def get_user_positions(
    user_id: int,
    snapshot_time: Optional[datetime] = None,  # 指定快照时间
    db: AsyncSession = Depends(get_db)
):
    if snapshot_time:
        # 查找最接近指定时间的快照
        query = query.where(
            PositionRecord.last_update_time <= snapshot_time
        )
```

### 3. 缓存优化

```python
# 使用Redis缓存最新快照
@cache(expire=300)  # 缓存5分钟
async def get_user_positions(user_id: int):
    # ...
```

## 相关文件

- `web/backend/routes/public_leaderboard_routes.py` - 排行榜API
- `web/backend/models.py` - PositionRecord模型
- `web/backend/services/snapshot_scheduler.py` - 快照调度器
- `web/backend/services/intraday_scheduler.py` - 智能盯盘调度器

## 测试验证

### 1. 检查持仓数据

```bash
# 调用API
curl http://localhost:8000/api/public/leaderboard/user/1/positions
```

**预期结果：**
- 返回用户的所有未平仓持仓
- 价格是快照时的价格，不是实时价格
- 数据来自PositionRecord表

### 2. 验证数据一致性

```python
# 检查数据库
from web.backend.database import SessionLocal
from web.backend.models import PositionRecord

db = SessionLocal()
positions = db.query(PositionRecord).filter(
    PositionRecord.user_id == 1,
    PositionRecord.is_closed == False
).all()

for pos in positions:
    print(f"{pos.stock_code}: {pos.last_price} @ {pos.last_update_time}")
```

### 3. 对比实时数据

```python
# 对比排行榜数据和智能盯盘实时数据
leaderboard_positions = await get_user_positions(user_id=1)
intraday_positions = await get_intraday_positions(user_id=1)

# 价格可能不同（快照 vs 实时）
# 但持仓数量应该相同
```

## 注意事项

1. **数据延迟** - 排行榜数据不是实时的，有一定延迟
2. **价格差异** - 快照价格可能与当前市场价格不同
3. **更新频率** - 取决于快照创建频率和智能盯盘运行频率
4. **历史数据** - 可以查看历史持仓状态，但需要保留历史快照
