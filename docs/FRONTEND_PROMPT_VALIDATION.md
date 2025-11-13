# 前端提示词验证和限制

## 修改内容

为前端提示词编辑器添加字符数限制、实时计数和验证提示。

## 修改文件

**文件**: `web/frontend/src/components/intraday/PromptConfigTab.tsx`

### 1. 策略名称（200字符）

```tsx
<label className="block text-sm font-medium text-text-primary mb-2">
  策略名称
  <span className="ml-2 text-xs text-text-tertiary">
    ({templateName.length}/200)  {/* ✅ 实时计数 */}
  </span>
</label>
<input
  type="text"
  value={templateName}
  onChange={(e) => setTemplateName(e.target.value)}
  maxLength={200}  {/* ✅ HTML限制 */}
  className="..."
  placeholder="例如：激进型日内交易策略"
/>
<p className="text-xs text-text-tertiary mt-1">
  策略标题，最多200个字符  {/* ✅ 提示文本 */}
</p>
```

### 2. 策略描述（500字符）

```tsx
<label className="block text-sm font-medium text-text-primary mb-2">
  策略描述
  <span className="ml-2 text-xs text-text-tertiary">
    ({description.length}/500)  {/* ✅ 实时计数 */}
  </span>
</label>
<input
  type="text"
  value={description}
  onChange={(e) => setDescription(e.target.value)}
  maxLength={500}  {/* ✅ HTML限制 */}
  className="..."
  placeholder="简要描述策略特点"
/>
<p className="text-xs text-text-tertiary mt-1">
  策略描述，最多500个字符  {/* ✅ 提示文本 */}
</p>
```

### 3. 系统提示词（20,000字符）

```tsx
<label className="block text-sm font-medium text-text-primary">
  系统提示词
</label>
<span className={`text-xs ${
  editedPrompt.length > 20000 
    ? 'text-red-500 font-semibold'  {/* ✅ 超出时红色警告 */}
    : 'text-text-secondary'
}`}>
  {editedPrompt.length.toLocaleString()} / 20,000 字符  {/* ✅ 实时计数 */}
</span>

<textarea
  value={editedPrompt}
  onChange={(e) => setEditedPrompt(e.target.value)}
  className="..."
  placeholder="定义 Agent 的行为、交易理念和执行流程..."
/>
<p className="text-xs text-text-tertiary mt-1">
  核心提示词内容，最多 20,000 个字符。系统会自动注入工具文档和变量说明。
</p>

{/* ✅ 超出限制时显示警告 */}
{editedPrompt.length > 20000 && (
  <div className="mt-2 p-3 rounded-md text-sm bg-red-50 border border-red-200 text-red-800">
    <div className="flex items-start gap-2">
      <i className="fas fa-exclamation-triangle mt-0.5" />
      <div className="flex-1">
        <p className="font-medium">提示词超出长度限制</p>
        <p className="text-xs mt-1">
          当前 {editedPrompt.length.toLocaleString()} 字符，
          超出 {(editedPrompt.length - 20000).toLocaleString()} 字符。
          请精简内容后再保存。
        </p>
      </div>
    </div>
  </div>
)}
```

### 4. 保存前验证

```tsx
const handleSave = async () => {
  // ✅ 验证策略名称
  if (templateName.length > 200) {
    onShowToast('策略名称不能超过200个字符', 'error');
    return;
  }
  
  // ✅ 验证策略描述
  if (description.length > 500) {
    onShowToast('策略描述不能超过500个字符', 'error');
    return;
  }
  
  // ✅ 验证提示词
  if (editedPrompt.length > 20000) {
    onShowToast(
      `提示词不能超过20,000个字符（当前${editedPrompt.length.toLocaleString()}字符）`, 
      'error'
    );
    return;
  }

  // 保存...
};
```

## 用户界面

### 正常状态

```
┌─────────────────────────────────────────────┐
│ 策略名称                        (15/200)    │
├─────────────────────────────────────────────┤
│ [激进型日内交易策略                      ]  │
├─────────────────────────────────────────────┤
│ 策略标题，最多200个字符                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 系统提示词              8,523 / 20,000 字符 │
├─────────────────────────────────────────────┤
│ [                                          ] │
│ [  提示词内容...                           ] │
│ [                                          ] │
├─────────────────────────────────────────────┤
│ 核心提示词内容，最多 20,000 个字符。        │
│ 系统会自动注入工具文档和变量说明。          │
└─────────────────────────────────────────────┘
```

