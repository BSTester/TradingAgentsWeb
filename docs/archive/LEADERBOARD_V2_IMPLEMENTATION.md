# 实时排名页面 V2 实现说明

## 📋 需求概述

按照智能盯盘页面的逻辑重新实现实时排名页面，主要特性：

1. ✅ **市场选择功能** - 支持US/HK/CN市场切换
2. ✅ **休市提示** - 市场休市时显示提示信息
3. ✅ **前10名趋势图** - 只显示资产排名前10的用户
4. ✅ **全屏趋势图** - 趋势图铺满页面宽度
5. ✅ **排名列表** - 显示所有参与排名的用户
6. ✅ **侧边栏详情** - 点击用户或折线时右侧滑出详情面板
7. ✅ **持仓信息** - 显示用户的持仓详情
8. ✅ **决策记录** - 显示用户的决策历史

## 🎨 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  导航栏                                                          │
├─────────────────────────────────────────────────────────────────┤
│  实时排名                                                        │
│  [美股] [港股] [A股]                          [实时连接]        │
│  ⚠️ 美股市场已休市（交易时间：9:30-16:00 EST）                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────┐  ┌──────────────────────┐  │
│  │                                 │  │  排名列表 (N)        │  │
│  │  资产趋势图 - 前10名            │  │  ┌────────────────┐  │  │
│  │  (Canvas全屏显示)               │  │  │ 🥇 1. 用户1    │  │  │
│  │                                 │  │  │    $120,000    │  │  │
│  │  - 多条彩色曲线                 │  │  └────────────────┘  │  │
│  │  - 图例显示用户名               │  │  ┌────────────────┐  │  │
│  │  - 可点击选择用户               │  │  │ 🥈 2. 用户2    │  │  │
│  │                                 │  │  │    $115,000    │  │  │
│  │                                 │  │  └────────────────┘  │  │
│  │                                 │  │  ...                 │  │
│  └────────────────────────────────┘  └──────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

[点击用户后，右侧滑出详情面板]

┌─────────────────────────────────────────────────────────────────┐
│  [趋势图和列表]                    │ ┌─────────────────────┐  │
│                                     │ │  用户详情 [X]       │  │
│                                     │ ├─────────────────────┤  │
│                                     │ │ [持仓] [决策记录]   │  │
│                                     │ ├─────────────────────┤  │
│                                     │ │  持仓列表           │  │
│                                     │ │  - 股票代码         │  │
│                                     │ │  - 数量/价格        │  │
│                                     │ │  - 盈亏             │  │
│                                     │ └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 核心功能实现

### 1. 市场选择

**实现位置**: `web/frontend/src/app/leaderboard/page.tsx`

```typescript
// 状态管理
const [selectedMarket, setSelectedMarket] = useState<string>(() => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('leaderboard_selected_market') || 'US';
  }
  return 'US';
});

// 市场切换
const handleMarketChange = useCallback((market: string) => {
  setSelectedMarket(market);
  localStorage.setItem('leaderboard_selected_market', market);
}, []);

// UI渲染
{['US', 'HK', 'CN'].map((market) => (
  <button
    key={market}
    onClick={() => handleMarketChange(market)}
    className={selectedMarket === market ? 'active' : ''}
  >
    {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'}
  </button>
))}
```

### 2. 休市提示

**实现逻辑**:
```typescript
useEffect(() => {
  const checkMarketStatus = () => {
    const now = new Date();
    const day = now.getDay(); // 0-6 (周日-周六)
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;

    let isOpen = false;
    let message = '';

    if (selectedMarket === 'US') {
      // 美股：周一到周五，9:30-16:00
      if (day >= 1 && day <= 5 && time >= 570 && time < 960) {
        isOpen = true;
      } else {
        message = '美股市场已休市（交易时间：9:30-16:00 EST）';
      }
    }
    // ... HK和CN的逻辑类似
    
    setMarketStatus({ isOpen, message });
  };

  checkMarketStatus();
  const interval = setInterval(checkMarketStatus, 60000);
  return () => clearInterval(interval);
}, [selectedMarket]);
```

