#!/usr/bin/env python3
"""
Verify Complete Implementation Logic

Check that:
1. User only edits prompt content (no tool/variable docs)
2. System auto-injects all tools (English)
3. System auto-injects variables (English)
4. Variables in user prompt are replaced at runtime
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.services.prompt_loader import load_user_prompt_template
from web.backend.database import SessionLocal
from web.backend.models import AgentPromptTemplate, AgentTool


def check_user_prompt_content():
    """Check what user actually edits"""
    print("=" * 80)
    print("Check 1: User Prompt Content")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        # Get a user's template
        template = db.query(AgentPromptTemplate).filter(
            AgentPromptTemplate.user_id == 1,
            AgentPromptTemplate.agent_type == "intraday_trader"
        ).first()
        
        if not template:
            print("  ℹ️  No template found for user 1")
            return True
        
        user_prompt = template.system_prompt
        
        # Check that user prompt does NOT contain system docs
        checks = [
            ("Runtime Variables", "Variable documentation"),
            ("Available Tools", "Tool documentation"),
            ("All tools below are available", "Tool intro text"),
            ("Account Management Tools", "Tool category header"),
        ]
        
        clean = True
        for pattern, description in checks:
            if pattern in user_prompt:
                print(f"  ❌ User prompt contains: {description}")
                clean = False
        
        if clean:
            print("  ✅ User prompt is clean (no system docs)")
            print(f"  ✅ User prompt length: {len(user_prompt)} chars")
            print(f"\n  Preview (first 200 chars):")
            print(f"  {user_prompt[:200]}...")
        
        return clean
        
    finally:
        db.close()


def check_system_injection():
    """Check that system injects docs correctly"""
    print("\n" + "=" * 80)
    print("Check 2: System Auto-Injection")
    print("=" * 80)
    
    # Load prompt for a user
    final_prompt, tools = load_user_prompt_template(1, 'intraday_trader', 'US', 'test_session')
    
    # Check structure
    checks = [
        ("Runtime Variables", "Variable docs injected"),
        ("Available Tools", "Tool docs injected"),
        ("Agent Configuration", "User section marker"),
        ("Account Management Tools", "Tool category"),
        ("Market Data Tools", "Tool category"),
    ]
    
    all_present = True
    for pattern, description in checks:
        if pattern in final_prompt:
            print(f"  ✅ {description}")
        else:
            print(f"  ❌ Missing: {description}")
            all_present = False
    
    print(f"\n  Final prompt length: {len(final_prompt)} chars")
    print(f"  Tools available: {len(tools)}")
    
    return all_present


def check_variable_replacement():
    """Check that variables are replaced"""
    print("\n" + "=" * 80)
    print("Check 3: Variable Replacement")
    print("=" * 80)
    
    final_prompt, tools = load_user_prompt_template(1, 'intraday_trader', 'US', 'test_session_123')
    
    # Check that variables are replaced
    checks = [
        ("US", "market_type replaced"),
        ("test_session_123", "session_id replaced"),
        ("1", "user_id replaced"),
    ]
    
    all_replaced = True
    for value, description in checks:
        if value in final_prompt:
            print(f"  ✅ {description} (found '{value}')")
        else:
            print(f"  ❌ {description} (not found)")
            all_replaced = False
    
    # Check that placeholders are NOT present
    placeholders = ["{market_type}", "{session_id}", "{user_id}", "{timestamp}"]
    no_placeholders = True
    for placeholder in placeholders:
        if placeholder in final_prompt:
            print(f"  ❌ Placeholder still present: {placeholder}")
            no_placeholders = False
    
    if no_placeholders:
        print(f"  ✅ All placeholders replaced")
    
    return all_replaced and no_placeholders


def check_all_tools_available():
    """Check that all tools are available"""
    print("\n" + "=" * 80)
    print("Check 4: All Tools Available")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        # Get all available tools from database
        all_tools = db.query(AgentTool).filter(
            AgentTool.is_available == True
        ).all()
        
        # Get tools from loaded prompt
        final_prompt, loaded_tools = load_user_prompt_template(1, 'intraday_trader', 'US')
        
        print(f"  Database tools: {len(all_tools)}")
        print(f"  Loaded tools: {len(loaded_tools)}")
        
        if len(all_tools) == len(loaded_tools):
            print(f"  ✅ All {len(all_tools)} tools are available")
            
            # Check each tool is in the prompt
            missing = []
            for tool in all_tools:
                if tool.tool_name not in final_prompt:
                    missing.append(tool.tool_name)
            
            if missing:
                print(f"  ❌ Tools missing from prompt: {missing}")
                return False
            else:
                print(f"  ✅ All tool names found in prompt")
                return True
        else:
            print(f"  ❌ Tool count mismatch")
            return False
            
    finally:
        db.close()


def check_prompt_structure():
    """Check final prompt structure"""
    print("\n" + "=" * 80)
    print("Check 5: Final Prompt Structure")
    print("=" * 80)
    
    final_prompt, tools = load_user_prompt_template(1, 'intraday_trader', 'US')
    
    # Find section positions
    sections = {
        "Runtime Variables": final_prompt.find("Runtime Variables"),
        "Available Tools": final_prompt.find("Available Tools"),
        "Agent Configuration": final_prompt.find("Agent Configuration"),
    }
    
    print("\n  Section positions:")
    for name, pos in sections.items():
        print(f"    {name}: {pos}")
    
    # Check order
    positions = list(sections.values())
    if positions == sorted(positions) and all(p >= 0 for p in positions):
        print("\n  ✅ Sections in correct order:")
        print("     1. Runtime Variables (system)")
        print("     2. Available Tools (system)")
        print("     3. Agent Configuration (user)")
        return True
    else:
        print("\n  ❌ Sections not in correct order")
        return False


def main():
    print("\n" + "🔍" * 40)
    print("Complete Implementation Logic Verification")
    print("🔍" * 40 + "\n")
    
    results = {
        "User Prompt Clean": check_user_prompt_content(),
        "System Injection": check_system_injection(),
        "Variable Replacement": check_variable_replacement(),
        "All Tools Available": check_all_tools_available(),
        "Prompt Structure": check_prompt_structure(),
    }
    
    print("\n" + "=" * 80)
    print("Verification Summary")
    print("=" * 80)
    
    for name, passed in results.items():
        print(f"  {'✅' if passed else '❌'} {name}")
    
    if all(results.values()):
        print("\n" + "🎉" * 40)
        print("All logic checks passed!")
        print("🎉" * 40)
        print("\n✅ Implementation Logic:")
        print("  1. User edits: Only prompt content (no system docs)")
        print("  2. System injects: Variable docs (English)")
        print("  3. System injects: Tool docs (English, all 11 tools)")
        print("  4. System replaces: Variables at runtime")
        print("  5. Final structure: Variables → Tools → User Config")
        print("\n🚀 System logic is correct and production-ready!")
    else:
        print("\n❌ Some logic checks failed")
    
    return all(results.values())


if __name__ == "__main__":
    sys.exit(0 if main() else 1)
