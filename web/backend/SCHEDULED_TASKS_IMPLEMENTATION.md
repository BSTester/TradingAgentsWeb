# Scheduled Analysis Tasks - Implementation Summary

## Overview

This document summarizes the implementation of the scheduled analysis tasks feature for TradingAgentsWeb. The feature allows users to configure analysis tasks to run automatically at specified intervals.

## Completed Components

### Backend (✅ Complete)

#### 1. Database Models (`web/backend/models.py`)
- Added `ScheduledTask` model with all required fields
- Integrated with User model via relationship
- Supports all execution cycles: daily, weekly, every_n_days, workdays

#### 2. Pydantic Schemas (`web/backend/schemas.py`)
- `ScheduledTaskCreate`: Validation for task creation
- `ScheduledTaskResponse`: API response format
- `ScheduledTaskUpdate`: Status update schema
- `ScheduledTaskListResponse`: Paginated list response

#### 3. Scheduler Service (`web/backend/services/scheduler_service.py`)
- APScheduler integration with SQLAlchemy job store
- Support for all execution cycles
- Job management (add, remove, pause, resume)
- Automatic trigger creation based on schedule configuration

#### 4. Task Executor (`web/backend/services/task_executor.py`)
- Executes scheduled tasks at configured times
- Integrates with existing `task_manager` for user-level queuing
- Handles end date checking and automatic task removal
- Creates analysis records for each execution

#### 5. API Routes (`web/backend/routes/scheduled_task_routes.py`)
- POST `/api/scheduled-tasks/` - Create scheduled task
- GET `/api/scheduled-tasks/` - List pending tasks (paginated)
- GET `/api/scheduled-tasks/{id}` - Get task details
- PATCH `/api/scheduled-tasks/{id}` - Update task (enable/disable, rename)
- DELETE `/api/scheduled-tasks/{id}` - Delete task

#### 6. Application Integration (`web/backend/app.py`)
- Scheduler initialization in application startup
- Load existing tasks on restart
- Graceful shutdown handling
- Router registration

#### 7. Database Migration (`web/backend/migrations/add_scheduled_tasks_table.py`)
- Migration script to add `scheduled_tasks` table
- Rollback support
- Works with both SQLite and MySQL

### Frontend (✅ Complete)

#### 1. Schedule Configuration Component (`web/frontend/src/components/analysis/ScheduleConfig.tsx`)
- Reusable schedule configuration form
- Support for all execution cycles
- Optional end date selection
- Task naming
- Schedule summary display

#### 2. Scheduled Tasks Dashboard (`web/frontend/src/app/scheduled-tasks/page.tsx`)
- List all pending scheduled tasks
- Enable/disable toggle
- Delete functionality with confirmation
- Pagination support
- Task statistics display

#### 3. API Client (`web/frontend/src/lib/api.ts`)
- `scheduledTasksAPI.create()` - Create task
- `scheduledTasksAPI.list()` - List tasks
- `scheduledTasksAPI.get()` - Get task details
- `scheduledTasksAPI.update()` - Update task
- `scheduledTasksAPI.delete()` - Delete task

#### 4. React Query Hooks (`web/frontend/src/hooks/useScheduledTasks.ts`)
- `useScheduledTasks()` - List tasks with pagination
- `useScheduledTask()` - Get single task
- `useCreateScheduledTask()` - Create mutation
- `useUpdateScheduledTask()` - Update mutation with optimistic updates
- `useDeleteScheduledTask()` - Delete mutation with optimistic updates

## Integration Steps

### 1. Install Dependencies

```bash
pip install apscheduler>=3.10.0
```

### 2. Run Database Migration

```bash
# For new installations, tables will be created automatically
# For existing databases, run the migration:
python web/backend/migrations/add_scheduled_tasks_table.py
```

### 3. Integrate Schedule Config into Analysis Form

Add the following to `AnalysisConfigForm.tsx`:

```typescript
import { ScheduleConfig, ScheduleData } from './ScheduleConfig';

// Add to state
const [isScheduled, setIsScheduled] = useState(false);
const [scheduleData, setScheduleData] = useState<ScheduleData>({
  task_name: '',
  execution_cycle: '',
  execution_time: '',
  interval_days: 1,
  end_date: ''
});

// Add before the submit button
<ScheduleConfig
  scheduleData={scheduleData}
  onChange={(data) => setScheduleData(prev => ({ ...prev, ...data }))}
  isScheduled={isScheduled}
  onToggleSchedule={setIsScheduled}
/>

// Update handleSubmit to call scheduled tasks API when isScheduled is true
if (isScheduled) {
  // Call scheduledTasksAPI.create() instead of analysisAPI.startAnalysis()
  const response = await scheduledTasksAPI.create({
    ...requestData,
    ...scheduleData
  });
  onShowToast('定时任务创建成功！', 'success');
  // Redirect to scheduled tasks page
  window.location.href = '/scheduled-tasks';
} else {
  // Existing immediate execution logic
  const response = await analysisAPI.startAnalysis(requestData);
  onAnalysisStart(response.analysis_id);
}
```

