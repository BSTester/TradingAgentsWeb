# Database Migrations

## Overview

This directory contains database migration scripts for TradingAgents Web Interface. Migrations are automatically applied on application startup.

## Migration Files

### Core Files

- **`auto_migrate.py`** - Auto migration manager (runs on startup)
- **`init_schema.py`** - Initial schema migration (creates all tables)
- **`AUTO_MIGRATION.md`** - Detailed documentation

### Migration History Table

The system uses a `migration_history` table to track applied migrations:

```sql
CREATE TABLE migration_history (
    migration_name VARCHAR(255) PRIMARY KEY,
    applied_at DATETIME NOT NULL,
    description VARCHAR(500)
);
```

## Current Schema

The current database schema includes:

### Tables

1. **users** - User accounts and authentication
   - id, username, email, hashed_password, role, is_active
   - created_at, updated_at

2. **user_configs** - User-specific configuration
   - id, user_id
   - last_ticker, last_analysts, last_research_depth
   - last_llm_provider, last_shallow_thinker, last_deep_thinker, last_backend_url
   - enable_trading_executor, futu_api_base_url, futu_api_key
   - last_api_key
   - created_at, updated_at

3. **scheduled_tasks** - Recurring analysis tasks
   - id, user_id, task_name
   - ticker, market, analysts, research_depth
   - llm_provider, shallow_thinker, deep_thinker, backend_url
   - is_public, enable_trading_executor, futu_api_base_url, futu_api_key
   - execution_cycle, execution_time, interval_days, day_of_week, end_date
   - is_enabled, status, next_run_time, last_run_time, total_executions
   - scheduler_job_id
   - created_at, updated_at

4. **analysis_records** - Analysis requests and results
   - id, analysis_id, user_id
   - ticker, company_name, market, analysis_date
   - analysts, research_depth, llm_provider, shallow_thinker, deep_thinker, backend_url
   - is_public, enable_trading_executor, futu_api_base_url, futu_api_key
   - status, current_step, progress_percentage
   - final_state, trading_decision, final_summary, phases
   - market_analysis, sentiment_analysis, news_analysis, fundamentals_analysis, risk_assessment
   - error_message, error_traceback
   - created_at, updated_at, started_at, completed_at

5. **analysis_logs** - Real-time analysis logs
   - id, analysis_record_id
   - timestamp, level, message, agent, step, progress
   - log_metadata

6. **export_records** - Export tracking (PDF, Markdown, JSON)
   - id, user_id, analysis_record_id
   - export_format, file_path, file_size, download_url
   - export_options, status, expires_at, downloaded_at
   - error_message
   - created_at, updated_at

## Usage

### Automatic (Recommended)

Migrations run automatically on application startup:

```bash
python web/backend/app.py
# or
uvicorn web.backend.app:app --reload
```

### Manual

Run migrations manually:

```bash
python web/backend/migrations/auto_migrate.py
```

### Initialize Fresh Database

For a completely new database:

```bash
python web/backend/migrations/init_schema.py
```

## Adding New Migrations

1. **Create migration script**:
   ```python
   # web/backend/migrations/my_migration.py
   def run_migration():
       # Your migration logic here
       pass
   
   if __name__ == "__main__":
       run_migration()
   ```

2. **Register in auto_migrate.py**:
   ```python
   MIGRATIONS = [
       # ... existing migrations ...
       {
           "name": "my_migration",
           "file": "my_migration.py",
           "description": "What this migration does"
       },
   ]
   ```

3. **Test**:
   ```bash
   python web/backend/migrations/my_migration.py
   ```

4. **Deploy**: Migration runs automatically on next startup

## Migration Best Practices

1. **Idempotent**: Migrations should be safe to run multiple times
2. **Backward Compatible**: Don't delete existing columns
3. **Test First**: Test in development before production
4. **Backup**: Always backup production database before migrations
5. **Atomic**: Each migration should be a single logical change

## Troubleshooting

### Reset Migration History

**Warning**: This will cause all migrations to re-run!

```sql
DROP TABLE migration_history;
```

### Skip Failed Migration

```sql
DELETE FROM migration_history WHERE migration_name = 'failed_migration';
```

### Mark Migration as Applied

```sql
INSERT INTO migration_history (migration_name, applied_at, description)
VALUES ('migration_name', datetime('now'), 'Description');
```

## Version History

- **v2.0** (Current) - Consolidated schema with all features
  - User authentication and roles
  - User configuration caching
  - Scheduled tasks
  - Trading executor support
  - Analysis tracking and results
  - Export functionality

## Support

For issues or questions:
- Check `AUTO_MIGRATION.md` for detailed documentation
- Review migration logs in application startup output
- Check `migration_history` table for applied migrations
