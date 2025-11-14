# 今日订单显示优化

## 修改说明

智能盯盘页面的"今日订单"功能已简化：前端不再进行日期过滤，直接显示后端返回的所有订单数据。

## 实现方式

### 前端
前端不进行任何日期过滤，直接显示后端返回的订单列表：

```typescript
// Backend returns all orders, frontend displays them as-is
const todayOrders = orders || [];
```

### 后端
后端通过 API 参数 `filter_status` 来过滤订单状态：
- `0` = 全部订单
- `1` = 已成交
- `2` = 待成交
- `3` = 已撤销

订单时间戳使用北京时间（Asia/Shanghai）存储。

## 修改文件

### 前端
- `web/frontend/src/components/intraday/TodayOrders.tsx`
  - 移除 `getTodayOrders()` 过滤函数
  - 直接使用后端返回的订单数据：`const todayOrders = orders || [];`

### 后端
- 无需修改
- 继续返回订单列表（根据 `filter_status` 参数过滤状态）

## 优势

1. **简单明了**：前端逻辑简化，减少复杂度
2. **数据一致性**：显示后端返回的原始数据，避免前后端不一致
3. **灵活性**：如需调整过滤逻辑，只需修改后端
4. **性能**：减少前端计算，提升渲染性能
