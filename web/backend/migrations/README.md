# Database Migrations

This directory contains SQL migration scripts for the TradingAgents database.

## Migration History

### 001_add_intraday_trading_tables.sql (2025-11-06)

Adds three new tables for the Intraday Trading Agent System:

#### 1. position_records
Tracks stock positions with first opening time and current status.

**Key Fields:**
- `stock_code`, `market_type` - Stock identifier and market
- `first_open_time`, `first_open_price` - Initial position details
- `current_quantity` - Current position size
- `is_closed` - Whether position is closed

**Indexes:**
- `idx_position_records_user_id` - Query by user
- `idx_position_records_stock_code` - Query by stock
- `idx_position_records_user_stock` - Composite index for user+stock queries

#### 2. trading_history
Records all trades for each position with decision context.

**Key Fields:**
- `trade_type` - BUY or SELL
- `quantity`, `price` - Trade details
- `decision_reason` - Why the trade was made
- `technical_signals` - Technical indicators (JSON)
- `news_sentiment` - News sentiment at trade time

**Indexes:**
- `idx_trading_history_position_id` - Query by position
- `idx_trading_history_trade_time` - Query by time

#### 3. intraday_decision_records
Stores complete analysis sessions with full decision-making process.

**Key Fields:**
- `session_id` - Unique session identifier
- `positions_analyzed` - List of stocks analyzed (JSON)
- `account_snapshot` - Account state at analysis time (JSON)
- `decision_report` - Full decision report text
- `trades_executed` - List of executed trades (JSON)
- `tool_calls` - Complete tool call sequence (JSON)

**Indexes:**
- `idx_intraday_decisions_user_id` - Query by user
- `idx_intraday_decisions_session_id` - Query by session
- `idx_intraday_decisions_start_time` - Query by time
- `idx_intraday_decisions_status` - Query by status

## How to Apply Migrations

### Automatic (Recommended)
The migrations are automatically applied when the application starts via SQLAlchemy's `create_all()` method in `database.py`.

```python
from web.backend.database import init_db_sync
init_db_sync()
```

### Manual (SQLite)
If you need to manually apply migrations to an existing database:

```bash
sqlite3 db/tradingagents.db < web/backend/migrations/001_add_intraday_trading_tables.sql
```

### Manual (PostgreSQL)
For PostgreSQL deployments, use the PostgreSQL-specific version in the migration file:

```bash
psql -U username -d tradingagents < web/backend/migrations/001_add_intraday_trading_tables.sql
```

## Testing Migrations

Run the test script to verify models are correctly configured:

```bash
python web/backend/test_intraday_models.py
```

## Database Schema

The complete schema includes:

**Existing Tables:**
- users
- user_configs
- analysis_records
- analysis_logs
- export_records
- scheduled_tasks

**New Tables (Intraday Trading):**
- position_records
- trading_history
- intraday_decision_records

## Relationships

```
User (1) ----< (N) PositionRecord
PositionRecord (1) ----< (N) TradingHistory
User (1) ----< (N) IntradayDecisionRecord
```

## Notes

- All tables use `ON DELETE CASCADE` for foreign keys to maintain referential integrity
- JSON fields are stored as TEXT in SQLite and JSONB in PostgreSQL
- Timestamps use timezone-aware types for consistency across deployments
- Indexes are optimized for common query patterns (user lookups, time-based queries)
