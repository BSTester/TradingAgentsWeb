#!/usr/bin/env python3
"""
Migration: Update Tool Descriptions to English

This migration updates all tool descriptions to English.

Run: python -m web.backend.migrations.005_update_tool_descriptions_english
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from web.backend.database import SessionLocal
from web.backend.models import AgentTool


# English descriptions for all tools
TOOL_DESCRIPTIONS_EN = {
    # Account management tools
    'get_futu_account_info': 'Get Futu account information including balance, position value, and P&L',
    'get_futu_positions': 'Get Futu positions including stock code, quantity, cost price, current price, and P&L',
    'get_futu_orders': 'Get Futu order information with optional status filter (all/pending/filled/cancelled)',
    
    # Market data tools
    'get_futu_quote': 'Get real-time stock quote including latest price, change%, volume, and OHLC',
    'get_futu_kline': 'Get stock K-line data supporting multiple timeframes (1min/5min/daily/weekly)',
    'get_futu_technical_analysis': 'Get technical analysis indicators including MACD, RSI, Bollinger Bands',
    
    # Trading tools
    'place_futu_order': 'Place trading order supporting buy/sell and market/limit order types',
    
    # News tools
    'get_futu_hot_news': 'Get hot financial news from Futu supporting Chinese and English',
    'get_futu_hot_stocks': 'Get hot stocks list from Futu to discover market trends',
    'get_akshare_news': 'Get financial news from AkShare for real-time market information',
    'get_akshare_hot_stocks': 'Get hot stocks from AkShare (Baidu search popularity) supporting A-shares/HK/US',
}


def migrate():
    """Execute migration"""
    print("=" * 60)
    print("Migration: Update Tool Descriptions to English")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        print("\n📝 Updating tool descriptions...")
        updated_count = 0
        not_found_count = 0
        
        for tool_name, description_en in TOOL_DESCRIPTIONS_EN.items():
            tool = db.query(AgentTool).filter(
                AgentTool.tool_name == tool_name
            ).first()
            
            if tool:
                old_desc = tool.tool_description
                tool.tool_description = description_en
                updated_count += 1
                print(f"  ✓ {tool_name}")
                print(f"    Old: {old_desc[:50]}...")
                print(f"    New: {description_en}")
            else:
                not_found_count += 1
                print(f"  ✗ {tool_name} (not found in database)")
        
        db.commit()
        
        print(f"\n✅ Tool descriptions updated:")
        print(f"   - Updated: {updated_count}")
        print(f"   - Not found: {not_found_count}")
        
        # Show all tools with new descriptions
        print("\n📊 All tools with English descriptions:")
        tools = db.query(AgentTool).order_by(AgentTool.category, AgentTool.tool_name).all()
        
        current_category = None
        category_names = {
            'account': 'Account Management Tools',
            'market_data': 'Market Data Tools',
            'trading': 'Trading Execution Tools',
            'news': 'News & Information Tools',
            'other': 'Other Tools'
        }
        
        for tool in tools:
            if tool.category != current_category:
                current_category = tool.category
                print(f"\n  【{category_names.get(tool.category, tool.category)}】")
            
            print(f"    • {tool.tool_name}: {tool.tool_description}")
        
        print(f"\n✅ Total: {len(tools)} tools with English descriptions")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
