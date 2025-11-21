# 排行榜趋势图改进

## 改进内容

### 1. 修复市场切换时数据不更新

**问题：** 切换市场后，趋势图显示的还是之前市场的数据。

**原因：** API请求没有包含市场参数，返回的是用户所有市场的数据。

**解决方案：**

#### 后端API添加市场过滤

```python
@router.get("/user/{user_id}/trend")
async def get_user_trend(
    user_id: int,
    days: int = 7,
    market: str = None,  # 新增市场参数
    db: AsyncSession = Depends(get_db)
):
    # Build query with optional market filter
    conditions = [
        AccountSnapshot.user_id == user_id,
        AccountSnapshot.snapshot_date >= start_date,
        AccountSnapshot.snapshot_date <= end_date
    ]
    
    if market:
        conditions.append(AccountSnapshot.market_type == market)
    
    query = select(AccountSnapshot).where(and_(*conditions))
```

#### 前端添加市场参数

```typescript
const response = await fetch(
  buildApiUrl(`/api/public/leaderboard/user/${user.user_id}/trend?days=7&market=${selectedMarket}`)
);
```

**效果：**
- 切换市场时，React Query的`queryKey`包含`selectedMarket`
- 自动触发重新请求
- 获取对应市场的趋势数据

### 2. 添加鼠标悬停Tooltip

**功能：** 鼠标移动到趋势图上时，显示数据详情。

**实现：**

#### 状态管理

```typescript
const [tooltip, setTooltip] = useState<{
  visible: boolean;
  x: number;
  y: number;
  data: {
    username: string;
    date: string;
    value: number;
  } | null;
}>({ visible: false, x: 0, y: 0, data: null });
```

#### 鼠标事件处理

```typescript
const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // 1. 获取鼠标位置
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // 2. 检查是否在图表区域内
  if (x < padding.left || x > rect.width - padding.right) {
    setTooltip({ visible: false, ... });
    return;
  }
  
  // 3. 计算最接近的数据点
  const dateIndex = Math.round((relativeX / chartWidth) * (sortedDates.length - 1));
  const targetDate = sortedDates[dateIndex];
  
  // 4. 找出最接近鼠标的用户数据
  users.forEach((user) => {
    const dataPoint = trendData.find(p => p.date === targetDate);
    if (dataPoint) {
      const pointY = calculateY(dataPoint.total_assets);
      const distance = Math.abs(y - pointY);
      
      if (distance < closestDistance) {
        closestUser = { username, value, distance };
      }
    }
  });
  
  // 5. 显示tooltip（距离小于20px）
  if (closestUser && closestUser.distance < 20) {
    setTooltip({ visible: true, x: e.clientX, y: e.clientY, data: ... });
  }
};
```

#### Tooltip UI

```tsx
{tooltip.visible && tooltip.data && (
  <div
    className="fixed z-50 bg-dark-primary border border-accent-primary rounded-lg shadow-lg p-3"
    style={{ left: `${tooltip.x + 10}px`, top: `${tooltip.y + 10}px` }}
  >
    <div className="text-sm font-semibold text-text-primary">
      {tooltip.data.username}
    </div>
    <div className="text-xs text-text-secondary">
      {tooltip.data.date}
    </div>
    <div className="text-sm font-bold text-accent-primary">
      ${tooltip.data.value.toLocaleString()}
    </div>
  </div>
)}
```

**特点：**
- 跟随鼠标位置
- 显示用户名、时间、资产值
- 只在距离数据点20px内显示
- 鼠标离开图表时隐藏
- 使用`pointer-events-none`避免干扰鼠标事件

### 3. 确保数据与Y轴匹配

**问题：** 折线数据的Y坐标需要与Y轴的金额标记对应。

**解决方案：** 使用统一的值域计算

#### 计算值域

```typescript
// 找出所有数据的最小值和最大值
let minValue = Infinity;
let maxValue = -Infinity;

Object.values(allTrendsData).forEach(trendData => {
  trendData.forEach(point => {
    minValue = Math.min(minValue, point.total_assets);
    maxValue = Math.max(maxValue, point.total_assets);
  });
});

// 添加10%边距
const valueRange = maxValue - minValue;
minValue -= valueRange * 0.1;
maxValue += valueRange * 0.1;
```

#### Y轴标签

```typescript
// Y轴网格线和标签
const ySteps = 5;
for (let i = 0; i <= ySteps; i++) {
  const y = padding.top + (chartHeight * i / ySteps);
  
  // 计算对应的值
  const value = maxValue - (maxValue - minValue) * (i / ySteps);
  
  // 显示标签（K为千）
  ctx.fillText(`${(value / 1000).toFixed(0)}K`, padding.left - 10, y + 4);
}
```

#### 数据点Y坐标

