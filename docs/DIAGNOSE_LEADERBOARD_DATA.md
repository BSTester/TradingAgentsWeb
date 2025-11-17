# 排行榜数据诊断指南

## 问题：港股和A股数据不显示

### 诊断步骤

#### 1. 检查后端数据

运行测试脚本：
```bash
python test_leaderboard_data.py
```

**预期输出：**
```
📊 Total users: 3

📈 Markets breakdown:
  CN: 1 users
    - admin: $957,414.56
  HK: 1 users
    - admin: $941,507.41
  US: 1 users
    - admin: $98,204.46
```

如果后端数据正确，继续下一步。

#### 2. 检查浏览器控制台

打开浏览器开发者工具（F12），查看Console标签。

**应该看到：**
```
🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
✅ Leaderboard WebSocket connected successfully
📤 Requesting initial leaderboard data...
📊 Received initial data: 3 users
📊 Leaderboard data: {
  totalUsers: 3,
  selectedMarket: "US",
  users: [
    { id: 1, market: "CN", assets: 957414.555 },
    { id: 1, market: "HK", assets: 941507.406 },
    { id: 1, market: "US", assets: 98204.455 }
  ]
}
```

**如果看到 `totalUsers: 0`：**
- WebSocket没有接收到数据
- 检查WebSocket连接状态
- 查看是否有错误信息

**如果看到 `totalUsers: 3` 但某个市场没有数据：**
- 数据接收正确
- 问题在前端过滤或显示逻辑

#### 3. 检查市场切换

在页面上：
1. 点击"美股"按钮
2. 查看控制台输出
3. 点击"港股"按钮
4. 查看控制台输出
5. 点击"A股"按钮
6. 查看控制台输出

每次切换都应该看到新的日志：
```
📊 Leaderboard data: {
  totalUsers: 3,
  selectedMarket: "HK",  // 应该变化
  users: [...]
}
```

#### 4. 检查过滤结果

在控制台中手动测试过滤：
```javascript
// 在浏览器控制台中执行
const users = [
  { user_id: 1, market_type: "CN", total_assets: 957414.555 },
  { user_id: 1, market_type: "HK", total_assets: 941507.406 },
  { user_id: 1, market_type: "US", total_assets: 98204.455 }
];

// 测试过滤
console.log('US:', users.filter(u => u.market_type === 'US'));
console.log('HK:', users.filter(u => u.market_type === 'HK'));
console.log('CN:', users.filter(u => u.market_type === 'CN'));
```

### 常见问题和解决方案

#### 问题1: WebSocket未连接

**症状：**
- 控制台显示连接错误
- `totalUsers: 0`
- 状态指示灯显示红色

**解决：**
1. 检查后端是否运行
2. 清除浏览器缓存
3. 硬刷新页面（Ctrl+Shift+R）

#### 问题2: 数据接收但不显示

**症状：**
- 控制台显示 `totalUsers: 3`
- 但页面显示"暂无参与排名的用户"

**可能原因：**
1. 过滤逻辑错误
2. 市场类型不匹配
3. 组件渲染问题

**解决：**
```javascript
// 在控制台检查数据
console.log('All users:', users);
console.log('Selected market:', selectedMarket);
console.log('Filtered users:', users.filter(u => u.market_type === selectedMarket));
```

#### 问题3: 只有美股有数据

**症状：**
- 美股显示正常
- 港股和A股显示"暂无参与排名的用户"

**可能原因：**
1. 后端只返回了美股数据
2. 市场类型字符串不匹配（大小写、空格等）

**检查：**
```javascript
// 检查市场类型的确切值
users.forEach(u => {
  console.log(`Market: "${u.market_type}" (length: ${u.market_type.length})`);
});
```

#### 问题4: 数据延迟

**症状：**
- 刷新页面后需要等待才能看到数据
- 切换市场时有延迟

**正常行为：**
- WebSocket连接需要1-2秒
- 数据接收需要几百毫秒
- 这是正常的

**如果延迟超过5秒：**
- 检查网络连接
- 检查后端性能
- 查看是否有大量数据

### 调试代码

临时添加更多调试信息：

```typescript
// 在 web/frontend/src/app/leaderboard/page.tsx 中

// 1. 查看原始数据
useEffect(() => {
  console.log('🔍 Raw users data:', users);
}, [users]);

// 2. 查看过滤后的数据
useEffect(() => {
  const filtered = users.filter(u => u.market_type === selectedMarket);
  console.log(`🔍 Filtered for ${selectedMarket}:`, filtered);
}, [users, selectedMarket]);

// 3. 查看top10数据
useEffect(() => {
  console.log('🔍 Top 10 users:', top10Users);
}, [top10Users]);
```

### 数据流追踪

```
后端 → WebSocket → 前端Hook → 页面组件 → 过滤 → 显示

1. 后端发送:
   [
     { user_id: 1, market_type: "CN", ... },
     { user_id: 1, market_type: "HK", ... },
     { user_id: 1, market_type: "US", ... }
   ]

2. WebSocket接收:
   setUsers([...]) // 设置到状态

3. 页面组件:
   const filteredUsers = users.filter(u => u.market_type === selectedMarket)

4. 显示:
   {filteredUsers.length === 0 ? "暂无数据" : <显示列表>}
```

### 验证清单

- [ ] 后端测试脚本返回3个市场的数据
- [ ] 浏览器控制台显示"Received initial data: 3 users"
- [ ] 控制台显示"totalUsers: 3"
- [ ] 控制台显示所有3个市场的用户数据
- [ ] 切换市场时控制台输出变化
- [ ] 页面显示对应市场的数据
- [ ] 趋势图显示对应市场的曲线

### 快速修复

如果以上都检查过了还是不行：

```bash
# 1. 完全重启
# 停止所有服务（Ctrl+C）

# 2. 清理前端缓存
cd web/frontend
rm -rf .next
rm -rf node_modules/.cache

# 3. 重启后端
cd ../backend
python app.py

# 4. 重启前端（新终端）
cd ../frontend
npm run dev

# 5. 清除浏览器所有缓存
# Chrome: Ctrl+Shift+Delete → 选择"所有时间" → 清除

# 6. 硬刷新页面
# Ctrl+Shift+R
```

### 获取帮助

如果问题仍然存在，收集以下信息：

1. **后端测试输出：**
   ```bash
   python test_leaderboard_data.py > backend_test.txt
   ```

2. **浏览器控制台日志：**
   - 右键点击控制台
   - 选择"Save as..."
   - 保存为 console.log

3. **Network标签：**
   - 筛选WS
   - 截图WebSocket连接
   - 查看消息内容

4. **页面截图：**
   - 美股页面
   - 港股页面
   - A股页面

有了这些信息，可以更容易定位问题。
