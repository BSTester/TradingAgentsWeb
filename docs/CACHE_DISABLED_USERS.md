# 禁用用户的缓存策略

## 概述

为了优化内存使用和安全性，禁用用户（`is_active=False`）的数据不会被缓存。

## 实现逻辑

### 1. 用户配置缓存

#### 预加载时跳过禁用用户

**文件**: `web/backend/services/user_config_cache.py`

```python
def preload_user_configs() -> int:
    """Preload all active user configurations into cache"""
    
    # 只加载活跃用户的配置 ✅
    user_configs = db.query(UserConfig).join(
        User, UserConfig.user_id == User.id
    ).filter(
        User.is_active == True  # 只加载活跃用户
    ).all()
    
    for user_config in user_configs:
        cache.set(user_config.user_id, config_dict)
    
    logger.info(f"Preloaded {count} user configurations (active users only)")
```

#### 运行时检查用户状态

```python
def get_user_config_from_cache(user_id: int):
    """Get user configuration with caching"""
    
    # 1. 尝试从缓存获取
    config = cache.get(user_id)
    if config is not None:
        return config
    
    # 2. 缓存未命中 - 查询数据库
    user = db.query(User).filter(User.id == user_id).first()
    
    # 3. 检查用户状态 ✅
    if not user or not user.is_active:
        logger.debug(f"User {user_id} is disabled, skipping cache")
        return None  # 不缓存禁用用户
    
    # 4. 加载配置并缓存（仅活跃用户）
    user_config = db.query(UserConfig).filter(...).first()
    cache.set(user_id, config_dict)  # 只缓存活跃用户
    
    return config_dict
```

### 2. 提示词缓存

**文件**: `web/backend/services/prompt_loader.py`

```python
def load_user_prompt_template(user_id: int, agent_type: str):
    """Load user's prompt template with caching"""
    
    # 1. 尝试从缓存获取
    cached_prompt = _prompt_cache.get(cache_key)
    if cached_prompt is not None:
        return cached_prompt
    
    # 2. 缓存未命中 - 查询数据库
    user = db.query(User).filter(User.id == user_id).first()
    
    # 3. 检查用户状态 ✅
    if not user or not user.is_active:
        logger.debug(f"User {user_id} is disabled, skipping cache")
        return get_default_intraday_prompt()  # 使用默认提示词，不缓存
    
    # 4. 加载提示词并缓存（仅活跃用户）
    template = db.query(AgentPromptTemplate).filter(...).first()
    _prompt_cache.set(cache_key, prompt)  # 只缓存活跃用户
    
    return prompt
```

## 行为对比

### 活跃用户（is_active=True）

```python
# 用户 1 是活跃用户
user1 = User(id=1, is_active=True)

# 第一次加载 - 从数据库
config = get_user_config_from_cache(1)
# 日志: Loaded user config from database for user 1
# 缓存: {1: {...}}

# 第二次加载 - 从缓存
config = get_user_config_from_cache(1)
# 日志: Cache hit for user 1
# 缓存: {1: {...}}
```

### 禁用用户（is_active=False）

```python
# 用户 2 是禁用用户
user2 = User(id=2, is_active=False)

# 第一次加载 - 从数据库，但不缓存
config = get_user_config_from_cache(2)
# 日志: User 2 is disabled, skipping cache
# 返回: None
# 缓存: {} (不缓存)

# 第二次加载 - 仍然从数据库查询
config = get_user_config_from_cache(2)
# 日志: User 2 is disabled, skipping cache
# 返回: None
# 缓存: {} (不缓存)
```

## 使用场景

### 场景 1：用户被禁用

```python
# 管理员禁用用户
user = db.query(User).filter(User.id == 1).first()
user.is_active = False
db.commit()

# 失效缓存
invalidate_user_config_cache(1)

# 后续访问不会缓存
config = get_user_config_from_cache(1)
# 返回: None (不缓存)
```

### 场景 2：用户被重新启用

```python
# 管理员重新启用用户
user = db.query(User).filter(User.id == 1).first()
user.is_active = True
db.commit()

# 失效缓存（如果有）
invalidate_user_config_cache(1)

# 后续访问会重新缓存
config = get_user_config_from_cache(1)
# 日志: Loaded user config from database for user 1
# 缓存: {1: {...}} (重新缓存)
```

### 场景 3：应用启动预加载

```python
# 应用启动时
preload_user_configs()

# 只加载活跃用户
# 用户 1 (active=True) → 缓存 ✅
# 用户 2 (active=False) → 跳过 ❌
# 用户 3 (active=True) → 缓存 ✅

# 日志: Preloaded 2 user configurations (active users only)
```

## 优势

### 1. 内存优化

