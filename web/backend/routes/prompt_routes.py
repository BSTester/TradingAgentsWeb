"""
Agent Prompt Template Management Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from web.backend.database import get_db
from web.backend.models import AgentPromptTemplate, TemplateTools, AgentTool, User
from web.backend.schemas import (
    PromptTemplateCreate,
    PromptTemplateUpdate,
    PromptTemplateResponse,
    ToolResponse,
    ToolSelectionUpdate,
    BulkToolSelectionUpdate,
)
from web.backend.auth_routes import get_current_user
from web.backend.services.prompt_loader import get_default_intraday_prompt, create_default_template_for_user

router = APIRouter(prefix="/api/prompts", tags=["prompts"])


@router.get("/tools", response_model=List[ToolResponse])
async def list_available_tools(
    category: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of all available tools
    
    Query params:
        - category: Filter by category (account, market_data, trading, news)
    """
    from sqlalchemy import select
    
    query = select(AgentTool).where(AgentTool.is_available == True)
    
    if category:
        query = query.where(AgentTool.category == category)
    
    result = await db.execute(query)
    tools = result.scalars().all()
    
    return [ToolResponse.model_validate(tool) for tool in tools]


@router.get("/templates/{agent_type}", response_model=PromptTemplateResponse)
async def get_prompt_template(
    agent_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get current user's prompt template for specified agent type
    """
    from sqlalchemy import select
    
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,
        AgentPromptTemplate.is_active == True
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for agent type '{agent_type}'"
        )
    
    # Get enabled tools
    tools_query = select(TemplateTools).where(
        TemplateTools.template_id == template.id,
        TemplateTools.is_enabled == True
    )
    tools_result = await db.execute(tools_query)
    enabled_tools = [t.tool_name for t in tools_result.scalars().all()]
    
    response = PromptTemplateResponse.model_validate(template)
    response.enabled_tools = enabled_tools
    
    return response


@router.post("/templates/{agent_type}", response_model=PromptTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_template(
    agent_type: str,
    data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new prompt template (if one doesn't exist)
    """
    from sqlalchemy import select
    
    # Check if template already exists
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id
    )
    result = await db.execute(query)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Template for agent type '{agent_type}' already exists"
        )
    
    # Create new template
    template = AgentPromptTemplate(
        agent_type=agent_type,
        user_id=current_user.id,
        system_prompt=data.system_prompt,
        template_name=data.template_name,
        description=data.description,
        version=data.version,
        is_active=True
    )
    
    db.add(template)
    await db.flush()
    
    # Enable all tools by default
    tools_query = select(AgentTool).where(AgentTool.is_available == True)
    tools_result = await db.execute(tools_query)
    all_tools = tools_result.scalars().all()
    
    for tool in all_tools:
        template_tool = TemplateTools(
            template_id=template.id,
            tool_name=tool.tool_name,
            is_enabled=True
        )
        db.add(template_tool)
    
    await db.commit()
    await db.refresh(template)
    
    response = PromptTemplateResponse.model_validate(template)
    response.enabled_tools = [t.tool_name for t in all_tools]
    
    return response


@router.put("/templates/{agent_type}", response_model=PromptTemplateResponse)
async def update_prompt_template(
    agent_type: str,
    data: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's prompt template
    """
    from sqlalchemy import select
    from datetime import datetime
    
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,
        AgentPromptTemplate.is_active == True
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for agent type '{agent_type}'"
        )
    
    # Update fields
    if data.template_name is not None:
        template.template_name = data.template_name
    if data.description is not None:
        template.description = data.description
    if data.system_prompt is not None:
        template.system_prompt = data.system_prompt
        # Auto-increment version when system_prompt is updated
        if template.version:
            try:
                # Try to parse version as float and increment
                current_version = float(template.version)
                template.version = f"{current_version + 0.1:.1f}"
            except ValueError:
                # If version is not a number, append timestamp
                template.version = f"{template.version}_{datetime.utcnow().strftime('%Y%m%d')}"
        else:
            template.version = "1.0"
    if data.version is not None:
        # Allow manual version override
        template.version = data.version
    if data.is_active is not None:
        template.is_active = data.is_active
    
    template.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(template)
    
    # Invalidate prompt cache after update
    from web.backend.services.prompt_loader import invalidate_prompt_cache
    invalidate_prompt_cache(current_user.id, agent_type)
    
    # Get enabled tools
    tools_query = select(TemplateTools).where(
        TemplateTools.template_id == template.id,
        TemplateTools.is_enabled == True
    )
    tools_result = await db.execute(tools_query)
    enabled_tools = [t.tool_name for t in tools_result.scalars().all()]
    
    response = PromptTemplateResponse.model_validate(template)
    response.enabled_tools = enabled_tools
    
    return response


@router.post("/templates/{agent_type}/reset", response_model=PromptTemplateResponse)
async def reset_to_default(
    agent_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Reset template to default prompt
    """
    from sqlalchemy import select
    from datetime import datetime
    
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,
        AgentPromptTemplate.is_active == True
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for agent type '{agent_type}'"
        )
    
    # Get default prompt
    default_prompt = get_default_intraday_prompt()
    
    # Reset template
    template.system_prompt = default_prompt
    template.version = "1.0"
    template.template_name = "默认日内交易策略"
    template.description = "系统默认的日内交易 Agent 提示词"
    template.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(template)
    
    # Get enabled tools
    tools_query = select(TemplateTools).where(
        TemplateTools.template_id == template.id,
        TemplateTools.is_enabled == True
    )
    tools_result = await db.execute(tools_query)
    enabled_tools = [t.tool_name for t in tools_result.scalars().all()]
    
    response = PromptTemplateResponse.model_validate(template)
    response.enabled_tools = enabled_tools
    
    return response


