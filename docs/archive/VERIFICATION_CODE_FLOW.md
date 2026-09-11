# 验证码流程说明

## 概述

验证码使用**内存缓存**存储，不使用数据库表。所有验证码相关操作都通过 `VerificationCodeService` 统一管理。

## 存储方式

### 内存缓存结构
```python
_verification_codes: Dict[str, Tuple[str, datetime, bool]] = {}
# 结构: {email: (code_hash, expires_at, used)}
```

### 字段说明
- `email`: 邮箱地址（键）
- `code_hash`: 验证码的 bcrypt 哈希值
- `expires_at`: 过期时间（UTC）
- `used`: 是否已使用

## 注册流程

### 1. 发送验证码
**端点**: `POST /api/auth/email-code/send-for-register`

**流程**：
```
1. 用户输入邮箱
2. 生成6位数字验证码
3. 使用 bcrypt 哈希验证码
4. 存储到内存缓存（有效期5分钟）
5. 发送邮件给用户
```

**代码位置**: `web/backend/auth_routes.py:send_email_code_for_register()`

### 2. 验证并注册
**端点**: `POST /api/auth/register`

**流程**：
```
1. 用户提交注册信息（包含验证码）
2. 验证图形验证码
3. 从内存缓存获取验证码数据
4. 检查是否过期
5. 检查是否已使用
6. 验证码是否匹配（bcrypt verify）
7. 标记为已使用
8. 创建用户账户
9. 返回 JWT token
```

**代码位置**: `web/backend/auth_routes.py:register()`

## 登录流程

### 邮箱验证码登录
**端点**: `POST /api/auth/email-code/send` + `POST /api/auth/login-with-email-code`

**流程**：
```
1. 用户输入邮箱
2. 检查用户是否存在
3. 生成验证码并存储
4. 发送邮件
5. 用户输入验证码
6. 验证码校验
7. 返回 JWT token
```

### 密码登录
**端点**: `POST /api/auth/login`

**流程**：
```
1. 用户输入用户名/密码
2. 验证图形验证码
3. 验证用户名密码
4. 返回 JWT token
```

## 验证码服务

### VerificationCodeService

**位置**: `web/backend/services/verification_code_service.py`

**主要方法**：

#### `_generate_code()`
生成6位随机数字验证码

#### `_hash_code(code: str)`
使用 bcrypt 哈希验证码

#### `_verify_hash(code: str, code_hash: str)`
验证码与哈希值比对

#### `generate_and_send_code(email: str, ip_address: str)`
生成验证码并发送邮件（用于登录）
- 检查用户是否存在
- 生成并存储验证码
- 发送邮件

#### `verify_code(email: str, code: str)`
验证验证码
- 检查是否存在
- 检查是否过期
- 检查是否已使用
- 验证哈希值
- 标记为已使用

#### `_send_verification_email(email: str, code: str)`
发送验证码邮件
- HTML 格式邮件
- 纯文本备用格式

## 安全特性

### 1. 验证码哈希存储
- 使用 bcrypt 哈希，不存储明文
- 防止内存泄露导致验证码泄露

### 2. 过期机制
- 默认5分钟有效期
- 过期自动清理

### 3. 一次性使用
- 验证成功后立即标记为已使用
- 防止重放攻击

### 4. 线程安全
- 使用 `threading.Lock()` 保护内存缓存
- 支持并发访问

### 5. 频率限制
- IP 级别的失败次数限制
- 防止暴力破解

## 配置

### 邮件服务配置
**位置**: `web/backend/services/email_service.py`

**环境变量**：
```bash
EMAIL_ENABLED=true
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASSWORD=your-app-password
EMAIL_FROM_ADDRESS=noreply@tradingagents.com
EMAIL_FROM_NAME=TradingAgentsWeb
```

### 验证码有效期
**位置**: `web/backend/services/verification_code_service.py`

```python
expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
```

可根据需要调整有效期。

## 测试

### 1. 发送验证码
```bash
curl -X POST http://localhost:8000/api/auth/email-code/send-for-register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 2. 注册
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "email_code": "123456",
    "captcha_id": "xxx",
    "captcha_answer": "1234"
  }'
```

## 常见问题

### Q: 验证码收不到？
A: 检查：
1. 邮件服务是否配置正确
2. SMTP 密码是否正确（Gmail 需要应用专用密码）
3. 查看后端日志是否有错误

### Q: 验证码总是提示过期？
A: 检查：
1. 服务器时间是否正确
2. 是否在5分钟内使用
3. 是否重复使用同一个验证码

### Q: 为什么不用数据库存储？
A: 
1. 验证码是短期临时数据，不需要持久化
2. 内存访问速度更快
3. 自动过期，无需手动清理
4. 减少数据库负载

### Q: 服务器重启后验证码会丢失吗？
A: 是的，内存缓存会清空。这是正常的，用户重新请求即可。

## 后续优化

1. **Redis 集成**：多服务器部署时使用 Redis 共享缓存
2. **定时清理**：添加定时任务清理过期验证码
3. **发送频率限制**：同一邮箱限制发送频率（如1分钟1次）
4. **验证次数限制**：限制验证失败次数（如5次后锁定）
