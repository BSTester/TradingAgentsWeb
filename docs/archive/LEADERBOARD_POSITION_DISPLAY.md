# 排行榜持仓显示优化

## 修改日期
2025-11-18

## 问题
1. 排行榜前端显示的持仓信息缺少持仓时长（holding_days）和开仓时间（first_open_time）的显示
2. `UserDetailPanel.tsx` 中持仓天数是前端手动计算的，与后端计算逻辑不一致（前端包含时间，后端只计算日期差）

## 解决方案

### 1. 后端修改 ✅
**文件**: `web/backend/routes/public_leaderboard_routes.py`

**修改内容**:
- 在 `/api/public/leaderboard/user/{user_id}/positions` 端点返回数据中添加 `holding_days` 字段
- 确保 `first_open_time` 字段正确返回

```python
all_positions.append({
    "stock_code": stock_code,
    "stock_name": stock_name,
    "market_type": market,
    "quantity": int(quantity),
    "cost_price": round(cost_price, 2),
    "current_price": round(current_price, 2),
    "market_value": round(market_value, 2),
    "unrealized_pnl": round(profit_loss, 2),
    "pnl_percentage": round(profit_loss_ratio * 100, 2),
    "first_open_price": round(cost_price, 2),
    "first_open_time": first_open_time_iso,  # ✅ 开仓时间
    "holding_days": holding_days,             # ✅ 持仓天数
})
```

### 2. 前端修改 ✅

#### 2.1 UserPositionsPanel.tsx（未使用的组件）
**文件**: `web/frontend/src/components/leaderboard/UserPositionsPanel.tsx`

**修改内容**:

#### 2.1 更新类型定义
```typescript
interface Position {
  stock_code: string;
  stock_name?: string;        // ✅ 新增
  market_type: string;
  quantity: number;
  cost_price?: number;        // ✅ 新增
  current_price?: number;
  market_value?: number;
  unrealized_pnl?: number;
  pnl_percentage?: number;
  first_open_time?: string;   // ✅ 新增
  holding_days?: number;      // ✅ 新增
}
```

#### 2.2 添加持仓时长和开仓时间显示
```tsx
{/* 持仓时长和开仓时间 */}
{(position.holding_days !== undefined || position.first_open_time) && (
  <div className="flex items-center space-x-4 mb-3 text-xs text-text-tertiary">
    {position.holding_days !== undefined && (
      <div className="flex items-center space-x-1">
        <i className="fas fa-clock" />
        <span>持仓 {position.holding_days} 天</span>
      </div>
    )}
    {position.first_open_time && (
      <div className="flex items-center space-x-1">
        <i className="fas fa-calendar" />
        <span>
          开仓: {new Date(position.first_open_time).toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    )}
  </div>
)}
```

#### 2.3 优化布局
- 添加股票名称显示
- 添加成本价显示
- 将价格信息从3列改为4列（成本价、当前价、市值、盈亏）
- 响应式布局：移动端2列，桌面端4列

#### 2.4 UserDetailPanel.tsx（实际使用的组件）✅
**文件**: `web/frontend/src/components/leaderboard/UserDetailPanel.tsx`

**问题**：持仓天数是前端手动计算的，与后端不一致
```typescript
// ❌ 旧代码：前端手动计算（包含时间部分）
持仓: {Math.floor((new Date().getTime() - new Date(position.first_open_time).getTime()) / (1000 * 60 * 60 * 24))} 天
```

**修复**：使用后端返回的 `holding_days` 字段
```typescript
// ✅ 新代码：使用后端计算的持仓天数
{(position.first_open_time || position.holding_days !== undefined) && (
  <div className="mt-3 pt-3 border-t border-dark-border">
    <div className="flex items-center justify-between text-xs">
      {position.first_open_time && (
        <span className="text-text-tertiary">
          <i className="fas fa-calendar mr-1" />
          开仓: {new Date(position.first_open_time).toLocaleString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      )}
      {position.holding_days !== undefined && (
        <span className="text-text-tertiary">
          <i className="fas fa-clock mr-1" />
          持仓 {position.holding_days} 天
        </span>
      )}
    </div>
  </div>
)}
```

## 显示效果

### 持仓卡片布局
```
┌─────────────────────────────────────────┐
│ AAPL  Apple Inc.  [US]        100 股    │
│ ⏰ 持仓 5 天  📅 开仓: 11/13 09:30      │
│                                         │
│ 成本价    当前价    市值      盈亏      │
│ $150.00  $155.50  $15,550  +$550 (+3.67%)│
└─────────────────────────────────────────┘
```

## 数据流

```
Futu API
  ↓
get_positions_async() (enriched with DB data)
  ↓
public_leaderboard_routes.py
  ↓
WebSocket / REST API
  ↓
UserPositionsPanel.tsx
  ↓
用户界面显示
```

## 与智能盯盘的一致性

排行榜持仓显示现在与智能盯盘页面保持一致：
- ✅ 都显示持仓天数
- ✅ 都显示开仓时间
- ✅ 都显示成本价和当前价
- ✅ 都使用相同的数据源（`get_positions_async`）
- ✅ 持仓天数计算逻辑统一（只计算日期差）

## 相关文件

- `web/backend/routes/public_leaderboard_routes.py` - 排行榜API路由
- `web/frontend/src/components/leaderboard/UserPositionsPanel.tsx` - 持仓显示组件
- `web/frontend/src/components/intraday/PositionOverview.tsx` - 智能盯盘持仓组件（参考）
- `tradingagents/dataflows/futu_trading.py` - 持仓数据获取工具
- `web/backend/services/futu_async_wrapper.py` - 异步封装

## 测试建议

1. **数据完整性测试**
   - 检查持仓天数是否正确显示
   - 检查开仓时间格式是否正确
   - 检查成本价和当前价是否准确

2. **UI测试**
   - 桌面端4列布局显示
   - 移动端2列布局显示
   - 图标和文字对齐
   - 颜色和样式一致性

3. **边界情况测试**
   - 当天开仓（holding_days = 0）
   - 无持仓数据
   - 数据加载中状态
