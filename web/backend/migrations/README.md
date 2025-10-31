# Database Migrations

This directory contains database migration scripts for TradingAgentsWeb.

## Available Migrations

### add_scheduled_tasks_table.py

Adds the `scheduled_tasks` table to support scheduled analysis tasks feature.

**Usage:**

```bash
# Run migration (add table)
python web/backend/migrations/add_scheduled_tasks_table.py

# Rollback migration (drop table)
python web/backend/migrations/add_scheduled_tasks_table.py --rollback
```

**What it does:**
- Creates `scheduled_tasks` table with all required columns
- Adds indexes for performance optimization
- Sets up foreign key relationship with `users` table
- Checks if table already exists before creating

**Rollback:**
- Drops the `scheduled_tasks` table
- Does not affect other tables or data

## Notes

- The project uses SQLAlchemy's `Base.metadata.create_all()` for initial database setup
- These migration scripts are for adding new tables to existing databases
- Always backup your database before running migrations
- Test migrations on a development database first
