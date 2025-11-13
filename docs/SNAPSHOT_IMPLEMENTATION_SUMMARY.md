# 资产快照功能实现总结

## 实现内容

### ✅ 后端实现

#### 1. 快照调度器服务 (`snapshot_scheduler.py`)
- 自动定时任务：每日在市场收盘后创建快照
- 支持三个市场：US (05:00), HK (16:30), CN (15:30) 北京时间
- 防止重复创建：每天每市场每用户只创建一次
- 错误处理：单个用户失败不影响其他用户
- 日志记录：详细的执行日志和统计信息

#### 2. Futu API 客户端 (`futu_api_client.py`)
- 异步 HTTP 客户端
- 获取账户信息：`get_account_info(market_type)`
- 获取持仓信息：`get_positions(market_type)`
- 获取订单信息：`get_orders(market_type, filter_status)`
- 错误处理和超时控制

#### 3. 应用启动集成 (`app.py`)
- 在应用启动时初始化快照调度器
- 在应用关闭时优雅停止调度器
- 只在 leader 进程中运行（避免多进程重复执行）

#### 4. API 路由（已存在）
- `GET /api/account-snapshots/trend` - 获取趋势数据
- `GET /api/account-snapshots/latest/{market_type}` - 获取最新快照
- `GET /api/account-snapshots/summary/{market_type}` - 获取汇总数据

注：手动创建快照的接口已移除。

### ✅ 前端实现

#### 1. PositionOverview 组件优化
- 调整盈亏显示顺序：金额在上，百分比在下
- 更直观的数据展示

#### 2. AccountInfo 组件
- 移除手动快照按钮
- 保留趋势图查看功能
- 快照仅在收盘时自动创建

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                     应用启动 (app.py)                        │
│  - 初始化快照调度器                                          │
│  - 注册定时任务（US/HK/CN）                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              快照调度器 (snapshot_scheduler.py)              │
│  - APScheduler 定时任务                                      │
│  - 市场收盘时间触发                                          │
│  - 遍历所有用户创建快照                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Futu API 客户端 (futu_api_client.py)           │
│  - 获取账户信息                                              │
│  - 获取持仓信息                                              │
│  - 计算盈亏数据                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  数据库 (AccountSnapshot)                    │
│  - 保存快照数据                                              │
│  - 索引优化（user_id, market_type, snapshot_date）          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              API 路由 (account_snapshot_routes.py)           │
│  - 手动创建快照                                              │
│  - 查询快照数据                                              │
│  - 趋势分析                                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              前端组件 (AccountInfo.tsx)                      │
│  - 快照按钮                                                  │
│  - 趋势图展示                                                │
│  - 用户交互                                                  │
└─────────────────────────────────────────────────────────────┘
```

## 定时任务时间表

| 市场 | 本地收盘时间 | 时区 | 快照时间（北京） |
|------|-------------|------|------------------|
| 美股 (US) | 16:00 | America/New_York | 夏令时 04:00<br>冬令时 05:00 |
| 港股 (HK) | 16:00 | Asia/Hong_Kong | 16:00 |
| A股 (CN) | 15:00 | Asia/Shanghai | 15:00 |

**时区处理**：
- 使用市场本地时区（如 America/New_York）
- APScheduler 自动处理夏令时 (DST) 切换
- 美股夏令时：3月第二个周日 - 11月第一个周日
- 无需手动调整时间

## 数据流程

### 自动快照流程

```
1. 定时任务触发（市场收盘时间）
   ↓
2. 查询所有配置了 Futu API 的用户
   ↓
3. 对每个用户：
   a. 检查是否已有今日快照（避免重复）
   b. 调用 Futu API 获取账户和持仓数据
   c. 计算总资产、现金、市值、盈亏
   d. 创建 AccountSnapshot 记录
   e. 保存到数据库
   ↓
4. 记录执行结果（成功数、失败数）
```

### 持仓盈亏显示优化

```
盈亏列显示顺序：
1. 金额（上方，较大字体）
   例：+$500.00
2. 百分比（下方，较小字体）
   例：+3.33%
```

## 关键特性

### 1. 防重复机制
- 每天每市场每用户只创建一次快照
- 使用日期范围查询检查是否已存在

### 2. 错误隔离
- 单个用户失败不影响其他用户
- 详细的错误日志便于排查

### 3. 性能优化
- 异步 API 调用
- 批量处理用户
- 数据库索引优化

### 4. 可扩展性
- 支持添加新市场
- 支持自定义快照时间
- 支持扩展快照内容

## 配置要求

### 用户配置
```python
# 用户需要配置以下任一项：
user_config.futu_api_base_url = "http://localhost:11111"
# 或
user_config.intraday_futu_api_url = "http://localhost:11111"

