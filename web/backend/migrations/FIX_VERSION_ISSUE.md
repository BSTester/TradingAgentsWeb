# 修复版本号问题完整指南

## 问题描述

系统在更新 prompt template 时，版本号逻辑有误，导致：
1. 版本号不断追加字符串（如 `1.0_edited_edited_edited`）而不是数字递增
2. 版本号超过数据库字段长度限制（VARCHAR(20)），导致数据库错误

## 错误信息

```
sqlalchemy.exc.DataError: (pymysql.err.DataError) (1406, "Data too long for column 'version' at row 1")
```

## 修复内容

### 1. 代码修复
- **文件**: `web/backend/routes/prompt_routes.py`
- **修改**: 版本号递增逻辑改为正确解析数字并递增
  - 旧逻辑: 解析失败时追加时间戳 → `1.0_20251114`
  - 新逻辑: 提取数字部分并递增 → `1.0` → `1.1` → `1.2`

### 2. 数据库 Schema 修复
- **文件**: `web/backend/models.py`
- **修改**: 版本号字段长度从 VARCHAR(20) 增加到 VARCHAR(50)

### 3. 数据清理
- **文件**: `002_fix_version_strings.py`
- **功能**: 清理已损坏的版本号数据

## 修复步骤

### 步骤 1: 应用数据库 Schema 变更

```bash
cd web/backend/migrations
python apply_migration_001.py
```

这会将 `version` 字段从 VARCHAR(20) 扩展到 VARCHAR(50)。

### 步骤 2: 清理损坏的版本号数据

```bash
python 002_fix_version_strings.py
```

这会扫描所有 template 并修复损坏的版本号：
- `1.0_edited_edited_edited` → `1.0`
- `2.5_20251114` → `2.5`
- `invalid_version` → `1.0`

### 步骤 3: 重启后端服务

```bash
# 如果使用 Docker
docker-compose restart tradingagents-backend

# 如果直接运行
# 停止当前进程，然后重新启动
python web/backend/app_v2.py
```

## 验证修复

### 1. 测试版本号递增逻辑

```bash
python web/backend/migrations/test_version_increment.py
```

应该看到所有测试通过 (✓)。

### 2. 验证数据库字段

```sql
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'agent_prompt_templates' AND COLUMN_NAME = 'version';
```

应该显示 `CHARACTER_MAXIMUM_LENGTH = 50`。

### 3. 检查版本号数据

```sql
SELECT id, agent_type, version, updated_at 
FROM agent_prompt_templates 
ORDER BY updated_at DESC 
LIMIT 10;
```

所有版本号应该是干净的数字格式（如 `1.0`, `1.1`, `2.3`）。

### 4. 测试更新功能

通过 Web UI 或 API 更新一个 prompt template，检查版本号是否正确递增：
- 第一次更新: `1.0` → `1.1`
- 第二次更新: `1.1` → `1.2`
- 第三次更新: `1.2` → `1.3`

## 版本号规则（修复后）

1. **初始版本**: 新创建的 template 版本号为 `1.0`
2. **自动递增**: 每次更新 `system_prompt` 时，版本号自动 +0.1
   - `1.0` → `1.1` → `1.2` → ... → `1.9` → `2.0`
3. **手动覆盖**: 可以通过 API 手动指定版本号
4. **容错处理**: 如果版本号格式错误（如 `1.0_edited`），会提取数字部分并递增

## 注意事项

- 修复后，旧的损坏版本号会被重置为其数字部分
- 版本历史不会丢失，只是版本号格式会被规范化
- 建议在生产环境应用前先在测试环境验证
