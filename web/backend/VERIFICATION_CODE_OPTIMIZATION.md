# 邮箱验证码优化说明

## 优化内容

将邮箱验证码存储从数据库迁移到内存存储，提升性能并简化架构。

## 变更详情

### 1. 存储方式变更

**之前：** 验证码存储在数据库表 `email_verification_codes` 中
- 需要数据库读写操作
- 需要定期清理过期记录
- 增加数据库负担

**现在：** 验证码存储在内存字典中
- 快速读写，无数据库开销
- 自动过期清理
- 线程安全（使用 `threading.Lock`）

### 2. 数据结构

```python
# 内存存储结构
_verification_codes: Dict[str, Tuple[str, datetime, bool]] = {}
# 格式: {email: (code_hash, expires_at, used)}
```

### 3. 主要优势

1. **性能提升**
   - 无数据库 I/O 延迟
   - 验证码生成和验证速度更快

2. **简化架构**
   - 移除数据库表和迁移
   - 减少数据库维护工作

3. **自动清理**
   - 过期验证码自动失效
   - 定时任务清理过期条目

4. **安全性保持**
   - 仍使用 bcrypt 哈希存储
   - 5分钟过期时间
   - 一次性使用验证

### 4. 注意事项

**服务重启影响：**
- 服务重启会清空所有内存中的验证码
- 用户需要重新请求验证码
- 这是可接受的权衡，因为验证码本身就是短期有效的

**多实例部署：**
- 如果使用多个后端实例，需要考虑使用 Redis 等共享缓存
- 当前实现适用于单实例或使用负载均衡的粘性会话

### 5. 迁移步骤

1. 更新 `verification_code_service.py` 使用内存存储
2. 从 `models.py` 移除 `EmailVerificationCode` 模型
3. 创建迁移脚本删除旧表（可选）
4. 更新清理任务使用内存清理

### 6. 未来扩展

如果需要支持多实例部署，可以考虑：
- 使用 Redis 作为共享缓存
- 使用分布式缓存方案
- 保持相同的 API 接口，只需更换底层存储实现

## 相关文件

- `web/backend/services/verification_code_service.py` - 验证码服务
- `web/backend/models.py` - 数据模型（已移除 EmailVerificationCode）
- `web/backend/app.py` - 清理任务
- `web/backend/migrations/remove_email_verification_codes.py` - 删除旧表的迁移
