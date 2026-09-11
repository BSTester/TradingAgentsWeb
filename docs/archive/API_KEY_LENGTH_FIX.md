# API密钥字段长度问题修复

## 🐛 问题描述

**错误信息**：
```
(pymysql.err.DataError) (1406, "Data too long for column 'intraday_api_key' at row 1")
```

**问题原因**：
- JWT token通常很长（500-1000字符）
- 数据库字段定义为`VARCHAR(255)`
- 无法存储完整的JWT token

**影响范围**：
- 使用JWT token作为API密钥的LLM提供商（如MiniMax）
- 所有需要存储长密钥的场景

## ✅ 修复方案

### 1. 更新数据库模型定义

**文件**: `web/backend/models.py`

**修改的字段**：

#### UserConfig模型
```python
# 修改前
futu_api_key = Column(String(255), nullable=True)
intraday_futu_api_key = Column(String(255), nullable=True)
intraday_api_key = Column(String(255), nullable=True)
last_api_key = Column(String(255), nullable=True)

# 修改后
futu_api_key = Column(String(1000), nullable=True)  # 增加到1000字符
intraday_futu_api_key = Column(String(1000), nullable=True)
intraday_api_key = Column(String(1000), nullable=True)
last_api_key = Column(String(1000), nullable=True)
```

#### ScheduledTask模型
```python
# 修改前
api_key = Column(String(255), nullable=True)
futu_api_key = Column(String(255), nullable=True)

# 修改后
api_key = Column(String(1000), nullable=True)
futu_api_key = Column(String(1000), nullable=True)
```

#### AnalysisRecord模型
```python
# 修改前
api_key = Column(String(255), nullable=True)
futu_api_key = Column(String(255), nullable=True)

# 修改后
api_key = Column(String(1000), nullable=True)
futu_api_key = Column(String(1000), nullable=True)
```

#### LLMProvider模型
```python
# 已经是1000，无需修改
api_key = Column(String(1000), nullable=True)
```

### 2. 数据库迁移

**文件**: `db/migrate_increase_api_key_length.py`

**功能**：
- 自动检测数据库类型（SQLite/MySQL/PostgreSQL）
- 根据数据库类型执行相应的ALTER TABLE语句
- SQLite：提示更新模型定义即可
- MySQL/PostgreSQL：执行ALTER TABLE修改列类型

**使用方法**：
```bash
python db/migrate_increase_api_key_length.py
```

## 📊 字段长度对比

| 字段 | 修改前 | 修改后 | 说明 |
|------|--------|--------|------|
| intraday_api_key | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| last_api_key | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| futu_api_key | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| intraday_futu_api_key | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| api_key (ScheduledTask) | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| api_key (AnalysisRecord) | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| futu_api_key (ScheduledTask) | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |
| futu_api_key (AnalysisRecord) | VARCHAR(255) | VARCHAR(1000) | 支持JWT token |

## 🔍 JWT Token示例

**典型的JWT token长度**：
```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJHcm91cE5hbWUiOiLlva3puY8iLCJVc2VyTmFtZSI6IuW9rem5jyIsIkFjY291bnQiOiIiLCJTdWJqZWN0SUQiOiIxOTg5NjAzMDY1OTU0NTcwMzM2IiwiSXNzdWVyIjoiTWluaU1heCBVc2VyIFBsYXRmb3JtIiwiRXhwaXJlQXQiOjE3MzQ1MjY4NTUsImlhdCI6MTczNDQzMzI1NX0.Zy-Ql7Qbz0iEfjiog7jgmQBfHzDkUM5Qalu0Fm8oLnrPMDkIeSmc2QKB7HryNAie_RvB1Bmdfi0d2eGYUNKhF5rOX1yNcJ8DaoTcM7Fmnxz-aHWvdI4n5TrJC_fwkE-VxEnuDkBOKrqwlC2bXSnN8eQ8TA
```

**长度**: 约500-800字符

**为什么需要1000字符**：
- JWT token长度不固定
- 包含header、payload、signature三部分
- Base64编码后会增加长度
- 预留空间以支持更长的token

## 🗄️ 数据库类型说明

### SQLite
- **特点**: 不支持直接修改列类型
- **处理**: 更新模型定义后，新数据自动使用新长度
- **现有数据**: 不受影响，可以正常读取
- **建议**: 如果需要存储长密钥，建议重新输入

### MySQL
- **特点**: 支持ALTER TABLE MODIFY COLUMN
- **处理**: 执行`ALTER TABLE table_name MODIFY COLUMN column_name VARCHAR(1000)`
- **现有数据**: 自动迁移，不受影响
- **注意**: 需要有ALTER权限

### PostgreSQL
- **特点**: 支持ALTER TABLE ALTER COLUMN TYPE
- **处理**: 执行`ALTER TABLE table_name ALTER COLUMN column_name TYPE VARCHAR(1000)`
- **现有数据**: 自动迁移，不受影响
- **注意**: 需要有ALTER权限

