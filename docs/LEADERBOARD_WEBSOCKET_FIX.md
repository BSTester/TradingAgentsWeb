# 排行榜WebSocket连接错误修复

## 问题描述

从实时排名页面切换到其他页面再重新进入时，会报WebSocket连接错误：

```
❌ Leaderboard WebSocket error: {}
```

## 问题原因

1. **旧连接未正确清理**：页面切换时，旧的WebSocket连接没有完全关闭，导致重新进入时出现冲突
2. **事件监听器冲突**：旧连接的 `onerror` 和 `onclose` 事件仍然会触发，导致错误日志
3. **状态不一致**：多个WebSocket实例同时存在，导致状态管理混乱

## 修复方案

### 1. 连接前清理旧连接

**文件**：`web/frontend/src/hooks/useLeaderboardWebSocket.ts`

在创建新连接前，先检查并关闭任何现有连接：

```typescript
const connect = useCallback(() => {
  // Clean up existing connection first
  if (wsRef.current) {
    if (wsRef.current.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket already connected')
      return
    }
    
    // Close any existing connection that's not open
    try {
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close()
      }
    } catch (err) {
      console.warn('⚠️ Error closing existing WebSocket:', err)
    }
    wsRef.current = null
  }
  
  // ... create new connection
}, [])
```

### 2. 防止旧连接事件触发

在 `onclose` 和 `onerror` 事件处理器中，检查事件是否来自当前连接：

```typescript
ws.onclose = (event) => {
  // Only process close event if this is still the current WebSocket
  if (wsRef.current === ws) {
    // ... handle close event
  } else {
    console.log('⚠️ Ignoring close event from old WebSocket connection')
  }
}

ws.onerror = (error) => {
  // Only log error if this is still the current WebSocket
  if (wsRef.current === ws) {
    // ... handle error
  } else {
    console.log('⚠️ Ignoring error from old WebSocket connection')
  }
}
```

### 3. 改进disconnect函数

添加更完善的清理逻辑和错误处理：

```typescript
const disconnect = useCallback(() => {
  console.log('🔌 Disconnecting leaderboard WebSocket...')
  
  // Clear all timers
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current)
    reconnectTimeoutRef.current = null
  }

  if (heartbeatIntervalRef.current) {
    clearInterval(heartbeatIntervalRef.current)
    heartbeatIntervalRef.current = null
  }

  if (updateRequestIntervalRef.current) {
    clearInterval(updateRequestIntervalRef.current)
    updateRequestIntervalRef.current = null
  }

  // Close WebSocket connection
  if (wsRef.current) {
    try {
      // Only close if not already closed
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close(1000, 'Manual disconnect')
      }
    } catch (err) {
      console.warn('⚠️ Error closing WebSocket:', err)
    }
    wsRef.current = null
  }

  setIsConnected(false)
  setError(null)
  reconnectCountRef.current = 0
  
  console.log('✅ Leaderboard WebSocket disconnected')
}, [])
```

## 修复效果

1. **无错误日志**：页面切换时不再出现WebSocket错误
2. **干净的连接**：每次进入页面都是全新的连接
3. **正确的状态**：连接状态准确反映实际情况
4. **资源释放**：所有定时器和连接都被正确清理

## 测试步骤

1. **进入排行榜页面**
   - 检查控制台：应该看到 `✅ Leaderboard WebSocket connected successfully`
   - 检查连接状态：页面右上角应该显示绿色圆点

2. **切换到其他页面**
   - 检查控制台：应该看到 `🔌 Disconnecting leaderboard WebSocket...`
   - 检查控制台：应该看到 `✅ Leaderboard WebSocket disconnected`

3. **重新进入排行榜页面**
   - 检查控制台：应该看到新的连接日志
   - 不应该看到任何错误日志
   - 数据应该正常加载

4. **多次切换**
   - 重复步骤2-3多次
   - 确认每次都能正常连接，没有错误

## 相关文件

- `web/frontend/src/hooks/useLeaderboardWebSocket.ts` - WebSocket hook实现
- `web/frontend/src/app/leaderboard/page.tsx` - 排行榜页面
- `web/backend/routes/websocket_routes.py` - 后端WebSocket路由

## 技术要点

### WebSocket生命周期管理

1. **连接前检查**：确保没有现有连接
2. **事件过滤**：只处理当前连接的事件
3. **完整清理**：关闭连接、清除定时器、重置状态
4. **错误处理**：捕获并记录所有可能的错误

### React Hook最佳实践

1. **useCallback**：避免不必要的重新创建函数
2. **useEffect cleanup**：组件卸载时自动清理
3. **useRef**：保持WebSocket实例的引用
4. **状态管理**：使用useState管理连接状态

### 调试技巧

1. **详细日志**：每个关键步骤都有日志输出
2. **状态标识**：使用emoji图标区分不同类型的日志
3. **错误上下文**：错误日志包含完整的上下文信息
4. **条件日志**：区分正常操作和异常情况

## 未来改进

1. **连接池**：考虑实现WebSocket连接池，复用连接
2. **自动重连策略**：根据网络状况动态调整重连间隔
3. **心跳优化**：根据服务器响应调整心跳频率
4. **性能监控**：添加连接质量和延迟监控
