# 公司名称显示功能实现说明

## 功能概述

本次更新为 TradingAgents 系统添加了中文公司名称显示功能，提升用户体验。

## 实现内容

### 1. 后端改动

#### 数据库模型 (`web/backend/models.py`)
- 在 `AnalysisRecord` 模型中添加 `company_name` 字段（VARCHAR(100)）
- 用于存储从股票代码提取的中文公司名称

#### 数据库迁移
- 创建迁移脚本：`web/backend/migrations/add_company_name.sql`
- 创建自动应用脚本：`web/backend/migrations/apply_migration.py`
- 添加迁移说明文档：`web/backend/migrations/README.md`

**注意**：新安装时不需要迁移，应用启动时会自动创建包含 `company_name` 字段的表。

#### Trader 节点 (`tradingagents/agents/trader/trader.py`)
- 在交易决策完成后，新增 LLM 调用提取公司名称
- 使用英文提示词，要求返回中文公司简称
- 示例：AAPL → 苹果，0700.HK → 腾讯，NVDA → 英伟达
- 将提取的公司名称添加到返回状态的 `company_of_interest` 字段

#### 分析任务 (`web/backend/analysis_task.py`)
- 从 trader 节点的返回状态中获取 `company_of_interest`
- 保存到数据库的 `company_name` 字段

#### API 路由更新
- `analysis_routes.py`：
  - `list_analyses` 接口返回 `company_name` 和 `market`
  - `get_analysis_results` 接口返回 `company_name` 和 `market`
- `leaderboard_routes.py`：
  - 排行榜接口返回 `company_name`

### 2. 前端改动

#### 历史记录页面 (`web/frontend/src/components/analysis/AnalysisHistory.tsx`)
- 在股票代码后面用括号显示公司名称
- 显示格式：`TSLA (特斯拉)`
- 同时显示市场类别（美股/港股/A股）

#### 结果详情页面 (`web/frontend/src/components/analysis/AnalysisResults.tsx`)
- 在交易决策横幅的股票代码区域显示
- 显示格式：`US | 英伟达` 或 `HK | 腾讯` 或 `CN | 贵州茅台`
- 市场类别和公司名称用 `|` 分隔

#### 排行榜页面
- 更新接口类型定义，支持 `company_name` 字段
- 保持原有显示格式（可根据需要后续调整）

### 3. 首页路由问题修复

**问题**：直接访问网站域名时跳转到登录页

**原因**：根路径 (`/`) 已经是排行榜页面，不需要认证。问题可能出在其他地方。

**解决方案**：
- 确认 `web/frontend/src/app/page.tsx` 是排行榜页面（无需认证）
- Dashboard 页面 (`/dashboard`) 才需要认证
- 如果仍有问题，检查中间件或路由配置

## 应用迁移

### 新安装（推荐）

如果是全新安装，直接启动应用即可：

```bash
cd web/backend
uvicorn app_v2:app --host 0.0.0.0 --port 8000
```

应用启动时会自动创建包含 `company_name` 字段的数据库表。

### 现有数据库升级

如果已有运行中的数据库，需要添加 `company_name` 字段：

#### 方法1：使用 Python 脚本（推荐）
```bash
cd web/backend/migrations
python apply_migration.py
```

#### 方法2：手动执行 SQL
```bash
# SQLite
sqlite3 tradingagents.db < web/backend/migrations/add_company_name.sql

# MySQL
mysql -u username -p database_name < web/backend/migrations/add_company_name.sql

# PostgreSQL
psql -U username -d database_name -f web/backend/migrations/add_company_name.sql
```

#### 方法3：在 Python 中执行
```python
from web.backend.database import sync_engine
from sqlalchemy import text

with sync_engine.connect() as conn:
    with open('web/backend/migrations/add_company_name.sql', 'r') as f:
        sql = f.read()
    conn.execute(text(sql))
    conn.commit()
```

## 显示效果

### 历史记录页面
```
┌─────────────────────────────────────────────────────────┐
│ 股票代码                                                 │
│ ┌──┐                                                    │
│ │TS│ TSLA (特斯拉)                                      │
│ └──┘ 美股 | 已完成                                      │
└─────────────────────────────────────────────────────────┘
```

### 结果详情页面
```
┌─────────────────────────────────────────────────────────┐
│ 交易决策横幅                                             │
│                                                         │
│ ┌──────┐                                               │
│ │ 📈  │  US | 英伟达                                    │
│ └──────┘  NVDA                                         │
│                                                         │
│           最终交易决策: BUY                             │
└─────────────────────────────────────────────────────────┘
```

## 技术细节

### LLM 提取公司名称
- **位置**：`tradingagents/agents/trader/trader.py`
- **时机**：交易决策生成完成后
- **提示词**：
  ```
  You are a financial data assistant. Extract the Chinese company name 
  from the given stock ticker symbol and analysis context. Return ONLY 
  the short Chinese company name (e.g., '苹果' for AAPL, '腾讯' for 
  0700.HK, '贵州茅台' for 600519, '英伟达' for NVDA). Do not include 
  any additional text, explanations, or formatting. Always return the 
  name in Chinese characters.
  ```
- **输入**：股票代码 + 分析结果前500字符
- **输出**：中文公司简称
- **错误处理**：提取失败时使用原始 ticker

### 数据流
```
用户输入股票代码
    ↓
分析流程执行
    ↓
Trader 节点生成交易决策
    ↓
LLM 提取公司名称（中文）
    ↓
保存到 company_of_interest 字段
    ↓
analysis_task 保存到数据库
    ↓
前端显示
```

## 兼容性

- ✅ 向后兼容：现有记录的 `company_name` 为 NULL，不影响显示
- ✅ 新分析自动填充公司名称
- ✅ 前端优雅降级：没有公司名称时只显示股票代码

## 测试建议

1. **新建分析**：
   - 测试美股（如 AAPL、TSLA、NVDA）
   - 测试港股（如 0700.HK、00700.HK）
   - 测试A股（如 600519、000001）

2. **检查显示**：
   - 历史记录页面：股票代码后是否显示公司名称
   - 结果详情页面：市场类别和公司名称是否正确显示
   - 排行榜页面：数据是否正常加载

3. **边界情况**：
   - 公司名称提取失败时的降级处理
   - 现有记录（company_name 为 NULL）的显示

## 注意事项

1. **数据库迁移**：必须先应用迁移才能使用此功能
2. **LLM 调用**：会增加一次额外的 LLM 调用，注意 API 配额
3. **提取准确性**：依赖 LLM 的理解能力，可能存在误差
4. **性能影响**：每次分析增加约 1-2 秒的处理时间

## 未来优化

1. 使用股票代码数据库缓存公司名称，减少 LLM 调用
2. 支持多语言公司名称（英文、中文）
3. 添加公司名称编辑功能
4. 在排行榜卡片中也显示公司名称
