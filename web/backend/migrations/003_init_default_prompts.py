#!/usr/bin/env python3
"""
Migration: Initialize Default Prompt Templates

This migration creates default prompt templates for existing users.

Run: python -m web.backend.migrations.003_init_default_prompts
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from web.backend.database import SessionLocal
from web.backend.models import User, AgentPromptTemplate, TemplateTools, AgentTool
from web.backend.services.prompt_loader import get_default_intraday_prompt


def migrate():
    """Execute migration"""
    print("=" * 60)
    print("Migration: Initialize Default Prompt Templates")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Get all users
        users = db.query(User).all()
        print(f"\n👥 Found {len(users)} users")
        
        if not users:
            print("⚠️  No users found. Skipping migration.")
            print("   Default templates will be created when users first use the system.")
            return True
        
        # Get default prompt
        default_prompt = get_default_intraday_prompt()
        
        # Get all available tools
        all_tools = db.query(AgentTool).filter(AgentTool.is_available == True).all()
        print(f"🔧 Found {len(all_tools)} available tools")
        
        # Create templates for each user
        created_count = 0
        skipped_count = 0
        
        for user in users:
            # Check if user already has a template
            existing = db.query(AgentPromptTemplate).filter(
                AgentPromptTemplate.agent_type == "intraday_trader",
                AgentPromptTemplate.user_id == user.id
            ).first()
            
            if existing:
                print(f"  ↻ User {user.username} (ID: {user.id}) already has a template, skipping")
                skipped_count += 1
                continue
            
            # Create template
            template = AgentPromptTemplate(
                agent_type="intraday_trader",
                user_id=user.id,
                system_prompt=default_prompt,
                template_name="默认日内交易策略",
                description="系统默认的日内交易 Agent 提示词",
                version="1.0",
                is_active=True
            )
            db.add(template)
            db.flush()  # Get template.id
            
            # Enable all tools
            for tool in all_tools:
                template_tool = TemplateTools(
                    template_id=template.id,
                    tool_name=tool.tool_name,
                    is_enabled=True
                )
                db.add(template_tool)
            
            created_count += 1
            print(f"  + Created template for user {user.username} (ID: {user.id}) with {len(all_tools)} tools")
        
        db.commit()
        
        print(f"\n✅ Default templates initialized:")
        print(f"   - Created: {created_count}")
        print(f"   - Skipped: {skipped_count}")
        print(f"   - Total users: {len(users)}")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print("\nAll migrations completed! System is ready to use.")
        
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
    """Rollback migration (delete all templates)"""
    print("=" * 60)
    print("Rollback: Delete All Prompt Templates")
    print("=" * 60)
    
    print("\n⚠️  WARNING: This will delete all user prompt templates!")
    confirm = input("Type 'yes' to confirm: ")
    
    if confirm.lower() != 'yes':
        print("❌ Rollback cancelled")
        return False
    
    db = SessionLocal()
    try:
        # Delete template_tools first (foreign key)
        tools_count = db.query(TemplateTools).delete()
        # Delete templates
        templates_count = db.query(AgentPromptTemplate).delete()
        db.commit()
        
        print(f"\n✅ Deleted {templates_count} templates and {tools_count} tool associations")
        return True
    except Exception as e:
        print(f"\n❌ Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Default Prompt Templates Migration")
    parser.add_argument(
        "--rollback",
        action="store_true",
        help="Rollback migration (delete all templates)"
    )
    
    args = parser.parse_args()
    
    if args.rollback:
        success = rollback()
    else:
        success = migrate()
    
    sys.exit(0 if success else 1)
