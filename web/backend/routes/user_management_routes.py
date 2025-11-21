#!/usr/bin/env python3
"""
User Management API Routes (Admin only)
用户管理相关的 API 路由（仅管理员）
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import desc, select, func
from typing import List
from datetime import datetime

from web.backend.database import get_db
from web.backend.models import User
from web.backend.schemas import UserStatusUpdate, UserIntradayAccessUpdate
from web.backend.auth_routes import get_current_active_user

router = APIRouter(prefix="/api/admin", tags=["user-management"])


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """
    Dependency to require admin role
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="需要管理员权限"
        )
    return current_user


@router.get("/users")
async def get_all_users(
    page: int = 1,
    limit: int = 20,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取所有用户列表（仅管理员）
    
    Args:
        page: 页码（从1开始）
        limit: 每页数量
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        用户列表和分页信息
    """
    # 计算偏移量
    offset = (page - 1) * limit
    
    # 查询总数
    count_stmt = select(func.count()).select_from(User)
    total_result = await db.execute(count_stmt)
    total = total_result.scalar()
    
    # 查询用户列表
    stmt = select(User).order_by(desc(User.created_at)).offset(offset).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # 转换为字典列表
    user_list = []
    for user in users:
        user_list.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "can_access_intraday_trading": user.can_access_intraday_trading,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        })
    
    # 计算分页信息
    total_pages = (total + limit - 1) // limit
    
    return {
        "users": user_list,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


@router.get("/users/{user_id}")
async def get_user_detail(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取用户详细信息（仅管理员）
    
    Args:
        user_id: 用户ID
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        用户详细信息
    """
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 获取用户的分析记录统计
    from web.backend.models import AnalysisRecord
    
    total_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id
    )
    total_result = await db.execute(total_stmt)
    total_analyses = total_result.scalar()
    
    completed_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id,
        AnalysisRecord.status == "completed"
    )
    completed_result = await db.execute(completed_stmt)
    completed_analyses = completed_result.scalar()
    
    running_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.user_id == user_id,
        AnalysisRecord.status.in_(["initializing", "running"])
    )
    running_result = await db.execute(running_stmt)
    running_analyses = running_result.scalar()
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "can_access_intraday_trading": user.can_access_intraday_trading,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        "statistics": {
            "total_analyses": total_analyses,
            "completed_analyses": completed_analyses,
            "running_analyses": running_analyses
        }
    }


@router.get("/stats")
async def get_system_stats(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    获取系统统计信息（仅管理员）
    
    Args:
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        系统统计信息
    """
    from web.backend.models import AnalysisRecord
    
    # 用户统计
    total_users_stmt = select(func.count()).select_from(User)
    total_users_result = await db.execute(total_users_stmt)
    total_users = total_users_result.scalar()
    
    active_users_stmt = select(func.count()).select_from(User).filter(User.is_active == True)
    active_users_result = await db.execute(active_users_stmt)
    active_users = active_users_result.scalar()
    
    admin_users_stmt = select(func.count()).select_from(User).filter(User.role == "admin")
    admin_users_result = await db.execute(admin_users_stmt)
    admin_users = admin_users_result.scalar()
    
    # 分析统计
    total_analyses_stmt = select(func.count()).select_from(AnalysisRecord)
    total_analyses_result = await db.execute(total_analyses_stmt)
    total_analyses = total_analyses_result.scalar()
    
    completed_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status == "completed"
    )
    completed_analyses_result = await db.execute(completed_analyses_stmt)
    completed_analyses = completed_analyses_result.scalar()
    
    running_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status.in_(["initializing", "running"])
    )
    running_analyses_result = await db.execute(running_analyses_stmt)
    running_analyses = running_analyses_result.scalar()
    
    error_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.status == "error"
    )
    error_analyses_result = await db.execute(error_analyses_stmt)
    error_analyses = error_analyses_result.scalar()
    
    # 市场统计
    us_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "US",
        AnalysisRecord.status == "completed"
    )
    us_analyses_result = await db.execute(us_analyses_stmt)
    us_analyses = us_analyses_result.scalar()
    
    hk_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "HK",
        AnalysisRecord.status == "completed"
    )
    hk_analyses_result = await db.execute(hk_analyses_stmt)
    hk_analyses = hk_analyses_result.scalar()
    
    cn_analyses_stmt = select(func.count()).select_from(AnalysisRecord).filter(
        AnalysisRecord.market == "CN",
        AnalysisRecord.status == "completed"
    )
    cn_analyses_result = await db.execute(cn_analyses_stmt)
    cn_analyses = cn_analyses_result.scalar()
    
    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "admin": admin_users
        },
        "analyses": {
            "total": total_analyses,
            "completed": completed_analyses,
            "running": running_analyses,
            "error": error_analyses
        },
        "markets": {
            "US": us_analyses,
            "HK": hk_analyses,
            "CN": cn_analyses
        }
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    status_update: UserStatusUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新用户状态（启用/禁用）（仅管理员）
    
    Args:
        user_id: 用户ID
        status_update: 状态更新数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        更新后的用户信息
    """
    
    # 防止管理员禁用自己的账户
    if user_id == current_user.id and not status_update.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="不能禁用当前登录的管理员账户"
        )
    
    # 查询用户
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 更新用户状态
    user.is_active = status_update.is_active
    await db.commit()
    await db.refresh(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "can_access_intraday_trading": user.can_access_intraday_trading,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None
    }


