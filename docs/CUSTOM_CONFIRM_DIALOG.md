# 自定义确认对话框实现

## 概述

为 LLM 配置管理页面实现了美观的自定义确认对话框，替代了系统原生的 `window.confirm()` 函数。

## 实现特性

### ✨ 核心功能

1. **自定义样式**
   - 深色主题设计，与应用整体风格一致
   - 圆角卡片式布局
   - 背景模糊效果
   - 阴影和边框增强视觉层次

2. **交互优化**
   - ✅ 键盘支持（ESC 键关闭）
   - ✅ 点击背景关闭
   - ✅ 平滑的淡入/缩放动画
   - ✅ 按钮悬停效果

3. **可配置性**
   - 自定义图标和颜色
   - 自定义按钮文本
   - 自定义按钮样式
   - 支持多行文本（`\n` 换行）

### 🎨 设计细节

#### 布局结构
```
┌─────────────────────────────────┐
│                                 │
│         ┌───────────┐           │
│         │   Icon    │           │  图标区
│         └───────────┘           │
│                                 │
│         Title Text              │  标题
│                                 │
│     Message content here        │  内容
│     with multiple lines         │
│                                 │
│         [取消] [确定]           │  操作按钮
│                                 │
└─────────────────────────────────┘
```

#### 颜色系统
- **背景**: `dark-secondary` (对话框), `dark-tertiary` (图标背景)
- **边框**: `dark-border`
- **文本**: `text-primary` (标题), `text-secondary` (内容)
- **危险按钮**: `bg-danger-500 hover:bg-danger-600`
- **取消按钮**: `bg-dark-tertiary hover:bg-dark-border`

### 📁 文件结构

```
web/frontend/src/components/admin/llm-config/
├── ConfirmDialog.tsx          # 确认对话框组件
├── ProviderList.tsx           # 供应商列表
├── ModelList.tsx              # 模型列表
└── README.md                  # 组件文档
```

### 🔧 使用方式

#### 1. 在页面中引入组件
```tsx
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';
```

#### 2. 定义对话框状态
```tsx
const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
});
```

#### 3. 触发对话框
```tsx
const handleDelete = (item: any) => {
  setConfirmDialog({
    isOpen: true,
    title: '删除确认',
    message: `确定要删除 "${item.name}" 吗？\n\n此操作无法撤销。`,
    onConfirm: () => {
      deleteItem(item.id);
    },
  });
};
```

#### 4. 渲染对话框
```tsx
<ConfirmDialog
  isOpen={confirmDialog.isOpen}
  title={confirmDialog.title}
  message={confirmDialog.message}
  onConfirm={confirmDialog.onConfirm}
  onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
/>
```

### 📋 实际应用场景

#### 删除供应商（危险操作）
```tsx
const handleDeleteProvider = (provider: any) => {
  setConfirmDialog({
    isOpen: true,
    title: '删除供应商',
    message: `确定要删除供应商 "${provider.display_name}" 吗？\n\n⚠️ 警告：这将同时删除该供应商下的所有模型！`,
    onConfirm: () => {
      deleteProviderMutation.mutate(provider.id);
    },
  });
};
```

**效果**:
- ⚠️ 图标显示警告标识
- 🔴 红色危险按钮
- 📝 清晰的警告信息
- 💬 多行文本说明影响范围

#### 删除模型（普通确认）
```tsx
const handleDeleteModel = (model: any) => {
  setConfirmDialog({
    isOpen: true,
    title: '删除模型',
    message: `确定要删除模型 "${model.display_name}" 吗？\n\n此操作无法撤销。`,
    onConfirm: () => {
      deleteModelMutation.mutate(model.id);
    },
  });
};
```

**效果**:
- 🗑️ 标准确认对话框
- 📝 简洁明了的提示
- 🔴 删除操作按钮

