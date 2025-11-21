#!/usr/bin/env python3
"""
Migration: Initialize Tool Definitions

This migration populates the agent_tools table with all available tools.

Run: python -m web.backend.migrations.002_init_tool_definitions
"""

import sys
import os
import json

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from web.backend.database import SessionLocal
from web.backend.models import AgentTool
from tradingagents.agents.utils.tool_registry import get_all_tools_metadata


def migrate():
    """Execute migration"""
    print("=" * 60)
    print("Migration: Initialize Tool Definitions")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Get all tool metadata
        print("\n📚 Loading tool metadata...")
        tools_metadata = get_all_tools_metadata()
        print(f"✅ Found {len(tools_metadata)} tools")
        
        # Insert or update tools
        print("\n💾 Inserting tool definitions...")
        added_count = 0
        updated_count = 0
        
        for tool_meta in tools_metadata:
            existing = db.query(AgentTool).filter(
                AgentTool.tool_name == tool_meta['tool_name']
            ).first()
            
            if existing:
                # Update existing
                existing.tool_description = tool_meta['tool_description']
                existing.tool_parameters = tool_meta['tool_parameters']
                existing.category = tool_meta['category']
                existing.is_available = True
                updated_count += 1
                print(f"  ↻ Updated: {tool_meta['tool_name']} ({tool_meta['category']})")
            else:
                # Insert new
                new_tool = AgentTool(
                    tool_name=tool_meta['tool_name'],
                    tool_description=tool_meta['tool_description'],
                    tool_parameters=tool_meta['tool_parameters'],
                    category=tool_meta['category'],
                    is_available=True
                )
                db.add(new_tool)
                added_count += 1
                print(f"  + Added: {tool_meta['tool_name']} ({tool_meta['category']})")
        
        db.commit()
        
        print(f"\n✅ Tool definitions initialized:")
        print(f"   - Added: {added_count}")
        print(f"   - Updated: {updated_count}")
        print(f"   - Total: {len(tools_metadata)}")
        
        # Show summary by category
        print("\n📊 Tools by category:")
        categories = {}
        for tool in db.query(AgentTool).all():
            cat = tool.category or 'other'
            categories[cat] = categories.get(cat, 0) + 1
        
        for cat, count in sorted(categories.items()):
            print(f"   - {cat}: {count} tools")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print("\nNext step:")
        print("Run: python -m web.backend.migrations.003_init_default_prompts")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


def rollback():
    """Rollback migration (clear all tools)"""
    print("=" * 60)
    print("Rollback: Clear Tool Definitions")
    print("=" * 60)
    
    print("\n⚠️  WARNING: This will delete all tool definitions!")
    confirm = input("Type 'yes' to confirm: ")
    
    if confirm.lower() != 'yes':
        print("❌ Rollback cancelled")
        return False
    
    db = SessionLocal()
    try:
        count = db.query(AgentTool).delete()
        db.commit()
        print(f"\n✅ Deleted {count} tool definitions")
        return True
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Tool Definitions Migration")
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback migration (clear all tools)"
    )
    
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback()
    else:
        success = migrate()
    
    sys.exit(0 if success else 1)
