# 交易显示格式优化

## 改进内容

将排行榜决策详情中的交易显示格式优化，与智能盯盘页面保持一致。

## 修改前

```tsx
<div className="bg-dark-tertiary rounded-lg p-4 border border-dark-border">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center space-x-2">
      <span className="font-semibold text-text-primary">
        {trade.stock_code}
      </span>
      <span className="text-xs px-2 py-1 rounded">
        {trade.action === 'BUY' ? '买入' : '卖出'}
      </span>
    </div>
    <span className="text-sm text-text-primary font-medium">
      {trade.quantity} 股
    </span>
  </div>
  <div className="grid grid-cols-2 gap-2 text-sm">
    <div>
      <p className="text-text-tertiary">价格</p>
      <p className="text-text-primary">$100.00</p>
    </div>
    <div>
      <p className="text-text-tertiary">总额</p>
      <p className="text-text-primary">$10,000.00</p>
    </div>
  </div>
</div>
```

**问题：**
- 布局混乱，信息分散
- 没有视觉层次
- 缺少备注信息
- 买入/卖出不够醒目

## 修改后

```tsx
<div className={`rounded-lg p-4 border-l-4 shadow-sm ${
  trade.action === 'BUY'
    ? 'bg-red-900/20 border-red-500'
    : 'bg-green-900/20 border-green-500'
}`}>
  {/* 头部：操作类型、股票代码、价格 */}
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-3">
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
        trade.action === 'BUY' 
          ? 'bg-red-500 text-white' 
          : 'bg-green-500 text-white'
      }`}>
        {trade.action === 'BUY' ? '买入' : '卖出'}
      </span>
      <span className="font-bold text-lg text-text-primary">
        {trade.stock_code}
      </span>
    </div>
    <span className="text-base font-semibold text-text-secondary">
      {currencySymbol}{trade.price.toFixed(2)}
    </span>
  </div>
  
  {/* 数量和总额 */}
  <div className="text-sm text-text-secondary font-medium mb-2">
    <i className="fas fa-layer-group mr-2 text-text-muted" />
    数量: <span className="font-bold">{trade.quantity}</span> 股
    <span className="ml-4">
      <i className="fas fa-calculator mr-2 text-text-muted" />
      总额: <span className="font-bold">{currencySymbol}{total}</span>
    </span>
  </div>
  
  {/* 备注 */}
  {trade.reason && (
    <div className="text-sm text-text-secondary mt-3 pt-3 border-t border-dark-border leading-relaxed">
      <i className="fas fa-info-circle mr-2 text-accent-primary" />
      {trade.reason}
    </div>
  )}
</div>
```

## 改进点

### 1. 视觉层次

**左侧边框颜色：**
- 买入：红色边框 + 红色背景
- 卖出：绿色边框 + 绿色背景

```tsx
className={`border-l-4 ${
  trade.action === 'BUY'
    ? 'bg-red-900/20 border-red-500'
    : 'bg-green-900/20 border-green-500'
}`}
```

**操作标签：**
- 圆角徽章样式
- 买入：红色背景
- 卖出：绿色背景

```tsx
<span className={`px-3 py-1 rounded-full text-xs font-bold ${
  trade.action === 'BUY' 
    ? 'bg-red-500 text-white' 
    : 'bg-green-500 text-white'
}`}>
  {trade.action === 'BUY' ? '买入' : '卖出'}
</span>
```

### 2. 信息布局

**头部（第一行）：**
- 左侧：操作标签 + 股票代码
- 右侧：价格

**中间（第二行）：**
- 数量 + 总额（在同一行）
- 使用图标增强可读性

**底部（第三行）：**
- 备注信息（如果有）
- 分隔线区分

### 3. 图标使用

```tsx
// 数量图标
<i className="fas fa-layer-group mr-2 text-text-muted" />

// 总额图标
<i className="fas fa-calculator mr-2 text-text-muted" />

// 备注图标
<i className="fas fa-info-circle mr-2 text-accent-primary" />
```

### 4. 备注支持

支持多个字段名：
- `trade.reason` - 交易原因
- `trade.description` - 交易描述

```tsx
{(trade.reason || trade.description) && (
  <div className="text-sm text-text-secondary mt-3 pt-3 border-t border-dark-border">
    <i className="fas fa-info-circle mr-2 text-accent-primary" />
    {trade.reason || trade.description}
  </div>
)}
```

### 5. 货币符号

根据市场类型显示正确的货币符号：

```tsx
const currencySymbol = getCurrencySymbol(selectedDecision.market_type || 'US');

