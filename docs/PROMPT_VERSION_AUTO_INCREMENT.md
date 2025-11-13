# 提示词版本自动递增

## 概述

提示词模板的版本号现在支持自动递增，当用户更新系统提示词（`system_prompt`）时，版本号会自动增加。

## 版本号更新规则

### 1. 自动递增（推荐）

当更新 `system_prompt` 时，版本号自动递增：

```python
# 当前版本: "1.0"
# 更新提示词后: "1.1"

# 当前版本: "2.5"
# 更新提示词后: "2.6"
```

**规则**：
- 如果版本号是数字格式（如 "1.0", "2.5"），则 +0.1
- 如果版本号无法解析为数字，则追加日期（如 "custom_20251113"）
- 如果版本号为空，则设置为 "1.0"

### 2. 手动指定（可选）

用户可以手动指定版本号，覆盖自动递增：

```python
# 请求
PUT /api/prompts/templates/intraday_trader
{
    "system_prompt": "新的提示词内容",
    "version": "2.0"  // 手动指定版本号
}

# 结果：版本号为 "2.0"（使用手动指定的值）
```

### 3. 仅更新其他字段

如果只更新标题或描述，版本号不变：

```python
# 请求
PUT /api/prompts/templates/intraday_trader
{
    "template_name": "新标题",
    "description": "新描述"
    // 没有 system_prompt
}

# 结果：版本号保持不变
```

## 实现逻辑

**文件**: `web/backend/routes/prompt_routes.py`

```python
# Update fields
if data.system_prompt is not None:
    template.system_prompt = data.system_prompt
    
    # Auto-increment version when system_prompt is updated
    if template.version:
        try:
            # Try to parse version as float and increment
            current_version = float(template.version)
            template.version = f"{current_version + 0.1:.1f}"
        except ValueError:
            # If version is not a number, append timestamp
            template.version = f"{template.version}_{datetime.utcnow().strftime('%Y%m%d')}"
    else:
        template.version = "1.0"

if data.version is not None:
    # Allow manual version override
    template.version = data.version
```

## 使用示例

### 示例 1：自动递增（数字版本）

```python
# 初始状态
template.version = "1.0"
template.system_prompt = "旧提示词"

# 更新请求
PUT /api/prompts/templates/intraday_trader
{
    "system_prompt": "新提示词"
}

# 结果
template.version = "1.1"  # 自动递增
template.system_prompt = "新提示词"
```

### 示例 2：自动递增（非数字版本）

```python
# 初始状态
template.version = "custom_v1"
template.system_prompt = "旧提示词"

# 更新请求
PUT /api/prompts/templates/intraday_trader
{
    "system_prompt": "新提示词"
}

# 结果
template.version = "custom_v1_20251113"  # 追加日期
template.system_prompt = "新提示词"
```

### 示例 3：手动指定版本

```python
# 初始状态
template.version = "1.5"
template.system_prompt = "旧提示词"

# 更新请求
PUT /api/prompts/templates/intraday_trader
{
    "system_prompt": "新提示词",
    "version": "2.0"  // 手动指定
}

# 结果
template.version = "2.0"  # 使用手动指定的值
template.system_prompt = "新提示词"
```

### 示例 4：仅更新标题

```python
# 初始状态
template.version = "1.0"
template.template_name = "旧标题"

# 更新请求
PUT /api/prompts/templates/intraday_trader
{
    "template_name": "新标题"
}

# 结果
template.version = "1.0"  # 版本号不变
template.template_name = "新标题"
```

## 版本号格式建议

### 推荐格式

| 格式 | 示例 | 说明 | 自动递增结果 |
|------|------|------|-------------|
| 主版本.次版本 | "1.0", "2.5" | 标准格式 | "1.1", "2.6" |
| 主版本.次版本.修订 | "1.0.0" | 语义化版本 | "1.0.1" (需手动) |
| 日期版本 | "20251113" | 日期格式 | "20251113_20251114" |

### 不推荐格式

