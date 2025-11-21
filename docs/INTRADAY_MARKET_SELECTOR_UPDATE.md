# 智能盯盘市场选择器UI更新

## 更新内容

将智能盯盘页面的市场选择器从下拉框（select）改为三个单选按钮的形式，与排行榜页面保持一致，提升用户体验。

## 视觉效果对比

### 修改前（下拉框）

```
┌─────────────────────────────────────┐
│ 账户信息                            │
│                                     │
│ [美股 ▼]  刷新                      │
└─────────────────────────────────────┘
```

点击后展开：
```
┌─────────────────────────────────────┐
│ [美股 ▼]                            │
│ ├─ 美股                             │
│ ├─ 港股                             │
│ └─ A股                              │
└─────────────────────────────────────┘
```

### 修改后（按钮组）

```
┌─────────────────────────────────────┐
│ 账户信息                            │
│                                     │
│ [美股] [港股] [A股]  刷新           │
└─────────────────────────────────────┘
```

## 实现细节

### 代码修改

**文件**：`web/frontend/src/components/intraday/AccountInfo.tsx`

**修改前**：
```tsx
<select
  value={selectedMarket}
  onChange={(e) => onMarketChange(e.target.value)}
  className="px-3 py-1 bg-dark-tertiary border border-dark-border text-text-primary rounded-md text-sm"
>
  <option value="US">美股</option>
  <option value="HK">港股</option>
  <option value="CN">A股</option>
</select>
```

**修改后**：
```tsx
<div className="flex items-center space-x-1 sm:space-x-2">
  {['US', 'HK', 'CN'].map((market) => (
    <button
      key={market}
      onClick={() => onMarketChange(market)}
      className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium transition-all ${
        selectedMarket === market
          ? 'bg-accent-primary text-white'
          : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary hover:text-text-primary'
      }`}
    >
      {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'}
    </button>
  ))}
</div>
```

## 样式说明

### 按钮状态

#### 选中状态
- **背景色**：`bg-accent-primary` - 主题色
- **文字色**：`text-white` - 白色
- **效果**：清晰标识当前选中的市场

#### 未选中状态
- **背景色**：`bg-dark-tertiary` - 深色背景
- **文字色**：`text-text-secondary` - 次要文字色
- **悬停**：`hover:bg-dark-primary hover:text-text-primary` - 悬停时变亮

### 响应式设计

#### 桌面端（sm及以上）
```tsx
px-3        // 内边距：12px
text-sm     // 字体：14px
space-x-2   // 按钮间距：8px
```

#### 移动端（小于sm）
```tsx
px-2        // 内边距：8px
text-xs     // 字体：12px
space-x-1   // 按钮间距：4px
```

### 刷新按钮优化

同时优化了刷新按钮的响应式显示：

```tsx
<button className="text-xs sm:text-sm ...">
  <i className="fas fa-sync-alt mr-1" />
  <span className="hidden sm:inline">刷新</span>      // 桌面端显示文字
  <span className="sm:hidden">{isFetching ? '...' : ''}</span>  // 移动端只显示图标
</button>
```

## 用户体验改进

### 1. 操作更直观

**下拉框**：
- 需要点击展开
- 需要移动鼠标选择
- 两步操作

**按钮组**：
- 一键切换
- 所有选项可见
- 一步操作 ✅

### 2. 视觉反馈更好

**下拉框**：
- 当前选择不够明显
- 需要点击才能看到其他选项

**按钮组**：
- 当前选择高亮显示 ✅
- 所有选项一目了然 ✅
- 悬停效果提供即时反馈 ✅

### 3. 移动端友好

**下拉框**：
- 在移动端会触发系统选择器
- 体验不一致

**按钮组**：
- 统一的触摸体验 ✅
- 按钮大小适合触摸 ✅
- 响应式间距避免误触 ✅

### 4. 与排行榜一致

现在智能盯盘和排行榜使用相同的市场选择器样式，提供一致的用户体验。

## 布局说明

### 桌面端布局

```
┌──────────────────────────────────────────────────────┐
│ 账户信息                                              │
│                                                       │
│ [美股] [港股] [A股]  🔄 刷新                          │
│  ↑      ↑      ↑                                     │
│  12px间距                                             │
└──────────────────────────────────────────────────────┘
```

### 移动端布局

```
┌────────────────────────────────┐
│ 账户信息                        │
│                                │
│ [美股][港股][A股] 🔄            │
│  ↑    ↑    ↑                   │
│  4px间距（更紧凑）              │
└────────────────────────────────┘
```

## 交互行为

### 点击切换

```javascript
onClick={() => onMarketChange(market)}
```

- 点击按钮立即切换市场
- 触发数据刷新
- 更新所有相关组件（账户信息、持仓、订单）

### 视觉过渡

```css
transition-all
```

- 背景色平滑过渡
- 文字颜色平滑过渡
- 提供流畅的视觉反馈

## 可访问性

### 1. 键盘导航

按钮支持Tab键导航：
```
Tab → 美股按钮
Tab → 港股按钮
Tab → A股按钮
Tab → 刷新按钮
```

### 2. 语义化HTML

使用 `<button>` 元素：
- 屏幕阅读器友好
- 支持键盘操作（Enter/Space）
- 符合Web标准

### 3. 视觉对比

- 选中状态与未选中状态对比明显
- 符合WCAG 2.1 AA标准
- 色盲用户也能区分（通过亮度差异）

## 性能优化

### 使用map渲染

```tsx
{['US', 'HK', 'CN'].map((market) => (
  <button key={market} ...>
))}
```

- 代码简洁
- 易于维护
- 性能优秀

### 条件类名

```tsx
className={`... ${
  selectedMarket === market
    ? 'bg-accent-primary text-white'
    : 'bg-dark-tertiary text-text-secondary ...'
}`}
```

- 动态应用样式
- 避免不必要的重渲染

## 测试场景

### 1. 功能测试

- ✅ 点击美股按钮切换到美股
- ✅ 点击港股按钮切换到港股
- ✅ 点击A股按钮切换到A股
- ✅ 切换后数据正确刷新

### 2. 视觉测试

- ✅ 选中状态高亮显示
- ✅ 未选中状态正常显示
- ✅ 悬停效果正常
- ✅ 过渡动画流畅

### 3. 响应式测试

- ✅ 桌面端：按钮大小合适，间距舒适
- ✅ 平板：按钮大小合适，间距舒适
- ✅ 手机：按钮大小适合触摸，间距避免误触

### 4. 兼容性测试

- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ 移动浏览器

## 与排行榜对比

### 排行榜市场选择器

```tsx
{['US', 'HK', 'CN'].map((market) => (
  <button
    onClick={() => handleMarketChange(market)}
    className={`px-4 py-2 rounded-lg text-sm font-medium ${
      selectedMarket === market
        ? 'bg-accent-primary text-white'
        : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
    }`}
  >
    {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'}
  </button>
))}
```

### 智能盯盘市场选择器

```tsx
{['US', 'HK', 'CN'].map((market) => (
  <button
    onClick={() => onMarketChange(market)}
    className={`px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium ${
      selectedMarket === market
        ? 'bg-accent-primary text-white'
        : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
    }`}
  >
    {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'}
  </button>
))}
```

**差异**：
- 智能盯盘按钮更紧凑（适合工具栏）
- 排行榜按钮更大（适合主要操作）
- 核心样式和交互逻辑一致

## 相关文档

- `docs/LEADERBOARD_UI_IMPROVEMENTS.md` - 排行榜UI改进
- `docs/MARKET_TIME_TIMEZONE_FIX.md` - 市场时间修复