**交易时间**:
- **美股**: 周一至周五 9:30-16:00 (EST)
- **港股**: 周一至周五 9:30-12:00, 13:00-16:00 (HKT)
- **A股**: 周一至周五 9:30-11:30, 13:00-15:00 (CST)

### 3. 前10名趋势图

**数据过滤**:
```typescript
// 过滤选定市场的用户
const filteredUsers = users.filter(u => u.market_type === selectedMarket);

// 按资产排序并取前10名
const top10Users = [...filteredUsers]
  .sort((a, b) => b.total_assets - a.total_assets)
  .slice(0, 10);
```

**图表组件**: `LeaderboardTrendChart`
- 接收前10名用户数据
- 接收所有用户数据（用于排名列表）
- 自动获取每个用户的30天趋势
- Canvas绘制多条曲线
- 支持点击和悬停交互

### 4. 全屏趋势图

**布局实现**:
```typescript
<div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
  {/* 趋势图 - flex-1 自动占满剩余空间 */}
  <div className="flex-1 bg-dark-secondary rounded-lg border border-dark-border p-4">
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ minHeight: '500px' }}
    />
  </div>

  {/* 排名列表 - 固定宽度 */}
  <div className="w-full lg:w-80 bg-dark-secondary rounded-lg border border-dark-border p-4">
    {/* 用户列表 */}
  </div>
</div>
```

### 5. 侧边栏详情面板

**组件**: `UserDetailPanel`

**特性**:
- 从右侧滑入/滑出
- 遮罩层背景
- 标签页切换（持仓/决策）
- 响应式设计

**实现**:
```typescript
<div className={`fixed right-0 top-0 bottom-0 w-full md:w-[600px] 
  bg-dark-secondary border-l border-dark-border z-50 
  transform transition-transform duration-300 
  ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
  {/* 内容 */}
</div>
```

### 6. 排名列表

**特性**:
- 显示所有参与排名的用户
- 按资产降序排列
- 前三名特殊标识（🥇🥈🥉）
- 点击查看详情
- 鼠标悬停高亮

**实现**:
```typescript
{allUsers
  .sort((a, b) => b.total_assets - a.total_assets)
  .map((user, index) => (
    <button
      key={user.user_id}
      onClick={() => onUserSelect(user.user_id, user.username)}
      onMouseEnter={() => setHoveredUser(user.user_id)}
      onMouseLeave={() => setHoveredUser(null)}
    >
      {/* 排名徽章 */}
      <div className={`w-8 h-8 rounded-full ${
        index === 0 ? 'bg-yellow-500' :  // 金牌
        index === 1 ? 'bg-gray-400' :    // 银牌
        index === 2 ? 'bg-orange-600' :  // 铜牌
        'bg-dark-primary'
      }`}>
        {index + 1}
      </div>
      {/* 用户信息和资产 */}
    </button>
  ))}
```

## 📡 后端API更新

### 1. 支持市场过滤

**文件**: `web/backend/routes/public_leaderboard_routes.py`

**修改**:
```python
@router.get("/users")
async def get_leaderboard_users(
    market: str = None,  # ✅ 新增参数
    db: AsyncSession = Depends(get_db)
):
    """获取所有参加排名的用户列表"""
    query = select(...).where(User.participate_in_leaderboard == True)
    
    # ✅ 如果指定了市场，添加过滤条件
    if market:
        query = query.where(AccountSnapshot.market_type == market)
    
    # ...
```

**使用方式**:
```
GET /api/public/leaderboard/users          # 所有市场
GET /api/public/leaderboard/users?market=US  # 只返回美股
GET /api/public/leaderboard/users?market=HK  # 只返回港股
GET /api/public/leaderboard/users?market=CN  # 只返回A股
```

## 🎯 交互流程

### 用户选择流程
```
1. 用户点击排名列表中的某个用户
   或点击趋势图中的折线
   ↓
