# 定时任务功能 - 快速启动指南

## ✅ 已完成的准备工作

1. ✅ 后端代码已实现
2. ✅ 前端代码已实现
3. ✅ date-fns 依赖已安装
4. ✅ 导航链接已添加
5. ✅ 类型定义已完成

## 🚀 立即开始使用

### 步骤 1: 安装后端依赖

```bash
pip install apscheduler>=3.10.0
```

### 步骤 2: 运行数据库迁移

```bash
python web/backend/migrations/add_scheduled_tasks_table.py
```

预期输出：
```
🔄 Starting migration: add_scheduled_tasks_table
📊 Database URL: ...
✨ Creating scheduled_tasks table...
✅ Migration completed successfully!
📋 Created table: scheduled_tasks
✅ Verification passed: scheduled_tasks table exists
```

### 步骤 3: 重启后端服务

```bash
# 停止当前运行的后端
# 然后重新启动
python web/backend/app.py
```

查看启动日志，应该看到：
```
✅ Database tables initialized successfully
✅ Running tasks cleaned up
✅ Scheduler service started
✅ Scheduled tasks loaded
✅ Task monitor started (leader)
```

### 步骤 4: 重启前端服务

```bash
cd web/frontend
npm run dev
```

### 步骤 5: 访问定时任务页面

打开浏览器访问：`http://localhost:3000/scheduled-tasks`

应该看到定时任务管理界面。

## 📝 集成调度配置到分析表单（可选）

如果要在分析表单中添加定时任务创建功能，请按照以下步骤操作：

### 1. 打开分析配置表单

编辑文件：`web/frontend/src/components/analysis/AnalysisConfigForm.tsx`

### 2. 添加导入

在文件顶部添加：

```typescript
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
import { scheduledTasksAPI } from '@/lib/api';
```

### 3. 添加状态

在组件内部，现有 useState 声明后添加：

```typescript
const [isScheduled, setIsScheduled] = useState(false);
const [scheduleData, setScheduleData] = useState<ScheduleData>({
  task_name: '',
  execution_cycle: '',
  execution_time: '',
  interval_days: 1,
  end_date: ''
});
```

### 4. 添加组件

在"隐私授权"部分之后，提交按钮之前添加：

```typescript
{/* 定时执行配置 */}
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>
```

### 5. 更新提交逻辑

在 `confirmStartAnalysis` 函数中，在现有的 API 调用之前添加：

```typescript
// Check if this is a scheduled task or immediate execution
if (isScheduled) {
  // Validate schedule configuration
  if (!scheduleData.task_name || !scheduleData.execution_cycle || !scheduleData.execution_time) {
    onShowToast('请完整填写定时任务配置', 'error');
    setIsSubmitting(false);
    return;
  }

  // Create scheduled task
  const scheduledTaskData = {
    ...requestData,
    task_name: scheduleData.task_name,
    execution_cycle: scheduleData.execution_cycle,
    execution_time: scheduleData.execution_time,
    interval_days: scheduleData.interval_days,
    end_date: scheduleData.end_date || undefined,
  };

  const response = await scheduledTasksAPI.create(scheduledTaskData);
  onShowToast('✅ 定时任务创建成功！', 'success');
  
  setTimeout(() => {
    window.location.href = '/scheduled-tasks';
  }, 1500);
  return;
}

// 否则执行现有的立即分析逻辑
```

### 6. 更新提交按钮文本

修改提交按钮的文本，使其根据模式显示不同内容：

```typescript
<button type="submit" disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <i className="fas fa-spinner fa-spin mr-2" />
      {isScheduled ? '创建定时任务中...' : '启动分析中...'}
    </>
  ) : (
    <>
      <i className={`fas ${isScheduled ? 'fa-clock' : 'fa-play'} mr-2`} />
      {isScheduled ? '创建定时任务' : '开始分析'}
    </>
  )}
</button>
```

详细的集成说明请参考：`web/frontend/SCHEDULE_INTEGRATION_GUIDE.md`

## 🧪 测试功能

### 1. 测试定时任务列表

1. 访问 `http://localhost:3000/scheduled-tasks`
2. 应该看到空列表或现有任务
3. 统计信息应该正确显示

### 2. 测试创建定时任务（通过 API）

使用 curl 或 Postman 测试：

```bash
curl -X POST http://localhost:8000/api/scheduled-tasks/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task_name": "测试任务",
    "ticker": "AAPL",
    "analysts": ["market", "news"],
    "research_depth": 1,
    "llm_provider": "openai",
    "backend_url": "https://api.openai.com/v1",
    "shallow_thinker": "gpt-4o-mini",
    "deep_thinker": "gpt-4o",
    "is_public": true,
    "execution_cycle": "daily",
    "execution_time": "09:00"
  }'
```

### 3. 测试任务管理

1. 在任务列表中点击启用/禁用按钮
2. 验证状态切换正常
3. 点击删除按钮
4. 确认删除对话框出现
5. 确认删除后任务消失

### 4. 测试任务执行

1. 创建一个执行时间在 2 分钟后的任务
2. 等待执行时间到达
3. 检查后端日志，应该看到：
   ```
   ✅ Executing scheduled task 1: 测试任务 (ticker: AAPL)
   ✅ Scheduled task 1 execution initiated successfully
   ```
4. 访问分析历史页面
5. 应该看到新创建的分析记录

## 📊 监控和调试

### 查看调度器状态

后端启动时会显示：
```
✅ Scheduler service started
✅ Loaded X scheduled tasks
```

### 查看任务执行日志

任务执行时会输出：
```
✅ Executing scheduled task {id}: {name} (ticker: {ticker})
✅ Scheduled task {id} execution initiated successfully
```

### 常见问题

**Q: 任务没有执行？**
- 检查任务是否启用（is_enabled = true）
- 检查 next_run_time 是否正确
- 检查后端日志是否有错误

**Q: 创建任务失败？**
- 检查是否超过 100 个任务限制
- 检查股票代码格式是否正确
- 检查执行周期和时间格式

**Q: 前端页面报错？**
- 确认 date-fns 已安装
- 检查浏览器控制台错误
- 确认后端 API 正常响应

## 📚 参考文档

- 完整实现文档：`web/backend/SCHEDULED_TASKS_IMPLEMENTATION.md`
- 前端集成指南：`web/frontend/SCHEDULE_INTEGRATION_GUIDE.md`
- 实施检查清单：`IMPLEMENTATION_CHECKLIST.md`

## ✅ 验证清单

- [ ] 后端依赖已安装（apscheduler）
- [ ] 前端依赖已安装（date-fns）✅
- [ ] 数据库迁移已运行
- [ ] 后端服务已重启
- [ ] 前端服务已重启
- [ ] 可以访问定时任务页面
- [ ] 可以创建定时任务
- [ ] 可以管理定时任务
- [ ] 任务可以正常执行

## 🎉 完成！

现在你可以开始使用定时任务功能了！

如有问题，请查看相关文档或检查日志输出。
