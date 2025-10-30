# 数据库迁移说明

## 添加公司名称字段

### 迁移文件
- `add_company_name.sql` - 添加 `company_name` 字段到 `analysis_records` 表

### 应用迁移

#### 方法1：使用 psql 命令行
```bash
psql -U your_username -d tradingagents_db -f add_company_name.sql
```

#### 方法2：使用 Python 脚本
```python
from web.backend.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    with open('web/backend/migrations/add_company_name.sql', 'r') as f:
        sql = f.read()
    conn.execute(text(sql))
    conn.commit()
```

#### 方法3：手动执行 SQL
连接到数据库后执行：
```sql
ALTER TABLE analysis_records 
ADD COLUMN IF NOT EXISTS company_name VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_analysis_records_company_name 
ON analysis_records(company_name);
```

### 功能说明
添加此字段后，系统会自动：
1. 在 trader 节点完成后，通过 LLM 从股票代码提取中文公司名称
2. 将公司名称保存到数据库
3. 在前端历史记录和结果详情页面显示公司名称

### 显示格式
- **历史记录页面**: `TSLA (特斯拉)`
- **结果详情页面**: `US | 英伟达` (在市场类别后面)
- **排行榜页面**: 保持原有显示格式

### 注意事项
- 此迁移是向后兼容的，不会影响现有数据
- 现有记录的 `company_name` 字段将为 NULL
- 新的分析会自动填充公司名称