2. 调用 onUserSelect(userId, username)
   ↓
3. 设置 selectedUserId 和 selectedUsername
   ↓
4. 设置 isPanelOpen = true
   ↓
5. 侧边栏从右侧滑入
   ↓
6. 自动加载用户的持仓和决策数据
   ↓
7. 显示详细信息
```

### 关闭面板流程
```
1. 用户点击关闭按钮或遮罩层
   ↓
2. 调用 handleClosePanel()
   ↓
3. 设置 isPanelOpen = false
   ↓
4. 侧边栏滑出（300ms动画）
   ↓
5. 动画结束后清除 selectedUserId
```

## 📊 数据流

### 实时数据更新
```
WebSocket连接
    ↓
每分钟接收更新
    ↓
更新 users 列表
    ↓
过滤选定市场的用户
    ↓
排序并取前10名
    ↓
传递给趋势图组件
    ↓
自动重新绘制
```

### 用户详情加载
```
用户点击
    ↓
设置 selectedUserId
    ↓
React Query 自动触发
    ↓
并行请求:
  - /api/public/leaderboard/user/{id}/positions
  - /api/public/leaderboard/user/{id}/decisions
    ↓
数据返回后显示在面板中
```

## 🎨 UI/UX特性

### 视觉设计
- ✅ 深色主题配色
- ✅ 渐变色按钮和高亮
- ✅ 平滑的动画过渡
- ✅ 清晰的视觉层次

### 交互反馈
- ✅ 鼠标悬停高亮
- ✅ 点击选中效果
- ✅ 加载状态显示
- ✅ 错误提示友好

### 响应式设计
- ✅ 桌面端：趋势图+列表并排
- ✅ 移动端：趋势图和列表堆叠
- ✅ 侧边栏：桌面600px，移动全屏

## 🔧 技术实现

### 组件结构
```
leaderboard/page.tsx (主页面)
├── LeaderboardTrendChart (趋势图+列表)
│   ├── Canvas绘图
│   └── 排名列表
└── UserDetailPanel (侧边栏)
    ├── 持仓信息标签
    └── 决策记录标签
```

### 状态管理
```typescript
// 市场选择
const [selectedMarket, setSelectedMarket] = useState('US');

// 用户选择
const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
const [selectedUsername, setSelectedUsername] = useState('');
const [isPanelOpen, setIsPanelOpen] = useState(false);

// 市场状态
const [marketStatus, setMarketStatus] = useState({
  isOpen: boolean,
  message: string
});
```

### 数据获取
```typescript
// WebSocket实时数据
const { users, isConnected, lastUpdate } = useLeaderboardWebSocket({
  token: user?.token,
  market: selectedMarket  // 可选的市场过滤
});

// 用户趋势数据
const { data: allTrendsData } = useQuery({
  queryKey: ['leaderboard-trends', userIds, market],
  queryFn: async () => {
    // 并行获取所有用户的趋势数据
  }
});

