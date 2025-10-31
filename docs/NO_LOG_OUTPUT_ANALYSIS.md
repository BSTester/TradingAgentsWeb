# 任务无日志输出问题分析

## 问题现象

任务执行过程中出现长时间(超过 60 秒)没有日志输出的情况:
```
⏰ 任务 scheduled_2_20251031_231500 无日志输出 90秒 (计数: 1/10)
```

## 可能的原因

### 1. LLM 调用耗时过长 ⭐ 最可能

**现象**:
- LangGraph 在调用 LLM 时会阻塞
- 某些 LLM 响应可能需要很长时间(30秒-2分钟)
- 在等待 LLM 响应期间,没有日志输出

**代码位置**:
```python
# analysis_task.py 第 440 行
stream_iterator = graph.graph.stream(init_agent_state, **args)
for chunk in stream_with_interrupt_check(stream_iterator):
    # 只有收到 chunk 才会有日志
    # 如果 LLM 调用很慢,这里会阻塞
```

**为什么没有状态**:
- `graph.stream()` 是同步阻塞调用
- 在 LLM 响应之前,不会产生任何 chunk
- 没有 chunk 就没有日志输出

**影响因素**:
- LLM 提供商的响应速度(OpenAI, Anthropic, Google 等)
- 网络延迟
- LLM 模型的复杂度(深度思考模型更慢)
- API 限流或排队

### 2. 数据获取工具调用耗时

**现象**:
- 调用 yfinance, akshare 等数据源
- 某些数据源响应很慢或超时
- 在等待数据期间没有日志

**代码位置**:
```python
# 工具调用检测
if hasattr(first_msg, 'tool_calls') and first_msg.tool_calls:
    for tool_call in first_msg.tool_calls:
        tool_name = tool_call.get('name', '')
        # 只有在收到 tool_call 消息后才会记录
```

**问题**:
- 工具调用是在 LangGraph 内部执行的
- 在工具执行期间,外部代码无法获取状态
- 只有工具调用完成后才会有消息

### 3. 数据库操作阻塞

**现象**:
- 数据库连接池耗尽
- 等待数据库连接
- 事务锁等待

**可能性**: 较低(已优化连接池到 100)

### 4. 内存或 CPU 资源不足

**现象**:
- 系统资源不足导致进程挂起
- Python GC(垃圾回收)耗时过长
- 大量数据处理导致阻塞

**可能性**: 中等

## 当前的日志输出机制

### 何时会输出日志?

1. **任务启动**: ✅ 有日志
   ```python
   send_log('info', '🚀 分析任务已启动', ...)
   ```

2. **配置阶段**: ✅ 有日志
   ```python
   send_log('info', '🔑 配置 API 密钥...', ...)
   ```

3. **分析师切换**: ✅ 有日志
   ```python
   send_log('info', f'🔍 {agent_display_name} 开始分析...', ...)
   ```

4. **工具调用**: ✅ 有日志(但只在收到消息后)
   ```python
   send_log('info', f'🔧 调用工具: {tool_name}', ...)
   ```

5. **LLM 调用中**: ❌ 没有日志
   - 在等待 LLM 响应期间,完全没有输出
   - 这是最大的盲区

6. **分析完成**: ✅ 有日志
   ```python
   send_log('info', '分析完成!', ...)
   ```

## 为什么调用 LLM 时无法获取状态?

### LangGraph 的执行模式

```python
# 同步流式调用
for chunk in graph.stream(state):
    # 只有在 LLM 返回 chunk 时才会执行这里
    # 在 LLM 思考期间,这个循环是阻塞的
    process_chunk(chunk)
```

### 问题所在

1. **同步阻塞**: `graph.stream()` 是同步调用,会阻塞当前线程
2. **无中间状态**: LLM 在生成响应时,不会产生中间状态
3. **流式输出延迟**: 即使使用流式输出,第一个 token 也可能需要很长时间

### 无法获取的信息

在 LLM 调用期间,我们无法知道:
- ❌ LLM 是否正在处理
- ❌ 已经等待了多长时间
- ❌ 是否卡住了还是正常等待
- ❌ 当前的处理进度

