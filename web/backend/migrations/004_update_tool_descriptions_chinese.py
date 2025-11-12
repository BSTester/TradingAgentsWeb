#!/usr/bin/env python3
"""
Migration: Update Tool Descriptions to Chinese

This migration updates all tool descriptions to Chinese.

Run: python -m web.backend.migrations.004_update_tool_descriptions_chinese
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..')))

from web.backend.database import SessionLocal
from web.backend.models import AgentTool


# Chinese descriptions for all tools
TOOL_DESCRIPTIONS_CN = {
    # Account management tools
    'get_futu_account_info': '获取富途账户信息，包括资金余额、持仓市值、盈亏等',
    'get_futu_positions': '获取富途持仓信息，包括股票代码、持仓数量、成本价、当前价、盈亏等',
    'get_futu_orders': '获取富途订单信息，可按状态筛选（全部/待成交/已成交/已撤销）',
    
    # Market data tools
    'get_futu_quote': '获取股票实时行情，包括最新价、涨跌幅、成交量、OHLC等',
    'get_futu_kline': '获取股票K线数据，支持多种时间周期（1分钟/5分钟/日线/周线等）',
    'get_futu_technical_analysis': '获取技术分析指标，支持MACD、RSI、布林带等常用指标',
    
    # Trading tools
    'place_futu_order': '下单交易，支持买入/卖出，市价单/限价单',
    
    # News tools
    'get_futu_hot_news': '获取富途热门财经新闻，支持中英文',
    'get_futu_hot_stocks': '获取富途热门股票榜单，发现市场热点',
    'get_akshare_news': '获取AkShare财经新闻，实时市场资讯',
    'get_akshare_hot_stocks': '获取AkShare热门股票（百度搜索热度），支持A股/港股/美股',
}


def migrate():
    """Execute migration"""
    print("=" * 60)
    print("Migration: Update Tool Descriptions to Chinese")
    print("=" * 60)
    
    db = SessionLocal()
    try:
        print("\n📝 Updating tool descriptions...")
        updated_count = 0
        not_found_count = 0
        
        for tool_name, description_cn in TOOL_DESCRIPTIONS_CN.items():
            tool = db.query(AgentTool).filter(
                AgentTool.tool_name == tool_name
            ).first()
            
            if tool:
                old_desc = tool.tool_description
                tool.tool_description = description_cn
                updated_count += 1
                print(f"  ✓ {tool_name}")
                print(f"    旧: {old_desc[:50]}...")
                print(f"    新: {description_cn}")
            else:
                not_found_count += 1
                print(f"  ✗ {tool_name} (not found in database)")
        
        db.commit()
        
        print(f"\n✅ Tool descriptions updated:")
        print(f"   - Updated: {updated_count}")
        print(f"   - Not found: {not_found_count}")
        
        # Show all tools with new descriptions
        print("\n📊 All tools with Chinese descriptions:")
        tools = db.query(AgentTool).order_by(AgentTool.category, AgentTool.tool_name).all()
        
        current_category = None
        for tool in tools:
            if tool.category != current_category:
                current_category = tool.category
                category_names = {
                    'account': '账户管理工具',
                    'market_data': '行情数据工具',
                    'trading': '交易执行工具',
                    'news': '新闻资讯工具',
                    'other': '其他工具'
                }
                print(f"\n  【{category_names.get(tool.category, tool.category)}】")
            
            print(f"    • {tool.tool_name}: {tool.tool_description}")
        
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
