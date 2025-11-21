#!/usr/bin/env python3
"""
Test tool documentation generation with different tool selections
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.services.prompt_loader import generate_tool_documentation, generate_variable_documentation


def test_all_tools():
    """Test with all tools enabled"""
    print("=" * 60)
    print("Test 1: All Tools Enabled")
    print("=" * 60)
    
    all_tool_names = [
        'get_futu_account_info',
        'get_futu_positions',
        'get_futu_orders',
        'get_futu_quote',
        'get_futu_kline',
        'get_futu_technical_analysis',
        'place_futu_order',
        'get_futu_hot_news',
        'get_futu_hot_stocks',
        'get_akshare_news',
        'get_akshare_hot_stocks',
    ]
    
    doc = generate_tool_documentation(all_tool_names)
    print(doc)
    print(f"\n✅ Generated documentation for {len(all_tool_names)} tools")
    print(f"   Documentation length: {len(doc)} characters")


def test_account_tools_only():
    """Test with only account management tools"""
    print("\n" + "=" * 60)
    print("Test 2: Account Management Tools Only")
    print("=" * 60)
    
    account_tools = [
        'get_futu_account_info',
        'get_futu_positions',
        'get_futu_orders',
    ]
    
    doc = generate_tool_documentation(account_tools)
    print(doc)
    print(f"\n✅ Generated documentation for {len(account_tools)} tools")
    print(f"   Documentation length: {len(doc)} characters")


def test_trading_tools():
    """Test with trading-related tools"""
    print("\n" + "=" * 60)
    print("Test 3: Trading Tools (Account + Market Data + Trading)")
    print("=" * 60)
    
    trading_tools = [
        'get_futu_account_info',
        'get_futu_positions',
        'get_futu_quote',
        'get_futu_kline',
        'place_futu_order',
    ]
    
    doc = generate_tool_documentation(trading_tools)
    print(doc)
    print(f"\n✅ Generated documentation for {len(trading_tools)} tools")
    print(f"   Documentation length: {len(doc)} characters")


def test_variable_documentation():
    """Test variable documentation"""
    print("\n" + "=" * 60)
    print("Test 4: Variable Documentation")
    print("=" * 60)
    
    doc = generate_variable_documentation()
    print(doc)
    print(f"\n✅ Generated variable documentation")
    print(f"   Documentation length: {len(doc)} characters")


if __name__ == "__main__":
    test_all_tools()
    test_account_tools_only()
    test_trading_tools()
    test_variable_documentation()
    
    print("\n" + "=" * 60)
    print("🎉 All tests completed!")
    print("=" * 60)
