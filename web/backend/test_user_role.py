#!/usr/bin/env python3
"""
Test script to verify user role functionality
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.database import SessionLocal
from web.backend.models import User


def test_user_roles():
    """Test user role functionality"""
    print("=" * 60)
    print("🧪 Testing User Role Functionality")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Get all users
        users = db.query(User).order_by(User.id).all()
        
        if not users:
            print("ℹ️  No users found in database")
            print("   Please register a user to test the functionality")
            return
        
        print(f"\n📊 Found {len(users)} user(s):\n")
        
        for i, user in enumerate(users, 1):
            role_icon = "👑" if user.role == "admin" else "👤"
            print(f"{i}. {role_icon} {user.username}")
            print(f"   Email: {user.email}")
            print(f"   Role: {user.role}")
            print(f"   Active: {user.is_active}")
            print(f"   Created: {user.created_at}")
            print()
        
        # Check first user
        first_user = users[0]
        if first_user.role == "admin":
            print(f"✅ First user '{first_user.username}' is correctly set as admin")
        else:
            print(f"⚠️  Warning: First user '{first_user.username}' is not admin (role: {first_user.role})")
        
        # Count roles
        admin_count = sum(1 for u in users if u.role == "admin")
        user_count = sum(1 for u in users if u.role == "user")
        
        print(f"\n📈 Role Statistics:")
        print(f"   Admin users: {admin_count}")
        print(f"   Regular users: {user_count}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
    
    print("=" * 60)


if __name__ == "__main__":
    test_user_roles()
