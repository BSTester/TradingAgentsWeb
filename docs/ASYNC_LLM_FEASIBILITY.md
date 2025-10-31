# LLM 异步调用可行性分析

## 问题背景

当前 LLM 调用是同步阻塞的,在等待响应期间无法输出日志,导致任务看起来"卡住"了。

## 技术栈分析

### 当前架构

```
FastAPI (异步)
    ↓
TaskManager (ThreadPoolExecutor - 同步线程)
    ↓
analysis_task.py (同步函数)
    ↓
TradingAgentsGraph (LangGraph - 同步)
    ↓
LLM 调用 (同步阻塞)
```

### 关键组件

1. **TaskManager**: 使用 `ThreadPoolExecutor`,在普通线程中运行
2. **analysis_task.py**: `run_analysis_task()` 是同步函数
3. **TradingAgentsGraph**: 基于 LangGraph,使用同步 API
4. **LangGraph**: 支持 `stream()` (同步) 和 `astream()` (异步)

## 改为异步的方案

### 方案 1: 完全异步化 (最彻底,工作量最大)

#### 架构变更

```
FastAPI (异步)
    ↓
TaskManager (asyncio.create_task - 异步任务)
    ↓
analysis_task.py (async def - 异步函数)
    ↓
TradingAgentsGraph (使用 astream - 异步)
    ↓
LLM 调用 (异步非阻塞)
```

#### 需要修改的文件

1. **web/backend/app.py** - TaskManager
   ```python
   # 当前
   class TaskManager:
       def __init__(self):
           self.executor = ThreadPoolExecutor(max_workers=10)
       
       def submit_task(self, ...):
           future = self.executor.submit(func, ...)
   
   # 改为
   class AsyncTaskManager:
       def __init__(self):
           self.tasks = {}
       
       async def submit_task(self, ...):
           task = asyncio.create_task(func(...))
           self.tasks[analysis_id] = task
   ```

2. **web/backend/analysis_task.py** - 主函数
   ```python
   # 当前
   def run_analysis_task(stop_event, analysis_id, ...):
       db = SessionLocal()  # 同步会话
       # ...
   
   # 改为
   async def run_analysis_task_async(analysis_id, ...):
       async with AsyncSessionLocal() as db:  # 异步会话
           # ...
   ```

3. **web/backend/analysis_task.py** - LangGraph 调用
   ```python
   # 当前
   for chunk in graph.graph.stream(state):
       # 同步处理
   
   # 改为
   async for chunk in graph.graph.astream(state):
       # 异步处理
       await asyncio.sleep(0)  # 让出控制权
   ```

4. **web/backend/analysis_task.py** - 数据库操作
   ```python
   # 当前
   db.commit()
   
   # 改为
   await db.commit()
   ```

5. **web/backend/analysis_task.py** - WebSocket 发送
   ```python
   # 当前
   loop = asyncio.new_event_loop()
   loop.run_until_complete(manager.send_message(...))
   
   # 改为
   await manager.send_message(...)
   ```

#### 优势

- ✅ 真正的异步,可以在等待期间执行其他操作
- ✅ 可以添加心跳日志
- ✅ 更好的资源利用率
- ✅ 可以实现真正的超时控制

#### 劣势

- ❌ 工作量巨大(估计 2-3 天)
- ❌ 需要测试所有功能
- ❌ 可能引入新的 bug
- ❌ 需要重新设计任务管理器
- ❌ 数据库会话管理变复杂

#### 风险

- 🔴 高风险:涉及核心架构变更
- 🔴 可能破坏现有功能
- 🔴 异步调试更困难

---

### 方案 2: 混合模式 - 添加心跳线程 (推荐)

#### 架构

保持当前同步架构,但添加独立的心跳线程:

```
同步主线程 (LLM 调用)
    +
心跳线程 (定期发送日志)
```

#### 实现

```python
import threading
import time

def run_analysis_task(...):
    # 心跳标志
    heartbeat_active = threading.Event()
    heartbeat_active.set()
    last_activity = {'time': time.time()}
    
    def heartbeat_worker():
        """独立线程,定期发送心跳日志"""
        while heartbeat_active.is_set():
            time.sleep(30)  # 每 30 秒
            
            if heartbeat_active.is_set():
                elapsed = time.time() - last_activity['time']
                if elapsed > 30:
                    # 超过 30 秒没有活动,发送心跳
                    send_log('info', f'⏳ 正在处理中... (已等待 {elapsed:.0f}秒)', 
                            'system', '处理中', analysis_record.progress_percentage, '分析阶段')
    
    # 启动心跳线程
    heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
    heartbeat_thread.start()
    
    try:
        # 正常的同步处理
        for chunk in graph.stream(state):
            last_activity['time'] = time.time()  # 更新活动时间
            # 处理 chunk
    finally:
        # 停止心跳
        heartbeat_active.clear()
```

