# 排行榜数据改进

## 改进内容

### 1. 持仓数据价格获取优化

**问题：** 持仓数据的当前价格和市值显示为0。

**原因：** yfinance的`info`字段可能为空或不包含价格信息。

**解决方案：** 使用多种fallback方法获取价格

#### 改进后的价格获取逻辑

```python
async def get_current_price(stock_code: str, market_type: str) -> float:
    # 方法1: 从info获取
    try:
        info = stock.info
        price = (
            info.get('currentPrice') or 
            info.get('regularMarketPrice') or 
            info.get('previousClose') or
            info.get('ask') or
            info.get('bid') or
            0.0
        )
        if price > 0:
            return float(price)
    except Exception:
        pass
    
    # 方法2: 从1天历史数据获取最新价格（1分钟间隔）
    try:
        hist = stock.history(period='1d', interval='1m')
        if not hist.empty:
            price = hist['Close'].iloc[-1]
            if price > 0:
                return float(price)
    except Exception:
        pass
    
    # 方法3: 从5天历史数据获取
    try:
        hist = stock.history(period='5d')
        if not hist.empty:
            price = hist['Close'].iloc[-1]
            if price > 0:
                return float(price)
    except Exception:
        pass
    
    return 0.0
```

**优点：**
- 多重fallback确保获取到价格
- 优先使用实时价格
- 如果实时价格不可用，使用历史数据
- 5分钟缓存减少API调用

### 2. 趋势图5分钟粒度数据

**问题：** 趋势图只显示每天一个数据点，粒度太粗。

**需求：** 显示最近1个月内按5分钟间隔的资产变化。

**解决方案：** 修改API返回5分钟粒度的数据

#### 数据聚合逻辑

```python
# 按5分钟间隔分组
interval_snapshots = {}
for snapshot in snapshots:
    timestamp = snapshot.snapshot_date
    # 向下取整到5分钟
    minutes = (timestamp.hour * 60 + timestamp.minute) // 5 * 5
    rounded_time = timestamp.replace(
        hour=minutes // 60, 
        minute=minutes % 60, 
        second=0, 
        microsecond=0
    )
    time_key = rounded_time.isoformat()
    
    # 保留每个5分钟间隔内最新的快照
    if time_key not in interval_snapshots or \
       snapshot.snapshot_date > interval_snapshots[time_key].snapshot_date:
        interval_snapshots[time_key] = snapshot
```

#### 数据格式变化

**修改前：**
```json
[
  {
    "date": "2025-11-17",
    "total_assets": 941507.406
  }
]
```

**修改后：**
```json
[
  {
    "date": "2025-11-17 09:30:00",
    "total_assets": 941507.406
  },
  {
    "date": "2025-11-17 09:35:00",
    "total_assets": 942100.50
  },
  {
    "date": "2025-11-17 09:40:00",
    "total_assets": 943200.75
  }
]
```

### 3. 前端趋势图适配

#### X轴标签优化

**问题：** 5分钟粒度数据点很多，标签会重叠。

**解决方案：** 动态调整标签显示间隔

```typescript
// 根据数据点数量调整显示间隔
const totalPoints = sortedDates.length;
let showInterval = 1;

if (totalPoints > 200) {
  showInterval = Math.floor(totalPoints / 10); // 显示约10个标签
} else if (totalPoints > 100) {
  showInterval = Math.floor(totalPoints / 15); // 显示约15个标签
} else if (totalPoints > 50) {
  showInterval = Math.floor(totalPoints / 20); // 显示约20个标签
} else {
  showInterval = Math.max(1, Math.floor(totalPoints / 10));
}
```

#### 标签格式

```typescript
// 根据数据格式显示
if (date.includes(' ')) {
  // 包含时间: "2025-11-17 14:30:00"
  const parts = date.split(' ');
  const datePart = parts[0].substring(5); // MM-DD
  const timePart = parts[1].substring(0, 5); // HH:MM
  label = `${datePart} ${timePart}`; // "11-17 14:30"
} else {
  // 只有日期: "2025-11-17"
  label = date.substring(5); // "11-17"
}
```

