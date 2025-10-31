# 定时任务配置集成步骤

## 快速集成指南

由于 `AnalysisConfigForm.tsx` 文件较大，这里提供详细的手动集成步骤。

### 步骤 1: 添加导入（文件顶部）

在文件顶部的导入部分，添加以下两行：

```typescript
import { scheduledTasksAPI } from '@/lib/api';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
```

完整的导入部分应该类似：

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { analysisAPI, scheduledTasksAPI } from '@/lib/api';  // 添加 scheduledTasksAPI
import { normalizeTicker, validateTicker, getTickerErrorMessage } from '@/utils/tickerValidator';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';  // 新增这行
```

### 步骤 2: 添加状态变量

在组件内部，找到现有的 `useState` 声明（通常在 `const [showPrivacyDialog, setShowPrivacyDialog]` 附近），添加：

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

### 步骤 3: 找到表单的隐私授权部分

在表单中查找包含 `is_public` checkbox 的部分（通常有"隐私授权"或类似文字），在该部分**之后**、提交按钮**之前**添加：

```typescript
{/* 定时执行配置 */}
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>
```

完整的结构应该类似：

```typescript
{/* 隐私授权部分 */}
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
  {/* ... 现有的隐私授权内容 ... */}
</div>

{/* 定时执行配置 - 新增部分 */}
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>

{/* 提交按钮 */}
<div className="text-center pt-6">
  {/* ... 提交按钮 ... */}