#### 优势

- ✅ 工作量小(1-2 小时)
- ✅ 不改变核心架构
- ✅ 风险低
- ✅ 可以立即实施
- ✅ 提供用户反馈

#### 劣势

- ❌ 不是真正的异步
- ❌ 仍然会阻塞主线程
- ❌ 无法真正取消 LLM 调用

#### 风险

- 🟢 低风险:只是添加功能,不改变现有逻辑

---

### 方案 3: 使用 asyncio.to_thread (折中方案)

#### 架构

在异步上下文中运行同步代码:

```python
# 在 FastAPI 路由中
async def start_analysis(...):
    # 在线程池中运行同步任务,但保持异步接口
    await asyncio.to_thread(run_analysis_task, ...)
```

#### 实现

```python
# app.py
async def submit_analysis_async(analysis_id, user_id, request_data, ...):
    """异步提交分析任务"""
    # 在线程池中运行同步函数
    task = asyncio.create_task(
        asyncio.to_thread(
            run_analysis_task,
            stop_event,
            analysis_id,
            user_id,
            request_data,
            manager,
            task_manager
        )
    )
    return task
```

#### 优势

- ✅ 保持同步代码不变
- ✅ 提供异步接口
- ✅ 可以使用 asyncio 的任务管理
- ✅ 工作量中等(半天)

#### 劣势

- ❌ 本质上还是同步阻塞
- ❌ 无法在 LLM 调用期间获取状态
- ❌ 只是包装,没有真正解决问题

#### 风险

- 🟡 中等风险:需要修改任务提交逻辑

---

## 对比分析

| 方案 | 工作量 | 风险 | 效果 | 推荐度 |
|------|--------|------|------|--------|
| 方案1: 完全异步化 | 2-3天 | 高 | 最好 | ⭐⭐ |
| 方案2: 心跳线程 | 1-2小时 | 低 | 中等 | ⭐⭐⭐⭐⭐ |
| 方案3: asyncio.to_thread | 半天 | 中 | 一般 | ⭐⭐⭐ |

## 推荐方案

### 短期(立即实施): 方案 2 - 心跳线程 ⭐⭐⭐⭐⭐

**原因**:
1. 工作量小,可以立即实施
2. 风险低,不影响现有功能
3. 能够解决用户体验问题(提供反馈)
4. 不需要大规模重构

**实施步骤**:
1. 在 `run_analysis_task()` 中添加心跳线程
2. 在关键点更新活动时间
3. 心跳线程定期检查并发送日志
4. 测试验证

### 长期(未来优化): 方案 1 - 完全异步化

**时机**:
- 当系统稳定后
- 有充足的测试时间
- 需要更高的并发性能时

**收益**:
- 真正的异步,更好的性能
- 可以实现更复杂的控制逻辑
- 更好的资源利用率

## 实施建议

### 立即可做(方案 2)

```python
# 在 analysis_task.py 中添加

class HeartbeatMonitor:
    """心跳监控器"""
    def __init__(self, send_log_func, analysis_record):
        self.send_log = send_log_func
        self.analysis_record = analysis_record
        self.last_activity = time.time()
        self.active = threading.Event()
        self.active.set()
        self.thread = None
    
    def start(self):
        """启动心跳监控"""
        self.thread = threading.Thread(target=self._heartbeat_worker, daemon=True)
        self.thread.start()
    
    def _heartbeat_worker(self):
        """心跳工作线程"""
        while self.active.is_set():
            time.sleep(30)  # 每 30 秒检查一次
            
            if self.active.is_set():
                elapsed = time.time() - self.last_activity
                if elapsed > 30:
                    # 发送心跳日志
                    self.send_log(
                        'info',
                        f'⏳ AI 正在思考中,请耐心等待... (已等待 {elapsed:.0f}秒)',
                        'system',
                        '处理中',
                        self.analysis_record.progress_percentage,
                        '分析阶段'
                    )
    
    def update(self):
        """更新活动时间"""
        self.last_activity = time.time()
    
    def stop(self):
        """停止心跳监控"""
        self.active.clear()

# 使用
heartbeat = HeartbeatMonitor(send_log, analysis_record)
heartbeat.start()

try:
    for chunk in graph.stream(state):
        heartbeat.update()  # 更新活动时间
        # 处理 chunk
finally:
    heartbeat.stop()
```

## 总结

**回答你的问题**: 

**LLM 调用可以改成异步的吗?**

✅ **可以**,但需要大量重构(方案 1)

🎯 **更好的选择**: 使用心跳线程(方案 2)
- 工作量小
- 风险低
- 能解决用户体验问题
- 不需要重构核心架构

**建议**: 先实施方案 2,如果未来需要更高性能,再考虑方案 1。
