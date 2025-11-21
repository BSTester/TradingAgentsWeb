# LLM 配置管理组件

## 组件列表

### 1. ConfirmDialog - 自定义确认对话框

美观的自定义确认对话框，用于替代系统 `confirm()` 函数。

#### 特性

- ✨ 现代化设计，与应用主题一致
- 🎨 自定义图标和颜色
- 📱 响应式布局
- 🌊 背景模糊效果
- ⌨️ 键盘支持（ESC 取消）
- 🔒 点击背景关闭

#### 使用示例

```tsx
import { ConfirmDialog } from '@/components/admin/llm-config/ConfirmDialog';

// 在组件中定义状态
const [confirmDialog, setConfirmDialog] = useState({
  isOpen: false,
  title: '',
  message: '',
  onConfirm: () => {},
});

// 显示确认对话框
const handleDelete = (item: any) => {
  setConfirmDialog({
    isOpen: true,
    title: '删除确认',
    message: `确定要删除 "${item.name}" 吗？\n\n此操作无法撤销。`,
    onConfirm: () => {
      // 执行删除操作
      deleteItem(item.id);
    },
  });
};

// 渲染对话框
<ConfirmDialog
  isOpen={confirmDialog.isOpen}
  title={confirmDialog.title}
  message={confirmDialog.message}
  onConfirm={confirmDialog.onConfirm}
  onCancel={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
  confirmText="删除" // 可选，默认"确定"
  cancelText="取消" // 可选，默认"取消"
  icon="fa-trash" // 可选，默认"fa-exclamation-triangle"
  iconColor="text-danger-500" // 可选
  confirmButtonClass="bg-danger-500 hover:bg-danger-600" // 可选
/>
```

#### Props

| 属性 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `isOpen` | `boolean` | ✅ | - | 是否显示对话框 |
| `title` | `string` | ✅ | - | 对话框标题 |
| `message` | `string` | ✅ | - | 对话框内容（支持 `\n` 换行） |
| `onConfirm` | `() => void` | ✅ | - | 确认回调 |
| `onCancel` | `() => void` | ✅ | - | 取消回调 |
| `confirmText` | `string` | ❌ | `'确定'` | 确认按钮文本 |
| `cancelText` | `string` | ❌ | `'取消'` | 取消按钮文本 |
| `confirmButtonClass` | `string` | ❌ | `'bg-danger-500 hover:bg-danger-600'` | 确认按钮样式 |
| `icon` | `string` | ❌ | `'fa-exclamation-triangle'` | FontAwesome 图标类名 |
| `iconColor` | `string` | ❌ | `'text-danger-500'` | 图标颜色类名 |

#### 预设场景

##### 删除供应商（危险操作）
```tsx
setConfirmDialog({
  isOpen: true,
  title: '删除供应商',
  message: `确定要删除供应商 "${provider.display_name}" 吗？\n\n⚠️ 警告：这将同时删除该供应商下的所有模型！`,
  onConfirm: () => deleteProvider(provider.id),
});
```

##### 删除模型（普通操作）
```tsx
setConfirmDialog({
  isOpen: true,
  title: '删除模型',
  message: `确定要删除模型 "${model.display_name}" 吗？\n\n此操作无法撤销。`,
  onConfirm: () => deleteModel(model.id),
});
```

##### 保存确认（成功样式）
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
/>
```

### 2. ProviderList - 供应商列表

卡片式展示 LLM 供应商列表。

### 3. ModelList - 模型列表

表格式展示 LLM 模型列表。

### 4. ProviderForm - 供应商表单

供应商创建/编辑表单（模态框）。

### 5. ModelForm - 模型表单

模型创建/编辑表单（模态框）。

## 设计原则

1. **一致性**: 所有组件使用统一的设计语言和颜色系统
2. **可访问性**: 支持键盘操作，清晰的视觉层次
3. **响应式**: 适配不同屏幕尺寸
4. **用户友好**: 清晰的提示信息，明确的操作反馈

## 样式系统

使用 Tailwind CSS 和项目的自定义主题：

- **主色调**: `accent-primary`, `accent-secondary`
- **深色背景**: `dark-primary`, `dark-secondary`, `dark-tertiary`
- **文本颜色**: `text-primary`, `text-secondary`, `text-muted`
- **状态颜色**: `success-500`, `danger-500`, `warning-500`