// 使用
{currencySymbol}{trade.price.toFixed(2)}
```

## 显示效果

### 买入交易

```
┌─────────────────────────────────────────┐
│ 🔴 买入  AAPL              $185.50      │ ← 红色边框
│                                         │
│ 📦 数量: 100 股  💰 总额: $18,550.00   │
│                                         │
│ ─────────────────────────────────────  │
│ ℹ️ 技术指标显示超卖，建议买入建仓      │
└─────────────────────────────────────────┘
```

### 卖出交易

```
┌─────────────────────────────────────────┐
│ 🟢 卖出  TSLA              $250.30      │ ← 绿色边框
│                                         │
│ 📦 数量: 50 股   💰 总额: $12,515.00   │
│                                         │
│ ─────────────────────────────────────  │
│ ℹ️ 达到止盈目标，建议获利了结          │
└─────────────────────────────────────────┘
```

## 与智能盯盘的一致性

### 相同点

1. **布局结构** - 头部、中间、底部三段式
2. **颜色方案** - 买入红色、卖出绿色
3. **图标使用** - 相同的图标和位置
4. **备注显示** - 相同的样式和分隔线

### 差异点

| 特性 | 智能盯盘 | 排行榜 |
|------|---------|--------|
| 股票字段 | `trade.stock` | `trade.stock_code` |
| 备注字段 | `trade.description` | `trade.reason` |
| 标题图标 | 黄色 | 黄色 |

**兼容性处理：**
```tsx
// 支持多个字段名
{trade.stock_code || trade.stock || trade.ticker || '未知股票'}
{trade.reason || trade.description}
```

## 响应式设计

### 桌面端
- 数量和总额在同一行
- 充分利用横向空间

### 移动端
- 自动换行
- 保持可读性

```tsx
<div className="text-sm text-text-secondary font-medium mb-2">
  <i className="fas fa-layer-group mr-2" />
  数量: <span className="font-bold">{trade.quantity}</span> 股
  <span className="ml-4">  {/* 移动端会自动换行 */}
    <i className="fas fa-calculator mr-2" />
    总额: <span className="font-bold">{total}</span>
  </span>
</div>
```

## 可访问性

### 1. 颜色对比度
- 红色背景：`bg-red-900/20`（20%透明度）
- 绿色背景：`bg-green-900/20`（20%透明度）
- 确保文字清晰可读

### 2. 语义化标签
- 使用`<span>`而不是`<div>`表示内联元素
- 图标使用`<i>`标签

### 3. 信息层次
- 重要信息（股票代码、价格）使用大字体
- 次要信息（数量、总额）使用中等字体
- 备注信息使用小字体

## 测试验证

### 1. 视觉测试

**买入交易：**
- [ ] 左侧红色边框
- [ ] 红色背景（半透明）
- [ ] 红色操作标签
- [ ] 股票代码清晰
- [ ] 价格显示正确
- [ ] 数量和总额在同一行
- [ ] 备注信息显示（如果有）

**卖出交易：**
- [ ] 左侧绿色边框
- [ ] 绿色背景（半透明）
- [ ] 绿色操作标签
- [ ] 其他同买入

### 2. 功能测试

**货币符号：**
- [ ] 美股显示 `$`
- [ ] 港股显示 `HK$`
- [ ] A股显示 `¥`

**字段兼容：**
- [ ] 支持 `stock_code`
- [ ] 支持 `stock`
- [ ] 支持 `ticker`
- [ ] 支持 `reason`
- [ ] 支持 `description`

### 3. 响应式测试

- [ ] 桌面端布局正常
- [ ] 平板端布局正常
- [ ] 移动端布局正常
- [ ] 文字不重叠
- [ ] 图标对齐

## 相关文件

- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 排行榜用户详情
- `web/frontend/src/components/intraday/DecisionHistory.tsx` - 智能盯盘决策历史（参考）
- `web/frontend/src/utils/marketCurrency.ts` - 货币工具

## 未来优化

1. **动画效果**
   - 添加展开/收起动画
   - 悬停高亮效果

2. **交互增强**
   - 点击查看更多详情
   - 复制交易信息

3. **数据可视化**
   - 添加价格走势图
   - 显示盈亏情况

4. **导出功能**
   - 导出交易记录
   - 生成交易报告
