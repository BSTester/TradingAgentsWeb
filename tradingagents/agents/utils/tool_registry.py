"""
Tool Registry - Central registry for data collection tools.

M0 removes Futu order/account tooling; registered tools must be read-only data
collection capabilities that can later be exposed through the Skills layer.
"""

from typing import Any, Dict, List

from langchain_core.tools import BaseTool


def extract_tool_metadata(tool: BaseTool) -> Dict[str, Any]:
    """Extract metadata from a LangChain tool."""
    parameters = {}
    if hasattr(tool, "args_schema") and tool.args_schema:
        schema = tool.args_schema.schema()
        parameters = {
            "properties": schema.get("properties", {}),
            "required": schema.get("required", []),
            "type": "object",
        }

    return {
        "tool_name": tool.name,
        "tool_description": tool.description or "",
        "tool_parameters": parameters,
    }


def get_all_akshare_tools() -> List[Dict[str, Any]]:
    """Get metadata for all AkShare news/market discovery tools."""
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_hot_stocks,
        get_akshare_news,
    )

    metadata_list = []
    for tool in [get_akshare_news, get_akshare_hot_stocks]:
        metadata = extract_tool_metadata(tool)
        metadata["category"] = "news"
        metadata_list.append(metadata)
    return metadata_list


def get_all_tools_metadata() -> List[Dict[str, Any]]:
    """Get metadata for all available tools."""
    return get_all_akshare_tools()


def get_tool_by_name(tool_name: str) -> BaseTool | None:
    """Get a registered tool instance by name."""
    from tradingagents.agents.utils.akshare_news_tools import (
        get_akshare_hot_stocks,
        get_akshare_news,
    )

    tool_map = {
        "get_akshare_news": get_akshare_news,
        "get_akshare_hot_stocks": get_akshare_hot_stocks,
    }
    return tool_map.get(tool_name)


def get_tools_by_names(tool_names: List[str]) -> List[BaseTool]:
    """Get multiple registered tool instances by name."""
    return [tool for name in tool_names if (tool := get_tool_by_name(name))]