// 用户详情数据
const { data: positions } = useQuery({
  queryKey: ['user-positions', userId, market],
  enabled: !!userId && isOpen
});
```

## 📈 性能优化

### 已实现的优化
1. **数据缓存**: React Query 60秒缓存
2. **按需加载**: 只在面板打开时加载详情
3. **Canvas绘图**: 比DOM操作性能更好
4. **WebSocket推送**: 减少HTTP请求
5. **市场过滤**: 只显示相关市场数据

### 渲染优化
- 使用 `useCallback` 避免不必要的重渲染
- 使用 `useMemo` 缓存计算结果
- Canvas 只在数据变化时重绘
- 列表使用虚拟滚动（如果用户很多）

## 🔐 安全考虑

### 数据访问
- ✅ 公开API无需鉴权（设计如此）
- ✅ 只显示参与排名的用户
- ✅ 用户可随时退出排名

### 隐私保护
- ✅ 默认不参与排名
- ✅ 用户主动开启
- ✅ 只显示公开数据

## 📝 文件清单

### 新建文件
- `web/frontend/src/app/leaderboard/page.tsx` - 主页面（重写）
- `web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx` - 趋势图组件（新建）
- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 详情面板（新建）

### 修改文件
- `web/backend/routes/public_leaderboard_routes.py` - 添加市场过滤参数
- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - 添加市场参数

### 保留文件
- `web/frontend/src/components/leaderboard/UserPositionsPanel.tsx` - 可能不再使用
- `web/frontend/src/components/leaderboard/DecisionHistoryPanel.tsx` - 可能不再使用
- `web/frontend/src/components/leaderboard/LeaderboardChart.tsx` - 已被新组件替代

## ✅ 功能清单

### 核心功能
- ✅ 市场选择（US/HK/CN）
- ✅ 休市状态检测和提示
- ✅ 前10名用户趋势图
- ✅ 全屏宽度显示
- ✅ 所有用户排名列表
- ✅ 点击用户查看详情
- ✅ 侧边栏滑出动画
- ✅ 持仓信息展示
- ✅ 决策记录展示

### 交互功能
- ✅ 鼠标悬停高亮
- ✅ 点击选中用户
- ✅ 点击折线选中用户
- ✅ 关闭详情面板
- ✅ 标签页切换

### 实时功能
- ✅ WebSocket实时推送
- ✅ 每分钟自动更新
- ✅ HTTP轮询降级
- ✅ 连接状态显示

## 🧪 测试建议

### 功能测试
1. ✅ 切换市场，验证数据过滤
2. ✅ 检查休市提示是否正确
3. ✅ 验证前10名排序正确
4. ✅ 点击用户，验证详情显示
5. ✅ 切换标签页，验证数据加载
6. ✅ 关闭面板，验证动画流畅

### 边界测试
1. 没有参与排名的用户
2. 某个市场没有用户
3. 用户没有持仓数据
4. 用户没有决策记录
5. WebSocket连接失败
6. API请求失败

### 性能测试
1. 100个用户的渲染性能
2. 趋势图绘制性能
3. 频繁切换市场的性能
4. 内存泄漏检查

## 🚀 部署步骤

### 1. 更新代码
```bash
# 代码已更新，无需额外操作
```

### 2. 重启服务
```bash
# 重启后端
# Ctrl+C 停止，然后重新运行
python web/backend/app.py

# 重启前端（如果需要）
cd web/frontend
npm run dev
```

### 3. 测试功能
1. 访问 http://localhost:3000/leaderboard
2. 切换市场
3. 查看趋势图
4. 点击用户查看详情

## 📚 相关文档

- [LEADERBOARD_README.md](LEADERBOARD_README.md) - 文档索引
- [LEADERBOARD_DEPLOYMENT_GUIDE.md](LEADERBOARD_DEPLOYMENT_GUIDE.md) - 部署指南
- [实时排名功能完成报告.md](实时排名功能完成报告.md) - 完整报告

## ✨ 改进亮点

### 相比V1版本
1. ✅ **市场选择** - V1没有，V2新增
2. ✅ **休市提示** - V1没有，V2新增
3. ✅ **前10名过滤** - V1显示所有，V2只显示前10
4. ✅ **全屏趋势图** - V1较小，V2铺满屏幕
5. ✅ **侧边栏面板** - V1在下方，V2右侧滑出
6. ✅ **排名徽章** - V1没有，V2有金银铜牌
7. ✅ **更好的布局** - V2更符合用户习惯

### 用户体验提升
- ✅ 更直观的市场切换
- ✅ 更清晰的休市提示
- ✅ 更大的趋