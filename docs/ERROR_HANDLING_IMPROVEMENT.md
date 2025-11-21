# 智能盯盘错误处理改进

## 问题描述

原来的错误信息不够详细，例如：
```
Error in intraday trader: Received response with null value for choices.
```

用户无法了解具体的错误原因和解决方法。

## 改进内容

### 1. 详细的错误信息

**修改前**:
```python
error_msg = f"Error in intraday trader: {str(e)}"
```

**修改后**:
```python
error_type = type(e).__name__
error_msg = str(e)
error_traceback = traceback.format_exc()
detailed_error = f"Error in intraday trader: {error_type}: {error_msg}"
```

### 2. 常见错误的特殊处理

针对常见错误提供具体的解决建议：

#### LLM API 空响应错误
```
错误信息: null value for choices

可能原因：
- API 密钥是否有效
- 模型名称是否正确
- API 配额是否充足
- 网络连接是否正常
```

#### API 频率限制
```
错误信息: rate limit

错误原因：API 请求频率超限，请稍后重试。
```

#### 请求超时
```
错误信息: timeout

错误原因：API 请求超时，请检查网络连接。
```

#### 认证失败
```
错误信息: authentication/unauthorized

错误原因：API 认证失败，请检查 API 密钥配置。
```

#### 网络连接失败
```
错误信息: connection

错误原因：网络连接失败，请检查网络设置。
```

### 3. 完整的错误报告格式

保存到数据库的错误报告格式：

```markdown
## 错误详情

**错误类型**: ValueError

**错误信息**: Received response with null value for choices.

**可能原因**:
- LLM API 返回了空响应
- 请检查：API 密钥是否有效、模型名称是否正确、API 配额是否充足、网络连接是否正常

**技术详情**:
```
[完整的堆栈跟踪]
```
```

### 4. WebSocket 错误通知增强

**修改前**:
```json
{
  "type": "intraday_session_error",
  "message": "Intraday session error: Received response with null value for choices.",
  "session_id": "xxx"
}
```

**修改后**:
```json
{
  "type": "intraday_session_error",
  "message": "智能盯盘执行失败: ValueError: Received response with null value for choices.",
  "error_type": "ValueError",
  "error_hints": [
    "LLM API 返回了空响应",
    "请检查：API 密钥是否有效、模型名称是否正确、API 配额是否充足、网络连接是否正常"
  ],
  "session_id": "xxx",
  "decision_id": 123
}
```

## 修改的文件

### 1. `tradingagents/agents/trader/intraday_trader.py`

**位置**: 异常处理块（约第 886 行）

**改进**:
- 添加错误类型识别
- 添加完整的堆栈跟踪
- 针对常见错误提供解决建议
- 改进错误报告格式

### 2. `web/backend/services/intraday_executor.py`

**位置**: 主异常处理块（约第 499 行）

**改进**:
- 添加详细的错误信息收集
- 识别常见错误类型并提供建议
- 构建结构化的错误报告
- 增强 WebSocket 错误通知

## 错误类型识别

系统会自动识别以下错误类型并提供相应建议：

| 错误关键词 | 错误类型 | 建议 |
|-----------|---------|------|
| `null value` + `choices` | LLM API 空响应 | 检查 API 配置和配额 |
| `rate limit` | API 频率限制 | 稍后重试 |
| `timeout` | 请求超时 | 检查网络连接 |
| `authentication` / `unauthorized` | 认证失败 | 检查 API 密钥 |
| `connection` | 网络连接失败 | 检查网络设置 |

## 用户体验改进

### 前端显示

错误信息会通过以下方式展示给用户：

1. **WebSocket 实时通知**
   - 显示错误类型和主要信息
   - 显示解决建议

2. **决策记录详情**
   - 完整的错误报告（Markdown 格式）
   - 包含技术详情和堆栈跟踪

3. **日志记录**
   - 后端日志包含完整的错误信息
   - 便于开发者调试

### 示例：前端错误显示

```
❌ 智能盯盘执行失败

错误类型: ValueError
错误信息: Received response with null value for choices.

可能原因:
• LLM API 返回了空响应
• 请检查：API 密钥是否有效、模型名称是否正确、API 配额是否充足、网络连接是否正常

[查看详细信息]
```

## 调试建议

### 开发者

1. 查看后端日志获取完整的堆栈跟踪
2. 检查 LLM API 配置（模型名称、API 密钥）
3. 验证网络连接和 API 可用性
4. 检查 API 配额使用情况

### 用户

1. 查看错误提示中的建议
2. 检查配置页面的 API 设置
3. 尝试重新验证 API 配置
4. 如果问题持续，联系管理员

## 测试

### 测试场景

1. **API 密钥无效**
   - 预期：显示认证失败错误和检查 API 密钥的建议

2. **模型名称错误**
   - 预期：显示 LLM API 错误和检查模型名称的建议

3. **网络超时**
   - 预期：显示超时错误和检查网络连接的建议

4. **API 配额耗尽**
   - 预期：显示频率限制错误和稍后重试的建议

### 验证方法

1. 触发错误（例如使用无效的 API 密钥）
2. 检查 WebSocket 通知是否包含详细信息
3. 查看决策记录详情页面的错误报告
4. 确认后端日志包含完整的堆栈跟踪

## 相关文件

- `tradingagents/agents/trader/intraday_trader.py` - 智能盯盘 Agent 错误处理
- `web/backend/services/intraday_executor.py` - 智能盯盘执行器错误处理
- `web/backend/routes/intraday_trading_routes.py` - API 路由（可能需要前端展示改进）