</div>
```

### 步骤 4: 更新表单提交逻辑

找到表单提交处理函数（可能叫 `handleSubmit`、`confirmStartAnalysis` 或类似名称），在调用 `analysisAPI.startAnalysis()` **之前**添加定时任务的处理逻辑：

```typescript
// 在现有的 try 块开始处添加
try {
  // 保存配置到缓存
  saveConfigToCache(formData);

  // 准备基础请求数据
  const baseRequestData: any = {
    ticker: normalizeTicker(formData.ticker),
    analysts: formData.analysts,
    research_depth: formData.research_depth,
    llm_provider: formData.llm_provider,
    backend_url: config?.llm_providers?.find((p: any) => p.value === formData.llm_provider)?.url || '',
    shallow_thinker: formData.shallow_thinker,
    deep_thinker: formData.deep_thinker,
    is_public: formData.is_public,
  };

  // 根据提供商添加API密钥
  if (formData.llm_provider === 'openai' || formData.llm_provider === 'oneai' || 
      formData.llm_provider === 'qwen' || formData.llm_provider === 'deepseek' || 
      formData.llm_provider === 'openrouter') {
    baseRequestData.openai_api_key = formData.api_key;
  } else if (formData.llm_provider === 'anthropic') {
    baseRequestData.anthropic_api_key = formData.api_key;
  } else if (formData.llm_provider === 'google') {
    baseRequestData.google_api_key = formData.api_key;
  }

  // 检查是否是定时任务
  if (isScheduled) {
    // 验证定时任务配置
    if (!scheduleData.task_name || !scheduleData.execution_cycle || !scheduleData.execution_time) {
      onShowToast('请完整填写定时任务配置', 'error');
      setIsSubmitting(false);
      return;
    }

    // 创建定时任务
    const scheduledTaskData = {
      ...baseRequestData,
      task_name: scheduleData.task_name,
      execution_cycle: scheduleData.execution_cycle,
      execution_time: scheduleData.execution_time,
      interval_days: scheduleData.interval_days,
      end_date: scheduleData.end_date || undefined,
      analysis_date: formData.analysis_date,
    };

    const response = await scheduledTasksAPI.create(scheduledTaskData);
    
    console.log('=== Scheduled Task Created ===');
    console.log('Response:', response);
    console.log('Task ID:', response.id);

    onShowToast('✅ 定时任务创建成功！', 'success');
    
    // 跳转到定时任务页面
    setTimeout(() => {
      window.location.href = '/scheduled-tasks';
    }, 1500);
    
    return; // 重要：阻止继续执行立即分析逻辑
  }

  // 如果不是定时任务，继续执行现有的立即分析逻辑
  const requestData = {
    ...baseRequestData,
    analysis_date: formData.analysis_date,
  };

  const response: AnalysisResponse = await analysisAPI.startAnalysis(requestData);
  // ... 现有的处理逻辑 ...
```

### 步骤 5: 更新提交按钮文本

找到提交按钮，更新其文本以反映当前模式：

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

## 完整示例

这里是一个简化的完整示例，展示关键部分：

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { analysisAPI, scheduledTasksAPI } from '@/lib/api';
import { normalizeTicker, validateTicker, getTickerErrorMessage } from '@/utils/tickerValidator';
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';

export function AnalysisConfigForm({ config, onAnalysisStart, onShowToast }: AnalysisConfigFormProps) {
  // ... 现有状态 ...
  
  // 定时任务状态
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    task_name: '',
    execution_cycle: '',
    execution_time: '',
    interval_days: 1,
    end_date: ''
  });

  // ... 现有函数 ...

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ... 现有验证逻辑 ...
    
    setIsSubmitting(true);
    
    try {
      // 准备基础数据
      const baseRequestData = {
        ticker: normalizeTicker(formData.ticker),
        analysts: formData.analysts,
        research_depth: formData.research_depth,
        llm_provider: formData.llm_provider,
        backend_url: config?.llm_providers?.find((p: any) => p.value === formData.llm_provider)?.url || '',
        shallow_thinker: formData.shallow_thinker,
        deep_thinker: formData.deep_thinker,
        is_public: formData.is_public,
      };

      // 添加API密钥
      if (formData.llm_provider === 'openai') {
        baseRequestData.openai_api_key = formData.api_key;
      }
      // ... 其他提供商 ...

      // 定时任务逻辑
      if (isScheduled) {
        if (!scheduleData.task_name || !scheduleData.execution_cycle || !scheduleData.execution_time) {
          onShowToast('请完整填写定时任务配置', 'error');
          setIsSubmitting(false);
          return;
        }

        const scheduledTaskData = {
          ...baseRequestData,
          task_name: scheduleData.task_name,
          execution_cycle: scheduleData.execution_cycle,
          execution_time: scheduleData.execution_time,
          interval_days: scheduleData.interval_days,
          end_date: scheduleData.end_date || undefined,
          analysis_date: formData.analysis_date,
        };

        await scheduledTasksAPI.create(scheduledTaskData);
        onShowToast('✅ 定时任务创建成功！', 'success');
        setTimeout(() => window.location.href = '/scheduled-tasks', 1500);
        return;
      }

      // 立即分析逻辑
      const requestData = {
        ...baseRequestData,
        analysis_date: formData.analysis_date,
      };
      
      const response = await analysisAPI.startAnalysis(requestData);
      onShowToast('✅ 分析任务已启动！', 'success');
      onAnalysisStart(response.analysis_id);
      
    } catch (error: any) {
      onShowToast(error.message || '操作失败', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* ... 现有表单字段 ... */}
        
        {/* 隐私授权 */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          {/* ... 现有内容 ... */}
        </div>

        {/* 定时执行配置 - 新增 */}
        <ScheduleConfig
          scheduleData={scheduleData}
          onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
          isScheduled={isScheduled}
          onToggleSchedule={setIsScheduled}
        />

        {/* 提交按钮 */}
        <div className="text-center pt-6">
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>{isScheduled ? '创建定时任务中...' : '启动分析中...'}</>
            ) : (
              <>{isScheduled ? '创建定时任务' : '开始分析'}</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
```

## 验证集成

集成完成后，检查以下内容：

1. ✅ 页面能正常加载，没有编译错误
2. ✅ 在隐私授权部分下方能看到"定时执行（可选）"部分
3. ✅ 勾选"启用定时任务"后，显示配置表单
4. ✅ 填写完整配置后，提交按钮文字变为"创建定时任务"
5. ✅ 不勾选时，提交按钮文字为"开始分析"（原有行为）
6. ✅ 创建定时任务成功后跳转到 `/scheduled-tasks` 页面

## 故障排除

### 问题：找不到 ScheduleConfig

**解决方案**：确认文件路径正确，ScheduleConfig.tsx 应该在同一目录下。

### 问题：scheduledTasksAPI 未定义

**解决方案**：确认已从 `@/lib/api` 导入 `scheduledTasksAPI`。

### 问题：提交后没有跳转

**解决方案**：检查浏览器控制台是否有错误，确认 API 调用成功。

### 问题：表单验证失败

**解决方案**：确保在 `isScheduled` 为 true 时，验证了所有必需的定时任务字段。

## 需要帮助？

如果遇到问题，请检查：
1. 浏览器控制台的错误信息
2. 后端日志
3. 网络请求是否成功（开发者工具 Network 标签）

参考完整文档：`web/frontend/SCHEDULE_INTEGRATION_GUIDE.md`