# 用户需要有权限：
user.role == 'admin' 
# 或
user.can_access_intraday_trading == True
```

### 系统配置
```python
# 无需额外环境变量
# 使用现有的 DATABASE_URL
```

## 监控和日志

### 启动日志
```
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot: next run at 2025-11-14 05:00:00+08:00
  - Daily HK Market Snapshot: next run at 2025-11-14 16:30:00+08:00
  - Daily CN Market Snapshot: next run at 2025-11-14 15:30:00+08:00
```

### 执行日志
```
INFO: Creating US market snapshots...
INFO: Created snapshot for user 1 (john_doe) in US market: $50000.00
WARNING: No account info for user 2 in US market
INFO: Snapshot already exists for user 3 (jane_smith) in US market today
INFO: ✅ US market snapshot job completed: 1 created, 0 errors
```

### 关闭日志
```
🔌 Shutting down...
✅ Snapshot scheduler stopped
```

## 测试建议

### 1. 单元测试
```python
# 测试快照创建
async def test_create_snapshot():
    from web.backend.services.futu_async_wrapper import get_account_info_async
    
    # 使用用户配置获取账户信息
    account = await get_account_info_async("US", user_id=1)
    assert account is not None
```

### 2. 集成测试
```python
# 测试定时任务
async def test_scheduled_snapshot():
    scheduler = get_snapshot_scheduler()
    await scheduler._create_snapshots_for_market("US")
    # 验证数据库中有新快照
```

### 3. 手动测试
1. 启动后端服务
2. 访问智能盯盘页面
3. 点击"快照"按钮
4. 验证快照创建成功
5. 查看趋势图显示新数据

## 已知限制

1. **时区处理**：美股时间会因夏令时变化，可能需要手动调整
2. **API 依赖**：依赖 Futu API 的可用性和响应速度
3. **存储空间**：长期运行会积累大量快照数据，需要定期清理
4. **并发限制**：大量用户时可能需要限流

## 未来改进

1. **智能时区**：自动处理夏令时变化
2. **数据压缩**：对历史快照进行压缩存储
3. **增量快照**：只记录变化的数据
4. **实时快照**：支持更高频率的快照（如每小时）
5. **快照对比**：提供快照之间的差异分析
6. **批量导出**：支持批量导出快照数据
7. **告警功能**：资产异常变化时发送告警

## 文件清单

### 新增文件
- ✅ `web/backend/services/snapshot_scheduler.py` - 快照调度器
- ✅ `web/backend/services/futu_api_client.py` - Futu API 客户端
- ✅ `docs/ASSET_SNAPSHOT_FEATURE.md` - 功能文档
- ✅ `docs/SNAPSHOT_IMPLEMENTATION_SUMMARY.md` - 实现总结

### 修改文件
- ✅ `web/backend/app.py` - 添加快照调度器初始化
- ✅ `web/frontend/src/components/intraday/AccountInfo.tsx` - 添加快照按钮

### 已存在文件（无需修改）
- `web/backend/models.py` - AccountSnapshot 模型
- `web/backend/routes/account_snapshot_routes.py` - API 路由
- `web/frontend/src/components/intraday/AccountTrendModal.tsx` - 趋势图

## 部署检查清单

- [ ] 确认数据库已创建 `account_snapshots` 表
- [ ] 确认用户已配置 Futu API URL
- [ ] 确认用户有日内交易权限
- [ ] 验证定时任务已注册（查看启动日志）
- [ ] 测试手动快照功能
- [ ] 验证快照数据正确保存
- [ ] 检查趋势图显示正常
- [ ] 监控定时任务执行情况

## 总结

资产快照功能已完整实现，包括：
1. ✅ 自动定时快照（三个市场，收盘时自动创建）
2. ✅ Futu API 集成
3. ✅ 错误处理和日志
4. ✅ 持仓盈亏显示优化（金额在上，百分比在下）
5. ✅ 完整文档

系统会在每个市场收盘后自动为所有用户创建资产快照。快照数据用于趋势分析、收益计算和风险监控。

**注意**：手动快照功能已移除，快照仅在收盘时自动创建，确保数据的一致性和准确性。
