#!/usr/bin/env python3
"""Test new default prompt without tool/variable documentation"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.services.prompt_loader import load_user_prompt_template


def main():
    print("=" * 80)
    print("Testing New Default Prompt")
    print("=" * 80)
    
    # Load for a new user (will get default prompt)
    prompt, tools = load_user_prompt_template(999, 'intraday_trader', 'US')
    
    print(f"\n✅ Prompt length: {len(prompt)} chars")
    print(f"✅ Tools count: {len(tools)}")
    
    # Check structure
    print("\n📐 Structure Check:")
    sections = [
        ("Runtime Variables", "Runtime Variables"),
        ("Available Tools", "Available Tools"),
        ("Agent Configuration", "Agent Configuration"),
    ]
    
    for name, marker in sections:
        idx = prompt.find(marker)
        if idx != -1:
            print(f"  ✓ {name} at position {idx}")
        else:
            print(f"  ✗ {name} NOT FOUND")
    
    # Check that old tool documentation is NOT in user's prompt
    print("\n🔍 Verify Clean Prompt (no tool docs in user section):")
    
    agent_config_idx = prompt.find("Agent Configuration")
    if agent_config_idx != -1:
        user_section = prompt[agent_config_idx:]
        
        # These should NOT be in user's section
        old_patterns = [
            "get_futu_account_info(market_type=",
            "call these 3 tools in parallel",
            "Step 1: Account & Position Overview",
            "PARALLEL TOOL CALLS",
        ]
        
        clean = True
        for pattern in old_patterns:
            if pattern in user_section:
                print(f"  ✗ Found old pattern: '{pattern[:50]}...'")
                clean = False
        
        if clean:
            print("  ✓ User section is clean (no tool documentation)")
    
    # Show preview of each section
    print("\n📄 Section Previews:")
    print("\n1. Runtime Variables:")
    runtime_idx = prompt.find("Runtime Variables")
    tools_idx = prompt.find("Available Tools")
    print(prompt[runtime_idx:tools_idx][:300] + "...")
    
    print("\n2. Available Tools:")
    config_idx = prompt.find("Agent Configuration")
    print(prompt[tools_idx:config_idx][:300] + "...")
    
    print("\n3. Agent Configuration (User's Prompt):")
    print(prompt[config_idx:config_idx+500] + "...")
    
    print("\n" + "=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
