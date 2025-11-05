# 用户并发任务数量更新

## 更新时间
2024-01-15

## 更新内容

### 修改前
- 每个用户同时只能运行 **1个** 分析任务
- 如果用户提交新任务时已有任务在运行，新任务会进入用户队列等待

### 修改后
- 每个用户同时可以运行 **2个** 分析任务
- 只有当用户已有2个任务在运行时，新任务才会进入队列等待

## 技术实现

### 数据结构变更

**修改前：**
```python
# 一对一映射：每个用户只能有一个运行中的任务
self.user_running_tasks: Dict[int, str] = {}  # user_id -> analysis_id
```

**修改后：**
```python
# 一对多映射：每个用户可以有多个运行中的任务
self.user_running_tasks: Dict[int, set] = {}  # user_id -> set of analysis_ids
self.max_concurrent_tasks_per_user = 2  # 每个用户最多同时运行2个任务
```

### 逻辑变更

#### 1. 任务提交检查

**修改前：**
```python
if user_id in self.user_running_tasks:
    # 用户已有运行中的任务，加入队列
    ...
```

**修改后：**
```python
user_running_count = len(self.user_running_tasks.get(user_id, set()))
if user_running_count >= self.max_concurrent_tasks_per_user:
    # 用户已达到并发上限（2个），加入队列
    ...
```

#### 2. 任务启动

**修改前：**
```python
self.user_running_tasks[user_id] = analysis_id  # 直接赋值
```

**修改后：**
```python
if user_id not in self.user_running_tasks:
    self.user_running_tasks[user_id] = set()
self.user_running_tasks[user_id].add(analysis_id)  # 添加到集合
```

#### 3. 任务完成

**修改前：**
```python
if user_id in self.user_running_tasks:
    del self.user_running_tasks[user_id]  # 删除整个映射
```

**修改后：**
```python
if user_id in self.user_running_tasks:
    self.user_running_tasks[user_id].discard(analysis_id)  # 从集合中移除
    if not self.user_running_tasks[user_id]:
        del self.user_running_tasks[user_id]  # 清理空集合
```

#### 4. 队列处理

**修改前：**
```python
# 任务完成后，立即从用户队列取出下一个任务
if user_id in self.user_task_queues and not self.user_task_queues[user_id].empty():
    ...
```

**修改后：**
```python
# 任务完成后，检查用户是否还有空闲槽位
if user_running_count < self.max_concurrent_tasks_per_user:
    if user_id in self.user_task_queues and not self.user_task_queues[user_id].empty():
        ...
```

## 使用场景

### 场景 1：用户提交第一个任务
```
用户 A 提交任务 1
    ↓
检查：用户 A 当前运行 0 个任务 < 2
    ↓
✅ 立即执行任务 1
```

### 场景 2：用户提交第二个任务
```
用户 A 提交任务 2（任务 1 还在运行）
    ↓
检查：用户 A 当前运行 1 个任务 < 2
    ↓
✅ 立即执行任务 2
```

### 场景 3：用户提交第三个任务
```
用户 A 提交任务 3（任务 1、2 都在运行）
    ↓
检查：用户 A 当前运行 2 个任务 >= 2
    ↓
⏳ 任务 3 进入用户队列等待
```

### 场景 4：任务完成后自动启动队列任务
```
任务 1 完成
    ↓
检查：用户 A 当前运行 1 个任务 < 2
    ↓
检查：用户 A 的队列中有任务 3
    ↓
✅ 自动启动任务 3
```

## 日志输出

### 任务启动
```
✅ 提交任务 analysis_xxx (用户 123) (45/50 运行中)
```

### 任务完成
```
✅ 任务 analysis_xxx 完成 (全局: 44/50, 用户 123: 1/2)
```

### 任务排队
```
⚠️  用户 123 已有 2 个运行中的任务（上限 2），任务 analysis_yyy 加入用户队列
```

### 队列任务启动
```
📤 从用户 123 队列中取出任务 analysis_yyy
✅ 提交任务 analysis_yyy (用户 123) (45/50 运行中)
```

## 配置说明

