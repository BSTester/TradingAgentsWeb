"""
Prompt Loader Service

Handles loading and managing user-specific agent prompt templates.
"""

import logging
import threading
from datetime import datetime
from typing import Tuple, List, Optional, Dict, Any
from sqlalchemy.orm import Session

from web.backend.database import SessionLocal
from web.backend.models import AgentPromptTemplate, TemplateTools, AgentTool

logger = logging.getLogger(__name__)


# ============================================================================
# Prompt Cache
# ============================================================================

class PromptCache:
    """
    Thread-safe cache for user prompt templates
    
    Cache key: (user_id, agent_type)
    Cache value: prompt string
    """
    
    def __init__(self):
        self._cache: Dict[Tuple[int, str], str] = {}
        self._lock = threading.RLock()
        logger.info("PromptCache initialized (no expiration, manual invalidation only)")
    
    def get(self, key: Tuple[int, str]) -> Optional[str]:
        """Get prompt from cache"""
        with self._lock:
            return self._cache.get(key)
    
    def set(self, key: Tuple[int, str], prompt: str) -> None:
        """Set prompt in cache"""
        with self._lock:
            self._cache[key] = prompt
            logger.debug(f"Cached prompt for user {key[0]}, agent_type {key[1]}")
    
    def invalidate(self, user_id: int, agent_type: str) -> None:
        """Invalidate cache for a specific user and agent type"""
        key = (user_id, agent_type)
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.info(f"✅ Invalidated prompt cache for user {user_id}, agent_type {agent_type}")
    
    def clear(self) -> None:
        """Clear all cache"""
        with self._lock:
            self._cache.clear()
            logger.info("Prompt cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        with self._lock:
            return {
                "total_entries": len(self._cache),
                "cached_keys": list(self._cache.keys())
            }


# Global prompt cache instance
_prompt_cache = PromptCache()


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


def _create_default_template_for_user_sync(user_id: int, db) -> AgentPromptTemplate:
    """
    Create a default prompt template for a user - Sync version
    
    Args:
        user_id: User ID
        db: Sync database session
        
    Returns:
        Created template
    """
    from sqlalchemy import select
    
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
    result = db.execute(select(AgentTool).filter(AgentTool.is_available == True))
    all_tools = result.scalars().all()
    
    for tool in all_tools:
        template_tool = TemplateTools(
            template_id=template.id,
            tool_name=tool.tool_name,
            is_enabled=True
        )
        db.add(template_tool)
    
    db.commit()
    
    return template


async def create_default_template_for_user_async(user_id: int, db) -> AgentPromptTemplate:
    """
    Create a default prompt template for a user - Async version (deprecated, kept for compatibility)
    
    Args:
        user_id: User ID
        db: Database session (will be ignored, creates its own)
        
    Returns:
        Created template
    """
    import asyncio
    from web.backend.database import SessionLocal
    
    # Create own sync session to avoid event loop issues
    sync_db = SessionLocal()
    try:
        return await asyncio.to_thread(_create_default_template_for_user_sync, user_id, sync_db)
    finally:
        sync_db.close()
    
    logger.info(f"Created default template for user {user_id} with {len(all_tools)} tools")
    
    return template


def create_default_template_for_user(user_id: int, db: Session) -> AgentPromptTemplate:
    """
    Create a default prompt template for a user - Sync version
    
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


def _load_user_prompt_template_sync(
    user_id: int,
    agent_type: str = "intraday_trader",
) -> str:
    """
    Load user's core prompt template (strategy and behavior only) - Sync version
    
    This is the internal sync implementation that can be called from any context.
    """
    # Try to get from cache first
    cache_key = (user_id, agent_type)
    cached_prompt = _prompt_cache.get(cache_key)
    
    if cached_prompt is not None:
        logger.debug(f"✅ Loaded prompt from cache for user {user_id}, agent_type {agent_type}")
        return cached_prompt
    
    # Cache miss - load from database (sync)
    from web.backend.database import SessionLocal
    from sqlalchemy import select
    
    db = SessionLocal()
    try:
        # Check if user is active first
        from web.backend.models import User
        result = db.execute(select(User).filter(User.id == user_id))
        user = result.scalar_one_or_none()
        
        if not user:
            logger.warning(f"User {user_id} not found")
            default_prompt = get_default_intraday_prompt()
            return default_prompt
        
        if not user.is_active:
            logger.debug(f"User {user_id} is disabled, skipping cache, using default prompt")
            # Don't cache for disabled users
            return get_default_intraday_prompt()
        
        # Query user's template
        result = db.execute(
            select(AgentPromptTemplate).filter(
                AgentPromptTemplate.agent_type == agent_type,
                AgentPromptTemplate.user_id == user_id,
                AgentPromptTemplate.is_active == True
            )
        )
        template = result.scalar_one_or_none()
        
        # Create default if not exists
        if not template:
            logger.info(f"No template found for user {user_id}, creating default")
            template = _create_default_template_for_user_sync(user_id, db)
            
            # Cache the prompt (only for active users)
            prompt = template.system_prompt
            _prompt_cache.set(cache_key, prompt)
            
            # Return ONLY user's core prompt (no system injections)
            # System documentation will be added by agent at runtime
            logger.info(
                f"📋 Loaded core prompt from database for user {user_id}: "
                f"version={template.version}, "
                f"length={len(prompt)}"
            )
            
            return prompt
            
    except Exception as e:
        logger.error(f"Error loading prompt template for user {user_id}: {e}", exc_info=True)
        # Fallback to default core prompt (no system injections)
        default_prompt = get_default_intraday_prompt()
        return default_prompt
    finally:
        db.close()


async def load_user_prompt_template_async(
    user_id: int,
    agent_type: str = "intraday_trader",
) -> str:
    """
    Load user's core prompt template (strategy and behavior only) - Async wrapper
    
    This function loads ONLY the user's custom strategy content.
    System documentation (tools, variables) will be injected by the agent at runtime.
    
    Uses caching to reduce database queries.
    
    Args:
        user_id: User ID
        agent_type: Type of agent (default: intraday_trader)
        
    Returns:
        User's core prompt string (without system injections)
    """
    import asyncio
    # Run sync version in thread pool to avoid event loop conflicts
    return await asyncio.to_thread(_load_user_prompt_template_sync, user_id, agent_type)


def load_user_prompt_template(
    user_id: int,
    agent_type: str = "intraday_trader",
) -> str:
    """
    Load user's core prompt template (strategy and behavior only) - Sync version
    
    This function loads ONLY the user's custom strategy content.
    System documentation (tools, variables) will be injected by the agent at runtime.
    
    Uses caching to reduce database queries.
    
    Args:
        user_id: User ID
        agent_type: Type of agent (default: intraday_trader)
        
    Returns:
        User's core prompt string (without system injections)
    """
    # Try to get from cache first
    cache_key = (user_id, agent_type)
    cached_prompt = _prompt_cache.get(cache_key)
    
    if cached_prompt is not None:
        logger.debug(f"✅ Loaded prompt from cache for user {user_id}, agent_type {agent_type}")
        return cached_prompt
    
    # Cache miss - load from database
    db = SessionLocal()
    try:
        # Check if user is active first
        from web.backend.models import User
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            logger.warning(f"User {user_id} not found")
            default_prompt = get_default_intraday_prompt()
            return default_prompt
        
        if not user.is_active:
            logger.debug(f"User {user_id} is disabled, skipping cache, using default prompt")
            # Don't cache for disabled users
            return get_default_intraday_prompt()
        
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
        
        # Cache the prompt (only for active users)
        prompt = template.system_prompt
        _prompt_cache.set(cache_key, prompt)
        
        # Return ONLY user's core prompt (no system injections)
        # System documentation will be added by agent at runtime
        logger.info(
            f"📋 Loaded core prompt from database for user {user_id}: "
            f"version={template.version}, "
            f"length={len(prompt)}"
        )
        
        return prompt
        
    except Exception as e:
        logger.error(f"Error loading prompt template for user {user_id}: {e}", exc_info=True)
        # Fallback to default core prompt (no system injections)
        default_prompt = get_default_intraday_prompt()
        # Don't cache error cases
        return default_prompt
        
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



def invalidate_prompt_cache(user_id: int, agent_type: str = "intraday_trader"):
    """
    Invalidate prompt cache for a user
    
    This function should be called when a user's prompt template is updated.
    
    Args:
        user_id: User ID
        agent_type: Agent type (default: intraday_trader)
    """
    _prompt_cache.invalidate(user_id, agent_type)
