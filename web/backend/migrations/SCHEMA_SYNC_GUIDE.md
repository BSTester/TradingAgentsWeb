# Schema Synchronization Guide

## Quick Start

The auto-migration system now includes automatic schema synchronization. When you add a new column to a model, it will be automatically added to the database on the next application startup.

## How to Add a New Column

### Step 1: Add Column to Model

Edit your model in `web/backend/models.py`:

```python
class User(Base):
    __tablename__ = "users"
    
    # Existing columns...
    id = Column(Integer, primary_key=True)
    username = Column(String(50), unique=True)
    
    # Add your new column
    phone_number = Column(String(20), nullable=True)  # ✅ Will be auto-added
```

### Step 2: Restart Application

```bash
python web/backend/app.py
```

The system will automatically:
1. Detect the new column
2. Generate the appropriate SQL
3. Add the column to the database

### Step 3: Verify

Check the startup logs:

```
[SCHEMA SYNC] Comparing database schema with models...
   [ADD] users.phone_number (VARCHAR(20))
   ✅ Added 1 missing column(s)
```

## Supported Scenarios

### ✅ Automatically Handled

- Adding new columns with basic types
- Adding nullable columns
- Adding columns with default values
- Adding columns to existing tables

### ❌ Requires Migration File

- Renaming columns
- Changing column types
- Adding indexes
- Adding foreign keys
- Adding unique constraints
- Data transformations
- Dropping columns (not recommended)

## Column Type Mapping

| SQLAlchemy Type | SQLite | MySQL |
|----------------|--------|-------|
| String(n) | VARCHAR(n) | VARCHAR(n) |
| Text | TEXT | TEXT |
| Integer | INTEGER | INTEGER |
| Float | FLOAT | FLOAT |
| Boolean | BOOLEAN | TINYINT(1) |
| DateTime | DATETIME | DATETIME |
| JSON | TEXT | JSON |

## Examples

### Example 1: Add Nullable Column

```python
# In models.py
class AnalysisRecord(Base):
    # ... existing columns ...
    
    # Add new optional field
    external_id = Column(String(100), nullable=True)
```

Result:
```sql
-- SQLite
ALTER TABLE analysis_records ADD COLUMN external_id VARCHAR(100) NULL

-- MySQL
ALTER TABLE analysis_records ADD COLUMN external_id VARCHAR(100) NULL
```

### Example 2: Add Column with Default

```python
# In models.py
class User(Base):
    # ... existing columns ...
    
    # Add new field with default
    notification_enabled = Column(Boolean, default=True, nullable=False)
```

Result:
```sql
-- SQLite
ALTER TABLE users ADD COLUMN notification_enabled BOOLEAN DEFAULT 1 NOT NULL

-- MySQL
ALTER TABLE users ADD COLUMN notification_enabled TINYINT(1) DEFAULT 1 NOT NULL
```

### Example 3: Add Timestamp Column

```python
# In models.py
from sqlalchemy.sql import func

class AnalysisRecord(Base):
    # ... existing columns ...
    
    # Add timestamp with server default
    archived_at = Column(DateTime(timezone=True), nullable=True)
```

Result:
```sql
-- SQLite
ALTER TABLE analysis_records ADD COLUMN archived_at DATETIME NULL

-- MySQL
ALTER TABLE analysis_records ADD COLUMN archived_at DATETIME NULL
```

## Complex Changes (Require Migration File)

### Adding an Index

Create `web/backend/migrations/add_user_email_index.py`:

```python
#!/usr/bin/env python3
"""
Migration: Add index on user email
"""

import sys
from pathlib import Path

project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import sync_engine
from sqlalchemy import text

def migrate():
    """Add index on users.email"""
    with sync_engine.begin() as conn:
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        """))
    
    print("✅ Index created successfully")

if __name__ == "__main__":
    migrate()
```

Then register in `auto_migrate.py`:

```python
MIGRATIONS = [
    {
        "name": "init_schema",
        "file": "init_schema.py",
        "description": "Initialize database schema"
    },
    {
        "name": "add_user_email_index",
        "file": "add_user_email_index.py",
        "description": "Add index on user email"
    },
]
```

## Testing

### Test Schema Sync

```bash
python web/backend/migrations/test_schema_sync.py
```

### Test Specific Migration

```bash
python web/backend/migrations/your_migration.py
```

### Dry Run (Check What Would Be Added)

The system logs all changes before applying them. Check the startup logs to see what will be added.

## Troubleshooting

### Column Not Being Added

1. **Check model is imported**: Ensure the model is imported in `auto_migrate.py`
2. **Check column name**: Verify the column name doesn't already exist
3. **Check permissions**: Ensure database user has ALTER TABLE permission
4. **Check logs**: Look for error messages in the startup logs

### Type Conversion Error

If you get a type conversion error:

1. Check if the type is supported (see table above)
2. For custom types, you may need a migration file
3. Check database-specific type requirements

### Migration Runs But Column Not Added

1. Check if there was an error in the logs
2. Verify the SQL syntax for your database
3. Check database permissions
4. Try running the SQL manually to see the error

## Best Practices

1. **Start Simple**: Use auto-sync for simple column additions
2. **Test Locally**: Always test on development database first
3. **Check Logs**: Review startup logs to verify changes
4. **Backup Production**: Always backup before deploying schema changes
5. **Use Migrations for Complex Changes**: Don't try to force complex changes through auto-sync

## Database-Specific Notes

### SQLite

- More permissive type system
- No native JSON type (uses TEXT)
- ALTER TABLE has limitations (can't drop columns easily)

### MySQL

- Strict type requirements
- Native JSON support
- Better ALTER TABLE support
- Requires proper character set (UTF-8)

## FAQ

**Q: Will this delete or modify existing columns?**  
A: No, the system only adds missing columns. It never deletes or modifies existing ones.

**Q: What if I rename a column in the model?**  
A: The system will see it as a new column and add it. The old column will remain. You need a migration file to rename columns.

**Q: Can I disable auto-sync?**  
A: Yes, comment out the `compare_and_sync_schema()` call in `auto_migrate.py`.

**Q: What about data migrations?**  
A: Data migrations require a migration file. Auto-sync only handles schema changes.

**Q: Is this safe for production?**  
A: Yes, but always test in development first and backup your production database before deploying.
