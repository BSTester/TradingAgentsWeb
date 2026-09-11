# 排行榜多市场数据修复

## 问题描述

排行榜页面只显示一个市场的数据，切换到美股或A股时没有数据显示。

## 根本原因

WebSocket端点在获取用户快照数据时，只返回每个用户的最新一条快照记录，而不是每个市场的最新快照。

### 原始逻辑（错误）

```python
for user in participating_users:
    # 只获取最新的一条快照
    snapshot_query = select(AccountSnapshot).where(
        AccountSnapshot.user_id == user.id
    ).order_by(AccountSnapshot.snapshot_date.desc()).limit(1)
    
    snapshot_result = await db.execute(snapshot_query)
    snapshot = snapshot_result.scalar_one_or_none()
    
    if snapshot:
        users_list.append({
            'user_id': user.id,
            'username': user.username,
            'market_type': snapshot.market_type,  # 只有一个市场
            'total_assets': float(snapshot.total_assets),
            'latest_snapshot_date': snapshot.snapshot_date.strftime('%Y-%m-%d')
        })
```

**问题：** 如果用户在多个市场都有快照，只会返回最新的那一个市场的数据。

## 解决方案

修改查询逻辑，为每个用户的每个市场都返回最新的快照数据。

### 修复后的逻辑

```python
for user in participating_users:
    # 获取该用户的所有快照
    snapshot_query = select(AccountSnapshot).where(
        AccountSnapshot.user_id == user.id
    ).order_by(AccountSnapshot.snapshot_date.desc())
    
    snapshot_result = await db.execute(snapshot_query)
    all_snapshots = snapshot_result.scalars().all()
    
    if all_snapshots:
        # 按市场分组，获取每个市场的最新快照
        market_snapshots = {}
        for snapshot in all_snapshots:
            market = snapshot.market_type or 'US'
            if market not in market_snapshots:
                market_snapshots[market] = snapshot
        
        # 为每个市场添加一条记录
        for market, snapshot in market_snapshots.items():
            users_list.append({
                'user_id': user.id,
                'username': user.username,
                'market_type': market,
                'total_assets': float(snapshot.total_assets),
                'latest_snapshot_date': snapshot.snapshot_date.strftime('%Y-%m-%d')
            })
```

**优点：**
- 每个用户在每个市场都有独立的记录
- 前端可以正确过滤和显示不同市场的数据
- 支持用户在多个市场同时参与排名

## 数据结构

### 修复前
```json
[
  {
    "user_id": 1,
    "username": "admin",
    "market_type": "HK",  // 只有最新的一个市场
    "total_assets": 941507.406,
    "latest_snapshot_date": "2025-11-16"
  }
]
```

### 修复后
```json
[
  {
    "user_id": 1,
    "username": "admin",
    "market_type": "CN",
    "total_assets": 957414.555,
    "latest_snapshot_date": "2025-11-16"
  },
  {
    "user_id": 1,
    "username": "admin",
    "market_type": "HK",
    "total_assets": 941507.406,
    "latest_snapshot_date": "2025-11-16"
  },
  {
    "user_id": 1,
    "username": "admin",
    "market_type": "US",
    "total_assets": 98204.455,
    "latest_snapshot_date": "2025-11-13"
  }
]
```

## 修改的文件

### 1. WebSocket路由 (`web/backend/routes/websocket_routes.py`)

修改 `leaderboard_websocket_endpoint` 函数中的数据获取逻辑。

### 2. 后台更新任务 (`web/backend/app.py`)

修改 `leaderboard_update_task` 函数中的数据获取逻辑，确保定时更新也使用相同的逻辑。

## 前端处理

前端已经正确实现了市场过滤逻辑：

```typescript
// 过滤选定市场的用户
const filteredUsers = users.filter(u => u.market_type === selectedMarket);

// 按资产排序并取前10名
const top10Users = [...filteredUsers]
  .sort((a, b) => b.total_assets - a.total_assets)
  .slice(0, 10);
```

这样当用户切换市场时：
1. WebSocket数据包含所有市场
2. 前端根据选择的市场过滤
3. 立即显示对应市场的排名
4. 无需重新请求数据

## 测试验证

### 测试脚本

创建了 `test_leaderboard_data.py` 用于验证数据结构：

```bash
python test_leaderboard_data.py
```

**预期输出：**
```
📊 Total users: 3

📈 Markets breakdown:
  CN: 1 users
    - admin: $957,414.56
  HK: 1 users
    - admin: $941,507.41
  US: 1 users
    - admin: $98,204.46
```

### 浏览器测试

1. 打开排行榜页面
2. 默认显示美股市场
3. 切换到港股，应该看到数据
4. 切换到A股，应该看到数据
5. 每个市场的排名和资产应该不同

## 边界情况处理

### 1. 用户没有任何快照

```python
else:
    # 为所有市场创建默认快照
    for market in ['US', 'HK', 'CN']:
        users_list.append({
            'user_id': user.id,
            'username': user.username,
            'market_type': market,
            'total_assets': 100000.0,  # 默认起始金额
            'latest_snapshot_date': datetime.now().strftime('%Y-%m-%d')
        })
```

### 2. 用户只在部分市场有快照

只返回有快照的市场数据，不创建虚假数据。

### 3. 快照日期不同

每个市场使用各自最新的快照日期，可能不同。

## 性能考虑

### 查询优化

虽然现在获取所有快照而不是只获取一条，但：
1. 每个用户的快照数量有限（通常每天一条）
2. 查询已经按日期降序排序
3. 在内存中分组比多次数据库查询更快

### 缓存策略

WebSocket数据每5分钟更新一次，减少数据库查询频率。

## 相关文件

- `web/backend/routes/websocket_routes.py` - WebSocket端点
- `web/backend/app.py` - 后台更新任务
- `web/frontend/src/app/leaderboard/page.tsx` - 前端页面
- `test_leaderboard_data.py` - 测试脚本

## 后续优化建议

1. **索引优化**
   - 在 `(user_id, market_type, snapshot_date)` 上创建复合索引
   - 加速按市场分组的查询

2. **数据聚合**
   - 考虑在数据库层面使用 GROUP BY 和 MAX
   - 减少内存中的数据处理

3. **缓存层**
   - 添加Redis缓存最新的市场快照
   - 减少数据库查询压力

4. **分页支持**
   - 如果用户数量很多，考虑添加分页
   - 只返回前N名用户的数据

## 验证清单

- [x] WebSocket返回所有市场的数据
- [x] 前端可以切换市场查看不同数据
- [x] 每个市场的排名独立计算
- [x] 趋势图显示对应市场的数据
- [x] 用户详情面板根据市场过滤
- [x] 测试脚本验证数据结构
- [x] 后台更新任务使用相同逻辑
