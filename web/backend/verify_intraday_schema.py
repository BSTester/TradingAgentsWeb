#!/usr/bin/env python3
"""
Verification script to display the complete schema of intraday trading tables
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from web.backend.database import sync_engine
from sqlalchemy import inspect

def display_table_schema(inspector, table_name):
    """Display detailed schema for a table"""
    print(f"\n{'='*80}")
    print(f"Table: {table_name}")
    print(f"{'='*80}")
    
    # Get columns
    columns = inspector.get_columns(table_name)
    print("\nColumns:")
    print(f"{'Name':<30} {'Type':<20} {'Nullable':<10} {'Default':<20}")
    print("-" * 80)
    for col in columns:
        col_type = str(col['type'])
        nullable = "YES" if col['nullable'] else "NO"
        default = str(col.get('default', '')) if col.get('default') else ''
        print(f"{col['name']:<30} {col_type:<20} {nullable:<10} {default:<20}")
    
    # Get foreign keys
    fks = inspector.get_foreign_keys(table_name)
    if fks:
        print("\nForeign Keys:")
        for fk in fks:
            print(f"  - {fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}")
    
    # Get indexes
    indexes = inspector.get_indexes(table_name)
    if indexes:
        print("\nIndexes:")
        for idx in indexes:
            unique = "UNIQUE" if idx.get('unique') else ""
            print(f"  - {idx['name']}: {', '.join(idx['column_names'])} {unique}")

def main():
    """Main verification function"""
    print("Intraday Trading Agent - Database Schema Verification")
    print("=" * 80)
    
    inspector = inspect(sync_engine)
    
    # Verify new tables
    new_tables = [
        'position_records',
        'trading_history',
        'intraday_decision_records'
    ]
    
    all_tables = inspector.get_table_names()
    
    print("\nDatabase Tables:")
    for table in all_tables:
        marker = "✅ NEW" if table in new_tables else "   "
        print(f"  {marker} {table}")
    
    # Display detailed schema for new tables
    for table in new_tables:
        if table in all_tables:
            display_table_schema(inspector, table)
        else:
            print(f"\n❌ ERROR: Table '{table}' not found!")
            return False
    
    print("\n" + "=" * 80)
    print("✅ Schema verification complete!")
    print("=" * 80)
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
