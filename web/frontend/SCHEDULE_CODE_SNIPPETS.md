# 定时任务集成 - 代码片段

## 代码片段 1: 导入语句（添加到文件顶部）

```typescript
import { scheduledTasksAPI } from '@/lib/api';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
```

## 代码片段 2: 状态声明（添加到组件内部）

```typescript
// 定时任务配置状态
const [isScheduled, setIsScheduled] = useState(false);
const [scheduleData, setScheduleData] = useState<ScheduleData>({
  task_name: '',
  execution_cycle: '',
  execution_time: '',
  interval_days: 1,
  end_date: ''
});
```

## 代码片段 3: ScheduleConfig 组件（添加到表单中）

```typescript
{/* 定时执行配置 */}
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>
```

## 代码片段 4: 提交逻辑（替换或添加到现有提交函数）

```typescript
// 在 try 块开始处添加
if (isScheduled) {
  // 验证定时任务配置
  if (!scheduleData.task_name || !scheduleData.execution_cycle || !scheduleData.execution_time) {
    onShowToast('请完整填写定时任务配置', 'error');
    setIsSubmitting(false);
    return;
  }

  // 准备定时任务数据
  const scheduledTaskData = {
    task_name: scheduleData.task_name,
    ticker: normalizeTicker(formData.ticker),
    analysts: formData.analysts,
    research_depth: formData.research_depth,
    llm_provider: formData.llm_provider,
    backend_url: config?.llm_providers?.find((p: any) => p.value === formData.llm_provider)?.url || '',
    shallow_thinker: formData.shallow_thinker,
    deep_thinker: formData.deep_thinker,
    is_public: formData.is_public,
    execution_cycle: scheduleData.execution_cycle,
    execution_time: scheduleData.execution_time,
    interval_days: scheduleData.interval_days,
    end_date: scheduleData.end_date || undefined,
    analysis_date: formData.analysis_date,
  };

  // 添加API密钥
  if (formData.llm_provider === 'openai' || formData.llm_provider === 'oneai' || 
      formData.llm_provider === 'qwen' || formData.llm_provider === 'deepseek' || 
      formData.llm_provider === 'openrouter') {
    scheduledTaskData.openai_api_key = formData.api_key;
  } else if (formData.llm_provider === 'anthropic') {
    scheduledTaskData.anthropic_api_key = formData.api_key;
  } else if (formData.llm_provider === 'google') {
    scheduledTaskData.google_api_key = formData.api_key;
  }

  // 创建定时任务
  const response = await scheduledTasksAPI.create(scheduledTaskData);
  
  console.log('=== Scheduled Task Created ===');
  console.log('Response:', response);

  onShowToast('✅ 定时任务创建成功！', 'success');
  
  // 跳转到定时任务页面
  setTimeout(() => {
    window.location.href = '/scheduled-tasks';
  }, 1500);
  
  return; // 重要：阻止继续执行立即分析逻辑
}

// 如果不是定时任务，继续执行现有的立即分析逻辑
// ... 现有代码 ...
```

## 代码片段 5: 更新提交按钮

```typescript
<button
  type="submit"
  disabled={isSubmitting}
  className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
>
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

## 快速集成步骤

1. 复制**代码片段 1**，粘贴到文件顶部的导入区域
2. 复制**代码片段 2**，粘贴到组件内部的状态声明区域（在其他 useState 附近）
3. 复制**代码片段 3**，粘贴到表单中隐私授权部分之后、提交按钮之前
4. 复制**代码片段 4**，粘贴到提交处理函数的开始处（在 try 块内）
5. 复制**代码片段 5**，替换现有的提交按钮

完成！保存文件后刷新页面即可看到定时任务配置选项。
