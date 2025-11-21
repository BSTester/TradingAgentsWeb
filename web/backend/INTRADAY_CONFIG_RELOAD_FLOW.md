# 智能盯盘配置重新加载流程

## 完整执行流程

### 1. 调度器启动
**文件**: `web/backend/services/intraday_scheduler.py`

```python
class IntradayScheduler:
    async def start(self):
        """启动调度器"""
        self.is_running = True
        self._task = asyncio.create_task(self._run_loop())
```

### 2. 调度循环
**文件**: `web/backend/services/intraday_scheduler.py`

```python
async def _run_loop(self):
    """主调度循环 - 按间隔检查所有市场"""
    while not self._stop_event.is_set():
        # 等待指定的时间间隔
        await asyncio.sleep(self.interval_minutes * 60)
        
        # 检查每个市场是否开市
        for market in markets_to_check:
            is_open, status_msg = is_market_open(market, market_local_time)
            if is_open:
                # 触发分析（后台任务）
                task = asyncio.ensure_future(self._trigger_analysis(market))
                self._analysis_tasks[market] = task
```

**关键点**：
- 调度器只负责定时触发，不存储配置
- 每次触发都会创建新的分析任务

### 3. 触发分析
**文件**: `web/backend/services/intraday_scheduler.py`

```python
async def _trigger_analysis(self, market: str):
    """触发特定市场的分析"""
    # 在线程池中运行分析（避免阻塞事件循环）
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,  # 使用默认 ThreadPoolExecutor
        self._run_analysis_sync,
        market
    )
```

### 4. 同步包装器
**文件**: `web/backend/services/intraday_scheduler.py`

```python
def _run_analysis_sync(self, market: str) -> dict:
    """同步包装器，在线程池中运行"""
    # 为这个线程创建新的事件循环
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # 调用执行器
    result = loop.run_until_complete(
        execute_intraday_analysis(
            market_type=market,
            user_id=self.user_id,
        )
    )
    
    return result
```

**关键点**：
- 每次执行都创建新的事件循环
- 每次都调用 `execute_intraday_analysis`，不复用任何状态

### 5. 执行分析（配置加载的关键步骤）
**文件**: `web/backend/services/intraday_executor.py`

```python
async def execute_intraday_analysis(
    market_type: str = "US",
    user_id: Optional[int] = None,
) -> Dict[str, Any]:
    """执行智能盯盘分析"""
    
    # ========================================
    # STEP 1: 从缓存加载配置（每次执行都会调用）
    # ========================================
    from web.backend.services.user_config_cache import get_user_config_from_cache
    
    # 从缓存获取用户配置（如果缓存失效，会自动从数据库重新加载）
    user_config_dict = None
    if user_id:
        user_config_dict = get_user_config_from_cache(user_id)
        if user_config_dict:
            logging.info(f"✅ Loaded user config from cache for user {user_id}")
        else:
            logging.warning(f"⚠️ No cached config for user {user_id}, will use defaults")
    
    # 提取所需的配置
    if user_config_dict:
        llm_provider = user_config_dict.get('intraday_llm_provider') or \
                      user_config_dict.get('last_llm_provider') or \
                      DEFAULT_CONFIG.get("llm_provider", "openai")
        
        api_key = user_config_dict.get('intraday_api_key') or \
                 user_config_dict.get('last_api_key')
        
        model_name = user_config_dict.get('intraday_llm_model') or \
                    user_config_dict.get('last_deep_thinker') or \
                    DEFAULT_CONFIG.get("deep_think_llm", "gpt-4o-mini")
        
        backend_url = user_config_dict.get('intraday_backend_url') or \
                     user_config_dict.get('last_backend_url') or \
                     DEFAULT_CONFIG.get("backend_url")
        
        futu_api_url = user_config_dict.get('intraday_futu_api_url') or \
                      user_config_dict.get('futu_api_base_url')
        
        futu_api_key = user_config_dict.get('futu_api_key')
    else:
        # 使用默认配置
        llm_provider = DEFAULT_CONFIG.get("llm_provider", "openai")
        api_key = None
        model_name = DEFAULT_CONFIG.get("deep_think_llm", "gpt-4o-mini")
        backend_url = DEFAULT_CONFIG.get("backend_url")
        futu_api_url = None
        futu_api_key = None
    
    logging.info(f"📋 Configuration loaded from cache:")
    logging.info(f"   LLM Provider: {llm_provider}")
    logging.info(f"   Model: {model_name}")
    logging.info(f"   Backend URL: {backend_url}")
    logging.info(f"   Futu API URL: {futu_api_url}")
    
    # ... 继续执行分析 ...
```

### 6. 缓存加载机制
**文件**: `web/backend/services/user_config_cache.py`

