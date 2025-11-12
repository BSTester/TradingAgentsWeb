#!/usr/bin/env python3
"""
Migration: Initialize Agent Prompt Templates

This migration creates the tables for agent prompt template management:
- agent_tools: Tool definitions (system-maintained)
- agent_prompt_templates: User-customizable prompts
- template_tools: Association between templates and tools

Run: python -m web.backend.migrations.001_init_prompt_templates
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from web.backend.database import sync_engine, SessionLocal
from web.backend.models import Base, AgentTool, AgentPromptTemplate, TemplateTools


def migrate():
    """Execute migration"""
    print("=" * 60)
    print("Migration: Initialize Agent Prompt Templates")
    print("=" * 60)
    
    # Create tables
    print("\n📋 Creating tables...")
    try:
        Base.metadata.create_all(
            bind=sync_engine,
            tables=[
                AgentTool.__table__,
                AgentPromptTemplate.__table__,
                TemplateTools.__table__,
            ]
        )
        print("✅ Tables created successfully")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return False
    
    # Verify tables
    print("\n🔍 Verifying tables...")
    db = SessionLocal()
    try:
        # Test queries
        db.query(AgentTool).first()
        db.query(AgentPromptTemplate).first()
        db.query(TemplateTools).first()
        print("✅ All tables verified")
    except Exception as e:
        print(f"❌ Error verifying tables: {e}")
        return False
    finally:
        db.close()
    
    print("\n" + "=" * 60)
    print("✅ Migration completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run: python -m web.backend.migrations.002_init_tool_definitions")
    print("2. Run: python -m web.backend.migrations.003_init_default_prompts")
    
    return True


def rollback():
    """Rollback migration (drop tables)"""
    print("=" * 60)
    print("Rollback: Drop Agent Prompt Template Tables")
    print("=" * 60)
    
    print("\n⚠️  WARNING: This will delete all prompt templates and tool definitions!")
    confirm = input("Type 'yes' to confirm: ")
    
    if confirm.lower() != 'yes':
        print("❌ Rollback cancelled")
        return False
    
    print("\n🗑️  Dropping tables...")
    try:
        TemplateTools.__table__.drop(sync_engine, checkfirst=True)
        AgentPromptTemplate.__table__.drop(sync_engine, checkfirst=True)
        AgentTool.__table__.drop(sync_engine, checkfirst=True)
        print("✅ Tables dropped successfully")
        return True
    except Exception as e:
        print(f"❌ Error dropping tables: {e}")
        return False


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Agent Prompt Template Migration")
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback migration (drop tables)"
    )
    
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback()
    else:
        success = migrate()
    
    sys.exit(0 if success else 1)