```typescript
// 绘制折线时使用相同的计算方式
const normalizedValue = (point.total_assets - minValue) / (maxValue - minValue);
const y = padding.top + chartHeight - (chartHeight * normalizedValue);
```

**保证：**
- Y轴标签显示的值与实际数据对应
- 折线的Y坐标准确反映资产值
- 所有用户使用相同的值域，可以直接对比

## 用户体验改进

### 1. 视觉反馈

**鼠标样式：**
```tsx
<canvas className="cursor-crosshair" />
```
- 从`cursor-pointer`改为`cursor-crosshair`
- 更适合数据查看场景

**Tooltip样式：**
- 深色背景，高对比度
- Accent颜色边框
- 阴影效果
- 清晰的层次结构

### 2. 交互流畅性

**性能优化：**
- 使用`React.MouseEvent`而不是原生事件
- 计算优化，避免重复计算
- 只在距离数据点近时显示tooltip

**响应速度：**
- 实时跟随鼠标
- 无延迟显示/隐藏
- 平滑的状态切换

### 3. 数据可读性

**格式化：**
```typescript
// 金额格式化
${value.toLocaleString(undefined, { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})}

// 日期格式化
date.includes(' ') 
  ? date.replace(' ', ' · ')  // "2025-11-17 · 14:30:00"
  : date                       // "2025-11-17"
```

**信息层次：**
1. 用户名（粗体，主要）
2. 时间（小字，次要）
3. 金额（粗体，高亮）

## 技术细节

### 坐标系统

```
Canvas坐标系：
┌─────────────────────────────┐
│ (0,0)                       │
│   padding.top               │
│   ┌─────────────────────┐   │
│ p │                     │ p │
│ a │   Chart Area        │ a │
│ d │                     │ d │
│ . │                     │ . │
│ l │                     │ r │
│ e │                     │ i │
│ f │                     │ g │
│ t │                     │ h │
│   └─────────────────────┘ t │
│   padding.bottom            │
└─────────────────────────────┘
```

### 值域映射

```typescript
// 数据值 → 屏幕Y坐标
const normalizedValue = (dataValue - minValue) / (maxValue - minValue);
const screenY = padding.top + chartHeight - (chartHeight * normalizedValue);

// 屏幕Y坐标 → 数据值
const normalizedY = (chartHeight - (screenY - padding.top)) / chartHeight;
const dataValue = minValue + (maxValue - minValue) * normalizedY;
```

### 距离计算

```typescript
// 欧几里得距离
const distance = Math.sqrt(
  Math.pow(mouseX - pointX, 2) + 
  Math.pow(mouseY - pointY, 2)
);

// 简化：只计算Y轴距离（X轴已经对齐到最近的数据点）
const distance = Math.abs(mouseY - pointY);
```

## 测试验证

### 1. 市场切换测试

**步骤：**
1. 打开排行榜页面
2. 默认显示美股市场
3. 切换到港股
4. 观察趋势图是否更新

**预期：**
- 趋势图立即更新
- 显示港股市场的数据
- Y轴范围自动调整

### 2. Tooltip测试

**步骤：**
1. 鼠标移动到趋势图上
2. 观察tooltip显示
3. 移动到不同位置
4. 移出图表区域

**预期：**
- Tooltip跟随鼠标
- 显示正确的用户和数据
- 距离数据点远时不显示
- 移出图表时隐藏

### 3. Y轴对齐测试

**步骤：**
1. 查看Y轴标签
2. 对比折线位置
3. 使用tooltip验证数值

**预期：**
- Y轴标签与数据对应
- 折线位置准确
- Tooltip显示的值与Y轴匹配

## 相关文件

- `web/backend/routes/public_leaderboard_routes.py` - 后端API
- `web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx` - 趋势图组件

## 未来优化

### 1. 增强交互

- [ ] 点击数据点固定tooltip
- [ ] 拖动选择时间范围
- [ ] 缩放功能
- [ ] 显示多个用户的tooltip

### 2. 性能优化

- [ ] 使用Web Worker处理数据
- [ ] Canvas离屏渲染
- [ ] 虚拟化大量数据点
- [ ] 防抖鼠标事件

### 3. 功能增强

- [ ] 导出图表为图片
- [ ] 自定义Y轴范围
- [ ] 显示涨跌幅
- [ ] 添加趋势线

## 注意事项

1. **性能考虑**
   - 鼠标移动事件频繁触发
   - 避免在事件处理中进行复杂计算
   - 使用React.memo优化组件

2. **精度问题**
   - Canvas坐标是整数
   - 数据值是浮点数
   - 需要适当的舍入处理

3. **边界情况**
   - 数据为空时的处理
   - 单个数据点的处理
   - 所有值相同时的处理

4. **浏览器兼容性**
   - Canvas API支持
   - 鼠标事件支持
   - CSS fixed定位
