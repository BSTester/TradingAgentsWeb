# 服务重启指南

## 何时需要重启

### 后端需要重启
- 修改了Python代码
- 修改了数据库模型
- 修改了API路由
- 修改了WebSocket逻辑

### 前端需要重启
- 修改了TypeScript/React代码
- 修改了环境变量
- 清除了缓存

### 浏览器需要刷新
- 前端代码更新后
- WebSocket连接异常
- 页面显示异常

## 完整重启流程

### 1. 停止所有服务

```bash
# 在运行后端的终端按 Ctrl+C
# 在运行前端的终端按 Ctrl+C
```

### 2. 重启后端

```bash
cd web/backend
python app.py
```

**等待看到：**
```
✅ Database tables initialized successfully
✅ Scheduler service started
✅ Leaderboard real-time update task started
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. 重启前端

```bash
cd web/frontend
npm run dev
```

**等待看到：**
```
✓ Ready in 2.5s
○ Local:   http://localhost:3000
```

### 4. 清除浏览器缓存

**方法1：硬刷新**
```
Ctrl + Shift + R
或
Ctrl + F5
```

**方法2：清除缓存**
1. 按 `Ctrl + Shift + Delete`
2. 选择"缓存的图像和文件"
3. 时间范围选择"所有时间"
4. 点击"清除数据"

### 5. 验证服务

**测试后端WebSocket：**
```bash
python test_ws_connection.py
```

**预期输出：**
```
✅ Connected successfully!
📨 Received: initial_data
👥 Users count: 3
✅ All tests passed!
```

**测试持仓API：**
```bash
curl http://localhost:8000/api/public/leaderboard/user/1/positions
```

**预期：** 返回JSON数据，不是500错误

**测试前端：**
1. 打开 http://localhost:3000/leaderboard
2. 打开浏览器开发者工具（F12）
3. 查看Console标签
4. 应该看到：
   ```
   🔌 Connecting to WebSocket: ws://localhost:8000/ws/leaderboard
   ✅ Leaderboard WebSocket connected successfully
   📊 Received initial data: 3 users
   ```

## 常见问题

### 问题1: 后端启动失败

**症状：**
```
Address already in use
```

**解决：**
```powershell
# 查找占用8000端口的进程
Get-NetTCPConnection -LocalPort 8000 | Select-Object OwningProcess

# 终止进程
Stop-Process -Id <PID> -Force
```

### 问题2: 前端启动失败

**症状：**
```
Port 3000 is already in use
```

**解决：**
```powershell
# 查找占用3000端口的进程
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess

# 终止进程
Stop-Process -Id <PID> -Force
```

### 问题3: WebSocket连接失败

**症状：**
```
❌ Leaderboard WebSocket error: {}
```

**解决：**
1. 确认后端正在运行
2. 测试WebSocket：`python test_ws_connection.py`
3. 清除浏览器缓存
4. 硬刷新页面（Ctrl+Shift+R）

### 问题4: 持仓数据不显示

**症状：**
- 页面显示"暂无持仓数据"
- 或者API返回500错误

**解决：**
1. 重启后端（应用最新代码）
2. 测试API：`curl http://localhost:8000/api/public/leaderboard/user/1/positions`
3. 查看后端控制台是否有错误

### 问题5: 修改代码后没有效果

**原因：** 服务没有重启或浏览器缓存

**解决：**
1. 重启后端服务
2. 重启前端服务（如果修改了前端）
3. 清除浏览器缓存
4. 硬刷新页面

## 快速重启脚本

### Windows PowerShell

创建 `restart.ps1`：
```powershell
# 停止服务
Write-Host "停止服务..." -ForegroundColor Yellow
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*app.py*"} | Stop-Process -Force
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*next*"} | Stop-Process -Force

Start-Sleep -Seconds 2

# 启动后端
Write-Host "启动后端..." -ForegroundColor Green
Start-Process -FilePath "python" -ArgumentList "web/backend/app.py" -WorkingDirectory $PWD

Start-Sleep -Seconds 5

# 启动前端
Write-Host "启动前端..." -ForegroundColor Green
Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "$PWD/web/frontend"

Write-Host "服务已重启！" -ForegroundColor Green
Write-Host "后端: http://localhost:8000" -ForegroundColor Cyan
Write-Host "前端: http://localhost:3000" -ForegroundColor Cyan
```

运行：
```powershell
.\restart.ps1
```

## 验证清单

重启后，验证以下内容：

### 后端
- [ ] 后端进程正在运行
- [ ] 端口8000正在监听
- [ ] WebSocket测试通过
- [ ] 持仓API返回数据
- [ ] 控制台没有错误

### 前端
- [ ] 前端进程正在运行
- [ ] 端口3000正在监听
- [ ] 页面可以访问
- [ ] 浏览器控制台没有错误
- [ ] WebSocket连接成功

### 功能
- [ ] 排行榜数据显示
- [ ] 可以切换市场
- [ ] 趋势图正常显示
- [ ] 用户详情可以打开
- [ ] 持仓信息显示
- [ ] 决策记录显示
- [ ] 货币符号正确

## 开发建议

### 1. 使用终端分屏

**Windows Terminal：**
- 左侧：后端
- 右侧：前端

这样可以同时看到两个服务的日志。

### 2. 监控日志

**后端日志关键信息：**
```
✅ Database tables initialized
✅ Scheduler service started
✅ Leaderboard real-time update task started
🔌 Leaderboard WebSocket connection attempt received
✅ Leaderboard WebSocket connected successfully
```

**前端日志关键信息：**
```
🔌 Connecting to WebSocket
✅ Leaderboard WebSocket connected successfully
📊 Received initial data: 3 users
```

### 3. 自动重启

**后端：** 使用 `uvicorn` 的 `--reload` 选项
```bash
uvicorn web.backend.app:app --reload --host 0.0.0.0 --port 8000
```

**前端：** Next.js 默认支持热重载

### 4. 调试模式

**后端：** 设置日志级别
```python
logging.basicConfig(level=logging.DEBUG)
```

**前端：** 打开浏览器开发者工具
```
F12 → Console
```

## 紧急情况

如果一切都不工作：

### 核弹选项（完全重置）

```bash
# 1. 停止所有Python和Node进程
taskkill /F /IM python.exe
taskkill /F /IM node.exe

# 2. 清理前端
cd web/frontend
rm -rf .next
rm -rf node_modules/.cache

# 3. 重新安装依赖（如果需要）
npm install

# 4. 重启服务
cd ../backend
python app.py

# 5. 新终端启动前端
cd web/frontend
npm run dev

# 6. 清除浏览器所有数据
# Chrome: Ctrl+Shift+Delete → 所有时间 → 全选 → 清除

# 7. 重新打开浏览器
```

## 相关文档

- `QUICK_FIX_WEBSOCKET.md` - WebSocket快速修复
- `DIAGNOSE_LEADERBOARD_DATA.md` - 数据诊断
- `test_ws_connection.py` - WebSocket测试脚本
- `test_leaderboard_data.py` - 数据测试脚本
