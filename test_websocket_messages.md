# WebSocket 消息发送测试指南

## 问题描述
智能盯盘页面在开始分析时，没有发送 WebSocket 消息，导致前端无法显示"运行中"状态的卡片。

具体问题：
1. 调度器每次循环触发分析时，没有通知前端
2. `execute_intraday_analysis` 发送的 `intraday_session_start` 消息可能因为事件循环问题无法送达
3. 前端在没有初始决策列表时，无法创建运行中的卡片

## 修复内容

### 1. 调度器修复 (web/backend/services/intraday_scheduler.py)

#### 新增：分析触发通知
在 `_trigger_analysis` 方法中添加了 WebSocket 通知：

```python
# 发送分析触发通知
await ws_manager.send_message({
    'type': 'analysis_trigger',
    'timestamp': datetime.utcnow().isoformat(),
    'message': f'开始 {market} 市场分析...',
    'market_type': market,
}, channel_id)
```

这样每次调度器触发分析时，前端都会收到通知。

### 2. 后端修复 (web/backend/services/intraday_executor.py)

#### 修复点 1: 添加 decision_id 到 session_start 消息
- **问题**: 原来的 `intraday_session_start` 消息缺少 `decision_id`、`session_id` 和 `market_type` 字段
- **修复**: 将消息发送移到创建决策记录之后，并包含所有必要字段

```python
# 修复后的代码
await ws_manager.send_message({
    'type': 'intraday_session_start',
    'timestamp': datetime.utcnow().isoformat(),
    'message': 'Intraday session started',
    'decision_id': decision_record.id,      # ✅ 新增
    'session_id': session_id,                # ✅ 新增
    'market_type': market_type,              # ✅ 新增
}, channel_id)
```

#### 修复点 2: 使用 await 而不是 create_task
- **问题**: 使用 `asyncio.create_task()` 可能导致消息不会立即发送
- **修复**: 改用 `await` 确保消息被发送

```python
# 修复前
asyncio.create_task(ws_manager.send_message(...))

# 修复后
await ws_manager.send_message(...)
```

#### 修复点 3: 添加详细日志
- 添加了 emoji 标记的日志，便于追踪消息发送状态
- ✅ 成功发送
- ❌ 发送失败

### 2. WebSocket 管理器增强 (web/backend/app.py)

添加了详细的调试日志：
- 显示发送的消息类型
- 显示连接数量
- 显示目标 channel
- 当没有活动连接时发出警告

### 3. 前端逻辑修复 (web/frontend/src/app/intraday-trading/page.tsx)

#### 修复点 1: 处理空决策列表
修复了当 `currentDecisions` 为 `undefined` 时无法创建运行中卡片的问题：

```typescript
if (currentDecisions) {
  // 更新现有列表
} else {
  // 创建新列表，包含运行中的决策
  queryClient.setQueryData(
    intradayTradingKeys.decisionsList(1, 20),
    {
      items: [runningDecision],
      total: 1,
      page: 1,
      limit: 20,
    }
  );
}
```

#### 修复点 2: 添加调试日志
添加了详细的控制台日志，便于追踪消息接收和处理：
- `📥 Received intraday_session_start`
- `✅ Updated decisions list with running decision`
- `⚠️ Received intraday_session_start without decision_id`

#### 修复点 3: 处理 analysis_trigger 消息
添加了对调度器触发消息的处理（可选显示通知）。

### 4. 前端样式修复 (web/frontend/src/components/intraday/DecisionHistory.tsx)

修复了状态徽章在深色主题下不明显的问题：

```typescript
// 修复前
running: { color: 'bg-blue-100 text-blue-800', ... }

// 修复后
running: { color: 'bg-blue-500/20 text-blue-400 border border-blue-500/50', ... }
```

## 测试步骤

### 1. 启动后端服务
```bash
cd web/backend
python app_v2.py
```

### 2. 启动前端服务
```bash
cd web/frontend
npm run dev
```

### 3. 测试流程

1. **登录系统**
   - 使用有智能盯盘权限的账号登录

2. **打开智能盯盘页面**
   - 导航到 `/intraday-trading`
   - 检查 WebSocket 连接状态（右上角应显示"实时连接"）

3. **启动分析**
   - 在控制面板中点击"启动系统"
   - 或者手动触发一次分析

