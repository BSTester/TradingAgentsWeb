# 用户详情面板改进

## 改进内容

### 1. 根据市场过滤数据

**问题：** 之前持仓和决策记录显示所有市场的数据，与当前选择的市场不匹配。

**解决方案：**

```typescript
// 获取所有数据（不带市场过滤）
const { data: allPositions } = useQuery({
  queryKey: ['user-positions', userId],
  // ...
});

const { data: allDecisions } = useQuery({
  queryKey: ['user-decisions', userId],
  // ...
});

// 前端根据市场过滤
const positions = React.useMemo(() => {
  if (!allPositions) return [];
  return allPositions.filter((p: any) => p.market_type === market);
}, [allPositions, market]);

const decisions = React.useMemo(() => {
  if (!allDecisions) return [];
  return allDecisions.filter((d: any) => d.market_type === market);
}, [allDecisions, market]);
```

**优点：**
- 数据只请求一次，切换市场时无需重新加载
- 响应更快，用户体验更好
- 减少服务器负载

### 2. 决策记录详情查看

**新增功能：** 点击决策记录卡片可以查看完整详情

#### 详情内容包括：

1. **基本信息**
   - 市场类型
   - 状态（已完成/运行中/失败）
   - 开始时间
   - 结束时间

2. **执行的交易**
   - 股票代码
   - 操作类型（买入/卖出）
   - 数量
   - 价格
   - 总额
   - 交易原因

3. **分析的持仓**
   - 显示所有被分析的股票代码

4. **决策报告**
   - 完整的决策分析报告
   - 使用等宽字体显示，保持格式

#### UI设计

**列表视图：**
```tsx
<div className="cursor-pointer" onClick={() => handleViewDecision(decision)}>
  {/* 决策摘要 */}
  <i className="fas fa-chevron-right" /> {/* 右箭头提示可点击 */}
</div>
```

**详情弹窗：**
- 全屏遮罩层（70%透明度）
- 居中弹窗，响应式尺寸
- 平滑的缩放动画
- 滚动查看完整内容

### 3. 视觉改进

#### 决策记录卡片
- 添加悬停效果（边框高亮）
- 添加鼠标指针样式（cursor-pointer）
- 添加右箭头图标提示可点击
- 报告摘要限制为2行（line-clamp-2）

#### 详情弹窗
- 深色背景，与主题一致
- 清晰的分区（时间信息、交易、持仓、报告）
- 图标标识各个部分
- 交易卡片使用颜色区分买入/卖出

## 使用示例

### 查看用户详情

1. 在排行榜页面点击用户
2. 侧边栏显示用户详情
3. 切换标签页查看持仓或决策记录

### 查看决策详情

1. 在决策记录标签页
2. 点击任意决策记录卡片
3. 弹窗显示完整详情
4. 点击遮罩层或关闭按钮退出

### 切换市场

1. 在排行榜页面切换市场（US/HK/CN）
2. 用户详情面板自动过滤显示对应市场的数据
3. 无需重新加载，立即响应

## 数据结构

### 持仓数据
```typescript
interface Position {
  stock_code: string;
  market_type: string;
  quantity: number;
  first_open_price: number;
  current_price: number;
  market_value: number;
  unrealized_pnl: number;
  pnl_percentage: number;
  first_open_time: string;
}
```

### 决策记录
```typescript
interface Decision {
  id: number;
  session_id: string;
  market_type: string;
  status: 'completed' | 'running' | 'failed';
  start_time: string;
  end_time: string | null;
  decision_report: string;
  trades_executed: Trade[];
  positions_analyzed: string[];
}

interface Trade {
  stock_code: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  reason?: string;
}
```

## 技术实现

### 状态管理
```typescript
const [selectedDecision, setSelectedDecision] = useState<any>(null);
const [isDecisionDetailOpen, setIsDecisionDetailOpen] = useState(false);
```

### 数据过滤
使用`React.useMemo`优化性能，只在依赖变化时重新计算：
```typescript
const positions = React.useMemo(() => {
  if (!allPositions) return [];
  return allPositions.filter((p: any) => p.market_type === market);
}, [allPositions, market]);
```

### 动画效果
使用Tailwind CSS的transition和transform：
```tsx
className={`transform transition-all duration-300 ${
  isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
}`}
```

## 相关文件

- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 用户详情面板组件
- `web/frontend/src/app/leaderboard/page.tsx` - 排行榜主页面
- `web/backend/routes/public_leaderboard_routes.py` - 后端API

## 后续优化建议

1. **分页加载** - 如果决策记录很多，可以添加分页
2. **搜索过滤** - 添加搜索框，按股票代码或日期过滤
3. **导出功能** - 允许导出决策报告为PDF或Markdown
4. **图表展示** - 添加交易历史图表，可视化盈亏变化
5. **实时更新** - 通过WebSocket实时更新运行中的决策状态
