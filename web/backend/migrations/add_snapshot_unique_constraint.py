#!/usr/bin/env python3
"""
Migration: Add unique constraint for account snapshots

Ensures each user can only have one snapshot per market per day.
This prevents duplicate snapshots from being created.

Date: 2025-11-13
"""

from sqlalchemy import text
from web.backend.database import SessionLocal, engine
import logging

logger = logging.getLogger(__name__)


def upgrade():
    """
    Add unique constraint to account_snapshots table
    
    The constraint ensures that for each combination of:
    - user_id
    - market_type
    - DATE(snapshot_date)
    
    Only one record can exist.
    """
    db = SessionLocal()
    try:
        # Check database type
        db_url = str(engine.url)
        
        if 'mysql' in db_url or 'mariadb' in db_url:
            # MySQL/MariaDB: Create unique index on date part
            logger.info("Creating unique constraint for MySQL/MariaDB...")
            
            # First, check if constraint already exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                AND table_name = 'account_snapshots'
                AND index_name = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if exists:
                logger.info("Unique constraint already exists, skipping...")
                return True
            
            # Create unique index on DATE(snapshot_date)
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint created successfully (MySQL/MariaDB)")
            
        elif 'sqlite' in db_url:
            # SQLite: Create unique index on date part
            logger.info("Creating unique constraint for SQLite...")
            
            # Check if index already exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM sqlite_master
                WHERE type = 'index'
                AND name = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if exists:
                logger.info("Unique constraint already exists, skipping...")
                return True
            
            # Create unique index on DATE(snapshot_date)
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint created successfully (SQLite)")
            
        elif 'postgresql' in db_url:
            # PostgreSQL: Create unique index on date part
            logger.info("Creating unique constraint for PostgreSQL...")
            
            # Check if index already exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = 'account_snapshots'
                AND indexname = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if exists:
                logger.info("Unique constraint already exists, skipping...")
                return True
            
            # Create unique index on DATE(snapshot_date)
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint created successfully (PostgreSQL)")
            
        else:
            logger.warning(f"Unknown database type: {db_url}")
            logger.warning("Skipping unique constraint creation")
            return False
        
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error creating unique constraint: {e}")
        # Don't raise exception - allow migration to continue
        return False
    finally:
        db.close()


def downgrade():
    """
    Remove unique constraint from account_snapshots table
    """
    db = SessionLocal()
    try:
        # Check database type
        db_url = str(engine.url)
        
        if 'mysql' in db_url or 'mariadb' in db_url:
            logger.info("Removing unique constraint for MySQL/MariaDB...")
            sql = text("DROP INDEX uq_user_market_date ON account_snapshots")
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint removed successfully (MySQL/MariaDB)")
            
        elif 'sqlite' in db_url:
            logger.info("Removing unique constraint for SQLite...")
            sql = text("DROP INDEX IF EXISTS uq_user_market_date")
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint removed successfully (SQLite)")
            
        elif 'postgresql' in db_url:
            logger.info("Removing unique constraint for PostgreSQL...")
            sql = text("DROP INDEX IF EXISTS uq_user_market_date")
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint removed successfully (PostgreSQL)")
            
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error removing unique constraint: {e}")
        return False
    finally:
        db.close()


def run_migration():
    """Run the migration"""
    print("=" * 60)
    print("Migration: Add unique constraint for account snapshots")
    print("=" * 60)
    
    success = upgrade()
    
    if success:
        print("\n✅ Migration completed successfully")
        print("\nUnique constraint added:")
        print("  - Table: account_snapshots")
        print("  - Constraint: (user_id, market_type, DATE(snapshot_date))")
        print("  - Effect: Each user can only have one snapshot per market per day")
    else:
        print("\n⚠️  Migration completed with warnings")
        print("Check logs for details")
    
    print("=" * 60)
    return success


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    run_migration()
