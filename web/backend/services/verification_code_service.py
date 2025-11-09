#!/usr/bin/env python3
"""
Verification Code Service for TradingAgents Web Interface
Handles generation, storage, and verification of email verification codes
Uses in-memory storage instead of database for better performance
"""

import os
import random
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext
import threading

from web.backend.models import User
from web.backend.services.email_service import get_email_service


# Password context for hashing verification codes
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory storage for verification codes
# Structure: {email: (code_hash, expires_at, used)}
_verification_codes: Dict[str, Tuple[str, datetime, bool]] = {}
_codes_lock = threading.Lock()


class VerificationCodeService:
    """
    Service for managing email verification codes
    """
    
    def __init__(self, db: AsyncSession):
        """
        Initialize verification code service
        
        Args:
            db: Async database session
        """
        self.db = db
        self.email_service = get_email_service()
    
    def _generate_code(self) -> str:
        """
        Generate a random 6-digit verification code
        
        Returns:
            str: 6-digit numeric code
        """
        return ''.join([str(random.randint(0, 9)) for _ in range(6)])
    
    def _hash_code(self, code: str) -> str:
        """
        Hash verification code using bcrypt
        
        Args:
            code: Plain text verification code
            
        Returns:
            str: Bcrypt hash of the code
        """
        return pwd_context.hash(code)
    
    def _verify_hash(self, code: str, code_hash: str) -> bool:
        """
        Verify code against stored hash
        
        Args:
            code: Plain text code to verify
            code_hash: Stored bcrypt hash
            
        Returns:
            bool: True if code matches hash, False otherwise
        """
        return pwd_context.verify(code, code_hash)
    
    async def generate_and_send_code(
        self,
        email: str,
        ip_address: str
    ) -> bool:
        """
        Generate verification code, store in memory, and send via email
        
        Args:
            email: User's email address
            ip_address: IP address of the requester
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Check if user with this email exists
            result = await self.db.execute(
                select(User).where(User.email == email)
            )
            user = result.scalar_one_or_none()
            
            if not user:
                print(f"❌ [VerificationCodeService] Email not registered: {email}")
                return False
            
            # Generate new code
            code = self._generate_code()
            code_hash = self._hash_code(code)
            
            # Calculate expiration time (5 minutes from now)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            
            # Store in memory (thread-safe)
            with _codes_lock:
                _verification_codes[email] = (code_hash, expires_at, False)
            
            print(f"📧 [VerificationCodeService] Generated code for {email}, expires at {expires_at}")
            
            # Send email with verification code
            success = await self._send_verification_email(email, code)
            
            if not success:
                print(f"❌ [VerificationCodeService] Failed to send email to {email}")
                # Clean up the code if email fails
                with _codes_lock:
                    _verification_codes.pop(email, None)
                return False
            
            print(f"✅ [VerificationCodeService] Verification code sent successfully to {email}")
            return True
            
        except Exception as e:
            print(f"❌ [VerificationCodeService] Error generating code: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def _send_verification_email(self, email: str, code: str) -> bool:
        """
        Send verification code email
        
        Args:
            email: Recipient email address
            code: 6-digit verification code
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        if not self.email_service.enabled:
            print("⚠️  [VerificationCodeService] Email service disabled, skipping email send")
            return False
        
        try:
            # Compose email content
            subject = "TradingAgents 登录验证码"
            
            # HTML body
            html_body = f"""
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
                <div style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🔐 TradingAgents</h1>
                        <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 14px;">登录验证码</p>
                    </div>
                    <div style="padding: 40px 30px;">
                        <p style="font-size: 16px; color: #495057; margin-bottom: 20px;">您好，</p>
                        <p style="font-size: 14px; color: #495057; margin-bottom: 30px;">您正在使用邮箱验证码登录 TradingAgents。您的验证码是：</p>
                        <div style="background-color: #f8f9fa; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                            <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">{code}</div>
                        </div>
                        <p style="font-size: 14px; color: #6c757d; margin-top: 30px; margin-bottom: 10px;">
                            <strong>⏰ 有效期：</strong>5分钟
                        </p>
                        <p style="font-size: 14px; color: #6c757d; margin-bottom: 30px;">
                            <strong>⚠️ 安全提示：</strong>请勿将此验证码分享给任何人，包括 TradingAgents 工作人员。
                        </p>
                        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 20px; font-size: 13px; color: #856404;">
                            <strong>注意：</strong>如果您没有请求此验证码，请忽略此邮件。您的账户仍然是安全的。
                        </div>
                    </div>
                </div>
            </body>
            </html>
            """
            
            # Plain text body
            text_body = f"""
TradingAgents 登录验证码

您好，

您正在使用邮箱验证码登录 TradingAgents。您的验证码是：

{code}

有效期：5分钟

安全提示：请勿将此验证码分享给任何人，包括 TradingAgents 工作人员。

注意：如果您没有请求此验证码，请忽略此邮件。您的账户仍然是安全的。

© 2024 TradingAgents. All rights reserved.
            """
            
            # Send email in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                self.email_service._send_email_sync,
                email,
                subject,
                html_body,
                text_body
            )
            
            return True
            
        except Exception as e:
            print(f"❌ [VerificationCodeService] Error sending email: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    async def verify_code(
        self,
        email: str,
        code: str
    ) -> bool:
        """
        Verify the code matches the stored hash and is not expired
        Marks code as used if valid
        
        Args:
            email: User's email address
            code: Plain text verification code to verify
            
        Returns:
            bool: True if code is valid, False otherwise
        """
        try:
            # Get code from memory (thread-safe)
            with _codes_lock:
                code_data = _verification_codes.get(email)
            
            if not code_data:
                print(f"❌ [VerificationCodeService] No code found for {email}")
                return False
            
            code_hash, expires_at, used = code_data
            
            # Check if code has been used
            if used:
                print(f"❌ [VerificationCodeService] Code already used for {email}")
                return False
            
            # Check if code has expired
            now = datetime.now(timezone.utc)
            if now > expires_at:
                print(f"❌ [VerificationCodeService] Code expired for {email}")
                # Clean up expired code
                with _codes_lock:
                    _verification_codes.pop(email, None)
                return False
            
            # Verify code hash
            if not self._verify_hash(code, code_hash):
                print(f"❌ [VerificationCodeService] Invalid code for {email}")
                return False
            
            # Mark code as used (thread-safe)
            with _codes_lock:
                _verification_codes[email] = (code_hash, expires_at, True)
            
            print(f"✅ [VerificationCodeService] Code verified successfully for {email}")
            return True
            
        except Exception as e:
            print(f"❌ [VerificationCodeService] Error verifying code: {e}")
            import traceback
            traceback.print_exc()
            return False
    
def get_verification_code_service(db: AsyncSession) -> VerificationCodeService:
    """
    Get verification code service instance
    
    Args:
        db: Async database session
        
    Returns:
        VerificationCodeService: Service instance
    """
    return VerificationCodeService(db)
