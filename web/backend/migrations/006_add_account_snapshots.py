"""
Migration 006: Add account_snapshots table for daily account tracking

This migration creates the account_snapshots table to store daily snapshots
of account balance and positions for historical tracking and trend analysis.
"""

from sqlalchemy import text


def upgrade(connection):
    """
    Create account_snapshots table
    """
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS account_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            market_type VARCHAR(10) NOT NULL,
            snapshot_date TIMESTAMP NOT NULL,
            total_assets FLOAT NOT NULL,
            cash FLOAT NOT NULL,
            market_value FLOAT NOT NULL,
            unrealized_pnl FLOAT DEFAULT 0.0,
            realized_pnl FLOAT DEFAULT 0.0,
            account_data TEXT,
            positions_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """))
    
    # Create indexes for better query performance
    connection.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_account_snapshots_user_id 
        ON account_snapshots(user_id)
    """))
    
    connection.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_account_snapshots_market_type 
        ON account_snapshots(market_type)
    """))
    
    connection.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_account_snapshots_snapshot_date 
        ON account_snapshots(snapshot_date)
    """))
    
    # Create composite index for common queries
    connection.execute(text("""
        CREATE INDEX IF NOT EXISTS idx_account_snapshots_user_market_date 
        ON account_snapshots(user_id, market_type, snapshot_date DESC)
    """))
    
    connection.commit()
    print("✅ Migration 006: account_snapshots table created successfully")


def downgrade(connection):
    """
    Drop account_snapshots table
    """
    connection.execute(text("DROP TABLE IF EXISTS account_snapshots"))
    connection.commit()
    print("✅ Migration 006: account_snapshots table dropped successfully")


if __name__ == "__main__":
    # For testing migration independently
    from web.backend.database import engine
    
    print("Running migration 006: Add account_snapshots table")
    with engine.connect() as conn:
        upgrade(conn)
    print("Migration completed!")