@router.patch("/users/{user_id}/intraday-access")
async def update_user_intraday_access(
    user_id: int,
    access_update: UserIntradayAccessUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """
    更新用户短线交易访问权限（仅管理员）
    
    Args:
        user_id: 用户ID
        access_update: 权限更新数据
        current_user: 当前用户（必须是管理员）
        db: 数据库会话
        
    Returns:
        更新后的用户信息
    """
    
    # 查询用户
    stmt = select(User).filter(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="用户不存在"
        )
    
    # 记录旧状态，用于判断是否需要发送邮件
    old_access = user.can_access_intraday_trading
    
    # 更新用户短线交易权限
    user.can_access_intraday_trading = access_update.can_access_intraday_trading
    await db.commit()
    await db.refresh(user)
    
    # 如果是从禁用变为启用，发送开通成功邮件
    if not old_access and access_update.can_access_intraday_trading:
        await _send_intraday_access_granted_email(user)
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active,
        "can_access_intraday_trading": user.can_access_intraday_trading,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None
    }


async def _send_intraday_access_granted_email(user: User):
    """
    发送智能盯盘功能开通成功邮件
    
    Args:
        user: 用户对象
    """
    try:
        import smtplib
        from email.mime.text import MIMEText
        from email.mime.multipart import MIMEMultipart
        import os
        import logging
        
        logger = logging.getLogger(__name__)
        
        # Get SMTP configuration
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME")
        smtp_password = os.getenv("SMTP_PASSWORD")
        smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
        smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
        app_base_url = os.getenv("APP_BASE_URL", "http://localhost:3000")
        
        # Support email - use configured support email or fallback to SMTP from email
        support_email = os.getenv("SUPPORT_EMAIL") or smtp_from_email
        
        # Validate SMTP configuration
        if not all([smtp_host, smtp_username, smtp_password, smtp_from_email]):
            logger.warning("SMTP not configured, skipping email notification")
            return
        
        # Compose email
        subject = "智能盯盘功能已开通 - TradingAgentsWeb"
        
        # HTML email body
        html_body = f"""
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🎉 智能盯盘功能已开通</h1>
                    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">TradingAgentsWeb</p>
                </div>
                
                <div style="padding: 30px;">
                    <p style="color: #495057; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                        尊敬的 <strong style="color: #212529;">{user.username}</strong>，您好！
                    </p>
                    
                    <p style="color: #495057; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0;">
                        恭喜您！您的智能盯盘功能已成功开通。现在您可以：
                    </p>
                    
                    <ul style="color: #495057; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0; padding-left: 25px;">
                        <li style="margin: 10px 0;">✅ 配置富途虚拟交易API，实现自动化交易分析</li>
                        <li style="margin: 10px 0;">✅ 设置定时分析任务，实时监控市场动态</li>
                        <li style="margin: 10px 0;">✅ 参与实时排名，与其他交易者比拼收益</li>
                        <li style="margin: 10px 0;">✅ 查看详细的持仓和决策历史记录</li>
                    </ul>
                    
                    <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #1565C0; font-size: 14px; line-height: 1.6;">
                            <strong>💡 下一步操作：</strong><br>
                            1. 部署富途虚拟交易API（推荐使用 <a href="https://github.com/BSTester/futu-paper-trade-api" style="color: #2196F3;">futu-paper-trade-api</a>）<br>
                            2. 在智能盯盘页面配置API地址和参数<br>
                            3. 启动定时分析，开始您的智能交易之旅
                        </p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="{app_base_url}/intraday-trading" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                            立即开始使用
                        </a>
                    </div>
                    
                    <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <p style="margin: 0; color: #856404; font-size: 13px; line-height: 1.6;">
                            <strong>⚠️ 风险提示：</strong> 虚拟交易仅供学习和测试使用，不代表真实交易结果。投资有风险，入市需谨慎。
                        </p>
                    </div>
                </div>
                
                <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
                    <p style="margin: 0; color: #6c757d; font-size: 13px;">
                        如有任何问题，请联系我们的支持团队<br>
                        <a href="mailto:{support_email}" style="color: #667eea; text-decoration: none;">{support_email}</a>
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Plain text email body
        text_body = f"""
智能盯盘功能已开通 - TradingAgentsWeb

尊敬的 {user.username}，您好！

恭喜您！您的智能盯盘功能已成功开通。现在您可以：

✅ 配置富途虚拟交易API，实现自动化交易分析
✅ 设置定时分析任务，实时监控市场动态
✅ 参与实时排名，与其他交易者比拼收益
✅ 查看详细的持仓和决策历史记录

下一步操作：
1. 部署富途虚拟交易API（推荐使用 https://github.com/BSTester/futu-paper-trade-api）
2. 在智能盯盘页面配置API地址和参数
3. 启动定时分析，开始您的智能交易之旅

立即开始使用：{app_base_url}/intraday-trading

风险提示：虚拟交易仅供学习和测试使用，不代表真实交易结果。投资有风险，入市需谨慎。

如有任何问题，请联系我们的支持团队：{support_email}
        """
        
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"TradingAgentsWeb <{smtp_from_email}>"
        msg['To'] = user.email
        
        # Attach text and HTML parts
        part1 = MIMEText(text_body, 'plain', 'utf-8')
        part2 = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(part1)
        msg.attach(part2)
        
        # Send email
        try:
            if smtp_use_tls:
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                server.starttls()
            else:
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
            
            server.login(smtp_username, smtp_password)
            server.sendmail(smtp_from_email, user.email, msg.as_string())
            server.quit()
            
            logger.info(f"Intraday access granted email sent to user {user.username} ({user.email})")
            
        except Exception as e:
            logger.error(f"Failed to send intraday access granted email: {e}")
    
    except Exception as e:
        # Don't fail the request if email fails
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error sending intraday access granted email: {e}")
