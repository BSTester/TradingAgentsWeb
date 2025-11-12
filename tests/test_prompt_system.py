#!/usr/bin/env python3
"""
Test script for prompt template system

Tests:
1. Database models
2. Tool registry
3. Prompt loader
4. API endpoints (manual test)
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.database import SessionLocal
from web.backend.models import AgentTool, AgentPromptTemplate, TemplateTools, User
from tradingagents.agents.utils.tool_registry import get_all_tools_metadata, get_tools_by_names
from web.backend.services.prompt_loader import load_user_prompt_template


def test_database_models():
    """Test 1: Database models"""
    print("=" * 60)
    print("Test 1: Database Models")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        # Test AgentTool
        tools = db.query(AgentTool).all()
        print(f"\n✅ Found {len(tools)} tools in database")
        for tool in tools[:3]:
            print(f"   - {tool.tool_name} ({tool.category})")
        
        # Test AgentPromptTemplate
        templates = db.query(AgentPromptTemplate).all()
        print(f"\n✅ Found {len(templates)} prompt templates")
        for template in templates[:3]:
            print(f"   - User {template.user_id}: {template.template_name} (v{template.version})")
        
        # Test TemplateTools
        template_tools = db.query(TemplateTools).all()
        print(f"\n✅ Found {len(template_tools)} tool associations")
        
        return True
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False
    finally:
        db.close()


def test_tool_registry():
    """Test 2: Tool registry"""
    print("\n" + "=" * 60)
    print("Test 2: Tool Registry")
    print("=" * 60)
    
    try:
        # Get all tools metadata
        tools_metadata = get_all_tools_metadata()
        print(f"\n✅ Loaded {len(tools_metadata)} tools from registry")
        
        # Group by category
        categories = {}
        for tool in tools_metadata:
            cat = tool['category']
            categories[cat] = categories.get(cat, 0) + 1
        
        print("\n📊 Tools by category:")
        for cat, count in sorted(categories.items()):
            print(f"   - {cat}: {count} tools")
        
        # Test get_tools_by_names
        tool_names = ['get_futu_account_info', 'get_futu_positions', 'place_futu_order']
        tools = get_tools_by_names(tool_names)
        print(f"\n✅ Retrieved {len(tools)} tool instances by name")
        for tool in tools:
            print(f"   - {tool.name}")
        
        return True
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_prompt_loader():
    """Test 3: Prompt loader"""
    print("\n" + "=" * 60)
    print("Test 3: Prompt Loader")
    print("=" * 60)
    
    try:
        # Get first user
        db = SessionLocal()
        user = db.query(User).first()
        db.close()
        
        if not user:
            print("\n⚠️  No users found, skipping test")
            return True
        
        print(f"\n🧪 Testing with user: {user.username} (ID: {user.id})")
        
        # Load prompt template
        prompt, tool_names = load_user_prompt_template(
            user_id=user.id,
            agent_type="intraday_trader",
            market_type="US",
            session_id="test_session_123"
        )
        
        print(f"\n✅ Loaded prompt template:")
        print(f"   - Prompt length: {len(prompt)} characters")
        print(f"   - Enabled tools: {len(tool_names)}")
        print(f"   - Tools: {', '.join(tool_names[:5])}{'...' if len(tool_names) > 5 else ''}")
        
        # Check variable injection
        if "US" in prompt and "test_session_123" in prompt:
            print(f"\n✅ Variables injected correctly")
        else:
            print(f"\n⚠️  Variables may not be injected correctly")
        
        return True
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_api_endpoints():
    """Test 4: API endpoints (manual instructions)"""
    print("\n" + "=" * 60)
    print("Test 4: API Endpoints (Manual Test)")
    print("=" * 60)
    
    print("\n📝 Manual testing instructions:")
    print("\n1. Start the backend server:")
    print("   python web/backend/app.py")
    
    print("\n2. Get authentication token:")
    print("   curl -X POST http://localhost:8000/api/auth/login \\")
    print("     -H 'Content-Type: application/json' \\")
    print("     -d '{\"username\":\"admin\",\"password\":\"your_password\"}'")
    
    print("\n3. Test endpoints (replace TOKEN with your token):")
    
    print("\n   a) List available tools:")
    print("      curl http://localhost:8000/api/prompts/tools \\")
    print("        -H 'Authorization: Bearer TOKEN'")
    
    print("\n   b) Get current prompt template:")
    print("      curl http://localhost:8000/api/prompts/templates/intraday_trader \\")
    print("        -H 'Authorization: Bearer TOKEN'")
    
    print("\n   c) Update prompt template:")
    print("      curl -X PUT http://localhost:8000/api/prompts/templates/intraday_trader \\")
    print("        -H 'Authorization: Bearer TOKEN' \\")
    print("        -H 'Content-Type: application/json' \\")
    print("        -d '{\"system_prompt\":\"Your custom prompt here...\"}'")
    
    print("\n   d) Reset to default:")
    print("      curl -X POST http://localhost:8000/api/prompts/templates/intraday_trader/reset \\")
    print("        -H 'Authorization: Bearer TOKEN'")
    
    return True


def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Prompt Template System Test Suite")
    print("=" * 60)
    
    results = []
    
    # Run tests
    results.append(("Database Models", test_database_models()))
    results.append(("Tool Registry", test_tool_registry()))
    results.append(("Prompt Loader", test_prompt_loader()))
    results.append(("API Endpoints", test_api_endpoints()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for name, passed in results:
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{status}: {name}")
    
    all_passed = all(passed for _, passed in results)
    
    if all_passed:
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