### 4. Add Navigation Link

Add link to scheduled tasks page in your navigation menu:

```tsx
<a href="/scheduled-tasks" className="nav-link">
  <i className="fas fa-clock mr-2" />
  定时任务
</a>
```

### 5. Install Frontend Dependencies

```bash
cd web/frontend
npm install date-fns
```

## Features

### Execution Cycles

1. **Daily** - Runs every day at specified time
2. **Weekly** - Runs every Monday at specified time
3. **Workdays** - Runs Monday-Friday at specified time
4. **Every N Days** - Runs every N days at specified time (1-365 days)

### Task Management

- **Enable/Disable** - Pause tasks without deleting them
- **End Date** - Automatically stop tasks after a specific date
- **Task Naming** - Give tasks descriptive names
- **Execution History** - View execution count and last run time
- **Next Run Time** - See when task will execute next

### User-Level Queuing

- Each user can only run one analysis at a time (manual or scheduled)
- Scheduled tasks automatically queue if user has a running task
- Tasks execute in order when previous task completes

### Automatic Cleanup

- Tasks are automatically removed from the scheduled list when:
  - End date is reached
  - No more executions are scheduled
- Completed tasks still appear in analysis history

## API Examples

### Create Scheduled Task

```bash
POST /api/scheduled-tasks/
Content-Type: application/json
Authorization: Bearer <token>

{
  "task_name": "Daily TSLA Analysis",
  "ticker": "TSLA",
  "analysts": ["market", "news", "fundamentals"],
  "research_depth": 2,
  "llm_provider": "openai",
  "backend_url": "https://api.openai.com/v1",
  "shallow_thinker": "gpt-4o-mini",
  "deep_thinker": "gpt-4o",
  "is_public": true,
  "execution_cycle": "daily",
  "execution_time": "09:00",
  "end_date": "2025-12-31"
}
```

### List Scheduled Tasks

```bash
GET /api/scheduled-tasks/?page=1&limit=20
Authorization: Bearer <token>
```

### Update Task Status

```bash
PATCH /api/scheduled-tasks/1
Content-Type: application/json
Authorization: Bearer <token>

{
  "is_enabled": false
}
```

### Delete Task

```bash
DELETE /api/scheduled-tasks/1
Authorization: Bearer <token>
```

## Configuration

### Scheduler Settings

The scheduler uses APScheduler with the following defaults:

- **Job Store**: SQLAlchemy (same database as application)
- **Coalesce**: True (combine missed runs)
- **Max Instances**: 1 (one instance per job)
- **Misfire Grace Time**: 3600 seconds (1 hour)
- **Timezone**: UTC

### Task Limits

- Maximum 100 scheduled tasks per user
- Interval days: 1-365 days
- End date must be in the future

## Troubleshooting

### Tasks Not Executing

1. Check if scheduler service is running:
   - Look for "✅ Scheduler service started" in logs
   
2. Check if task is enabled:
   - Verify `is_enabled` is `true` in database
   
3. Check next run time:
   - Verify `next_run_time` is set correctly

### Tasks Executing Multiple Times

- This should not happen due to `max_instances=1` setting
- Check for multiple application instances running
- Verify leader election is working (only one worker should start scheduler)

### Migration Issues

If migration fails:

```bash
# Rollback
python web/backend/migrations/add_scheduled_tasks_table.py --rollback

# Try again
python web/backend/migrations/add_scheduled_tasks_table.py
```

## Future Enhancements

Potential improvements for future versions:

1. **Email Notifications** - Send email when scheduled task completes
2. **Webhook Support** - Call webhook URL after execution
3. **Execution History** - Dedicated table for execution logs
4. **Task Templates** - Save and reuse task configurations
5. **Bulk Operations** - Enable/disable multiple tasks at once
6. **Advanced Scheduling** - Support for cron expressions
7. **Task Dependencies** - Chain tasks together
8. **Retry Logic** - Automatic retry on failure

## Testing

### Backend Tests

```bash
# Test scheduler service
pytest web/backend/tests/test_scheduler_service.py

# Test task executor
pytest web/backend/tests/test_task_executor.py

# Test API routes
pytest web/backend/tests/test_scheduled_task_routes.py
```

### Frontend Tests

```bash
# Test components
npm test -- ScheduleConfig.test.tsx
npm test -- ScheduledTasksPage.test.tsx

# Test hooks
npm test -- useScheduledTasks.test.ts
```

### Manual Testing

1. Create a scheduled task with execution time in 2 minutes
2. Wait and verify task executes
3. Check analysis history for execution record
4. Verify next run time is updated
5. Disable task and verify it doesn't execute
6. Re-enable and verify execution resumes
7. Set end date to tomorrow and verify task stops after that

## Support

For issues or questions:

1. Check application logs for errors
2. Verify database schema is up to date
3. Check APScheduler job store for registered jobs
4. Review this documentation for configuration details

## Conclusion

The scheduled analysis tasks feature is fully implemented and ready for use. It provides a robust, user-friendly way to automate recurring analysis tasks with comprehensive management capabilities.
