#!/usr/bin/env python3
"""
User Configuration Cache Service

Caches user configurations in memory to reduce database queries.
Automatically refreshes cache when configurations are updated.
"""

import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import threading

logger = logging.getLogger(__name__)


class UserConfigCache:
    """
    Thread-safe cache for user configurations
    
    Features:
    - In-memory caching with TTL (Time To Live)
    - Thread-safe operations
    - Automatic cache invalidation
    - Lazy loading (only loads when needed)
    """
    
    def __init__(self, ttl_seconds: Optional[int] = None):
        """
        Initialize cache
        
        Args:
            ttl_seconds: Time to live for cache entries (None = never expire, only invalidate manually)
        """
        self._cache: Dict[int, Dict[str, Any]] = {}
        self._cache_timestamps: Dict[int, datetime] = {}
        self._lock = threading.RLock()
        self._ttl = timedelta(seconds=ttl_seconds) if ttl_seconds else None
        if self._ttl:
            logger.info(f"UserConfigCache initialized with TTL={ttl_seconds}s")
        else:
            logger.info("UserConfigCache initialized with no expiration (manual invalidation only)")
    
    def get(self, user_id: int) -> Optional[Dict[str, Any]]:
        """
        Get user configuration from cache
        
        Args:
            user_id: User ID
            
        Returns:
            User configuration dict or None if not in cache or expired
        """
        with self._lock:
            # Check if in cache
            if user_id not in self._cache:
                return None
            
            # Check if expired (only if TTL is set)
            if self._ttl:
                cache_time = self._cache_timestamps.get(user_id)
                if cache_time and datetime.now() - cache_time > self._ttl:
                    logger.debug(f"Cache expired for user {user_id}")
                    del self._cache[user_id]
                    del self._cache_timestamps[user_id]
                    return None
            
            logger.debug(f"Cache hit for user {user_id}")
            return self._cache[user_id].copy()
    
    def set(self, user_id: int, config: Dict[str, Any]) -> None:
        """
        Set user configuration in cache
        
        Args:
            user_id: User ID
            config: Configuration dict
        """
        with self._lock:
            self._cache[user_id] = config.copy()
            self._cache_timestamps[user_id] = datetime.now()
            logger.debug(f"Cache set for user {user_id}")
    
    def invalidate(self, user_id: int) -> None:
        """
        Invalidate cache for a specific user
        
        Args:
            user_id: User ID
        """
        with self._lock:
            if user_id in self._cache:
                del self._cache[user_id]
                del self._cache_timestamps[user_id]
                logger.debug(f"Cache invalidated for user {user_id}")
    
    def clear(self) -> None:
        """Clear all cache entries"""
        with self._lock:
            self._cache.clear()
            self._cache_timestamps.clear()
            logger.info("Cache cleared")
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dict with cache stats
        """
        with self._lock:
            return {
                "total_entries": len(self._cache),
                "ttl_seconds": self._ttl.total_seconds(),
                "users_cached": list(self._cache.keys())
            }


# Global cache instance
_user_config_cache: Optional[UserConfigCache] = None


def get_user_config_cache() -> UserConfigCache:
    """
    Get or create global user config cache instance
    
    Returns:
        UserConfigCache instance
    """
    global _user_config_cache
    if _user_config_cache is None:
        _user_config_cache = UserConfigCache(ttl_seconds=None)  # No expiration, manual invalidation only
    return _user_config_cache


def get_user_config_from_cache(user_id: int) -> Optional[Dict[str, Any]]:
    """
    Get user configuration with caching
    
    This function first checks the cache, and if not found or expired,
    queries the database and updates the cache.
    
    Args:
        user_id: User ID
        
    Returns:
        User configuration dict or None if user not found
    """
    cache = get_user_config_cache()
    
    # Try cache first
    config = cache.get(user_id)
    if config is not None:
        return config
    
    # Cache miss - query database
    try:
        from web.backend.database import SessionLocal
        from web.backend.models import UserConfig, User
        
        db = SessionLocal()
        try:
            # Check if user is active first
            user = db.query(User).filter(User.id == user_id).first()
            
            if not user:
                logger.debug(f"User {user_id} not found")
                return None
            
            if not user.is_active:
                logger.debug(f"User {user_id} is disabled, skipping cache")
                return None
            
            # Get user config
            user_config = db.query(UserConfig).filter(UserConfig.user_id == user_id).first()
            
            if user_config:
                # Convert to dict
                config_dict = {
                    'user_id': user_config.user_id,
                    'last_llm_provider': user_config.last_llm_provider,
                    # Analysis config (fallback)
                    'last_deep_thinker': user_config.last_deep_thinker,
                    'last_backend_url': user_config.last_backend_url,
                }
                
                # Update cache (only for active users)
                cache.set(user_id, config_dict)
                logger.debug(f"Loaded user config from database for user {user_id}")
                
                return config_dict
            else:
                logger.debug(f"No config found for user {user_id}")
                return None
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error loading user config for user {user_id}: {e}")
        return None


def invalidate_user_config_cache(user_id: int) -> None:
    """
    Invalidate cache for a specific user
    
    Call this when user configuration is updated.
    
    Args:
        user_id: User ID
    """
    cache = get_user_config_cache()
    cache.invalidate(user_id)
    logger.info(f"Invalidated cache for user {user_id}")


def preload_user_configs() -> int:
    """
    Preload all active user configurations into cache
    
    This can be called at application startup to warm up the cache.
    Only loads configs for active users (is_active=True).
    
    Returns:
        Number of configs loaded
    """
    try:
        from web.backend.database import SessionLocal
        from web.backend.models import UserConfig, User
        
        cache = get_user_config_cache()
        db = SessionLocal()
        
        try:
            # Get all user configs for active users only
            user_configs = db.query(UserConfig).join(
                User, UserConfig.user_id == User.id
            ).filter(
                User.is_active == True
            ).all()
            
            count = 0
            for user_config in user_configs:
                config_dict = {
                    'user_id': user_config.user_id,
                    'last_llm_provider': user_config.last_llm_provider,
                    # Analysis config (fallback)
                    'last_deep_thinker': user_config.last_deep_thinker,
                    'last_backend_url': user_config.last_backend_url,
                }
                cache.set(user_config.user_id, config_dict)
                count += 1
            
            logger.info(f"Preloaded {count} user configurations into cache (active users only)")
            return count
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error preloading user configs: {e}")
        return 0