## ✅ 验证修复

### 测试步骤
1. ✅ 更新models.py中的字段定义
2. ✅ 运行迁移脚本（如果使用MySQL/PostgreSQL）
3. ✅ 重启后端服务
4. ✅ 登录系统
5. ✅ 进入智能盯盘配置
6. ✅ 输入长JWT token
7. ✅ 保存配置
8. ✅ 验证保存成功

### 预期结果
- ✅ 不再出现"Data too long"错误
- ✅ JWT token完整保存
- ✅ 配置可以正常使用
- ✅ 刷新页面后配置保持

## 🔐 安全建议

### 密钥存储
1. **加密存储**: 生产环境应该加密存储API密钥
2. **环境变量**: 敏感密钥建议使用环境变量
3. **访问控制**: 限制数据库访问权限
4. **定期轮换**: 定期更换API密钥

### 代码示例
```python
# 加密存储示例（未实现）
from cryptography.fernet import Fernet

def encrypt_api_key(api_key: str, encryption_key: bytes) -> str:
    """加密API密钥"""
    f = Fernet(encryption_key)
    return f.encrypt(api_key.encode()).decode()

def decrypt_api_key(encrypted_key: str, encryption_key: bytes) -> str:
    """解密API密钥"""
    f = Fernet(encryption_key)
    return f.decrypt(encrypted_key.encode()).decode()
```

## 📝 相关文件

### 修改的文件
- `web/backend/models.py` - 更新字段定义
- `db/migrate_increase_api_key_length.py` - 数据库迁移脚本

### 影响的表
- `user_configs` - 用户配置表
- `scheduled_tasks` - 定时任务表
- `analysis_records` - 分析记录表
- `llm_providers` - LLM提供商表（已经是1000）

## 🎯 支持的LLM提供商

### 使用JWT token的提供商
- ✅ **MiniMax**: 使用JWT token认证
- ✅ **其他**: 任何使用JWT的提供商

### 使用普通API Key的提供商
- ✅ **OpenAI**: sk-xxx格式，约50字符
- ✅ **Anthropic**: sk-ant-xxx格式，约100字符
- ✅ **Google**: 约40字符
- ✅ **所有提供商**: 1000字符足够支持

## 📈 性能影响

### 存储空间
- **增加**: 每个字段增加约745字节（1000-255）
- **影响**: 对于小型数据库可忽略
- **建议**: 大型数据库考虑使用TEXT类型

### 查询性能
- **影响**: VARCHAR(1000)对查询性能影响很小
- **索引**: 不建议对API密钥字段建索引
- **优化**: 如果需要，可以考虑单独的密钥表

## 🔄 回滚方案

如果需要回滚到255字符：

### 1. 更新模型定义
```python
# 改回255
api_key = Column(String(255), nullable=True)
```

### 2. 数据库迁移（MySQL/PostgreSQL）
```sql
-- MySQL
ALTER TABLE user_configs MODIFY COLUMN intraday_api_key VARCHAR(255);

-- PostgreSQL
ALTER TABLE user_configs ALTER COLUMN intraday_api_key TYPE VARCHAR(255);
```

### 3. 注意事项
- ⚠️ 回滚前确保没有超过255字符的数据
- ⚠️ 否则会导致数据截断
- ⚠️ 建议先备份数据库

## 📞 故障排查

### 问题1: 迁移脚本失败
**原因**: 数据库连接问题或权限不足
**解决**: 
- 检查DATABASE_URL配置
- 确认数据库用户有ALTER权限
- 查看详细错误信息

### 问题2: 仍然报错"Data too long"
**原因**: 
- 模型定义未更新
- 服务未重启
- 使用了旧的数据库连接

**解决**:
- 确认models.py已更新
- 重启后端服务
- 清除数据库连接池

### 问题3: SQLite数据截断
**原因**: SQLite的VARCHAR限制
**解决**:
- 重新输入API密钥
- 或者导出数据，删除表，重新创建

## ✨ 总结

### 修复内容
- ✅ 所有API密钥字段长度增加到1000字符
- ✅ 支持JWT token等长密钥
- ✅ 提供数据库迁移脚本
- ✅ 兼容SQLite/MySQL/PostgreSQL

### 修复效果
- ✅ 不再出现"Data too long"错误
- ✅ 支持所有类型的API密钥
- ✅ 现有数据不受影响
- ✅ 向后兼容

### 后续建议
- ⚠️ 考虑实现密钥加密存储
- ⚠️ 添加密钥长度验证
- ⚠️ 实现密钥轮换机制
- ⚠️ 添加密钥过期提醒

---

**修复日期**: 2024年11月17日  
**问题类型**: 数据库字段长度  
**严重程度**: 高  
**状态**: ✅ 已修复
