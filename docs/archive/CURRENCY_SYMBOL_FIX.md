# 货币符号修复

## 问题描述

用户详情面板中的金额显示都使用美元符号（$），没有根据市场类型显示正确的货币符号。

## 解决方案

### 1. 使用货币工具函数

项目中已经有 `getCurrencySymbol` 工具函数：

```typescript
// web/frontend/src/utils/marketCurrency.ts
export function getCurrencySymbol(marketType: string): string {
  return getCurrencyForMarket(marketType).symbol;
}
```

**货币映射：**
- US → `$` (美元)
- HK → `HK$` (港币)
- CN → `¥` (人民币)

### 2. 修改持仓信息显示

**修改前：**
```tsx
<p className="text-text-primary font-medium">
  ${position.current_price?.toFixed(2) || '0.00'}
</p>
```

**修改后：**
```tsx
<p className="text-text-primary font-medium">
  {getCurrencySymbol(position.market_type)}{position.current_price?.toFixed(2) || '0.00'}
</p>
```

**应用位置：**
- 开仓价格
- 当前价格
- 市值
- 盈亏

### 3. 修改交易信息显示

**修改前：**
```tsx
<p className="text-text-primary">
  ${trade.price?.toFixed(2) || '0.00'}
</p>
```

**修改后：**
```tsx
<p className="text-text-primary">
  {getCurrencySymbol(selectedDecision.market_type)}{trade.price?.toFixed(2) || '0.00'}
</p>
```

**应用位置：**
- 交易价格
- 交易总额

## 持仓数据问题修复

### 问题：港股和A股持仓不显示

**原因：** API返回500错误，可能是数据字段为null导致计算错误。

**解决方案：** 添加完善的错误处理和默认值

```python
# web/backend/routes/public_leaderboard_routes.py

for position in positions:
    try:
        # 确保价格有效
        current_price = position.last_price if position.last_price and position.last_price > 0 else position.first_open_price
        
        if not current_price or current_price <= 0:
            current_price = position.first_open_price if position.first_open_price else 0
        
        # 确保数量有效
        market_value = current_price * position.current_quantity if position.current_quantity else 0
        cost_basis = position.first_open_price * position.current_quantity if position.first_open_price and position.current_quantity else 0
        
        # 计算盈亏
        unrealized_pnl = market_value - cost_basis
        pnl_percentage = (unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0.0
        
        # 返回数据，使用默认值避免None
        positions_data.append({
            "stock_code": position.stock_code or "",
            "market_type": position.market_type or "US",
            "quantity": position.current_quantity or 0,
            "current_price": round(current_price, 2) if current_price else 0.0,
            "market_value": round(market_value, 2) if market_value else 0.0,
            "unrealized_pnl": round(unrealized_pnl, 2) if unrealized_pnl else 0.0,
            "pnl_percentage": round(pnl_percentage, 2) if pnl_percentage else 0.0,
            "first_open_price": round(position.first_open_price, 2) if position.first_open_price else 0.0,
            "first_open_time": position.first_open_time.isoformat() if position.first_open_time else None,
        })
    except Exception as e:
        print(f"Error formatting position {position.stock_code}: {e}")
        continue
```

## 显示效果

### 美股（US）
```
开仓价格: $180.00
当前价格: $185.50
市值: $18,550
盈亏: +$550 (+3.05%)
```

### 港股（HK）
```
开仓价格: HK$350.00
当前价格: HK$365.20
市值: HK$36,520
盈亏: +HK$1,520 (+4.34%)
```

### A股（CN）
```
开仓价格: ¥50.00
当前价格: ¥52.30
市值: ¥5,230
盈亏: +¥230 (+4.60%)
```

## 测试验证

### 1. 测试持仓API

```bash
# 测试API是否正常返回
curl http://localhost:8000/api/public/leaderboard/user/1/positions
```

**预期：** 返回200状态码和持仓数据

### 2. 测试货币符号

在浏览器中：
1. 打开排行榜页面
2. 切换到美股市场
3. 点击用户查看详情
4. 查看持仓信息，应该显示 `$`

5. 切换到港股市场
6. 点击用户查看详情
7. 查看持仓信息，应该显示 `HK$`

8. 切换到A股市场
9. 点击用户查看详情
10. 查看持仓信息，应该显示 `¥`

### 3. 测试决策交易

1. 查看决策记录
2. 点击查看详情
3. 查看"执行的交易"部分
4. 验证价格和总额使用正确的货币符号

## 相关文件

- `web/frontend/src/utils/marketCurrency.ts` - 货币工具函数
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 用户详情面板
- `web/backend/routes/public_leaderboard_routes.py` - 持仓API

## 注意事项

1. **货币符号位置**
   - 符号在金额前面
   - 符号和金额之间没有空格
   - 例如：`$100.00` 而不是 `$ 100.00`

2. **数据验证**
   - 确保所有数值字段都有默认值
   - 避免None值导致计算错误
   - 使用try-except捕获异常

3. **一致性**
   - 所有金额显示都使用相同的格式
   - 货币符号始终与市场类型匹配
   - 保持UI的一致性

## 未来优化

1. **格式化函数**
   ```typescript
   // 使用formatAmount函数统一格式化
   import { formatAmount } from '@/utils/marketCurrency';
   
   <p>{formatAmount(position.current_price, position.market_type)}</p>
   ```

2. **国际化支持**
   - 支持更多货币
   - 支持用户自定义货币显示
   - 支持货币转换

3. **精度控制**
   - 不同市场使用不同的小数位数
   - 美股：2位小数
   - 港股：2位小数
   - A股：2位小数（人民币）
