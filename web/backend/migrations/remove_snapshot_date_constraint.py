#!/usr/bin/env python3
"""
Migration: Remove date-based unique constraint for account snapshots

Removes the constraint that limits one snapshot per user per market per day.
This allows multiple snapshots per day at different times (e.g., hourly monitoring).

The new behavior:
- Multiple snapshots per day are allowed (different times)
- Same exact timestamp (to the second) will update existing snapshot

Date: 2025-11-13
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from web.backend.database import SessionLocal, engine
import logging

logger = logging.getLogger(__name__)


def upgrade():
    """
    Remove the date-based unique constraint from account_snapshots table
    
    This allows multiple snapshots per day at different times.
    """
    db = SessionLocal()
    try:
        # Check database type
        db_url = str(engine.url)
        
        if 'mysql' in db_url or 'mariadb' in db_url:
            logger.info("Removing date-based unique constraint for MySQL/MariaDB...")
            
            # Check if constraint exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM information_schema.statistics
                WHERE table_schema = DATABASE()
                AND table_name = 'account_snapshots'
                AND index_name = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if not exists:
                logger.info("Unique constraint does not exist, skipping...")
                return True
            
            # Drop the unique index
            sql = text("DROP INDEX uq_user_market_date ON account_snapshots")
            db.execute(sql)
            db.commit()
            logger.info("✅ Date-based unique constraint removed successfully (MySQL/MariaDB)")
            
        elif 'sqlite' in db_url:
            logger.info("Removing date-based unique constraint for SQLite...")
            
            # Check if index exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM sqlite_master
                WHERE type = 'index'
                AND name = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if not exists:
                logger.info("Unique constraint does not exist, skipping...")
                return True
            
            # Drop the unique index
            sql = text("DROP INDEX IF EXISTS uq_user_market_date")
            db.execute(sql)
            db.commit()
            logger.info("✅ Date-based unique constraint removed successfully (SQLite)")
            
        elif 'postgresql' in db_url:
            logger.info("Removing date-based unique constraint for PostgreSQL...")
            
            # Check if index exists
            check_sql = text("""
                SELECT COUNT(*) as count
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = 'account_snapshots'
                AND indexname = 'uq_user_market_date'
            """)
            result = db.execute(check_sql)
            exists = result.scalar() > 0
            
            if not exists:
                logger.info("Unique constraint does not exist, skipping...")
                return True
            
            # Drop the unique index
            sql = text("DROP INDEX IF EXISTS uq_user_market_date")
            db.execute(sql)
            db.commit()
            logger.info("✅ Date-based unique constraint removed successfully (PostgreSQL)")
            
        else:
            logger.warning(f"Unknown database type: {db_url}")
            logger.warning("Skipping constraint removal")
            return False
        
        logger.info("📝 Note: Multiple snapshots per day are now allowed")
        logger.info("   Application logic will prevent duplicate timestamps (to the second)")
        
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error removing unique constraint: {e}")
        raise
    finally:
        db.close()


def downgrade():
    """
    Re-add the date-based unique constraint
    
    WARNING: This will fail if there are multiple snapshots for the same user/market/day
    """
    db = SessionLocal()
    try:
        # Check database type
        db_url = str(engine.url)
        
        logger.warning("⚠️  Re-adding date-based unique constraint")
        logger.warning("   This will fail if multiple snapshots exist for the same day")
        
        if 'mysql' in db_url or 'mariadb' in db_url:
            logger.info("Re-creating unique constraint for MySQL/MariaDB...")
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint re-created successfully (MySQL/MariaDB)")
            
        elif 'sqlite' in db_url:
            logger.info("Re-creating unique constraint for SQLite...")
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint re-created successfully (SQLite)")
            
        elif 'postgresql' in db_url:
            logger.info("Re-creating unique constraint for PostgreSQL...")
            sql = text("""
                CREATE UNIQUE INDEX uq_user_market_date 
                ON account_snapshots (user_id, market_type, DATE(snapshot_date))
            """)
            db.execute(sql)
            db.commit()
            logger.info("✅ Unique constraint re-created successfully (PostgreSQL)")
            
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error re-creating unique constraint: {e}")
        logger.error("You may need to manually clean up duplicate snapshots first")
        raise
    finally:
        db.close()


def run_migration():
    """Run the migration"""
    print("=" * 70)
    print("Migration: Remove date-based unique constraint for account snapshots")
    print("=" * 70)
    
    print("\n📋 Current behavior:")
    print("   ❌ Only one snapshot per user per market per day")
    
    print("\n📋 New behavior:")
    print("   ✅ Multiple snapshots per day allowed (different times)")
    print("   ✅ Same timestamp (to the second) will update existing snapshot")
    
    print("\n🔄 Running migration...")
    
    try:
        success = upgrade()
        
        if success:
            print("\n✅ Migration completed successfully")
            print("\nChanges:")
            print("  - Removed constraint: uq_user_market_date")
            print("  - Effect: Multiple snapshots per day are now allowed")
            print("  - Note: Application logic prevents duplicate timestamps")
        else:
            print("\n⚠️  Migration completed with warnings")
            print("Check logs for details")
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        print("\nTroubleshooting:")
        print("  1. Check database connection")
        print("  2. Verify table exists: account_snapshots")
        print("  3. Check database logs for details")
        return False
    
    print("=" * 70)
    return success


if __name__ == "__main__":
    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    import sys
    success = run_migration()
    sys.exit(0 if success else 1)
