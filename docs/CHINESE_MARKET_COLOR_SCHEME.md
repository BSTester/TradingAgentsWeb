# 中国市场颜色方案 - 红涨绿跌

## 背景

在中国股市中，颜色习惯与国际市场相反：
- **红色**表示上涨、盈利（正值）
- **绿色**表示下跌、亏损（负值）

这与欧美市场的习惯相反（绿涨红跌），因此需要特别处理。

## 颜色定义

### 标准颜色值

```typescript
// 上涨/盈利 - 红色
const PROFIT_COLOR = '#f03a55';  // 中国红

// 下跌/亏损 - 绿色  
const LOSS_COLOR = '#00a870';    // 中国绿
```

### 使用场景

1. **持仓盈亏**
   - 盈利（正值）：红色
   - 亏损（负值）：绿色

2. **价格变动**
   - 上涨（正值）：红色
   - 下跌（负值）：绿色

3. **收益率**
   - 正收益：红色
   - 负收益：绿色

## 修改内容

### 1. 排行榜持仓信息

**文件**：`web/frontend/src/components/leaderboard/UserDetailPanel.tsx`

**修改前**：
```tsx
<p className={`font-medium ${
  (position.unrealized_pnl || 0) >= 0
    ? 'text-success-500'  // 绿色 - 错误！
    : 'text-danger-500'   // 红色 - 错误！
}`}>
```

**修改后**：
```tsx
<p className={`font-medium ${
  (position.unrealized_pnl || 0) >= 0
    ? 'text-[#f03a55]'    // 红色 - 正确！
    : 'text-[#00a870]'    // 绿色 - 正确！
}`}>
```

### 2. 智能盯盘持仓概览

**文件**：`web/frontend/src/components/intraday/PositionOverview.tsx`

**已正确实现**：
```tsx
<div className={`font-medium ${
  (position.pnl || 0) >= 0 
    ? 'text-[#f03a55]'    // 红色 - 盈利
    : 'text-[#00a870]'    // 绿色 - 亏损
}`}>
  {(position.pnl || 0) >= 0 ? '+' : ''}{currency}{(position.pnl || 0).toFixed(2)}
</div>
```

### 3. 账户信息

**文件**：`web/frontend/src/components/intraday/AccountInfo.tsx`

**已正确实现**：
```tsx
<p className={`text-xs md:text-sm ${
  todayProfitLoss >= 0 
    ? 'text-[#f03a55]'    // 红色 - 盈利
    : 'text-[#00a870]'    // 绿色 - 亏损
}`}>
  {todayProfitLoss >= 0 ? '+' : ''}{currency}{todayProfitLoss.toLocaleString()}
</p>
```

## 实现规范

### Tailwind CSS 自定义颜色

使用方括号语法定义自定义颜色：

```tsx
// 文字颜色
className="text-[#f03a55]"  // 红色文字
className="text-[#00a870]"  // 绿色文字

// 背景颜色
className="bg-[#f03a55]"    // 红色背景
className="bg-[#00a870]"    // 绿色背景

// 边框颜色
className="border-[#f03a55]" // 红色边框
className="border-[#00a870]" // 绿色边框
```

### 条件渲染模式

```tsx
// 基本模式
className={value >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}

// 带默认值
className={`font-medium ${(value || 0) >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}`}

// 多属性
className={`
  font-medium 
  ${value >= 0 ? 'text-[#f03a55]' : 'text-[#00a870]'}
  ${value >= 0 ? 'bg-[#f03a55]/10' : 'bg-[#00a870]/10'}
`}
```

### 符号显示

盈亏数值应该显示正负号：

```tsx
// 正值显示 +
{value >= 0 ? '+' : ''}{value.toFixed(2)}

// 示例输出
// +123.45  (盈利，红色)
// -56.78   (亏损，绿色)
```

## 注意事项

### 1. 不要混淆状态颜色

**盈亏颜色**（红涨绿跌）：
- ✅ 盈利：红色 `#f03a55`
- ✅ 亏损：绿色 `#00a870`

**状态颜色**（保持国际惯例）：
- ✅ 成功：绿色 `success-500`
- ✅ 失败：红色 `danger-500`
- ✅ 警告：黄色 `warning-500`

### 2. 市场特定性

这个颜色方案主要用于：
- 中国A股市场（CN）
- 香港股市（HK）
- 可能也适用于其他亚洲市场

对于美股（US），理论上应该使用绿涨红跌，但为了保持一致性，我们在所有市场都使用红涨绿跌。

### 3. 可访问性

确保颜色对比度足够：
- 红色 `#f03a55` 在深色背景上的对比度：✅ 良好
- 绿色 `#00a870` 在深色背景上的对比度：✅ 良好

对于色盲用户，除了颜色外，还应该使用：
- 正负号（+/-）
- 箭头图标（↑/↓）
- 文字说明

## 检查清单

在添加新的盈亏显示功能时，请检查：

- [ ] 使用正确的颜色值（`#f03a55` 和 `#00a870`）
- [ ] 正值显示红色，负值显示绿色
- [ ] 正值前面加 `+` 号
- [ ] 数值格式化正确（小数位数、千分位）
- [ ] 在深色背景上可读性良好
- [ ] 提供了除颜色外的其他视觉提示

## 相关文件

### 已修改
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 排行榜持仓盈亏

### 已正确实现
- `web/frontend/src/components/intraday/PositionOverview.tsx` - 智能盯盘持仓
- `web/frontend/src/components/intraday/AccountInfo.tsx` - 账户信息

### 需要注意
- 任何新增的盈亏显示组件
- 价格变动显示
- 收益率显示
- 趋势图表

## 参考资料

### 中国股市颜色习惯
- 红色：上涨、盈利、买入
- 绿色：下跌、亏损、卖出

### 历史原因
中国股市使用红涨绿跌的原因：
1. 文化传统：红色在中国文化中代表喜庆、吉祥
2. 心理因素：红色更能引起投资者的注意
3. 市场习惯：从股市建立之初就采用这个标准

### 国际对比
- **中国、台湾、韩国**：红涨绿跌
- **美国、欧洲、日本**：绿涨红跌

## 测试建议

1. **视觉测试**
   - 检查盈利显示为红色
   - 检查亏损显示为绿色
   - 检查零值的显示

2. **数值测试**
   - 正值：+123.45（红色）
   - 负值：-56.78（绿色）
   - 零值：0.00（灰色或默认色）

3. **边界测试**
   - 非常小的正值：+0.01
   - 非常小的负值：-0.01
   - 大数值：+1,234,567.89

4. **响应式测试**
   - 桌面端显示
   - 移动端显示
   - 不同屏幕尺寸
