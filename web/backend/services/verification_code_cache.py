"""
Verification Code Cache Service
验证码缓存服务 - 使用内存缓存存储验证码
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
import hashlib
import threading

class VerificationCodeCache:
    """
    In-memory cache for verification codes
    内存缓存验证码服务
    """
    
    def __init__(self):
        self._cache: Dict[str, Dict] = {}
        self._lock = threading.Lock()
    
    def _hash_code(self, code: str) -> str:
        """Hash verification code for security"""
        return hashlib.sha256(code.encode()).hexdigest()
    
    def store_code(
        self, 
        email: str, 
        code: str, 
        expires_in_minutes: int = 5,
        ip_address: Optional[str] = None
    ) -> None:
        """
        Store verification code in cache
        
        Args:
            email: User email
            code: Verification code (will be hashed)
            expires_in_minutes: Expiration time in minutes
            ip_address: Client IP address
        """
        with self._lock:
            now = datetime.now(timezone.utc)
            self._cache[email] = {
                'code_hash': self._hash_code(code),
                'created_at': now,
                'expires_at': now + timedelta(minutes=expires_in_minutes),
                'used': False,
                'ip_address': ip_address
            }
    
    def verify_code(self, email: str, code: str) -> tuple[bool, Optional[str]]:
        """
        Verify code for email
        
        Args:
            email: User email
            code: Verification code to verify
            
        Returns:
            (success, error_message)
        """
        with self._lock:
            if email not in self._cache:
                return False, "验证码不存在或已过期"
            
            cached = self._cache[email]
            
            # Check if already used
            if cached['used']:
                return False, "验证码已使用"
            
            # Check if expired
            now = datetime.now(timezone.utc)
            if now > cached['expires_at']:
                # Clean up expired code
                del self._cache[email]
                return False, "验证码已过期"
            
            # Verify code
            code_hash = self._hash_code(code)
            if code_hash != cached['code_hash']:
                return False, "验证码错误"
            
            # Mark as used
            cached['used'] = True
            return True, None
    
    def cleanup_expired(self) -> int:
        """
        Clean up expired codes
        
        Returns:
            Number of codes cleaned up
        """
        with self._lock:
            now = datetime.now(timezone.utc)
            expired_emails = [
                email for email, data in self._cache.items()
                if now > data['expires_at']
            ]
            
            for email in expired_emails:
                del self._cache[email]
            
            return len(expired_emails)
    
    def get_code_info(self, email: str) -> Optional[Dict]:
        """
        Get code information (for debugging)
        
        Args:
            email: User email
            
        Returns:
            Code info dict or None
        """
        with self._lock:
            if email not in self._cache:
                return None
            
            cached = self._cache[email]
            return {
                'created_at': cached['created_at'].isoformat(),
                'expires_at': cached['expires_at'].isoformat(),
                'used': cached['used'],
                'ip_address': cached['ip_address']
            }


# Global cache instance
_verification_cache = VerificationCodeCache()


def get_verification_cache() -> VerificationCodeCache:
    """Get global verification code cache instance"""
    return _verification_cache