### 修改并发数量

如果需要修改每个用户的并发任务数量，修改 `web/backend/app.py` 中的配置：

```python
class TaskManager:
    def __init__(self, max_workers=50):
        ...
        self.max_concurrent_tasks_per_user = 2  # 修改这里
```

**建议值：**
- `1` - 保守模式，确保资源不冲突
- `2` - 平衡模式，提高用户体验（当前设置）
- `3-5` - 激进模式，适合资源充足的服务器

### 全局并发限制

全局并发限制仍然有效：

```python
class TaskManager:
    def __init__(self, max_workers=50):  # 全局最多50个任务
        ...
```

**优先级：**
1. 全局限制：最多 50 个任务同时运行
2. 用户限制：每个用户最多 2 个任务同时运行

## 性能影响

### 优点

1. **提高用户体验**
   - 用户可以同时分析多个股票
   - 减少等待时间
   - 提高系统利用率

2. **更好的资源利用**
   - 避免资源闲置
   - 提高并发处理能力
   - 更高的吞吐量

### 注意事项

1. **资源消耗**
   - 每个任务会消耗 CPU、内存、API 配额
   - 需要确保服务器资源充足
   - 监控系统负载

2. **API 限流**
   - 注意 LLM API 的速率限制
   - 可能需要调整 API 配额
   - 考虑使用不同的 API 密钥

3. **数据库连接**
   - 更多并发任务意味着更多数据库连接
   - 确保数据库连接池足够大
   - 监控数据库性能

## 测试验证

### 测试场景 1：同时提交2个任务
```bash
# 用户 A 同时提交2个任务
POST /api/analysis (ticker=AAPL)
POST /api/analysis (ticker=TSLA)

# 预期：两个任务都立即开始执行
```

### 测试场景 2：同时提交3个任务
```bash
# 用户 A 同时提交3个任务
POST /api/analysis (ticker=AAPL)
POST /api/analysis (ticker=TSLA)
POST /api/analysis (ticker=NVDA)

# 预期：
# - AAPL 和 TSLA 立即执行
# - NVDA 进入队列等待
# - 当 AAPL 或 TSLA 完成后，NVDA 自动开始
```

### 测试场景 3：多用户并发
```bash
# 用户 A 提交2个任务
POST /api/analysis (user=A, ticker=AAPL)
POST /api/analysis (user=A, ticker=TSLA)

# 用户 B 提交2个任务
POST /api/analysis (user=B, ticker=NVDA)
POST /api/analysis (user=B, ticker=META)

# 预期：4个任务都立即执行（不同用户互不影响）
```

## 监控建议

### 关键指标

1. **用户并发数分布**
   - 统计每个用户同时运行的任务数
   - 识别高频用户
   - 优化资源分配

2. **队列等待时间**
   - 监控任务在队列中的等待时间
   - 识别瓶颈
   - 调整并发限制

3. **系统资源使用**
   - CPU 使用率
   - 内存使用率
   - 数据库连接数
   - API 调用频率

### 告警规则

建议设置以下告警：

1. 全局运行任务数 > 45（接近上限）
2. 单个用户队列长度 > 5
3. 平均队列等待时间 > 5 分钟
4. CPU 使用率 > 80%
5. 内存使用率 > 85%

## 回滚方案

如果需要回滚到每用户1个任务的限制：

```python
# 修改 web/backend/app.py
class TaskManager:
    def __init__(self, max_workers=50):
        ...
        self.max_concurrent_tasks_per_user = 1  # 改回1
```

## 相关文件

- `web/backend/app.py` - TaskManager 实现
- `web/backend/routes/analysis_routes.py` - 任务提交接口
- `web/backend/analysis_task.py` - 任务执行逻辑

## 更新日志

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 2024-01-15 | v2.0 | 支持每用户2个并发任务 | Kiro AI |
| 2024-01-01 | v1.0 | 初始版本，每用户1个任务 | - |

---

**更新状态：** ✅ 已完成  
**测试状态：** ⏳ 待验证  
**影响范围：** 任务调度系统  
**向后兼容：** 是