4. **观察日志**

   **后端日志应显示**:
   ```
   🚀 Triggering intraday trading analysis for US market (user 1)...
   📤 Sent analysis_trigger notification for US market
   📤 Sending message type 'analysis_trigger' to 1 connection(s) on channel 'intraday_user_1'
   
   Starting intraday analysis: session=intraday_20231112_143022_abc123, market=US, user=1
   ✅ Sent intraday_session_start WebSocket message: decision_id=123, channel=intraday_user_1
   📤 Sending message type 'intraday_session_start' to 1 connection(s) on channel 'intraday_user_1'
   ```

   **前端控制台应显示**:
   ```
   📥 Analysis triggered: US
   📥 Received intraday_session_start: {decision_id: 123, session_id: "...", market_type: "US"}
   ✅ Updated decisions list with running decision: {id: 123, status: "running", ...}
   ```
   或者（如果是第一次）：
   ```
   ✅ Created new decisions list with running decision: {id: 123, status: "running", ...}
   ```

5. **检查决策历史**
   - 在"决策历史"部分应该看到一个新的卡片
   - 卡片状态显示为"运行中"（蓝色徽章，旋转图标）
   - 卡片应该在列表顶部

6. **等待分析完成**
   - 分析完成后，卡片状态应更新为"已完成"（绿色徽章）
   - 显示执行的交易数量

## 常见问题排查

### 问题 1: 没有看到"运行中"卡片

**检查项**:
1. WebSocket 是否连接成功？
   - 查看页面右上角的连接状态
   - 应显示"实时连接"（绿色）

2. 后端是否发送了消息？
   - 查看后端日志，搜索 "Sent intraday_session_start"
   - 应该看到 ✅ 标记

3. 消息是否包含 decision_id？
   - 查看后端日志中的 decision_id 值
   - 查看前端控制台接收到的消息

4. channel_id 是否正确？
   - 后端应使用 `intraday_user_{user_id}`
   - 前端 WebSocket 连接应使用相同的 channel

### 问题 2: WebSocket 连接失败

**检查项**:
1. 是否已登录？
2. Token 是否有效？
3. 用户是否有智能盯盘权限？
4. 后端 WebSocket 路由是否正常？

### 问题 3: 消息发送但前端没收到

**检查项**:
1. 查看后端日志中的连接数量
   - 应该显示 "Sending message to X connection(s)"
   - 如果是 0，说明没有活动连接

2. 检查 channel_id 是否匹配
   - 后端: `intraday_user_{user_id}`
   - 前端: 应该连接到 `/ws/intraday/{user_id}`

## 预期结果

✅ 启动分析后，立即在决策历史中看到"运行中"卡片
✅ 卡片显示蓝色徽章和旋转图标
✅ 分析完成后，卡片更新为"已完成"状态
✅ 后端日志显示消息发送成功
✅ 前端控制台显示接收到消息

## 消息流程图

```
调度器循环触发
    ↓
[1] 发送 analysis_trigger 消息
    ↓
调用 execute_intraday_analysis
    ↓
创建决策记录 (status='running')
    ↓
[2] 发送 intraday_session_start 消息 (包含 decision_id)
    ↓
前端接收消息
    ↓
创建/更新运行中的卡片
    ↓
Agent 执行分析
    ↓
[3] 发送 intraday_session_complete 消息
    ↓
前端更新卡片为"已完成"状态
```

## 关键点

1. **两个通知点**：
   - `analysis_trigger`: 调度器触发分析时（可选）
   - `intraday_session_start`: 创建决策记录后（必须）

2. **channel_id 必须匹配**：
   - 后端: `intraday_user_{user_id}`
   - 前端: 连接到 `/ws/intraday/{user_id}`

3. **事件循环处理**：
   - `execute_intraday_analysis` 在新的事件循环中运行
   - 使用 `await` 确保消息发送完成

4. **前端容错**：
   - 即使没有初始决策列表，也能创建运行中的卡片
   - 添加了详细的日志便于调试

## 相关文件

- `web/backend/services/intraday_scheduler.py` - 调度器（新增触发通知）
- `web/backend/services/intraday_executor.py` - 分析执行器（修复消息发送）
- `web/backend/app.py` - WebSocket 管理器（增强日志）
- `web/frontend/src/app/intraday-trading/page.tsx` - 智能盯盘页面（修复空列表处理）
- `web/frontend/src/components/intraday/DecisionHistory.tsx` - 决策历史组件（修复样式）
- `web/frontend/src/hooks/useIntradayWebSocket.ts` - WebSocket Hook
