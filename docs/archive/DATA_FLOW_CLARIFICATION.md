# 数据流说明文档

## 数据表和用途

### 1. `position_records` 表
**用途**：跟踪用户持仓的开仓/关闭状态

**字段**：
- `stock_code`: 股票代码
- `market_type`: 市场类型 (US/HK/CN)
- `first_open_time`: 首次开仓时间
- `first_open_price`: 首次开仓价格
- `initial_quantity`: 初始数量
- `current_quantity`: 当前数量
- `is_closed`: 是否已关闭

**特点**：
- ❌ **不存储公司名称** (`stock_name`)
- ✅ 只用于跟踪持仓状态和计算持仓天数
- ✅ 由 `sync_positions_to_db` 函数维护

### 2. `account_snapshots` 表
**用途**：记录账户历史快照（每日收盘或智能盯盘后）

**字段**：
- `total_assets`: 总资产
- `cash`: 现金
- `market_value`: 市值
- `unrealized_pnl`: 未实现盈亏
- `realized_pnl`: 已实现盈亏
- `positions_data`: **持仓详情（JSON）** ⭐

**`positions_data` 结构**：
```json
[
  {
    "stock_code": "AAPL",
    "stock_name": "Apple Inc.",  // ⭐ 包含公司名称
    "quantity": 100,
    "cost_price": 150.0,
    "current_price": 175.0,
    "market_value": 17500.0,
    "unrealized_pnl": 2500.0,
    "first_open_time": "2024-01-01T10:00:00",
    "holding_days": 30
  }
]
```

**特点**：
- ✅ **存储公司名称** (`stock_name`)
- ✅ 用于历史记录和趋势分析
- ✅ 由快照调度器自动创建

## API 接口数据来源

### 排行榜相关接口

#### 1. `/api/public/leaderboard/users`
**数据来源**：`AccountSnapshot` 表
**返回内容**：
- 用户ID、用户名
- 市场类型
- 总资产
- 最新快照日期
- 使用的模型名称

**不包含**：持仓详情

---

#### 2. `/api/public/leaderboard/user/{user_id}/trend`
**数据来源**：`AccountSnapshot` 表
**返回内容**：
- 历史资产趋势数据（按5分钟间隔）
- 日期和总资产

**不包含**：持仓详情

---

#### 3. `/api/public/leaderboard/user/{user_id}/positions` ⭐
**数据来源**：**Futu API 实时数据**（不是从数据库读取）
**返回内容**：
- 股票代码
- **公司名称** ⭐ (从 Futu API 获取)
- 市场类型
- 数量、成本价、当前价
- 市值、盈亏
- 首次开仓时间（从 `position_records` 表获取）
- 持仓天数（从 `position_records` 表计算）

**数据流程**：
```
Futu API (get_positions)
  ↓
包含 stock_name
  ↓
enriched with database info (first_open_time, holding_days)
  ↓
返回给前端
```

---

#### 4. `/api/public/leaderboard/user/{user_id}/decisions`
**数据来源**：`intraday_decision_records` 表
**返回内容**：决策历史记录

## 快照创建流程

### 定时快照（每日收盘）
```
SnapshotScheduler._create_snapshots_for_market
  ↓
1. get_account_info_async (获取账户信息)
  ↓
2. get_positions_async (获取持仓信息，包含 stock_name)
  ↓
3. 格式化 positions_data (保留 stock_name)
  ↓
4. 保存到 AccountSnapshot.positions_data
```

### 智能盯盘后快照
```
智能盯盘分析完成
  ↓
create_account_snapshot
  ↓
1. get_account_info_async
  ↓
2. get_positions_async (包含 stock_name)
  ↓
3. 格式化 positions_data (保留 stock_name)
  ↓
4. 保存到 AccountSnapshot.positions_data
```

## 前端显示

### 排行榜页面持仓信息
**组件**：`UserPositionsPanel`
**数据来源**：`/api/public/leaderboard/user/{user_id}/positions`
**显示内容**：
- 股票代码 + **公司名称** ⭐
- 市场类型
- 数量、价格、市值、盈亏
- 持仓天数

**数据流**：
```
前端请求
  ↓
后端调用 Futu API (实时)
  ↓
enriched with position_records (持仓天数)
  ↓
返回包含 stock_name 的数据
  ↓
前端显示
```

## 总结

### 公司名称 (`stock_name`) 的存储位置

| 位置 | 是否存储 | 用途 |
|------|---------|------|
| `position_records` 表 | ❌ 不存储 | 只跟踪持仓状态 |
| `account_snapshots.positions_data` | ✅ 存储 | 历史快照记录 |
| Futu API 实时数据 | ✅ 返回 | 实时持仓显示 |

### 关键点

1. **排行榜持仓显示**：从 Futu API 实时获取，已包含公司名称
2. **快照数据**：保存完整持仓信息（包含公司名称）用于历史记录
3. **`position_records` 表**：不需要存储公司名称，只用于跟踪状态
4. **数据一致性**：快照和实时数据都包含公司名称

### 修改内容

✅ **已完成**：
- 更新快照调度器，保存持仓信息时包含公司名称
- 创建数据迁移脚本，为已有快照添加公司名称
- 前端已支持显示公司名称

❌ **不需要**：
- 修改 `position_records` 表结构
- 修改排行榜持仓接口（已经从 Futu API 获取公司名称）
