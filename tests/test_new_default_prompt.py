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
    prompt = load_user_prompt_template(999, 'intraday_trader')
    
    print(f"\n✅ Prompt length: {len(prompt)} chars")
    
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
    
    old_patterns = [
        "Runtime Variables",
        "Available Tools",
        "Agent Configuration",
        "get_futu_account_info(market_type=",
        "call these 3 tools in parallel",
        "Step 1: Account & Position Overview",
        "PARALLEL TOOL CALLS",
    ]
    
    clean = True
    for pattern in old_patterns:
        if pattern in prompt:
            print(f"  ✗ Found old pattern: '{pattern[:50]}...'")
            clean = False
    
    if clean:
        print("  ✓ Core prompt is clean (no injected system documentation)")
    
    # Show preview of each section
    print("\n📄 Section Previews:")
    print("\n1. Core Prompt:")
    print(prompt[:500] + "...")
    
    print("\n" + "=" * 80)
    print("✅ Test Complete!")
    print("=" * 80)


if __name__ == "__main__":
    main()