## 数据示例

### 持仓数据（修复后）

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

### 趋势数据（5分钟粒度，最近7天）

```json
[
  {
    "date": "2025-11-17 09:30:00",
    "total_assets": 941507.406
  },
  {
    "date": "2025-11-17 09:35:00",
    "total_assets": 942100.50
  },
  {
    "date": "2025-11-17 09:40:00",
    "total_assets": 943200.75
  }
]
```

## 性能考虑

### 价格缓存

```python
_price_cache: Dict[str, Tuple[float, datetime]] = {}
_cache_duration = timedelta(minutes=5)
```

- 每个股票的价格缓存5分钟
- 减少yfinance API调用
- 避免频繁请求导致限流

### 数据量控制

**1周的5分钟数据：**
- 1天 = 24小时 × 12个5分钟 = 288个数据点
- 7天 = 288 × 7 = 2,016个数据点

**优化策略：**
1. 只返回有快照的时间点（实际数据点会少很多）
2. 前端动态调整标签显示间隔
3. Canvas绘图性能良好，可以处理数千个点
4. 1周时间范围平衡了数据量和趋势可见性

### 查询优化

```python
# 使用索引优化查询
query = select(AccountSnapshot).where(
    and_(
        AccountSnapshot.user_id == user_id,
        AccountSnapshot.snapshot_date >= start_date,
        AccountSnapshot.snapshot_date <= end_date
    )
).order_by(AccountSnapshot.snapshot_date.asc())
```

**建议索引：**
```sql
CREATE INDEX idx_snapshot_user_date 
ON account_snapshots(user_id, snapshot_date);
```

## 测试验证

### 1. 测试持仓价格获取

```python
# 测试不同市场的价格获取
await get_current_price('AAPL', 'US')    # 美股
await get_current_price('00700', 'HK')   # 港股
await get_current_price('600519', 'CN')  # A股
```

### 2. 测试趋势数据

```bash
# 调用API（默认7天）
curl http://localhost:8000/api/public/leaderboard/user/1/trend

# 或指定天数
curl http://localhost:8000/api/public/leaderboard/user/1/trend?days=7
```

**预期：**
- 返回最近7天的5分钟粒度数据
- 数据按时间排序
- 包含日期和时间信息

### 3. 测试前端显示

1. 打开排行榜页面
2. 点击用户查看趋势图
3. 验证：
   - X轴显示日期和时间
   - 标签不重叠
   - 曲线平滑连续
   - 数据点密集

## 相关文件

- `web/backend/routes/public_leaderboard_routes.py` - 后端API
- `web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx` - 趋势图组件
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 用户详情面板

## 注意事项

### 1. 数据可用性

- 并非所有时间点都有快照数据
- 只在交易时间和定时任务运行时才有数据
- 非交易时间段会有数据空白

### 2. 价格获取限制

- yfinance有API调用限制
- 使用缓存减少调用频率
- 如果获取失败，显示0

### 3. 时区问题

- 确保服务器时区设置正确
- 快照时间使用服务器本地时间
- 前端显示时考虑用户时区

### 4. 性能监控

- 监控价格获取的成功率
- 监控API响应时间
- 监控缓存命中率

## 未来优化

1. **使用专业数据源**
   - 替换yfinance为更可靠的数据源
   - 考虑使用付费API（如Alpha Vantage、IEX Cloud）
   - 提高数据准确性和可用性

2. **数据预聚合**
   - 在数据库中预计算5分钟聚合数据
   - 减少实时计算压力
   - 提高查询速度

3. **WebSocket实时推送**
   - 价格变化时实时推送更新
   - 减少轮询请求
   - 提供更好的实时体验

4. **图表交互增强**
   - 添加缩放功能
   - 添加时间范围选择器
   - 显示数据点详情tooltip