| 格式 | 示例 | 问题 | 自动递增结果 |
|------|------|------|-------------|
| 纯文本 | "v1", "latest" | 无法递增 | "v1_20251113" |
| 混合格式 | "v1.0-beta" | 解析困难 | "v1.0-beta_20251113" |

## 前端建议

### 1. 显示版本历史

```typescript
// 显示版本号和更新时间
<div className="version-info">
  <span>版本: {template.version}</span>
  <span>更新时间: {formatDate(template.updated_at)}</span>
</div>
```

### 2. 版本号输入（可选）

```typescript
// 允许用户手动指定版本号
<Form.Item label="版本号（可选）">
  <Input 
    placeholder="留空则自动递增"
    value={version}
    onChange={(e) => setVersion(e.target.value)}
  />
  <span className="hint">
    当前版本: {currentVersion}，
    自动递增后: {getNextVersion(currentVersion)}
  </span>
</Form.Item>

// 计算下一个版本号
function getNextVersion(current: string): string {
  try {
    const num = parseFloat(current);
    return (num + 0.1).toFixed(1);
  } catch {
    return `${current}_${new Date().toISOString().split('T')[0]}`;
  }
}
```

### 3. 版本对比

```typescript
// 显示版本变更
<Timeline>
  <Timeline.Item>
    <div>版本 2.0 (2025-11-13)</div>
    <div>更新了交易策略逻辑</div>
  </Timeline.Item>
  <Timeline.Item>
    <div>版本 1.9 (2025-11-12)</div>
    <div>优化了风险控制参数</div>
  </Timeline.Item>
</Timeline>
```

## API 响应

### 成功响应

```json
{
  "id": 1,
  "agent_type": "intraday_trader",
  "user_id": 1,
  "system_prompt": "更新后的提示词内容...",
  "template_name": "我的交易策略",
  "description": "策略描述",
  "version": "1.1",  // 自动递增
  "is_active": true,
  "created_at": "2025-11-13T10:00:00Z",
  "updated_at": "2025-11-13T14:30:00Z",
  "enabled_tools": ["get_account_info", "get_positions", ...]
}
```

## 版本号历史追踪（未来功能）

### 建议实现

可以考虑添加版本历史表来追踪所有变更：

```python
class PromptTemplateHistory(Base):
    """提示词模板历史记录"""
    __tablename__ = "prompt_template_history"
    
    id = Column(Integer, primary_key=True)
    template_id = Column(Integer, ForeignKey("agent_prompt_templates.id"))
    version = Column(String(50))
    system_prompt = Column(Text)
    changed_by = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=datetime.utcnow)
    change_description = Column(String(500))
```

### 使用场景

- 查看历史版本
- 回滚到旧版本
- 对比不同版本
- 审计变更记录

## 最佳实践

### 1. 版本号命名

```python
# ✅ 推荐
"1.0"  # 初始版本
"1.1"  # 小改动
"2.0"  # 大改动

# ❌ 不推荐
"latest"  # 无法追踪
"v1"      # 格式不统一
```

### 2. 更新说明

```python
# 建议在描述中说明版本变更
{
    "system_prompt": "新提示词",
    "description": "v1.1: 优化了风险控制逻辑，增加了止损条件"
}
```

### 3. 重大更新

```python
# 重大更新时手动指定主版本号
{
    "system_prompt": "完全重写的提示词",
    "version": "2.0",
    "description": "v2.0: 全新的交易策略框架"
}
```

## 相关文档

- [提示词管理 API](./PROMPT_MANAGEMENT_API.md)
- [验证规则和缓存更新](./VALIDATION_AND_CACHE_UPDATE.md)

## 总结

版本号自动递增机制：

1. ✅ **自动递增**：更新提示词时自动 +0.1
2. ✅ **手动覆盖**：支持手动指定版本号
3. ✅ **智能处理**：数字版本递增，非数字版本追加日期
4. ✅ **选择性更新**：只更新标题/描述时版本号不变
5. ✅ **易于追踪**：版本号变化反映提示词的演进

这个机制让用户可以轻松追踪提示词的变更历史，同时保持灵活性。
