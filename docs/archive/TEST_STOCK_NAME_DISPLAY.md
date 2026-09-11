# 测试公司名称显示功能

## 问题
实时排名中的持仓信息卡片没有显示公司名称。

## 修复内容

### 1. 前端修改
**文件**: `web/frontend/src/components/leaderboard/UserDetailPanel.tsx`

**修改点**:
- 在持仓卡片中添加公司名称显示
- 显示位置：股票代码下方
- 样式：较小的灰色文字

**修改前**:
```tsx
<span className="font-semibold text-text-primary text-lg">
  {position.stock_code}
</span>
```

**修改后**:
```tsx
<div className="flex flex-col space-y-1">
  <div className="flex items-center space-x-2">
    <span className="font-semibold text-text-primary text-lg">
      {position.stock_code}
    </span>
    <span className="text-xs px-2 py-1 bg-dark-primary rounded text-text-tertiary">
      {position.market_type}
    </span>
  </div>
  {position.stock_name && (
    <span className="text-sm text-text-secondary">
      {position.stock_name}
    </span>
  )}
</div>
```

### 2. 后端调试日志
**文件**: `web/backend/routes/public_leaderboard_routes.py`

添加了 `stock_name` 的调试日志输出，方便排查问题。

### 3. 前端调试日志
**文件**: `web/frontend/src/components/leaderboard/UserDetailPanel.tsx`

添加了控制台日志，显示接收到的持仓数据。

## 测试步骤

### 1. 重启后端服务
```bash
# 停止当前运行的后端
# 重新启动后端
python web/backend/app_v2.py
```

### 2. 重新构建前端（如果需要）
```bash
cd web/frontend
npm run build
# 或者开发模式
npm run dev
```

### 3. 打开浏览器测试

1. 访问排行榜页面
2. 点击任意用户查看详情
3. 切换到"持仓信息"标签
4. 检查持仓卡片是否显示公司名称

**预期结果**:
```
AAPL                    [US]
Apple Inc.
100 股

开仓价格: $150.00
当前价格: $175.00
市值: $17,500
盈亏: +$2,500 (+16.67%)
```

### 4. 检查调试日志

#### 后端日志
查看后端控制台输出，应该看到类似：
```
[Leaderboard] AAPL (US) - Raw API data:
  stock_name: Apple Inc.
  cost_price: 150.0, current_price: 175.0
  market_value: 17500.0, profit_loss: 2500.0
  holding_days: 30
```

#### 前端日志
打开浏览器开发者工具（F12），查看控制台，应该看到：
```
[UserDetailPanel] Positions data: [...]
  AAPL: stock_name = "Apple Inc."
```

## 故障排查

### 如果公司名称仍然不显示

1. **检查后端日志**
   - 确认 `stock_name` 不为空
   - 如果为空，说明 Futu API 没有返回公司名称

2. **检查前端日志**
   - 确认前端接收到的数据包含 `stock_name`
   - 如果没有，检查 API 响应

3. **检查 Futu API**
   - 测试 Futu API 的 `/api/positions` 接口
   - 确认返回的数据包含 `stock_name` 字段

4. **清除缓存**
   - 清除浏览器缓存
   - 清除 React Query 缓存（刷新页面）

### 常见问题

**Q: 只有部分股票显示公司名称？**
A: 可能是 Futu API 对某些股票没有返回公司名称。这是正常的，代码已经处理了这种情况（使用 `position.stock_name &&` 条件渲染）。

**Q: 公司名称显示为空字符串？**
A: 检查 Futu API 返回的数据，可能需要在后端添加过滤逻辑：
```python
stock_name = pos.get('stock_name', '').strip()
```

**Q: 布局错乱？**
A: 检查 CSS 样式，确保 `flex-col` 和 `space-y-1` 正确应用。

## 验证清单

- [ ] 后端日志显示 `stock_name` 不为空
- [ ] 前端日志显示接收到 `stock_name`
- [ ] 持仓卡片显示公司名称
- [ ] 公司名称显示在股票代码下方
- [ ] 样式正确（灰色小字）
- [ ] 没有公司名称的股票不显示额外空白

## 相关文件

- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 持仓详情面板
- `web/backend/routes/public_leaderboard_routes.py` - 持仓数据接口
- `tradingagents/dataflows/futu_trading.py` - Futu API 包装器
