# 自定义确认对话框 - 快速参考

## 🚀 快速开始

### 1. 引入组件
```tsx
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';
```

### 2. 添加状态
```tsx
const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
});
```

### 3. 触发对话框
```tsx
// 删除操作
const handleDelete = (item) => {
  setConfirmDialog({
    isOpen: true,
    title: '删除确认',
    message: `确定要删除 "${item.name}" 吗？\n\n此操作无法撤销。`,
    onConfirm: () => deleteItem(item.id),
  });
};
```

### 4. 渲染组件
```tsx
<ConfirmDialog
  isOpen={confirmDialog.isOpen}
  title={confirmDialog.title}
  message={confirmDialog.message}
  onConfirm={confirmDialog.onConfirm}
  onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
/>
```

## 📝 常用场景

### 场景 1: 删除供应商（带警告）
```tsx
setConfirmDialog({
  isOpen: true,
  title: '删除供应商',
  message: `确定要删除供应商 "${provider.display_name}" 吗？\n\n⚠️ 警告：这将同时删除该供应商下的所有模型！`,
  onConfirm: () => deleteProvider(provider.id),
});
```

### 场景 2: 删除模型
```tsx
setConfirmDialog({
  isOpen: true,
  title: '删除模型',
  message: `确定要删除模型 "${model.display_name}" 吗？\n\n此操作无法撤销。`,
  onConfirm: () => deleteModel(model.id),
});
```

### 场景 3: 自定义按钮和图标
```tsx
<ConfirmDialog
  isOpen={true}
  title="保存更改"
  message="确定要保存当前配置吗？"
  onConfirm={handleSave}
  onCancel={handleCancel}
  icon="fa-save"
  iconColor="text-success-500"
  confirmButtonClass="bg-success-500 hover:bg-success-600"
  confirmText="保存"
  cancelText="返回"
/>
```

## 🎨 Props 速查表

| Props | 类型 | 默认值 | 说明 |
|-------|------|--------|------|
| `isOpen` | `boolean` | - | **必填** 是否显示 |
| `title` | `string` | - | **必填** 标题 |
| `message` | `string` | - | **必填** 内容 |
| `onConfirm` | `function` | - | **必填** 确认回调 |
| `onCancel` | `function` | - | **必填** 取消回调 |
| `confirmText` | `string` | `'确定'` | 确认按钮文本 |
| `cancelText` | `string` | `'取消'` | 取消按钮文本 |
| `icon` | `string` | `'fa-exclamation-triangle'` | 图标类名 |
| `iconColor` | `string` | `'text-danger-500'` | 图标颜色 |
| `confirmButtonClass` | `string` | `'bg-danger-500 ...'` | 按钮样式 |

## 🎯 图标和颜色预设

### 危险操作（默认）
```tsx
icon="fa-exclamation-triangle"
iconColor="text-danger-500"
confirmButtonClass="bg-danger-500 hover:bg-danger-600"
```

### 删除操作
```tsx
icon="fa-trash"
iconColor="text-danger-500"
confirmButtonClass="bg-danger-500 hover:bg-danger-600"
```

### 成功/保存
```tsx
icon="fa-check-circle"
iconColor="text-success-500"
confirmButtonClass="bg-success-500 hover:bg-success-600"
```

### 信息提示
```tsx
icon="fa-info-circle"
iconColor="text-blue-500"
confirmButtonClass="bg-blue-500 hover:bg-blue-600"
```

### 警告
```tsx
icon="fa-exclamation-triangle"
iconColor="text-warning-500"
confirmButtonClass="bg-warning-500 hover:bg-warning-600"
```

## ⌨️ 键盘快捷键

- `ESC` - 关闭对话框（等同于点击取消）
- 点击背景 - 关闭对话框

## ✅ vs ❌ 对比

### ❌ 系统原生确认框
```tsx
if (confirm('确定要删除吗？')) {
  deleteItem();
}
```
- 样式无法自定义
- 用户体验差
- 功能单一

### ✅ 自定义确认对话框
```tsx
setConfirmDialog({
  isOpen: true,
  title: '删除确认',
  message: '确定要删除吗？',
  onConfirm: () => deleteItem(),
});
```
- 美观的自定义样式
- 流畅的动画效果
- 丰富的配置选项
- 更好的用户体验

## 📚 完整文档

详细文档请参考：`docs/CUSTOM_CONFIRM_DIALOG.md`
