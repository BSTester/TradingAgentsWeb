"""
Test script for real-time stock quotes functionality

Usage:
    python tests/test_realtime_quotes.py

Requirements:
    - Set XUEQIU_TOKEN environment variable
    - Or pass token directly in the code below
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tradingagents.dataflows.akshare_stock import (
    get_stock_realtime_quote,
    _normalize_xueqiu_symbol
)


def test_symbol_normalization():
    """Test symbol normalization for different markets"""
    print("=" * 80)
    print("Testing Symbol Normalization")
    print("=" * 80)
    
    test_cases = [
        # A-shares
        ("600000", "A_STOCK", "SH600000"),
        ("000001", "A_STOCK", "SZ000001"),
        ("SH600000", "A_STOCK", "SH600000"),
        ("688001", "A_STOCK", "SH688001"),
        ("300001", "A_STOCK", "SZ300001"),
        # US stocks
        ("AAPL", "US_STOCK", "AAPL"),
        ("aapl", "US_STOCK", "AAPL"),
        ("TSLA", "US_STOCK", "TSLA"),
        # HK stocks
        ("00700", "HK_STOCK", "00700"),
        ("700", "HK_STOCK", "00700"),
        ("00700.HK", "HK_STOCK", "00700"),
        ("9988", "HK_STOCK", "09988"),
    ]
    
    passed = 0
    failed = 0
    
    for symbol, market, expected in test_cases:
        result = _normalize_xueqiu_symbol(symbol, market)
        if result == expected:
            print(f"✓ {symbol} ({market}) -> {result}")
            passed += 1
        else:
            print(f"✗ {symbol} ({market}) -> {result} (expected: {expected})")
            failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0


def test_realtime_quotes():
    """Test real-time quote retrieval"""
    print("\n" + "=" * 80)
    print("Testing Real-Time Quote Retrieval")
    print("=" * 80)
    
    # Check token from environment variable
    token = os.getenv('XUEQIU_TOKEN')
    
    if not token:
        print("\n⚠ WARNING: No XUEQIU_TOKEN environment variable found!")
        print("Set environment variable to test API calls:")
        print("  export XUEQIU_TOKEN='your_token_here'")
        print("Skipping API tests...\n")
        return True
    
    print(f"Using token from environment: {token[:10]}...\n")
    
    test_symbols = [
        ("600000", "A-share"),
        ("AAPL", "US stock"),
        ("00700", "HK stock"),
    ]
    
    for symbol, description in test_symbols:
        print(f"\n--- Testing {description} ({symbol}) ---")
        try:
            result = get_stock_realtime_quote(symbol)
            if result.startswith("Error") or result.startswith("No real-time"):
                print(f"✗ Failed: {result}")
            else:
                print(f"✓ Success!")
                # Print first 500 characters
                print(result[:500] + "..." if len(result) > 500 else result)
        except Exception as e:
            print(f"✗ Exception: {type(e).__name__}: {e}")
    
    return True


def main():
    """Run all tests"""
    print("\n" + "=" * 80)
    print("Real-Time Stock Quotes Test Suite")
    print("=" * 80 + "\n")
    
    # Test 1: Symbol normalization (no token needed)
    norm_passed = test_symbol_normalization()
    
    # Test 2: Real-time quotes (requires token from environment)
    api_passed = test_realtime_quotes()
    
    # Summary
    print("\n" + "=" * 80)
    print("Test Summary")
    print("=" * 80)
    print(f"Symbol Normalization: {'✓ PASSED' if norm_passed else '✗ FAILED'}")
    print(f"API Integration: {'✓ PASSED' if api_passed else '✗ FAILED'}")
    print("\nNote: API tests require XUEQIU_TOKEN environment variable")
    print("See docs/XUEQIU_TOKEN_SETUP.md for setup instructions")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
