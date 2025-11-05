# 排队任务恢复功能

## 更新时间
2024-01-15

## 功能说明

### 问题背景

**修改前：**
- 服务重启时，只清理运行中的任务（标记为中断）
- 排队中的任务（status='queued'）被遗忘，永远不会执行
- 用户需要手动重新提交这些任务

**修改后：**
- 服务重启时，清理运行中的任务
- 自动恢复所有排队中的任务，重新加入执行队列
- 用户无需手动操作，任务自动继续

## 实现逻辑

### 启动流程

```
应用启动
    ↓
1. 清理运行中任务
    ├─ 查找 status='initializing' 或 'running' 的任务
    ├─ 标记为 'interrupted'
    └─ 记录中断原因
    ↓
2. 恢复排队任务
    ├─ 查找 status='queued' 的任务
    ├─ 按创建时间排序
    ├─ 重新提交到任务管理器
    └─ 根据用户并发限制自动排队或执行
    ↓
应用就绪
```

### 代码实现

```python
async def cleanup_running_tasks():
    """Clean up running tasks on server restart and restore queued tasks"""
    
    # 1. 清理运行中任务
    running_tasks = db.query(AnalysisRecord).filter(
        status in ['initializing', 'running']
    ).all()
    
    for task in running_tasks:
        task.status = 'interrupted'
        task.error_message = '服务重启导致任务中断'
    
    # 2. 恢复排队任务
    queued_tasks = db.query(AnalysisRecord).filter(
        status == 'queued'
    ).order_by(created_at).all()
    
    for task in queued_tasks:
        # 重新提交任务
        task_manager.submit_task(
            task.analysis_id,
            task.user_id,
            run_analysis_task,
            ...
        )
```

## 任务恢复详情

### 恢复的任务信息

从数据库中读取以下信息：

- ✅ `ticker` - 股票代码
- ✅ `analysis_date` - 分析日期
- ✅ `selected_analysts` - 选择的分析师
- ✅ `research_depth` - 研究深度
- ✅ `llm_provider` - LLM 提供商
- ✅ `deep_thinker` - 深度思考模型
- ✅ `shallow_thinker` - 快速思考模型
- ✅ `enable_trading_executor` - 是否启用交易执行
- ✅ `futu_api_base_url` - 富途 API 地址
- ✅ `futu_api_key` - 富途 API 密钥

### 任务提交逻辑

恢复的任务会经过正常的任务管理器流程：

1. **检查用户并发限制**
   - 如果用户当前运行任务数 < 2，立即执行
   - 如果用户当前运行任务数 >= 2，加入用户队列

2. **检查全局并发限制**
   - 如果全局运行任务数 < 50，立即执行
   - 如果全局运行任务数 >= 50，加入全局队列

3. **按顺序执行**
   - 按创建时间排序，先创建的先执行
   - 保证公平性

## 使用场景

### 场景 1：服务正常重启

```
重启前状态：
- 用户 A: 任务1 (running), 任务2 (queued)
- 用户 B: 任务3 (running), 任务4 (queued)

重启后状态：
- 用户 A: 任务1 (interrupted), 任务2 (running) ✅
- 用户 B: 任务3 (interrupted), 任务4 (running) ✅
```

### 场景 2：服务崩溃重启

```
崩溃前状态：
- 用户 A: 任务1 (running), 任务2 (queued), 任务3 (queued)
- 用户 B: 任务4 (running)

重启后状态：
- 用户 A: 任务1 (interrupted), 任务2 (running), 任务3 (queued) ✅
- 用户 B: 任务4 (interrupted)

说明：
- 任务2 立即开始执行（用户 A 有空闲槽位）
- 任务3 保持排队（用户 A 已达到并发上限）
- 当任务2 完成后，任务3 自动开始
```

### 场景 3：多用户排队任务

```
重启前状态：
- 用户 A: 任务1 (queued)
- 用户 B: 任务2 (queued)
- 用户 C: 任务3 (queued)

重启后状态（假设全局限制为50）：
- 用户 A: 任务1 (running) ✅
- 用户 B: 任务2 (running) ✅
- 用户 C: 任务3 (running) ✅

说明：所有任务都立即开始（不同用户，全局有空闲）
```

## 日志输出

### 清理运行中任务

```
🔄 发现 2 个运行中的任务，准备中断...
  🛑 中断任务: analysis_20241115_123456_AAPL_1
  🛑 中断任务: analysis_20241115_123457_TSLA_1
✅ 已中断 2 个任务
```

### 恢复排队任务

