#!/usr/bin/env python3
"""
Test script for intraday scheduler auto-recovery feature

This script tests the scheduler recovery functionality by:
1. Creating a test user with scheduler configuration
2. Simulating service restart
3. Verifying scheduler is restored correctly
"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from web.backend.database import SessionLocal, init_db_sync
from web.backend.models import User, UserConfig
from web.backend.services.user_intraday_scheduler import get_manager
from sqlalchemy import select


def setup_test_user():
    """Create a test user with scheduler configuration"""
    db = SessionLocal()
    try:
        # Check if test user exists
        result = db.execute(
            select(User).where(User.username == "test_scheduler_user")
        )
        user = result.scalar_one_or_none()
        
        if not user:
            # Create test user
            from passlib.context import CryptContext
            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            user = User(
                username="test_scheduler_user",
                email="test_scheduler@example.com",
                hashed_password=pwd_context.hash("test123"),
                role="user",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"✅ Created test user (ID: {user.id})")
        else:
            print(f"✅ Test user exists (ID: {user.id})")
        
        # Get or create user config
        result = db.execute(
            select(UserConfig).where(UserConfig.user_id == user.id)
        )
        config = result.scalar_one_or_none()
        
        if not config:
            config = UserConfig(user_id=user.id)
            db.add(config)
        
        # Set scheduler configuration
        config.intraday_futu_api_url = "http://localhost:8080"  # Mock API
        config.intraday_interval_minutes = 5
        config.intraday_market_type = "US"
        config.intraday_scheduler_enabled = True
        config.intraday_scheduler_auto_start = True  # Mark for auto-recovery
        
        db.commit()
        print(f"✅ Configured scheduler for user {user.id}")
        print(f"   - API URL: {config.intraday_futu_api_url}")
        print(f"   - Interval: {config.intraday_interval_minutes} minutes")
        print(f"   - Market: {config.intraday_market_type}")
        print(f"   - Auto-start: {config.intraday_scheduler_auto_start}")
        
        return user.id
    
    finally:
        db.close()


async def test_scheduler_recovery():
    """Test scheduler recovery functionality"""
    print("\n" + "="*60)
    print("Testing Scheduler Auto-Recovery")
    print("="*60 + "\n")
    
    # Step 1: Setup test user
    print("Step 1: Setting up test user...")
    user_id = setup_test_user()
    
    # Step 2: Simulate service restart by restoring schedulers
    print("\nStep 2: Simulating service restart...")
    manager = get_manager()
    
    # Clear any existing schedulers (simulate fresh start)
    if manager.has_scheduler(user_id):
        await manager.stop_scheduler(user_id)
        await manager.remove_scheduler(user_id)
        print("   Cleared existing scheduler")
    
    # Restore schedulers from database
    print("   Restoring schedulers from database...")
    await manager.restore_schedulers_from_db()
    
    # Step 3: Verify scheduler was restored
    print("\nStep 3: Verifying scheduler restoration...")
    
    if manager.has_scheduler(user_id):
        print(f"   ✅ Scheduler exists for user {user_id}")
        
        scheduler = manager.get_scheduler(user_id)
        if scheduler and scheduler.is_running:
            print(f"   ✅ Scheduler is running")
            
            status = manager.get_scheduler_status(user_id)
            print(f"\n   Scheduler Status:")
            print(f"   - Running: {status['is_running']}")
            print(f"   - Interval: {status['interval_minutes']} minutes")
            print(f"   - Market: {status['market_type']}")
            print(f"   - Market Status: {status['market_status']}")
            
            # Stop scheduler
            print("\n   Stopping scheduler...")
            await manager.stop_scheduler(user_id)
            print("   ✅ Scheduler stopped")
            
            return True
        else:
            print(f"   ❌ Scheduler is not running")
            return False
    else:
        print(f"   ❌ Scheduler not found for user {user_id}")
        return False


async def test_manual_stop_no_recovery():
    """Test that manually stopped schedulers are not recovered"""
    print("\n" + "="*60)
    print("Testing Manual Stop (No Recovery)")
    print("="*60 + "\n")
    
    # Step 1: Setup test user
    print("Step 1: Setting up test user...")
    user_id = setup_test_user()
    
    # Step 2: Manually stop scheduler (clear auto_start flag)
    print("\nStep 2: Manually stopping scheduler...")
    db = SessionLocal()
    try:
        result = db.execute(
            select(UserConfig).where(UserConfig.user_id == user_id)
        )
        config = result.scalar_one_or_none()
        
        if config:
            config.intraday_scheduler_enabled = False
            config.intraday_scheduler_auto_start = False  # Clear auto-start
            db.commit()
            print(f"   ✅ Cleared auto-start flag for user {user_id}")
    finally:
        db.close()
    
    # Step 3: Simulate service restart
    print("\nStep 3: Simulating service restart...")
    manager = get_manager()
    
    # Clear any existing schedulers
    if manager.has_scheduler(user_id):
        await manager.stop_scheduler(user_id)
        await manager.remove_scheduler(user_id)
    
    # Restore schedulers from database
    print("   Restoring schedulers from database...")
    await manager.restore_schedulers_from_db()
    
    # Step 4: Verify scheduler was NOT restored
    print("\nStep 4: Verifying scheduler was NOT restored...")
    
    if not manager.has_scheduler(user_id):
        print(f"   ✅ Scheduler correctly NOT restored for user {user_id}")
        return True
    else:
        print(f"   ❌ Scheduler was incorrectly restored for user {user_id}")
        return False


async def cleanup():
    """Clean up test data"""
    print("\n" + "="*60)
    print("Cleaning up test data...")
    print("="*60 + "\n")
    
    db = SessionLocal()
    try:
        # Remove test user
        result = db.execute(
            select(User).where(User.username == "test_scheduler_user")
        )
        user = result.scalar_one_or_none()
        
        if user:
            db.delete(user)
            db.commit()
            print(f"✅ Removed test user")
    finally:
        db.close()


async def main():
    """Run all tests"""
    try:
        # Initialize database
        print("Initializing database...")
        init_db_sync()
        
        # Run tests
        test1_passed = await test_scheduler_recovery()
        test2_passed = await test_manual_stop_no_recovery()
        
        # Summary
        print("\n" + "="*60)
        print("Test Summary")
        print("="*60)
        print(f"Test 1 (Auto Recovery): {'✅ PASSED' if test1_passed else '❌ FAILED'}")
        print(f"Test 2 (Manual Stop): {'✅ PASSED' if test2_passed else '❌ FAILED'}")
        print("="*60 + "\n")
        
        # Cleanup
        # await cleanup()  # Uncomment to remove test user
        
        return test1_passed and test2_passed
    
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
