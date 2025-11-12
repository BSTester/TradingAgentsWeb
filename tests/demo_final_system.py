#!/usr/bin/env python3
"""
Demo: Final System with Chinese Tool Descriptions and Auto Documentation
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from web.backend.services.prompt_loader import load_user_prompt_template
from web.backend.database import SessionLocal
from web.backend.models import AgentTool


def show_tool_descriptions():
    """Show all tool descriptions in Chinese"""
    print("=" * 80)
    print("📚 工具描述（中文）")
    print("=" * 80)
    
    db = SessionLocal()
    try:
        tools = db.query(AgentTool).order_by(AgentTool.category, AgentTool.tool_name).all()
        
        current_category = None
        category_names = {
            'account': '账户管理工具',
            'market_data': '行情数据工具',
            'trading': '交易执行工具',
            'news': '新闻资讯工具',
            'other': '其他工具'
        }
        
        for tool in tools:
            if tool.category != current_category:
                current_category = tool.category
                print(f"\n【{category_names.get(tool.category, tool.category)}】")
            
            print(f"  • {tool.tool_name}")
            print(f"    {tool.tool_description}")
        
        print(f"\n✅ 共 {len(tools)} 个工具，全部使用中文描述")
        
    finally:
        db.close()


def show_full_prompt_structure():
    """Show the complete prompt structure with auto-generated documentation"""
    print("\n" + "=" * 80)
    print("📋 完整提示词结构（自动生成文档）")
    print("=" * 80)
    
    prompt, tools = load_user_prompt_template(1, 'intraday_trader', 'US')
    
    print(f"\n✅ 提示词总长度: {len(prompt)} 字符")
    print(f"✅ 启用工具数量: {len(tools)}")
    
    # Show structure
    print("\n📐 提示词结构:")
    print("  1️⃣ 运行时变量说明（自动生成）")
    print("  2️⃣ 可用工具说明（根据用户选择的工具自动生成）")
    print("  3️⃣ Agent 行为配置（用户编辑的提示词）")
    
    # Show each section
    sections = [
        ("运行时变量说明", "运行时变量说明", "可用工具说明"),
        ("可用工具说明", "可用工具说明", "Agent 行为配置"),
        ("Agent 行为配置", "Agent 行为配置", None)
    ]
    
    for section_name, start_marker, end_marker in sections:
        print(f"\n{'─' * 80}")
        print(f"📄 {section_name}")
        print('─' * 80)
        
        start_idx = prompt.find(start_marker)
        if start_idx == -1:
            print(f"  ⚠️ 未找到 {section_name}")
            continue
        
        if end_marker:
            end_idx = prompt.find(end_marker, start_idx + len(start_marker))
            if end_idx == -1:
                section_content = prompt[start_idx:]
            else:
                section_content = prompt[start_idx:end_idx]
        else:
            section_content = prompt[start_idx:]
        
        # Show first 500 characters of each section
        preview = section_content[:500].strip()
        print(preview)
        if len(section_content) > 500:
            print(f"\n  ... (还有 {len(section_content) - 500} 字符)")


def show_selective_tools_demo():
    """Demo: Show how tool documentation adapts to user selection"""
    print("\n" + "=" * 80)
    print("🎯 工具选择演示（工具说明自动适配）")
    print("=" * 80)
    
    from web.backend.services.prompt_loader import generate_tool_documentation
    
    scenarios = [
        ("只读模式（仅查询工具）", [
            'get_futu_account_info',
            'get_futu_positions',
            'get_futu_quote',
            'get_futu_kline',
        ]),
        ("完整交易模式（所有工具）", [
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
        ]),
        ("新闻分析模式（新闻+行情）", [
            'get_futu_quote',
            'get_futu_hot_news',
            'get_akshare_news',
            'get_akshare_hot_stocks',
        ]),
    ]
    
    for scenario_name, tool_list in scenarios:
        print(f"\n{'─' * 80}")
        print(f"📌 场景: {scenario_name}")
        print(f"   工具数量: {len(tool_list)}")
        print('─' * 80)
        
        doc = generate_tool_documentation(tool_list)
        print(doc)


def main():
    """Run all demos"""
    print("\n" + "🎉" * 40)
    print("最终系统演示：中文工具描述 + 自动文档生成")
    print("🎉" * 40)
    
    show_tool_descriptions()
    show_full_prompt_structure()
    show_selective_tools_demo()
    
    print("\n" + "=" * 80)
    print("✅ 所有功能演示完成！")
    print("=" * 80)
    print("\n核心特性:")
    print("  ✓ 所有工具描述使用中文")
    print("  ✓ 系统自动添加变量说明")
    print("  ✓ 系统自动添加工具使用说明")
    print("  ✓ 工具说明根据用户选择自动适配")
    print("  ✓ 用户只需编辑 Agent 行为配置部分")
    print("\n🚀 系统已完全就绪！")


if __name__ == "__main__":
    main()
