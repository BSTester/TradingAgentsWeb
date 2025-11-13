# 资产快照功能

## 功能概述

资产快照功能自动记录用户每日的账户资产状态，用于追踪资产变化趋势和生成历史报表。

## 功能特性

### 1. 自动定时快照

系统会在每个市场收盘后自动为所有用户创建资产快照：

- **美股市场 (US)**: 美东时间 16:00（自动处理夏令时/冬令时）
  - 夏令时 (EDT): 北京时间 04:00
  - 冬令时 (EST): 北京时间 05:00
- **港股市场 (HK)**: 香港时间 16:00（北京时间 16:00）
- **A股市场 (CN)**: 北京时间 15:00

**时区处理**：系统使用市场本地时区，APScheduler 自动处理夏令时切换，无需手动调整。

### 2. 快照内容

每个快照包含以下信息：

- 总资产 (total_assets)
- 可用资金 (cash)
- 持仓市值 (market_value)
- 已实现盈亏 (realized_pnl)
- 未实现盈亏 (unrealized_pnl)
- 快照时间 (snapshot_date)
- 市场类型 (market_type)

### 3. 唯一性约束

**重要**：每个用户每个市场每天只能有一条快照记录。

- 约束维度：`(user_id, market_type, DATE(snapshot_date))`
- 实现方式：应用层检查 + 数据库唯一索引
- 使用市场本地日期，确保准确性

详见：`docs/SNAPSHOT_UNIQUE_CONSTRAINT.md`

## 技术实现

### 后端组件

#### 1. 快照调度器 (`snapshot_scheduler.py`)

```python
from web.backend.services.snapshot_scheduler import get_snapshot_scheduler

# 获取调度器实例
scheduler = get_snapshot_scheduler()

# 查看下次运行时间
next_run = scheduler.get_next_run_time('US')
```

**特性**：
- 使用 APScheduler 实现定时任务
- 支持多市场独立调度
- 自动处理时区（北京时间 UTC+8）
- 防止重复创建（每天每市场只创建一次）

#### 2. Futu API 客户端 (`futu_api_client.py`)

```python
from web.backend.services.futu_async_wrapper import get_account_info_async

# 获取账户信息（使用用户配置）
account_info = await get_account_info_async("US", user_id=user.id)

# 或者不指定用户（使用环境变量配置）
account_info = await client.get_account_info("US")

# 获取持仓信息
positions = await client.get_positions("US")
```

#### 3. API 路由 (`account_snapshot_routes.py`)

- `GET /api/account-snapshots/trend` - 获取趋势数据
- `GET /api/account-snapshots/latest/{market_type}` - 获取最新快照
- `GET /api/account-snapshots/summary/{market_type}` - 获取汇总数据

注：手动创建快照的接口已移除，快照仅通过定时任务自动创建。

### 前端组件

#### AccountInfo 组件

在智能盯盘页面的账户信息卡片中：

1. **趋势图按钮**：点击查看资产趋势图（使用快照数据）

注：手动快照按钮已移除，快照仅在收盘时自动创建。

## 应用启动流程

1. **初始化数据库**：创建 `account_snapshots` 表
2. **启动快照调度器**：注册三个市场的定时任务
3. **打印调度信息**：显示下次运行时间

```
✅ Snapshot scheduler started (daily account snapshots)
📸 Scheduled snapshot jobs (3):
  - Daily US Market Snapshot: next run at 2025-11-14 05:00:00+08:00
  - Daily HK Market Snapshot: next run at 2025-11-14 16:30:00+08:00
  - Daily CN Market Snapshot: next run at 2025-11-14 15:30:00+08:00
```

## 数据库模型

```python
class AccountSnapshot(Base):
    __tablename__ = "account_snapshots"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    market_type = Column(String(10), nullable=False)  # US, HK, CN
    snapshot_date = Column(DateTime(timezone=True), nullable=False)
    
    # 账户余额信息
    total_assets = Column(Float, nullable=False)
    cash = Column(Float, nullable=False)
    market_value = Column(Float, nullable=False)
    realized_pnl = Column(Float, default=0.0)
    unrealized_pnl = Column(Float, default=0.0)
    
    # 唯一约束（通过数据库索引实现）
    # Index: uq_user_market_date (user_id, market_type, DATE(snapshot_date))
    # 确保每个用户每个市场每天只有一条记录
```

## 使用场景

### 1. 资产趋势分析

用户可以查看不同时间段的资产变化：
- 7天趋势
- 30天趋势
- 自定义时间段

### 2. 收益计算

通过对比不同时间点的快照，计算：
- 日收益率
- 周收益率
- 月收益率
- 年化收益率

### 3. 风险监控

- 最大回撤分析
- 仓位变化追踪
- 现金流分析

## 配置要求

### 用户配置

用户需要配置 Futu API 才能创建快照：

1. 在用户配置中设置 `futu_api_base_url`
2. 或在日内交易配置中设置 `intraday_futu_api_url`
3. 确保用户有 `can_access_intraday_trading` 权限或为管理员

### 环境变量

无需额外环境变量，使用现有的数据库配置。

## 故障处理

### 快照创建失败

如果快照创建失败，系统会：
1. 记录错误日志
2. 继续处理其他用户
3. 不影响定时任务的后续执行

### API 连接失败

如果 Futu API 连接失败：
1. 跳过该用户的快照创建
2. 记录警告日志
3. 等待下次定时任务重试

## 监控和日志

### 日志示例

```
INFO: Creating US market snapshots...
INFO: Created snapshot for user 1 (john_doe) in US market: $50000.00
INFO: Snapshot already exists for user 2 (jane_smith) in US market today
INFO: ✅ US market snapshot job completed: 1 created, 0 errors
```

### 监控指标

- 每日快照创建数量
- 快照创建失败次数
- API 调用响应时间
- 数据库写入性能

## 未来优化

1. **增量快照**：只记录变化的数据
2. **压缩存储**：对历史快照进行压缩
3. **数据归档**：将旧快照归档到冷存储
4. **实时快照**：支持更高频率的快照（如每小时）
5. **快照对比**：提供快照之间的差异分析
6. **导出功能**：支持导出快照数据为 Excel/CSV

## 相关文件

### 后端
- `web/backend/services/snapshot_scheduler.py` - 快照调度器
- `web/backend/services/futu_api_client.py` - Futu API 客户端
- `web/backend/routes/account_snapshot_routes.py` - API 路由
- `web/backend/models.py` - AccountSnapshot 模型
- `web/backend/app.py` - 应用启动（初始化调度器）

### 前端
- `web/frontend/src/components/intraday/AccountInfo.tsx` - 账户信息组件（快照按钮）
- `web/frontend/src/components/intraday/AccountTrendModal.tsx` - 趋势图模态框
- `web/frontend/src/hooks/useIntradayTrading.ts` - 数据获取 hooks

## 测试

### 手动测试快照创建

```bash
# 启动后端服务
cd web/backend
python app.py

# 在浏览器中访问智能盯盘页面
# 点击账户信息卡片中的"快照"按钮
```

### 测试定时任务

```python
# 修改调度时间为测试时间
MARKET_CLOSE_TIMES = {
    'US': {'hour': 14, 'minute': 30},  # 测试：下午2:30
}

# 重启服务，等待定时任务执行
```

### 查看快照数据

```sql
-- 查询用户的快照记录
SELECT * FROM account_snapshots 
WHERE user_id = 1 
ORDER BY snapshot_date DESC 
LIMIT 10;

-- 查询今天的快照
SELECT * FROM account_snapshots 
WHERE DATE(snapshot_date) = CURRENT_DATE;
```
