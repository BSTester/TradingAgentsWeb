#!/usr/bin/env python3
"""
Initialize database and run migrations
"""

import sys
import os
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
os.chdir(project_root)

from web.backend.database import init_db_sync

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Initializing database")
    print("=" * 60)
    
    try:
        init_db_sync()
        print("=" * 60)
        print("✅ Database initialized successfully!")
        print("=" * 60)
    except Exception as e:
        print("=" * 60)
        print(f"❌ Database initialization failed: {e}")
        print("=" * 60)
        import traceback
        traceback.print_exc()
        sys.exit(1)