@router.get("/templates/{agent_type}/tools", response_model=List[str])
async def get_enabled_tools(
    agent_type: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get list of enabled tool names for current user's template
    """
    from sqlalchemy import select
    
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,
        AgentPromptTemplate.is_active == True
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for agent type '{agent_type}'"
        )
    
    tools_query = select(TemplateTools).where(
        TemplateTools.template_id == template.id,
        TemplateTools.is_enabled == True
    )
    tools_result = await db.execute(tools_query)
    
    return [t.tool_name for t in tools_result.scalars().all()]


@router.put("/templates/{agent_type}/tools")
async def update_tool_selection(
    agent_type: str,
    data: BulkToolSelectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update tool selection for current user's template
    """
    from sqlalchemy import select, delete
    
    query = select(AgentPromptTemplate).where(
        AgentPromptTemplate.agent_type == agent_type,
        AgentPromptTemplate.user_id == current_user.id,
        AgentPromptTemplate.is_active == True
    )
    
    result = await db.execute(query)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No template found for agent type '{agent_type}'"
        )
    
    # Delete existing tool associations
    await db.execute(
        delete(TemplateTools).where(TemplateTools.template_id == template.id)
    )
    
    # Add new tool associations
    for tool_update in data.tools:
        if tool_update.is_enabled:
            template_tool = TemplateTools(
                template_id=template.id,
                tool_name=tool_update.tool_name,
                is_enabled=True
            )
            db.add(template_tool)
    
    await db.commit()
    
    return {"message": "Tool selection updated successfully"}


@router.post("/templates/{agent_type}/validate")
async def validate_prompt_template(
    agent_type: str,
    data: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Validate complete system prompt by assembling it like the agent does
    
    This simulates the agent's prompt assembly process:
    1. User Strategy (from input)
    2. Execution Workflow (from file)
    3. Current Context (test values)
    
    Returns validation result with final character count.
    """
    from datetime import datetime
    import os
    
    try:
        # Get user's prompt
        user_prompt = data.system_prompt
        
        # Basic validation
        if not user_prompt or not user_prompt.strip():
            return {
                "valid": False,
                "message": "提示词不能为空"
            }
        
        if len(user_prompt.strip()) < 50:
            return {
                "valid": False,
                "message": "提示词内容过短，请提供更详细的策略描述"
            }
        
        if len(user_prompt) > 50000:
            return {
                "valid": False,
                "message": "提示词内容过长，请精简至50000字符以内"
            }
        
        # Load workflow documentation (same as agent does)
        workflow_file = os.path.join(
            os.path.dirname(__file__),
            '../../../tradingagents/agents/trader/intraday_trader_workflow.txt'
        )
        
        try:
            with open(workflow_file, 'r', encoding='utf-8') as f:
                workflow_documentation = f.read()
        except Exception as e:
            return {
                "valid": False,
                "message": f"无法加载工作流文档: {str(e)}"
            }
        
        # Generate test context (same as agent does)
        context_info = f"""## Current Context

- Market: US
- Session ID: test_session_123
- Timestamp: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- User ID: {current_user.id}

## Market Rules
- **US Market**: Supports both long and short positions, T+0 trading (can buy and sell same day)
- **HK Market**: Only supports long positions, short selling NOT supported, T+0 trading allowed
- **CN Market (A-shares)**: Only supports long positions, short selling NOT supported, T+1 trading (stocks bought today cannot be sold same day)

Current market is US. Please formulate trading strategy according to market rules.
"""
        
        # Assemble complete system message (same order as agent)
        system_message_parts = [
            "## Trading Strategy\n",
            user_prompt,
            "\n## Execution Workflow\n",
            workflow_documentation,
            "\n## Current Session Context\n",
            context_info,
            "\nNow execute your trading strategy following the workflow above based on current context."
        ]
        
        final_prompt = "\n\n".join(system_message_parts)
        
        # Success - return only validation result and character count
        return {
            "valid": True,
            "message": "验证通过",
            "total_length": len(final_prompt)
        }
        
    except Exception as e:
        return {
            "valid": False,
            "message": f"验证失败: {str(e)}"
        }