## 解决方案

### 方案 1: 增加心跳日志 ⭐ 推荐

在 LangGraph 流式处理前后添加日志:

```python
# 在调用前
send_log('info', f'🤔 {agent_name} 正在思考...', agent, '思考中', progress, '分析阶段')

# 调用 LLM
for chunk in graph.stream(state):
    # 处理 chunk
    pass

# 在收到第一个响应后
send_log('info', f'💬 {agent_name} 开始响应', agent, '响应中', progress, '分析阶段')
```

### 方案 2: 添加超时监控

在 LangGraph 调用时添加超时检测:

```python
import threading
import time

def llm_call_with_heartbeat():
    last_heartbeat = time.time()
    
    def heartbeat_thread():
        while not stop_event.is_set():
            time.sleep(30)  # 每 30 秒
            if time.time() - last_heartbeat > 30:
                send_log('info', '⏳ 等待 LLM 响应中...', 'system', '等待', progress, '分析阶段')
    
    threading.Thread(target=heartbeat_thread, daemon=True).start()
    
    # 执行 LLM 调用
    for chunk in graph.stream(state):
        last_heartbeat = time.time()
        # 处理 chunk
```

### 方案 3: 使用异步 LangGraph (复杂)

将 LangGraph 改为异步模式,可以在等待期间执行其他操作:

```python
async for chunk in graph.astream(state):
    # 异步处理
    await process_chunk(chunk)
```

**问题**: 需要大量重构,因为当前是在同步线程中运行

### 方案 4: 增加停滞检测阈值 ✅ 已实施

将停滞检测从 5 次增加到 10 次(5分钟 -> 10分钟):

```python
# 已修改
if self.task_no_log_count[analysis_id] >= 10:  # 从 5 改为 10
    print(f"⚠️  任务异常：连续 10 次检测无日志输出")
```

## 建议的改进

### 短期改进(立即可做)

1. ✅ **增加停滞检测阈值到 10 次** - 已完成
2. **在关键点添加日志**:
   ```python
   # 在每个分析师开始前
   send_log('info', f'🎯 准备调用 {agent_name}...', ...)
   
   # 在 LLM 调用前
   send_log('info', f'🤔 {agent_name} 正在思考(可能需要1-2分钟)...', ...)
   ```

### 中期改进(需要测试)

1. **添加心跳机制**: 在长时间操作期间定期发送心跳日志
2. **记录 LLM 调用时间**: 统计每次 LLM 调用的耗时
3. **添加超时警告**: 如果 LLM 调用超过预期时间,发送警告

### 长期改进(需要重构)

1. **异步 LangGraph**: 改用异步模式,可以更好地控制执行流程
2. **进度估算**: 基于历史数据估算每个步骤的耗时
3. **可视化等待**: 在前端显示"正在等待 LLM 响应"的动画

## 监控建议

### 添加 LLM 调用监控

```python
import time

llm_call_start = time.time()
send_log('info', f'🤔 调用 LLM: {model_name}', ...)

for chunk in graph.stream(state):
    if first_chunk:
        elapsed = time.time() - llm_call_start
        send_log('info', f'💬 LLM 首次响应 (耗时: {elapsed:.1f}秒)', ...)
        first_chunk = False
```

### 记录慢查询

```python
if elapsed > 60:
    print(f"⚠️  LLM 调用耗时过长: {elapsed:.1f}秒")
    # 记录到数据库或日志文件
```

## 总结

**主要原因**: LLM 调用是同步阻塞的,在等待响应期间无法输出日志

**当前状态**: 
- ✅ 已将停滞检测阈值增加到 10 次(10分钟)
- ✅ 数据库连接池已优化到 100
- ✅ 事务管理已加强

**下一步**:
1. 在关键点添加更多日志(特别是 LLM 调用前后)
2. 考虑添加心跳机制
3. 监控 LLM 调用耗时

**用户体验**:
- 用户需要理解某些步骤(特别是深度思考)可能需要较长时间
- 前端可以显示"正在等待 AI 响应,请耐心等待"的提示
- 10 分钟的超时阈值对于大多数分析任务是合理的
