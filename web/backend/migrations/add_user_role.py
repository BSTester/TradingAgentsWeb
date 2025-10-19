#!/usr/bin/env python3
"""
Database migration script to add role field to User table
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from sqlalchemy import text
from web.backend.database import SessionLocal, engine
from web.backend.models import User


def add_role_column():
    """Add role column to users table"""
    print("📝 Adding role column to users table...")
    
    with engine.connect() as conn:
        try:
            # Check if column already exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM pragma_table_info('users') WHERE name='role'"
            ))
            exists = result.scalar() > 0
            
            if exists:
                print("ℹ️  Role column already exists, skipping creation")
            else:
                # Add the column with default value 'user'
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' NOT NULL"
                ))
                conn.commit()
                print("✅ Role column added successfully")
                
        except Exception as e:
            print(f"❌ Error adding role column: {e}")
            raise


def create_role_index():
    """Create index on role column"""
    print("📝 Creating index on role column...")
    
    with engine.connect() as conn:
        try:
            # Check if index already exists
            result = conn.execute(text(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='ix_users_role'"
            ))
            exists = result.scalar() > 0
            
            if exists:
                print("ℹ️  Role index already exists, skipping creation")
            else:
                # Create the index
                conn.execute(text(
                    "CREATE INDEX ix_users_role ON users (role)"
                ))
                conn.commit()
                print("✅ Role index created successfully")
                
        except Exception as e:
            print(f"❌ Error creating role index: {e}")
            raise


def set_first_user_as_admin():
    """Set the first registered user as admin"""
    print("📝 Setting first user as admin...")
    
    db = SessionLocal()
    try:
        # Get the first user (by ID)
        first_user = db.query(User).order_by(User.id).first()
        
        if not first_user:
            print("ℹ️  No users found")
            return
        
        if first_user.role == 'admin':
            print(f"ℹ️  User '{first_user.username}' is already admin")
        else:
            first_user.role = 'admin'
            db.commit()
            print(f"✅ User '{first_user.username}' set as admin")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error setting first user as admin: {e}")
        raise
    finally:
        db.close()


def verify_migration():
    """Verify migration was successful"""
    print("📝 Verifying migration...")
    
    db = SessionLocal()
    try:
        # Count total users
        total = db.query(User).count()
        
        # Count admin users
        admin_count = db.query(User).filter(User.role == 'admin').count()
        
        # Count regular users
        user_count = db.query(User).filter(User.role == 'user').count()
        
        print(f"📊 Migration verification:")
        print(f"   Total users: {total}")
        print(f"   Admin users: {admin_count}")
        print(f"   Regular users: {user_count}")
        
        if total > 0 and admin_count == 0:
            print(f"⚠️  Warning: No admin users found")
        else:
            print("✅ Role migration successful")
            
    except Exception as e:
        print(f"❌ Error verifying migration: {e}")
        raise
    finally:
        db.close()


def migrate():
    """Run the complete migration"""
    print("=" * 60)
    print("🚀 Starting user role migration")
    print("=" * 60)
    
    try:
        # Step 1: Add column
        add_role_column()
        
        # Step 2: Create index
        create_role_index()
        
        # Step 3: Set first user as admin
        set_first_user_as_admin()
        
        # Step 4: Verify
        verify_migration()
        
        print("=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print("=" * 60)
        print(f"❌ Migration failed: {e}")
        print("=" * 60)
        sys.exit(1)


if __name__ == "__main__":
    migrate()
