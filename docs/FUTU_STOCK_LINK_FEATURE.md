# 富途股票详情页链接功能

## 功能说明

在排行榜的持仓信息卡片中，股票代码现在是可点击的链接，点击后会在新标签页中打开富途股票详情页。

## 实现细节

### 1. 工具函数

**文件**: `web/frontend/src/utils/futuLink.ts`

提供两个函数：
- `getFutuStockUrl(stockCode, marketType)`: 生成富途股票详情页 URL
- `openFutuStockPage(stockCode, marketType)`: 在新标签页中打开富途股票详情页

### 2. URL 格式

根据不同市场生成对应的 URL：

| 市场 | 示例代码 | URL 格式 | 示例 URL |
|------|---------|---------|----------|
| 美股 (US) | AAPL | `https://www.futunn.com/stock/{CODE}-US` | https://www.futunn.com/stock/AAPL-US |
| 港股 (HK) | 00700 | `https://www.futunn.com/stock/{CODE}-HK` | https://www.futunn.com/stock/00700-HK |
| A股-沪市 (CN) | 600519 | `https://www.futunn.com/stock/{CODE}-SH` | https://www.futunn.com/stock/600519-SH |
| A股-深市 (CN) | 000001 | `https://www.futunn.com/stock/{CODE}-SZ` | https://www.futunn.com/stock/000001-SZ |

### 3. 股票代码处理

**美股**:
- 提取所有字母序列，选择最长的
- 例如: `US.AAPL` → `AAPL` (而不是 `US`)

**港股/A股**:
- 提取数字部分
- 例如: `HK.00700` 或 `00700.HK` → `00700`

**A股市场判断**:
- 沪市: 以 `60` 或 `688` 开头 (主板和科创板)
- 深市: 其他 (包括 `00`、`30`、`002` 等)

### 4. 应用组件

已在以下组件中实现：

1. **UserDetailPanel** (`web/frontend/src/components/leaderboard/UserDetailPanel.tsx`)
   - 用户详情侧边栏的持仓信息

2. **UserPositionsPanel** (`web/frontend/src/components/leaderboard/UserPositionsPanel.tsx`)
   - 持仓详情面板

3. **PositionOverview** (`web/frontend/src/components/intraday/PositionOverview.tsx`)
   - 智能盯盘页面的持仓概览（已有实现）

## 使用方式

### 在组件中使用

```tsx
import { openFutuStockPage } from '@/utils/futuLink';

// 在按钮点击事件中使用
<button
  onClick={() => openFutuStockPage(position.stock_code, position.market_type)}
  className="text-accent-primary hover:underline"
  title="点击查看富途股票详情"
>
  {position.stock_code}
</button>
```

### 只获取 URL

```tsx
import { getFutuStockUrl } from '@/utils/futuLink';

const url = getFutuStockUrl('AAPL', 'US');
// 返回: "https://www.futunn.com/stock/AAPL-US"
```

## 视觉效果

**修改前**:
```
AAPL  Apple Inc.  [US]        100 股
```

**修改后**:
```
AAPL  Apple Inc.  [US]        100 股
^^^^
蓝色可点击链接，鼠标悬停显示下划线
```

## 样式说明

- **颜色**: `text-accent-primary` (蓝色)
- **悬停效果**: 
  - 显示下划线 (`hover:underline`)
  - 透明度变化 (`hover:opacity-80`)
- **光标**: 自动显示为指针 (button 元素默认)
- **提示**: 鼠标悬停显示 "点击查看富途股票详情"

## 测试用例

### 美股
- `AAPL` → https://www.futunn.com/stock/AAPL-US
- `NVDA` → https://www.futunn.com/stock/NVDA-US
- `US.TSLA` → https://www.futunn.com/stock/TSLA-US

### 港股
- `00700` → https://www.futunn.com/stock/00700-HK
- `HK.02258` → https://www.futunn.com/stock/02258-HK
- `09988.HK` → https://www.futunn.com/stock/09988-HK

### A股
- `600519` → https://www.futunn.com/stock/600519-SH (沪市)
- `688670` → https://www.futunn.com/stock/688670-SH (科创板)
- `000001` → https://www.futunn.com/stock/000001-SZ (深市)
- `300750` → https://www.futunn.com/stock/300750-SZ (创业板)

## 注意事项

1. **新标签页打开**: 使用 `window.open()` 并设置 `noopener,noreferrer` 安全参数
2. **代码提取**: 自动处理各种格式的股票代码（带前缀、后缀等）
3. **兼容性**: 与智能盯盘页面的实现保持一致
4. **可访问性**: 提供 `title` 属性作为提示信息

## 相关文件

- `web/frontend/src/utils/futuLink.ts` - 工具函数
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 用户详情面板
- `web/frontend/src/components/leaderboard/UserPositionsPanel.tsx` - 持仓详情面板
- `web/frontend/src/components/intraday/PositionOverview.tsx` - 智能盯盘持仓概览（参考实现）
