"""
Prompt Loader Service

Handles loading and managing user-specific agent prompt templates.
"""

import logging
from datetime import datetime
from typing import Tuple, List, Optional
from sqlalchemy.orm import Session

from web.backend.database import SessionLocal
from web.backend.models import AgentPromptTemplate, TemplateTools, AgentTool

logger = logging.getLogger(__name__)


def generate_tool_documentation() -> str:
    """
    Generate tool documentation for ALL available tools (English)
    
    Returns:
        Formatted tool documentation string in English
    """
    from web.backend.database import SessionLocal
    from web.backend.models import AgentTool
    
    db = SessionLocal()
    try:
        # Get ALL available tools
        tools = db.query(AgentTool).filter(
            AgentTool.is_available == True
        ).order_by(AgentTool.category, AgentTool.tool_name).all()
        
        if not tools:
            return ""
        
        # Group tools by category
        tools_by_category = {}
        for tool in tools:
            category = tool.category or 'other'
            if category not in tools_by_category:
                tools_by_category[category] = []
            tools_by_category[category].append(tool)
        
        category_names = {
            'account': 'Account Management Tools',
            'market_data': 'Market Data Tools', 
            'trading': 'Trading Execution Tools',
            'news': 'News & Information Tools',
            'other': 'Other Tools'
        }
        
        doc_parts = ["## Available Tools\n"]
        doc_parts.append("All tools below are available for use. The system will automatically provide access to these tools.\n")
        
        for category, category_tools in tools_by_category.items():
            category_name = category_names.get(category, category)
            doc_parts.append(f"### {category_name}\n")
            
            for tool in category_tools:
                doc_parts.append(f"- `{tool.tool_name}` - {tool.tool_description}")
                
                # Add parameter info if available
                if tool.tool_parameters and 'properties' in tool.tool_parameters:
                    params = list(tool.tool_parameters['properties'].keys())
                    if params:
                        doc_parts.append(f"  * Parameters: {', '.join(params)}")
            
            doc_parts.append("")  # Empty line between categories
        
        return "\n".join(doc_parts)
        
    finally:
        db.close()


def generate_variable_documentation() -> str:
    """
    Generate documentation for runtime variables (English)
    
    Returns:
        Formatted variable documentation string in English
    """
    return """## Runtime Variables

The following variables are automatically injected at runtime. You can reference them in your prompt:

- `{market_type}` - Current market type (US/HK/CN)
- `{session_id}` - Unique session identifier
- `{timestamp}` - Current timestamp (YYYY-MM-DD HH:MM:SS)
- `{user_id}` - Current user ID

These variables will be automatically replaced with actual values during execution.
"""


def get_default_intraday_prompt() -> str:
    """
    Get the default intraday trader prompt template
    
    This is the fallback prompt used when a user hasn't customized their template yet.
    """
    # Read from the original intraday_trader.py file
    try:
        import os
        prompt_file = os.path.join(
            os.path.dirname(__file__),
            '../../../tradingagents/agents/trader/intraday_trader_default_prompt.txt'
        )
        
        if os.path.exists(prompt_file):
            with open(prompt_file, 'r', encoding='utf-8') as f:
                return f.read()
    except Exception as e:
        logger.warning(f"Could not load default prompt from file: {e}")
    
    # Fallback inline prompt
    return """You are an aggressive intraday trading agent operating like a professional day trader with full autonomy to analyze positions and execute trades.

## Your Mission
Maximize risk-adjusted returns through strategic intraday trading.

## Available Variables
- {{market_type}} - Current market (US/HK/CN)
- {{session_id}} - Session identifier
- {{timestamp}} - Current timestamp
- {{user_id}} - User identifier

## Execution Workflow

### Phase 1: Information Collection
Call these tools to gather data:
- get_futu_account_info(market_type="{{market_type}}")
- get_futu_positions(market_type="{{market_type}}")
- get_futu_orders(market_type="{{market_type}}", filter_status=0)

### Phase 2: Analysis
Analyze the collected data and make decisions.

### Phase 3: Execute Trades
Use place_futu_order() to execute trades if needed.

### Phase 4: Generate Report
Provide a comprehensive report in Chinese.

Current market: {{market_type}}
Session: {{session_id}}
"""


def create_default_template_for_user(user_id: int, db: Session) -> AgentPromptTemplate:
    """
    Create a default prompt template for a user
    
    Args:
        user_id: User ID
        db: Database session
        
    Returns:
        Created template
    """
    default_prompt = get_default_intraday_prompt()
    
    template = AgentPromptTemplate(
        agent_type="intraday_trader",
        user_id=user_id,
        system_prompt=default_prompt,
        template_name="默认日内交易策略",
        description="系统默认的日内交易 Agent 提示词",
        version="1.0",
        is_active=True
    )
    
    db.add(template)
    db.commit()
    db.refresh(template)
    
    # Enable all tools by default
    all_tools = db.query(AgentTool).filter(AgentTool.is_available == True).all()
    for tool in all_tools:
        template_tool = TemplateTools(
            template_id=template.id,
            tool_name=tool.tool_name,
            is_enabled=True
        )
        db.add(template_tool)
    
    db.commit()
    
    logger.info(f"Created default template for user {user_id} with {len(all_tools)} tools")
    
    return template


def load_user_prompt_template(
    user_id: int,
    agent_type: str = "intraday_trader",
) -> str:
    """
    Load user's core prompt template (strategy and behavior only)
    
    This function loads ONLY the user's custom strategy content.
    System documentation (tools, variables) will be injected by the agent at runtime.
    
    Args:
        user_id: User ID
        agent_type: Type of agent (default: intraday_trader)
        
    Returns:
        User's core prompt string (without system injections)
    """
    db = SessionLocal()
    try:
        # Query user's template
        template = db.query(AgentPromptTemplate).filter(
            AgentPromptTemplate.agent_type == agent_type,
            AgentPromptTemplate.user_id == user_id,
            AgentPromptTemplate.is_active == True
        ).first()
        
        # Create default if not exists
        if not template:
            logger.info(f"No template found for user {user_id}, creating default")
            template = create_default_template_for_user(user_id, db)
        
        # Return ONLY user's core prompt (no system injections)
        # System documentation will be added by agent at runtime
        logger.info(
            f"Loaded core prompt for user {user_id}: "
            f"version={template.version}, "
            f"length={len(template.system_prompt)}"
        )
        
        return template.system_prompt
        
    except Exception as e:
        logger.error(f"Error loading prompt template for user {user_id}: {e}", exc_info=True)
        # Fallback to default core prompt (no system injections)
        return get_default_intraday_prompt()
        
    finally:
        db.close()


def get_enabled_tools_for_user(user_id: int, agent_type: str = "intraday_trader") -> List[str]:
    """
    Get list of enabled tool names for a user
    
    Args:
        user_id: User ID
        agent_type: Type of agent
        
    Returns:
        List of enabled tool names
    """
    db = SessionLocal()
    try:
        template = db.query(AgentPromptTemplate).filter(
            AgentPromptTemplate.agent_type == agent_type,
            AgentPromptTemplate.user_id == user_id,
            AgentPromptTemplate.is_active == True
        ).first()
        
        if not template:
            # Return all tools if no template
            all_tools = db.query(AgentTool).filter(AgentTool.is_available == True).all()
            return [t.tool_name for t in all_tools]
        
        enabled_tools = db.query(TemplateTools).filter(
            TemplateTools.template_id == template.id,
            TemplateTools.is_enabled == True
        ).all()
        
        return [t.tool_name for t in enabled_tools]
        
    finally:
        db.close()
