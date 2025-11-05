#!/usr/bin/env python3
"""
Test script for schema synchronization
Tests the auto_migrate schema comparison and column addition
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(project_root))

from web.backend.migrations.auto_migrate import auto_migrate

if __name__ == "__main__":
    print("Testing schema synchronization...")
    print()
    
    success, failed, skipped = auto_migrate(verbose=True)
    
    print()
    if failed > 0:
        print("❌ Schema sync test failed")
        sys.exit(1)
    else:
        print("✅ Schema sync test passed")
        sys.exit(0)