### 超出限制状态

```
┌─────────────────────────────────────────────┐
│ 系统提示词              20,523 / 20,000 字符│
│                         ^^^^^^ (红色加粗)    │
├─────────────────────────────────────────────┤
│ [                                          ] │
│ [  提示词内容...                           ] │
│ [                                          ] │
├─────────────────────────────────────────────┤
│ ⚠️ 提示词超出长度限制                       │
│ 当前 20,523 字符，超出 523 字符。           │
│ 请精简内容后再保存。                        │
└─────────────────────────────────────────────┘
```

### 保存失败提示

```
┌─────────────────────────────────────────────┐
│ ❌ 提示词不能超过20,000个字符               │
│    （当前20,523字符）                       │
└─────────────────────────────────────────────┘
```

## 字符限制总结

| 字段 | 最大长度 | HTML限制 | 实时计数 | 超出警告 | 保存验证 |
|------|---------|---------|---------|---------|---------|
| 策略名称 | 200 | ✅ | ✅ | ❌ | ✅ |
| 策略描述 | 500 | ✅ | ✅ | ❌ | ✅ |
| 系统提示词 | 20,000 | ❌ | ✅ | ✅ | ✅ |

**说明**：
- 策略名称和描述使用 `maxLength` HTML 属性硬限制
- 系统提示词不使用 HTML 限制（允许超出以便用户看到警告）
- 所有字段都有实时字符计数
- 系统提示词超出时显示红色警告框
- 保存时所有字段都会验证

## 与后端一致性

| 字段 | 前端限制 | 后端限制 | 一致性 |
|------|---------|---------|--------|
| template_name | 200 | 200 | ✅ |
| description | 500 | 500 | ✅ |
| system_prompt | 20,000 | 20,000 | ✅ |

## 用户体验优化

### 1. 渐进式提示

```tsx
// 正常状态：灰色文本
{editedPrompt.length} / 20,000 字符

// 接近限制（>18,000）：黄色警告
{editedPrompt.length} / 20,000 字符 ⚠️

// 超出限制（>20,000）：红色错误
{editedPrompt.length} / 20,000 字符 ❌
```

### 2. 实时反馈

- 输入时立即更新字符计数
- 超出限制时立即显示警告框
- 保存按钮可以禁用（可选）

### 3. 清晰的错误信息

```tsx
// ✅ 好的错误信息
"提示词不能超过20,000个字符（当前20,523字符）"

// ❌ 不好的错误信息
"提示词太长"
```

## 测试建议

### 1. 边界值测试

```typescript
// 策略名称
templateName = "a".repeat(200);  // ✅ 允许
templateName = "a".repeat(201);  // ❌ HTML阻止输入

// 策略描述
description = "a".repeat(500);   // ✅ 允许
description = "a".repeat(501);   // ❌ HTML阻止输入

// 系统提示词
editedPrompt = "a".repeat(20000);  // ✅ 允许
editedPrompt = "a".repeat(20001);  // ⚠️ 允许输入但显示警告
```

### 2. 保存验证测试

```typescript
// 测试超出限制
editedPrompt = "a".repeat(20001);
handleSave();  // ❌ 应该显示错误，不保存
```

### 3. 用户体验测试

```typescript
// 场景1：正常输入
用户输入: 8000字符
显示: "8,000 / 20,000 字符" (灰色)
保存: ✅ 成功

// 场景2：超出限制
用户输入: 20500字符
显示: "20,500 / 20,000 字符" (红色)
警告框: ⚠️ 提示词超出长度限制
保存: ❌ 显示错误提示
```

## 相关文档

- [验证规则和缓存更新](./VALIDATION_AND_CACHE_UPDATE.md)
- [后端提示词验证](../web/backend/schemas.py)

## 总结

前端提示词验证已完善：

1. ✅ **实时字符计数**：所有字段都显示当前字符数
2. ✅ **HTML 限制**：策略名称和描述使用 maxLength
3. ✅ **视觉警告**：提示词超出时红色显示
4. ✅ **警告框**：超出限制时显示详细警告信息
5. ✅ **保存验证**：保存前验证所有字段长度
6. ✅ **清晰提示**：每个字段都有说明文字
7. ✅ **与后端一致**：前后端限制完全一致

用户现在可以清楚地看到字符限制，并在超出时得到明确的提示！