```python
# 假设有 1000 个用户
# - 900 个活跃用户
# - 100 个禁用用户

# 优化前：缓存所有用户
memory_usage = 1000 * 1KB = 1000KB

# 优化后：只缓存活跃用户
memory_usage = 900 * 1KB = 900KB

# 节省：100KB (10%)
```

### 2. 安全性

```python
# 禁用用户的数据不会长期驻留在内存中
# - 减少数据泄露风险
# - 禁用立即生效
# - 不需要等待缓存过期
```

### 3. 一致性

```python
# 禁用用户每次都查询数据库
# - 确保获取最新状态
# - 避免缓存过期问题
# - 简化缓存管理
```

## 日志示例

### 活跃用户

```
INFO - Preloaded 10 user configurations (active users only)
DEBUG - Cache hit for user 1
DEBUG - Cache hit for user 2
```

### 禁用用户

```
INFO - Preloaded 10 user configurations (active users only)
DEBUG - User 3 is disabled, skipping cache
DEBUG - User 3 is disabled, skipping cache
```

### 用户状态变更

```
# 禁用用户
INFO - User 1 disabled by admin
INFO - Invalidated cache for user 1
DEBUG - User 1 is disabled, skipping cache

# 重新启用用户
INFO - User 1 enabled by admin
INFO - Invalidated cache for user 1
INFO - Loaded user config from database for user 1
DEBUG - Cache hit for user 1
```

## 监控建议

### 1. 统计活跃/禁用用户

```python
from web.backend.database import SessionLocal
from web.backend.models import User

db = SessionLocal()

active_count = db.query(User).filter(User.is_active == True).count()
disabled_count = db.query(User).filter(User.is_active == False).count()

print(f"Active users: {active_count}")
print(f"Disabled users: {disabled_count}")
print(f"Cache efficiency: {active_count / (active_count + disabled_count) * 100:.1f}%")
```

### 2. 查看缓存状态

```python
from web.backend.services.user_config_cache import get_user_config_cache

cache = get_user_config_cache()
stats = cache.get_stats()

print(f"Cached users: {stats['total_entries']}")
print(f"Expected: {active_count}")
print(f"Match: {stats['total_entries'] == active_count}")
```

### 3. 审计禁用用户访问

```bash
# 查看禁用用户的访问日志
grep "is disabled, skipping cache" logs/app.log

# 统计禁用用户访问次数
grep "is disabled, skipping cache" logs/app.log | wc -l
```

## 最佳实践

### 1. 禁用用户时失效缓存

```python
@router.put("/admin/users/{user_id}/disable")
async def disable_user(user_id: int):
    # 禁用用户
    user.is_active = False
    await db.commit()
    
    # 立即失效缓存 ✅
    invalidate_user_config_cache(user_id)
    invalidate_prompt_cache(user_id, "intraday_trader")
    
    return {"message": "User disabled"}
```

### 2. 启用用户时失效缓存

```python
@router.put("/admin/users/{user_id}/enable")
async def enable_user(user_id: int):
    # 启用用户
    user.is_active = True
    await db.commit()
    
    # 失效缓存，下次访问会重新缓存 ✅
    invalidate_user_config_cache(user_id)
    invalidate_prompt_cache(user_id, "intraday_trader")
    
    return {"message": "User enabled"}
```

### 3. 定期清理缓存

```python
# 定期检查缓存中是否有禁用用户的数据
def cleanup_disabled_users_cache():
    from web.backend.database import SessionLocal
    from web.backend.models import User
    from web.backend.services.user_config_cache import get_user_config_cache
    
    cache = get_user_config_cache()
    stats = cache.get_stats()
    
    db = SessionLocal()
    for user_id in stats['users_cached']:
        user = db.query(User).filter(User.id == user_id).first()
        if user and not user.is_active:
            # 发现禁用用户的缓存，清理
            invalidate_user_config_cache(user_id)
            logger.warning(f"Cleaned up cache for disabled user {user_id}")
    
    db.close()
```

## 相关文档

- [用户配置缓存详细文档](./USER_CONFIG_CACHE.md)
- [提示词缓存实现](./PROMPT_CACHE_IMPLEMENTATION.md)
- [系统优化总结](./OPTIMIZATION_SUMMARY.md)

## 总结

禁用用户的缓存策略：

1. ✅ **预加载跳过**：应用启动时只加载活跃用户
2. ✅ **运行时检查**：每次加载前检查用户状态
3. ✅ **不缓存禁用用户**：禁用用户的数据不进入缓存
4. ✅ **内存优化**：减少不必要的内存占用
5. ✅ **安全性提升**：禁用用户数据不驻留内存
6. ✅ **状态一致性**：禁用用户每次查询数据库

这个策略确保了缓存的高效性和安全性，同时简化了缓存管理。