### 🎯 Props API

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `isOpen` | `boolean` | ✅ | - | 是否显示对话框 |
| `title` | `string` | ✅ | - | 对话框标题 |
| `message` | `string` | ✅ | - | 对话框内容（支持 `\n` 换行） |
| `onConfirm` | `() => void` | ✅ | - | 确认回调函数 |
| `onCancel` | `() => void` | ✅ | - | 取消回调函数 |
| `confirmText` | `string` | ❌ | `'确定'` | 确认按钮文本 |
| `cancelText` | `string` | ❌ | `'取消'` | 取消按钮文本 |
| `confirmButtonClass` | `string` | ❌ | `'bg-danger-500 hover:bg-danger-600'` | 确认按钮样式类名 |
| `icon` | `string` | ❌ | `'fa-exclamation-triangle'` | FontAwesome 图标类名 |
| `iconColor` | `string` | ❌ | `'text-danger-500'` | 图标颜色类名 |

### 🌟 优势对比

#### 原生 `window.confirm()`
```tsx
// ❌ 缺点：
// - 样式无法自定义
// - 与应用主题不一致
// - 功能单一
// - 用户体验差
if (confirm('确定要删除吗？')) {
  deleteItem();
}
```

#### 自定义 `ConfirmDialog`
```tsx
// ✅ 优点：
// - 完全自定义样式
// - 与应用主题一致
// - 支持图标、多行文本
// - 流畅的动画效果
// - 键盘支持
// - 更好的用户体验
setConfirmDialog({
  isOpen: true,
  title: '删除确认',
  message: '确定要删除吗？\n\n此操作无法撤销。',
  onConfirm: () => deleteItem(),
});
```

### 🚀 扩展建议

#### 1. 添加不同类型的对话框预设
```tsx
// 成功确认
<ConfirmDialog
  icon="fa-check-circle"
  iconColor="text-success-500"
  confirmButtonClass="bg-success-500 hover:bg-success-600"
/>

// 警告确认
<ConfirmDialog
  icon="fa-exclamation-triangle"
  iconColor="text-warning-500"
  confirmButtonClass="bg-warning-500 hover:bg-warning-600"
/>

// 信息确认
<ConfirmDialog
  icon="fa-info-circle"
  iconColor="text-blue-500"
  confirmButtonClass="bg-blue-500 hover:bg-blue-600"
/>
```

#### 2. 添加输入框支持
```tsx
// 可以扩展为带输入框的确认对话框
interface ConfirmDialogWithInputProps extends ConfirmDialogProps {
  showInput?: boolean;
  inputPlaceholder?: string;
  onInputChange?: (value: string) => void;
}
```

#### 3. 添加异步确认
```tsx
// 支持异步确认操作，显示加载状态
const [isConfirming, setIsConfirming] = useState(false);

<ConfirmDialog
  isConfirming={isConfirming}
  onConfirm={async () => {
    setIsConfirming(true);
    await deleteItem();
    setIsConfirming(false);
  }}
/>
```

### 📊 技术栈

- **React**: 组件化开发
- **TypeScript**: 类型安全
- **Tailwind CSS**: 样式系统
- **React Hooks**: 状态管理和副作用处理

### ✅ 测试检查清单

- [x] 点击确认按钮可以正常执行回调
- [x] 点击取消按钮可以关闭对话框
- [x] 点击背景可以关闭对话框
- [x] 按 ESC 键可以关闭对话框
- [x] 动画效果流畅
- [x] 多行文本正常显示
- [x] 响应式布局适配移动端
- [x] 图标和颜色可以自定义

### 🎓 最佳实践

1. **明确的警告信息**
   - 使用多行文本清晰说明操作后果
   - 危险操作使用 ⚠️ emoji 强调

2. **一致的用户体验**
   - 所有删除操作使用统一的确认对话框
   - 保持按钮位置和颜色的一致性

3. **适当的动画**
   - 使用淡入和缩放动画增强体验
   - 避免过度动画影响性能

4. **键盘友好**
   - 支持 ESC 键快速取消
   - 可以扩展支持 Enter 键确认

## 总结

通过实现自定义确认对话框，我们显著提升了 LLM 配置管理页面的用户体验：

✅ **更美观**: 与应用主题完美融合
✅ **更友好**: 清晰的提示和流畅的动画
✅ **更灵活**: 支持多种自定义选项
✅ **更专业**: 符合现代 Web 应用标准

这个组件可以轻松应用到项目的其他部分，作为标准的确认对话框解决方案。
