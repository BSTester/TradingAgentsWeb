# 智能盯盘配置缓存修复

## 修复日期
2024年11月19日

## 问题描述
在智能盯盘页面修改配置后，后端没有清除内存缓存，导致在不重启服务的情况下，下次执行时仍然使用旧的缓存配置。

## 根本原因
系统使用了 `user_config_cache` 来缓存用户配置，以减少数据库查询。但在以下场景修改配置后，没有调用 `invalidate_user_config_cache()` 来清除缓存：

1. 保存智能盯盘配置 (`/api/intraday/scheduler/config`)
2. 启动调度器时设置默认市场类型
3. 启动/停止调度器时更新启用标志
4. 验证配置后恢复原值

## 缓存机制说明

### 缓存位置
`web/backend/services/user_config_cache.py`

### 缓存特性
- **线程安全**: 使用 `threading.RLock()` 保证并发安全
- **无过期时间**: TTL 设置为 None，只能手动失效
- **懒加载**: 只在需要时从数据库加载
- **自动更新**: 缓存未命中时自动从数据库加载并更新缓存

### 缓存使用场景
智能盯盘执行器 (`intraday_executor.py`) 在每次执行前会从缓存加载用户配置：
```python
user_config_dict = get_user_config_from_cache(user_id)
```

## 修复内容

### 1. 保存配置时清除缓存
**文件**: `web/backend/routes/intraday_trading_routes.py`
**位置**: `configure_scheduler()` 函数

```python
await db.commit()

# Invalidate user config cache to force reload on next execution
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

### 2. 启动调度器时清除缓存
**场景1**: 设置默认市场类型时
```python
user_config.intraday_market_type = "US,HK,CN"
await db.commit()
# Invalidate cache after setting default market type
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

**场景2**: 更新调度器启用状态时
```python
user_config.intraday_scheduler_enabled = True
user_config.intraday_scheduler_auto_start = True
await db.commit()

# Invalidate cache after updating scheduler status
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

### 3. 停止调度器时清除缓存
```python
user_config.intraday_scheduler_enabled = False
user_config.intraday_scheduler_auto_start = False
await db.commit()

# Invalidate cache after updating scheduler status
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

### 4. 验证配置后清除缓存
**场景**: 验证配置时临时修改配置，验证后恢复原值
```python
# Restore original values
user_config.intraday_futu_api_url = original_url
user_config.intraday_futu_api_key = original_key
await db.commit()

# Invalidate cache after restoring values
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

## 其他路由的缓存处理

### 分析路由 (analysis_routes.py)
✅ **已正确实现** - 在保存配置后调用了缓存失效：
```python
await db.commit()

# Invalidate cache after updating user config
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(current_user.id)
```

## 缓存失效流程

1. **修改配置**: 更新数据库中的 `user_configs` 表
2. **提交事务**: `await db.commit()`
3. **清除缓存**: `invalidate_user_config_cache(user_id)`
4. **下次执行**: 
   - 缓存未命中
   - 从数据库重新加载最新配置
   - 更新缓存

## 测试建议

### 测试场景1: 修改配置后立即执行
1. 在智能盯盘页面修改配置（如修改LLM模型）
2. 保存配置
3. 立即触发一次分析
4. 检查日志，确认使用了新配置

### 测试场景2: 启动调度器
1. 启动调度器
2. 等待自动执行
3. 检查日志，确认使用了正确的配置

### 测试场景3: 修改配置后自动执行
1. 启动调度器
2. 在调度器运行期间修改配置
3. 等待下次自动执行
4. 检查日志，确认使用了新配置

### 验证方法
查看执行日志中的配置信息：
```
📋 Configuration loaded from cache:
   LLM Provider: anthropic
   Model: claude-3-5-sonnet-20241022
   ...
```

## 影响范围
- 智能盯盘配置修改立即生效
- 不需要重启服务即可使用新配置
- 提升用户体验

## 注意事项
1. 缓存失效是线程安全的，可以在并发环境下使用
2. 缓存失效后，下次访问会自动从数据库重新加载
3. 只有活跃用户（is_active=True）的配置才会被缓存
4. 缓存失效不会影响正在运行的分析任务，只影响新启动的任务
