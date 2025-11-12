"""
Tool Registry - Central registry for all available agent tools

This module provides a centralized registry of all tools that can be used by agents.
It extracts metadata from tool functions and provides a structured format for storage.
"""

import inspect
from typing import List, Dict, Any
from langchain_core.tools import BaseTool


def extract_tool_metadata(tool: BaseTool) -> Dict[str, Any]:
    """
    Extract metadata from a LangChain tool
    
    Args:
        tool: LangChain BaseTool instance
        
    Returns:
        Dictionary with tool metadata
    """
    # Get parameter schema
    parameters = {}
    if hasattr(tool, 'args_schema') and tool.args_schema:
        schema = tool.args_schema.schema()
        parameters = {
            'properties': schema.get('properties', {}),
            'required': schema.get('required', []),
            'type': 'object'
        }
    
    return {
        'tool_name': tool.name,
        'tool_description': tool.description or '',
        'tool_parameters': parameters,
    }


def get_all_futu_tools() -> List[Dict[str, Any]]:
    """Get metadata for all Futu trading tools"""
    from tradingagents.agents.utils.futu_trading_tools import (
        get_futu_account_info,
        get_futu_positions,
        get_futu_orders,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_futu_hot_news,
        place_futu_order,
    )
    
    tools = [
        get_futu_account_info,
        get_futu_positions,
        get_futu_orders,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_futu_hot_news,
        place_futu_order,
    ]
    
    metadata_list = []
    for tool in tools:
        metadata = extract_tool_metadata(tool)
        
        # Categorize tools
        if 'account' in tool.name or 'position' in tool.name or 'order' in tool.name:
            category = 'account'
        elif 'quote' in tool.name or 'kline' in tool.name or 'technical' in tool.name:
            category = 'market_data'
        elif 'place' in tool.name:
            category = 'trading'
        elif 'news' in tool.name or 'hot' in tool.name:
            category = 'news'
        else:
            category = 'other'
        
        metadata['category'] = category
        metadata_list.append(metadata)
    
    return metadata_list


def get_all_akshare_tools() -> List[Dict[str, Any]]:
    """Get metadata for all AkShare tools"""
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_news,
        get_akshare_hot_stocks,
    )
    
    tools = [
        get_akshare_news,
        get_akshare_hot_stocks,
    ]
    
    metadata_list = []
    for tool in tools:
        metadata = extract_tool_metadata(tool)
        metadata['category'] = 'news'
        metadata_list.append(metadata)
    
    return metadata_list


def get_all_tools_metadata() -> List[Dict[str, Any]]:
    """
    Get metadata for all available tools
    
    Returns:
        List of tool metadata dictionaries
    """
    all_tools = []
    
    # Futu tools
    all_tools.extend(get_all_futu_tools())
    
    # AkShare tools
    all_tools.extend(get_all_akshare_tools())
    
    return all_tools


def get_tool_by_name(tool_name: str) -> BaseTool:
    """
    Get a tool instance by name
    
    Args:
        tool_name: Name of the tool
        
    Returns:
        Tool instance or None if not found
    """
    from tradingagents.agents.utils.futu_trading_tools import (
        get_futu_account_info,
        get_futu_positions,
        get_futu_orders,
        get_futu_quote,
        get_futu_kline,
        get_futu_technical_analysis,
        get_futu_hot_stocks,
        get_futu_hot_news,
        place_futu_order,
    )
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_news,
        get_akshare_hot_stocks,
    )
    
    tool_map = {
        'get_futu_account_info': get_futu_account_info,
        'get_futu_positions': get_futu_positions,
        'get_futu_orders': get_futu_orders,
        'get_futu_quote': get_futu_quote,
        'get_futu_kline': get_futu_kline,
        'get_futu_technical_analysis': get_futu_technical_analysis,
        'get_futu_hot_stocks': get_futu_hot_stocks,
        'get_futu_hot_news': get_futu_hot_news,
        'place_futu_order': place_futu_order,
        'get_akshare_news': get_akshare_news,
        'get_akshare_hot_stocks': get_akshare_hot_stocks,
    }
    
    return tool_map.get(tool_name)


def get_tools_by_names(tool_names: List[str]) -> List[BaseTool]:
    """
    Get multiple tool instances by names
    
    Args:
        tool_names: List of tool names
        
    Returns:
        List of tool instances
    """
    tools = []
    for name in tool_names:
        tool = get_tool_by_name(name)
        if tool:
            tools.append(tool)
    return tools
