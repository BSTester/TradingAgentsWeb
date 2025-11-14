# 持仓概览 - 股票详情链接功能

## 功能描述

在持仓概览页面，点击股票代码可以在新窗口中打开富途牛牛的股票详情页，方便用户快速查看股票的详细信息。

## 功能特性

### 1. 点击跳转
- 点击任意股票代码，自动在新窗口打开富途股票详情页
- 使用 `window.open()` 的 `noopener,noreferrer` 参数确保安全性
- 鼠标悬停时显示外部链接图标和下划线提示

### 2. URL 格式

根据不同市场和股票代码自动生成正确的富途 URL：

#### 美股 (US)
- **格式**: `https://www.futunn.com/stock/{股票代码}-US`
- **示例**: 
  - NVDA → https://www.futunn.com/stock/NVDA-US
  - AAPL → https://www.futunn.com/stock/AAPL-US
  - TSLA → https://www.futunn.com/stock/TSLA-US

#### 港股 (HK)
- **格式**: `https://www.futunn.com/stock/{股票代码}-HK`
- **示例**:
  - 02258 → https://www.futunn.com/stock/02258-HK
  - 00700 → https://www.futunn.com/stock/00700-HK
  - 09988 → https://www.futunn.com/stock/09988-HK

#### A股 - 上海 (CN-SH)
- **格式**: `https://www.futunn.com/stock/{股票代码}-SH`
- **规则**:
  - 60xxxx: 上海主板
  - 688xxx: 科创板
- **示例**:
  - 688670 → https://www.futunn.com/stock/688670-SH
  - 600519 → https://www.futunn.com/stock/600519-SH

#### A股 - 深圳 (CN-SZ)
- **格式**: `https://www.futunn.com/stock/{股票代码}-SZ`
- **规则**:
  - 00xxxx: 深圳主板
  - 30xxxx: 创业板
  - 002xxx: 中小板
- **示例**:
  - 301017 → https://www.futunn.com/stock/301017-SZ
  - 000001 → https://www.futunn.com/stock/000001-SZ
  - 300750 → https://www.futunn.com/stock/300750-SZ

## 实现细节

### 股票代码处理

股票代码可能包含市场前缀（如 `HK.00700`、`SH.600519`），需要提取纯数字部分：
- `HK.00700` → `00700`
- `SH.600519` → `600519`
- `SZ.301017` → `301017`
- `AAPL` → `AAPL`（美股保持不变）

### URL 生成函数

```typescript
const getFutuStockUrl = (stockCode: string, marketType: string): string => {
  const market = marketType.toUpperCase();
  
  if (market === 'US') {
    return `https://www.futunn.com/stock/${stockCode}-US`;
  } else if (market === 'HK') {
    return `https://www.futunn.com/stock/${stockCode}-HK`;
  } else if (market === 'CN') {
    // Shanghai: 60xxxx, 688xxx (科创板)
    // Shenzhen: 00xxxx, 30xxxx (创业板), 002xxx (中小板)
    if (stockCode.startsWith('60') || stockCode.startsWith('688')) {
      return `https://www.futunn.com/stock/${stockCode}-SH`;
    } else {
      return `https://www.futunn.com/stock/${stockCode}-SZ`;
    }
  }
  
  return `https://www.futunn.com/stock/${stockCode}`;
};
```

### 点击处理函数

```typescript
const handleStockClick = (stockCode: string, marketType: string) => {
  const url = getFutuStockUrl(stockCode, marketType);
  window.open(url, '_blank', 'noopener,noreferrer');
};
```

### UI 实现

```tsx
<button
  onClick={() => handleStockClick(position.stock_code, position.market_type)}
  className="text-left hover:opacity-80 transition-opacity group"
  title="点击查看富途股票详情"
>
  <div className="text-xs md:text-sm font-medium text-accent-primary group-hover:underline flex items-center">
    {position.stock_code}
    <i className="fas fa-external-link-alt ml-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
  {position.stock_name && (
    <div className="text-xs text-text-tertiary hidden md:block">
      {position.stock_name}
    </div>
  )}
</button>
```

## 用户体验

### 视觉反馈
1. **默认状态**: 股票代码显示为蓝色（accent-primary）
2. **鼠标悬停**: 
   - 显示下划线
   - 显示外部链接图标（从透明渐变到可见）
   - 整体透明度降低（hover:opacity-80）
3. **提示文本**: 鼠标悬停时显示 "点击查看富途股票详情"

### 交互行为
- 点击后在新标签页打开，不影响当前页面
- 使用 `noopener,noreferrer` 确保安全性和隐私
- 支持键盘导航（button 元素）

## 修改文件

### 前端
- `web/frontend/src/components/intraday/PositionOverview.tsx`
  - 添加 `getFutuStockUrl()` 函数
  - 添加 `handleStockClick()` 函数
  - 修改股票代码显示为可点击按钮

## 测试

可以使用 `test_futu_stock_url.html` 文件进行测试：

```bash
# 在浏览器中打开
open test_futu_stock_url.html
```

该测试页面包含：
- 各市场的 URL 格式规则说明
- 多个测试用例（美股、港股、A股）
- 可直接点击测试生成的 URL

## 注意事项

1. **A股市场判断**: 根据股票代码前缀自动判断是上海还是深圳
   - 上海: 60xxxx, 688xxx
   - 深圳: 其他（00xxxx, 30xxxx, 002xxx）

2. **安全性**: 使用 `noopener,noreferrer` 防止新窗口访问原窗口的 `window.opener`

3. **兼容性**: 所有现代浏览器都支持 `window.open()` 和相关参数

4. **富途 URL**: 如果富途修改了 URL 格式，需要相应更新 `getFutuStockUrl()` 函数

## 未来优化

1. 可以添加更多股票信息网站的链接选项
2. 可以在设置中让用户选择默认的股票详情网站
3. 可以添加右键菜单，提供多个网站选项
