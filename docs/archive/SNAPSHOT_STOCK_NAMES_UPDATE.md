# 快照持仓信息添加公司名称功能

## 概述

本次更新为账户快照（AccountSnapshot）的持仓信息添加了公司名称字段，使得排行榜和持仓详情页面能够显示更友好的股票信息。

## 修改内容

### 1. 数据库模型
- `AccountSnapshot.positions_data` JSON 字段现在包含 `stock_name`（公司名称）
- 字段结构：
  ```json
  {
    "stock_code": "AAPL",
    "stock_name": "Apple Inc.",
    "quantity": 100,
    "cost_price": 150.0,
    "current_price": 175.0,
    "market_value": 17500.0,
    "unrealized_pnl": 2500.0,
    "first_open_time": "2024-01-01T10:00:00",
    "holding_days": 30
  }
  ```

### 2. 后端修改

#### `web/backend/services/snapshot_scheduler.py`
- **`_create_snapshots_for_market` 方法**：
  - 添加了获取持仓信息的逻辑
  - 从 Futu API 获取持仓数据（包含公司名称）
  - 将持仓数据保存到 `positions_data` 字段

- **`create_account_snapshot` 函数**：
  - 同样添加了获取和保存持仓信息的逻辑
  - 支持在智能盯盘分析后创建快照时包含公司名称

### 3. 数据迁移

#### `db/migrate_add_stock_names_to_snapshots.py`
- 迁移脚本用于更新已有的快照数据
- 为没有 `stock_name` 的持仓记录从 Futu API 获取公司名称
- 使用方法：
  ```bash
  python db/migrate_add_stock_names_to_snapshots.py
  ```

### 4. 前端显示

前端已经支持显示公司名称：
- `UserPositionsPanel` 组件会显示 `stock_name`
- `UserDetailPanel` 组件的持仓信息也会显示公司名称
- 格式：`股票代码 (公司名称)`

## 数据流程

1. **定时快照**（每日收盘后）：
   ```
   SnapshotScheduler
   → get_account_info_async (获取账户信息)
   → get_positions_async (获取持仓信息，包含公司名称)
   → 保存到 AccountSnapshot.positions_data
   ```

2. **智能盯盘后快照**：
   ```
   智能盯盘分析完成
   → create_account_snapshot
   → get_positions_async (获取持仓信息，包含公司名称)
   → 保存到 AccountSnapshot.positions_data
   ```

3. **前端显示**：
   ```
   排行榜页面
   → 获取用户持仓 (/api/public/leaderboard/user/{user_id}/positions)
   → 从实时 API 获取（包含公司名称）
   → UserPositionsPanel 显示
   ```

## 测试

使用测试脚本验证功能：
```bash
python test_snapshot_with_stock_names.py
```

测试内容：
- 创建新快照
- 验证 `positions_data` 包含 `stock_name`
- 检查数据完整性

## 注意事项

1. **API 依赖**：公司名称来自 Futu API 的 `get_positions` 接口
2. **数据一致性**：快照数据和实时数据都包含公司名称
3. **向后兼容**：前端代码使用 `position.stock_name` 时有可选检查（`?`），兼容旧数据
4. **迁移建议**：建议运行迁移脚本更新已有快照数据

## 相关文件

- `web/backend/models.py` - AccountSnapshot 模型定义
- `web/backend/services/snapshot_scheduler.py` - 快照调度器
- `web/backend/routes/public_leaderboard_routes.py` - 排行榜 API
- `web/frontend/src/components/leaderboard/UserPositionsPanel.tsx` - 持仓显示组件
- `db/migrate_add_stock_names_to_snapshots.py` - 数据迁移脚本
- `test_snapshot_with_stock_names.py` - 测试脚本