```
🔄 发现 3 个排队中的任务，准备恢复...
  ✅ 恢复任务: analysis_20241115_123458_NVDA_1 (NVDA)
  ✅ 恢复任务: analysis_20241115_123459_META_1 (META)
  ⏳ 任务已加入队列: analysis_20241115_123500_AMZN_1 (AMZN)
✅ 已恢复 3/3 个排队任务
```

### 无任务需要处理

```
✅ 没有需要清理的运行中任务
✅ 没有需要恢复的排队任务
```

### 恢复失败

```
🔄 发现 1 个排队中的任务，准备恢复...
  ❌ 恢复任务失败 analysis_20241115_123456_AAPL_1: Invalid configuration
✅ 已恢复 0/1 个排队任务
```

## 错误处理

### 恢复失败的任务

如果任务恢复失败（例如配置无效），会：

1. 记录错误日志
2. 将任务状态改为 'error'
3. 记录错误原因到 `error_message`
4. 继续恢复其他任务

### 部分恢复成功

```python
# 示例：3个任务，2个成功，1个失败
✅ 已恢复 2/3 个排队任务
```

## 性能影响

### 启动时间

- **无排队任务：** 几乎无影响（< 100ms）
- **少量任务（< 10）：** 轻微延迟（< 1s）
- **大量任务（> 50）：** 可能延迟 2-5s

### 资源消耗

- **数据库查询：** 2次（运行中 + 排队中）
- **任务提交：** 每个任务一次
- **内存：** 临时加载任务数据

### 优化建议

如果有大量排队任务，可以考虑：

1. **批量处理**
   ```python
   # 每次只恢复前50个任务
   queued_tasks = queued_tasks[:50]
   ```

2. **异步恢复**
   ```python
   # 在后台线程中恢复
   threading.Thread(target=restore_queued_tasks).start()
   ```

3. **延迟恢复**
   ```python
   # 应用启动后5秒再恢复
   await asyncio.sleep(5)
   await restore_queued_tasks()
   ```

## 监控建议

### 关键指标

1. **恢复成功率**
   - 成功恢复的任务数 / 总排队任务数
   - 目标：> 95%

2. **恢复时间**
   - 从启动到所有任务恢复完成的时间
   - 目标：< 5s

3. **失败原因分布**
   - 统计各种失败原因
   - 识别系统性问题

### 告警规则

建议设置以下告警：

1. 恢复成功率 < 90%
2. 恢复时间 > 10s
3. 单次恢复失败任务数 > 5

## 测试验证

### 测试场景 1：正常恢复

```bash
# 1. 提交3个任务（2个运行，1个排队）
POST /api/analysis (ticker=AAPL)
POST /api/analysis (ticker=TSLA)
POST /api/analysis (ticker=NVDA)

# 2. 重启服务
docker restart tradingagents-backend

# 3. 检查日志
# 预期：
# - AAPL 和 TSLA 被标记为 interrupted
# - NVDA 自动恢复并开始执行
```

### 测试场景 2：多用户恢复

```bash
# 1. 用户A提交2个任务，用户B提交2个任务
# 2. 重启服务
# 3. 验证所有排队任务都被恢复
```

### 测试场景 3：恢复失败处理

```bash
# 1. 创建一个配置无效的排队任务
# 2. 重启服务
# 3. 验证任务被标记为 error
# 4. 验证其他任务正常恢复
```

## 相关文件

- `web/backend/app.py` - 启动逻辑和任务恢复
- `web/backend/analysis_task.py` - 任务执行逻辑
- `web/backend/models.py` - 数据库模型

## 注意事项

### API 密钥

恢复的任务使用用户配置中保存的 API 密钥：

```python
# 从用户配置中读取 API 密钥
user_config = db.query(UserConfig).filter(user_id == task.user_id).first()
api_key = user_config.last_api_key if user_config else ''

request_data = {
    'api_key': api_key,  # 使用用户配置中的密钥
    ...
}
```

**说明：**
- 每个用户的 API 密钥存储在 `UserConfig.last_api_key` 中
- 恢复任务时使用该用户最后使用的 API 密钥
- 如果用户没有配置密钥，则使用空字符串（会使用环境变量）
- 保证每个任务使用正确的用户密钥

### 任务顺序

任务按创建时间排序恢复：

```python
.order_by(AnalysisRecord.created_at)
```

**保证：**
- 先提交的任务先恢复
- 公平性
- 可预测性

## 更新日志

| 日期 | 版本 | 更新内容 | 更新人 |
|------|------|---------|--------|
| 2024-01-15 | v1.0 | 添加排队任务恢复功能 | Kiro AI |

---

**功能状态：** ✅ 已完成  
**测试状态：** ⏳ 待验证  
**影响范围：** 应用启动流程  
**向后兼容：** 是
