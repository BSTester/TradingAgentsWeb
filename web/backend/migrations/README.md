# Database Migrations

This directory contains database migration scripts for the TradingAgentsWeb backend.

## Available Migrations

### 001 - Increase version column length
**File**: `001_increase_version_column_length.sql`  
**Date**: 2025-11-14  
**Description**: Increases the `version` column in `agent_prompt_templates` table from VARCHAR(20) to VARCHAR(50) to support longer version strings.

**Issue**: The application was generating version strings longer than 20 characters, causing database errors:
```
sqlalchemy.exc.DataError: (pymysql.err.DataError) (1406, "Data too long for column 'version' at row 1")
```

### 002 - Fix corrupted version strings
**File**: `002_fix_version_strings.py`  
**Date**: 2025-11-14  
**Description**: Cleans up corrupted version strings like "1.0_edited_edited_edited" by extracting the numeric part or resetting to "1.0".

**Issue**: A bug in the version increment logic was appending strings instead of incrementing numbers, resulting in versions like "1.0_edited_edited_edited".

**Fix**: The version increment logic in `prompt_routes.py` has been corrected to properly parse and increment numeric versions (1.0 → 1.1 → 1.2, etc.)

## How to Apply Migrations

### Migration 001 - Increase version column length

#### Option 1: Using Python Script (Recommended)
```bash
cd web/backend/migrations
python apply_migration_001.py
```

#### Option 2: Using MySQL CLI
```bash
mysql -u your_username -p your_database < 001_increase_version_column_length.sql
```

#### Option 3: Using Docker
If running in Docker, execute inside the MySQL container:
```bash
docker exec -i tradingagents-mysql mysql -u root -p your_database < 001_increase_version_column_length.sql
```

### Migration 002 - Fix corrupted version strings

**Run this AFTER applying migration 001:**

```bash
cd web/backend/migrations
python 002_fix_version_strings.py
```

This will scan all templates and clean up any corrupted version strings.

## Verification

After applying the migration, verify the change:
```sql
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'agent_prompt_templates' AND COLUMN_NAME = 'version';
```

Expected result: `CHARACTER_MAXIMUM_LENGTH` should be `50`.

## Notes

- The model definition in `web/backend/models.py` has been updated to reflect this change
- Existing data will not be affected, only the column constraint is modified
- This migration is backward compatible (shorter strings still work)
