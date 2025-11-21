# Schedule Configuration Integration Guide

## Overview

This guide explains how to integrate the ScheduleConfig component into the existing AnalysisConfigForm to enable scheduled task creation.

## Step 1: Import Required Components and Types

Add these imports to `AnalysisConfigForm.tsx`:

```typescript
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';
import { scheduledTasksAPI } from '@/lib/api';
```

## Step 2: Add State for Schedule Configuration

Add these state variables after the existing state declarations:

```typescript
// Add after existing useState declarations
const [isScheduled, setIsScheduled] = useState(false);
const [scheduleData, setScheduleData] = useState<ScheduleData>({
  task_name: '',
  execution_cycle: '',
  execution_time: '',
  interval_days: 1,
  end_date: ''
});
```

## Step 3: Add ScheduleConfig Component to Form

Insert the ScheduleConfig component after the "隐私授权" section and before the submit button:

```typescript
{/* 隐私授权 */}
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
  {/* ... existing privacy section ... */}
</div>

{/* 定时执行配置 - NEW SECTION */}
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>

{/* 提交按钮 */}
<div className="text-center pt-6">
  {/* ... existing submit button ... */}
</div>
```

## Step 4: Update Form Submission Logic

Replace the `confirmStartAnalysis` function with this updated version:

```typescript
const confirmStartAnalysis = async () => {
  setShowPrivacyDialog(false);
  setIsSubmitting(true);

  try {
    // Save complete configuration to cache (including API key)
    saveConfigToCache(formData);

    // Prepare base request data
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

    // Add API key based on provider
    if (formData.llm_provider === 'openai' || formData.llm_provider === 'oneai' || 
        formData.llm_provider === 'qwen' || formData.llm_provider === 'deepseek' || 
        formData.llm_provider === 'openrouter') {
      baseRequestData.openai_api_key = formData.api_key;
    } else if (formData.llm_provider === 'anthropic') {
      baseRequestData.anthropic_api_key = formData.api_key;
    } else if (formData.llm_provider === 'google') {
      baseRequestData.google_api_key = formData.api_key;
    }

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
      
      // Redirect to scheduled tasks page after a short delay
      setTimeout(() => {
        window.location.href = '/scheduled-tasks';
      }, 1500);
      
    } else {
      // Immediate execution (existing logic)
      const requestData = {
        ...baseRequestData,
        analysis_date: formData.analysis_date,
      };

      const response: AnalysisResponse = await analysisAPI.startAnalysis(requestData);

      console.log('=== Analysis Started ===');
      console.log('Response:', response);
      console.log('Analysis ID:', response.analysis_id);

      // Check if this is a duplicate task
      if (response.message && response.status !== 'queued') {
        console.log('Duplicate task detected, connecting to existing analysis:', response.analysis_id);
        onShowToast('⚠️ 您已有正在进行的分析任务，不能同时运行多个分析。已自动连接到现有任务。', 'warning');
        setTimeout(() => {
          onAnalysisStart(response.analysis_id);
        }, 1500);
      } else {
        onShowToast('✅ 分析任务已启动！', 'success');
        onAnalysisStart(response.analysis_id);
      }
    }
  } catch (error: any) {
    console.error('操作失败:', error);
    onShowToast(error.message || '操作失败', 'error');
  } finally {
    setIsSubmitting(false);
  }
};
```

## Step 5: Update Submit Button Text

Update the submit button to reflect whether it's creating a scheduled task or starting immediate analysis:

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

## Step 6: Update Cache Logic (Optional)

If you want to cache the schedule configuration as well, update the cache functions:

```typescript
// Update saveConfigToCache to include schedule data
const saveConfigToCache = (data: FormData, schedule?: ScheduleData) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      ...data,
      schedule: schedule,
      cached_at: new Date().toISOString()
    }));
  } catch (_error) {
    console.warn('缓存配置失败:', _error);
  }
};

// Update loadConfigFromCache to restore schedule data
const loadConfigFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const cachedData = JSON.parse(cached);
      const cachedDate = new Date(cachedData.cached_at);
      const now = new Date();
      const diffHours = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60);

      if (diffHours < 24) {
        setFormData(prev => ({
          ...prev,
          ...cachedData,
          analysis_date: new Date().toISOString().split('T')[0] || ''
        }));

        // Restore schedule data if exists
        if (cachedData.schedule) {
          setScheduleData(cachedData.schedule);
          setIsScheduled(true);
        }

        if (cachedData.api_key && cachedData.llm_provider && cachedData.llm_provider !== 'ollama') {
          setApiKeyValidated(true);
        }

        return true;
      }
    }
  } catch (_error) {
    console.warn('加载缓存配置失败:', _error);
  }
  return false;
};
```

## Complete Integration Example

Here's a minimal example showing the key parts:

```typescript
export function AnalysisConfigForm({ config, onAnalysisStart, onShowToast }: AnalysisConfigFormProps) {
  // ... existing state ...
  
  // Add schedule state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleData>({
    task_name: '',
    execution_cycle: '',
    execution_time: '',
    interval_days: 1,
    end_date: ''
  });

  // ... existing functions ...

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {/* ... existing form sections ... */}
        
        {/* Privacy section */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
          {/* ... existing privacy content ... */}
        </div>

        {/* NEW: Schedule configuration */}
        <ScheduleConfig
          scheduleData={scheduleData}
          onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
          isScheduled={isScheduled}
          onToggleSchedule={setIsScheduled}
        />

        {/* Submit button */}
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

## Testing Checklist

After integration, test the following:

- [ ] Form displays schedule configuration section
- [ ] Toggle between immediate and scheduled execution works
- [ ] All schedule fields validate correctly
- [ ] Creating scheduled task redirects to /scheduled-tasks
- [ ] Immediate execution still works as before
- [ ] Schedule configuration is cached (optional)
- [ ] Error messages display correctly
- [ ] Submit button text changes based on mode

## Troubleshooting

### Issue: ScheduleConfig not showing
- Check import path is correct
- Verify component is placed inside the form
- Check if there are any console errors

### Issue: API call fails
- Verify scheduledTasksAPI is imported
- Check network tab for error details
- Ensure backend is running and routes are registered

### Issue: Validation errors
- Check all required fields are filled
- Verify execution_time format is HH:MM
- Ensure interval_days is provided for every_n_days cycle

## Additional Notes

- The schedule configuration is optional - users can still create immediate analyses
- Schedule data is separate from analysis configuration
- Both immediate and scheduled tasks use the same base configuration
- Scheduled tasks appear in the /scheduled-tasks dashboard
- Executed scheduled tasks appear in the regular analysis history
