# Backend Services

This directory contains service modules for the TradingAgentsWeb backend.

## Service Modules

### Intraday Trading System

Short-term trading system with automated analysis and execution.

#### `intraday_scheduler.py`
**Purpose**: Core scheduler class for a single user's intraday trading.

**Key Class**: `IntradayScheduler`
- Manages periodic execution of intraday trading analysis
- Checks market hours before triggering analysis
- Supports multiple markets (US/HK/CN/ALL)

**Usage**: Should NOT be instantiated directly. Use `UserIntradaySchedulerManager` instead.

#### `user_intraday_scheduler.py`
**Purpose**: Multi-user scheduler management.

**Key Class**: `UserIntradaySchedulerManager`
- Manages multiple `IntradayScheduler` instances (one per user)
- Provides centralized control for all user schedulers
- Handles scheduler lifecycle (create, start, stop, remove)

**Usage**:
```python
from web.backend.services.user_intraday_scheduler import get_manager

manager = get_manager()
await manager.create_scheduler(user_id=1, interval_minutes=5, market_type="US")
await manager.start_scheduler(user_id=1)
```

#### `intraday_executor.py`
**Purpose**: Executes a single intraday trading analysis session.

**Key Function**: `execute_intraday_analysis()`
- Creates decision record in database
- Invokes LangGraph agent for analysis
- Saves results and sends WebSocket notifications

**Usage**:
```python
from web.backend.services.intraday_executor import execute_intraday_analysis

result = await execute_intraday_analysis(market_type="US", user_id=1)
```

### Scheduled Tasks System

Long-term scheduled analysis tasks using APScheduler.

#### `scheduler_service.py`
**Purpose**: APScheduler service for managing scheduled tasks.

**Key Class**: `SchedulerService`
- Manages scheduled analysis tasks
- Supports cron and interval triggers
- Persists jobs to database

**Usage**:
```python
from web.backend.services.scheduler_service import SchedulerService

scheduler = SchedulerService(db_url="sqlite:///./tradingagents.db")
await scheduler.start()
```

#### `task_executor.py`
**Purpose**: Executes scheduled analysis tasks.

**Key Function**: `execute_scheduled_task()`
- Called by APScheduler when a task is triggered
- Creates analysis record and submits to task manager

### Email Service

#### `email_service.py`
**Purpose**: Email notification service.

**Key Class**: `EmailService`
- Sends analysis completion notifications
- Supports HTML email templates
- Handles email configuration

**Usage**:
```python
from web.backend.services.email_service import init_email_service

email_service = init_email_service()
await email_service.send_analysis_complete_email(user_email, analysis_id)
```

## Architecture Overview

### Intraday Trading Flow

```
User API Request
    ↓
UserIntradaySchedulerManager.create_scheduler()
    ↓
IntradayScheduler (periodic execution)
    ↓
execute_intraday_analysis()
    ↓
LangGraph Agent (autonomous tool calling)
    ↓
Decision Record + WebSocket Notification
```

### Scheduled Tasks Flow

```
User API Request
    ↓
SchedulerService.add_job()
    ↓
APScheduler (cron/interval trigger)
    ↓
execute_scheduled_task()
    ↓
Task Manager (existing analysis flow)
```

## Key Differences

| Feature | Intraday Trading | Scheduled Tasks |
|---------|------------------|-----------------|
| **Trigger** | Periodic (every N minutes) | Cron/Interval |
| **Execution** | LangGraph agent | Traditional analysis |
| **Scope** | Short-term trading | Long-term analysis |
| **Market Hours** | Checks market hours | No market check |
| **User Isolation** | Per-user scheduler | Shared scheduler |

## Best Practices

1. **Intraday Trading**:
   - Always use `UserIntradaySchedulerManager` to create schedulers
   - Never instantiate `IntradayScheduler` directly
   - Check market hours before analysis

2. **Scheduled Tasks**:
   - Use cron expressions for specific times
   - Use interval triggers for periodic tasks
   - Set appropriate end dates

3. **Email Service**:
   - Configure SMTP settings in environment variables
   - Use async methods for non-blocking email sending
   - Handle email failures gracefully

## Configuration

### Environment Variables

```bash
# Intraday Trading
INTRADAY_INTERVAL_MINUTES=5
INTRADAY_MARKET_TYPE=ALL

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@tradingagents.com
SMTP_FROM_NAME=TradingAgents

# Scheduled Tasks
DATABASE_URL=sqlite:///./tradingagents.db
```

## Testing

### Test Intraday Trading

```python
# Test scheduler creation
manager = get_manager()
scheduler = await manager.create_scheduler(user_id=1, interval_minutes=5)
assert scheduler is not None

# Test scheduler start/stop
await manager.start_scheduler(user_id=1)
assert manager.get_scheduler_status(user_id=1)['is_running'] == True

await manager.stop_scheduler(user_id=1)
assert manager.get_scheduler_status(user_id=1)['is_running'] == False
```

### Test Scheduled Tasks

```python
# Test job creation
scheduler = SchedulerService(db_url="sqlite:///./test.db")
await scheduler.start()

job_id = await scheduler.add_job(
    func=execute_scheduled_task,
    trigger_type="interval",
    minutes=5
)
assert job_id is not None
```

## Troubleshooting

### Intraday Trading Issues

**Problem**: Scheduler not triggering analysis
- Check if market is open
- Verify scheduler is running
- Check logs for errors

**Problem**: Analysis fails
- Check LLM configuration
- Verify Futu API connection
- Check agent logs

### Scheduled Tasks Issues

**Problem**: Jobs not executing
- Check APScheduler is started
- Verify job is enabled
- Check database connection

**Problem**: Jobs executing multiple times
- Check `coalesce` setting
- Verify `max_instances` setting
- Check for duplicate jobs

## Related Documentation

- [Intraday Trading System](../../../docs/INTRADAY_AGENT_REFACTOR.md)
- [WebSocket Optimization](../../../docs/INTRADAY_WEBSOCKET_OPTIMIZATION.md)
- [Multi-Market Support](../../../docs/INTRADAY_MULTI_MARKET_SUPPORT.md)
- [Scheduled Tasks Guide](../../../docs/SCHEDULED_TASKS.md)