```python
def get_user_config_from_cache(user_id: int) -> Optional[Dict[str, Any]]:
    """
    从缓存获取用户配置
    
    流程：
    1. 首先检查缓存
    2. 如果缓存命中，直接返回
    3. 如果缓存未命中，从数据库加载
    4. 更新缓存
    5. 返回配置
    """
    cache = get_user_config_cache()
    
    # 尝试从缓存获取
    config = cache.get(user_id)
    if config is not None:
        return config  # 缓存命中
    
    # 缓存未命中 - 查询数据库
    try:
        from web.backend.database import SessionLocal
        from web.backend.models import UserConfig, User
        
        db = SessionLocal()
        try:
            # 检查用户是否活跃
            user = db.query(User).filter(User.id == user_id).first()
            
            if not user or not user.is_active:
                return None
            
            # 获取用户配置
            user_config = db.query(UserConfig).filter(
                UserConfig.user_id == user_id
            ).first()
            
            if user_config:
                # 转换为字典
                config_dict = {
                    'user_id': user_config.user_id,
                    'futu_api_base_url': user_config.futu_api_base_url,
                    'intraday_futu_api_url': user_config.intraday_futu_api_url,
                    'futu_api_key': user_config.futu_api_key,
                    'last_llm_provider': user_config.last_llm_provider,
                    'last_api_key': user_config.last_api_key,
                    # Intraday config
                    'intraday_llm_provider': user_config.intraday_llm_provider,
                    'intraday_api_key': user_config.intraday_api_key,
                    'intraday_llm_model': user_config.intraday_llm_model,
                    'intraday_backend_url': user_config.intraday_backend_url,
                    'intraday_interval_minutes': user_config.intraday_interval_minutes,
                    'intraday_market_type': user_config.intraday_market_type,
                    # Analysis config (fallback)
                    'last_deep_thinker': user_config.last_deep_thinker,
                    'last_backend_url': user_config.last_backend_url,
                }
                
                # 更新缓存（只缓存活跃用户）
                cache.set(user_id, config_dict)
                logger.debug(f"Loaded user config from database for user {user_id}")
                
                return config_dict
            else:
                return None
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error loading user config for user {user_id}: {e}")
        return None
```

## 配置更新后的重新加载流程

### 场景：用户修改配置

```
1. 用户在前端修改配置
   ↓
2. 前端调用 POST /api/intraday/scheduler/config
   ↓
3. 后端更新数据库
   user_config.intraday_llm_model = "new-model"
   await db.commit()
   ↓
4. 后端清除缓存 ⭐ 关键步骤
   invalidate_user_config_cache(user_id)
   ↓
5. 缓存被清除
   cache._cache[user_id] 被删除
   ↓
6. 下次执行时（调度器触发）
   ↓
7. execute_intraday_analysis() 被调用
   ↓
8. get_user_config_from_cache(user_id) 被调用
   ↓
9. 缓存未命中（因为已被清除）
   ↓
10. 从数据库重新加载配置
    ↓
11. 获取到最新的配置
    config_dict['intraday_llm_model'] = "new-model"
    ↓
12. 更新缓存
    cache.set(user_id, config_dict)
    ↓
13. 使用新配置执行分析 ✅
```

## 关键设计点

### 1. 无状态执行
- 每次执行都是独立的
- 不在调度器中存储配置
- 每次都从缓存/数据库加载最新配置

### 2. 缓存策略
- **缓存位置**: 内存（Python 字典）
- **缓存范围**: 进程级别（单个后端实例）
- **过期策略**: 手动失效（TTL=None）
- **线程安全**: 使用 `threading.RLock()`

### 3. 配置优先级
```python
# 智能盯盘配置优先，分析配置作为后备
llm_provider = (
    user_config.intraday_llm_provider or  # 1. 智能盯盘专用配置
    user_config.last_llm_provider or      # 2. 分析页面配置（后备）
    DEFAULT_CONFIG["llm_provider"]        # 3. 系统默认配置
)
```

### 4. 缓存失效时机
所有修改 `UserConfig` 的操作后都必须调用：
```python
from web.backend.services.user_config_cache import invalidate_user_config_cache
invalidate_user_config_cache(user_id)
```

包括：
- 保存配置
- 启动调度器
- 停止调度器
- 验证配置后恢复

## 验证方法

### 查看日志
执行时会输出配置信息：
```
✅ Loaded user config from cache for user 1
📋 Configuration loaded from cache:
   LLM Provider: anthropic
   Model: claude-3-5-sonnet-20241022
   Backend URL: http://localhost:8000
   Futu API URL: http://localhost:11111
```

### 测试步骤
1. 启动调度器
2. 查看第一次执行的日志，记录使用的模型
3. 修改配置（如更改模型）
4. 等待下次自动执行
5. 查看日志，确认使用了新模型

### 缓存状态检查
可以添加调试端点查看缓存状态：
```python
@router.get("/debug/cache-stats")
async def get_cache_stats():
    from web.backend.services.user_config_cache import get_user_config_cache
    cache = get_user_config_cache()
    return cache.get_stats()
```

## 性能优化

### 缓存的好处
1. **减少数据库查询**: 每次执行不需要查询数据库
2. **提高响应速度**: 内存访问比数据库快得多
3. **降低数据库负载**: 特别是高频执行时

### 缓存失效的代价
1. **下次执行会查询数据库**: 一次性开销
2. **立即生效**: 确保配置更新立即可用
3. **自动重建**: 下次访问时自动从数据库加载

## 注意事项

### 1. 多实例部署
如果部署多个后端实例：
- 每个实例有独立的缓存
- 修改配置后，只清除当前实例的缓存
- 其他实例的缓存不会自动清除
- 解决方案：
  - 使用 Redis 等共享缓存
  - 或者接受短暂的配置不一致（下次执行时会更新）

### 2. 缓存一致性
- 只缓存活跃用户（is_active=True）
- 用户被禁用时，缓存会在下次访问时自动清除
- 不会缓存不存在的用户

### 3. 线程安全
- 使用 `threading.RLock()` 保证并发安全
- 可以在多线程环境下安全使用
- 适用于 ThreadPoolExecutor

## 总结

配置重新加载的核心机制：
1. **每次执行都调用** `get_user_config_from_cache()`
2. **缓存未命中时** 自动从数据库加载
3. **修改配置后** 立即清除缓存
4. **下次执行时** 自动获取最新配置

这种设计确保了：
- ✅ 配置更新立即生效（下次执行）
- ✅ 不需要重启服务
- ✅ 高性能（缓存命中时）
- ✅ 数据一致性（缓存失效后重新加载）
