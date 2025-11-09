# 暗黑主题应用指南 - 剩余页面快速更新

## 概述

核心暗黑主题系统已完成，剩余页面可以通过简单的类名替换快速应用暗黑主题。

## 🎨 核心原则

### 1. 色彩映射表

| 原有类名 | 暗黑主题类名 | 说明 |
|---------|-------------|------|
| `bg-white` | `bg-dark-secondary` | 卡片/容器背景 |
| `bg-gray-50` | `bg-dark-primary` | 页面背景 |
| `bg-gray-100` | `bg-dark-tertiary` | 输入框背景 |
| `text-gray-900` | `text-text-primary` | 主要文本 |
| `text-gray-700` | `text-text-secondary` | 次要文本 |
| `text-gray-500` | `text-text-tertiary` | 辅助文本 |
| `border-gray-300` | `border-dark-border` | 边框 |
| `bg-blue-600` | `bg-gradient-to-r from-accent-primary to-accent-secondary` | 主按钮 |

### 2. 组件模式

#### 页面容器
```jsx
// 之前
<div className="min-h-screen bg-gray-50">
  {children}
</div>

// 之后
<div className="min-h-screen bg-dark-primary">
  {children}
</div>
```

#### 卡片
```jsx
// 之前
<div className="bg-white rounded-lg shadow p-6 border border-gray-200">
  {content}
</div>

// 之后
<div className="bg-dark-secondary rounded-xl shadow-card-dark p-6 border border-dark-border hover:border-accent-primary hover:shadow-glow-cyan transition-all">
  {content}
</div>
```

#### 输入框
```jsx
// 之前
<input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />

// 之后
<input className="w-full px-4 py-2 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all" />
```

#### 按钮
```jsx
// 之前
<button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
  按钮
</button>

// 之后
<button className="px-4 py-2 bg-gradient-to-r from-accent-primary to-accent-secondary text-white rounded-lg hover:shadow-glow-cyan hover:scale-105 active:scale-95 transition-all">
  按钮
</button>
```

#### 表格
```jsx
// 之前
<table className="w-full">
  <thead className="bg-gray-50">
    <tr>
      <th className="px-4 py-3 text-left text-gray-700">标题</th>
    </tr>
  </thead>
  <tbody className="bg-white">
    <tr className="border-b border-gray-200">
      <td className="px-4 py-3 text-gray-900">内容</td>
    </tr>
  </tbody>
</table>

// 之后
<table className="w-full">
  <thead className="bg-dark-tertiary">
    <tr>
      <th className="px-4 py-3 text-left text-text-secondary border-b border-dark-border">标题</th>
    </tr>
  </thead>
  <tbody className="bg-dark-secondary">
    <tr className="border-b border-dark-border hover:bg-dark-tertiary transition-colors">
      <td className="px-4 py-3 text-text-primary">内容</td>
    </tr>
  </tbody>
</table>
```

## 📋 页面更新清单

### Dashboard 页面
**文件**: `web/frontend/src/app/dashboard/page.tsx`

**需要更新**:
1. 页面容器背景
2. AnalysisConfigForm 组件样式
3. 所有输入框和选择框
4. 提交按钮

**示例**:
```jsx
// 页面容器
<div className="min-h-screen bg-dark-primary">
  <AppNavbar user={user} onLogout={logout} />
  <div className="max-w-7xl mx-auto px-4 py-8">
    {/* 内容 */}
  </div>
</div>
```

### Analysis 详情页面
**文件**: `web/frontend/src/app/analysis/[id]/page.tsx`

**需要更新**:
1. 页面背景
2. AnalysisResults 组件
3. AnalysisLogs 组件
4. Markdown 渲染样式

**Markdown 样式**:
```css
/* 在 globals.css 中添加 */
.markdown-dark {
  @apply text-text-primary;
}

.markdown-dark h1,
.markdown-dark h2,
.markdown-dark h3 {
  @apply text-text-primary border-b border-dark-border;
}

.markdown-dark code {
  @apply bg-dark-tertiary text-accent-primary px-1 py-0.5 rounded;
}

.markdown-dark pre {
  @apply bg-dark-tertiary border border-dark-border rounded-lg p-4;
}
```

### History 页面
**文件**: `web/frontend/src/app/history/page.tsx`

**需要更新**:
1. 页面背景
2. 表格样式
3. 分页控件
4. 过滤器

### Profile 页面
**文件**: `web/frontend/src/app/profile/page.tsx`

**需要更新**:
1. 页面背景
2. 表单样式
3. 密码修改模态框

### Admin 页面
**文件**: `web/frontend/src/app/admin/users/page.tsx`

**需要更新**:
1. 页面背景
2. 用户表格
3. 操作按钮

### Scheduled Tasks 页面
**文件**: `web/frontend/src/app/scheduled-tasks/page.tsx`

**需要更新**:
1. 页面背景
2. 任务列表
3. 创建任务表单

### Intraday Trading 页面
**文件**: `web/frontend/src/app/intraday-trading/page.tsx`

**需要更新**:
1. 页面背景
2. 控制面板
3. 持仓概览
4. 决策历史

## 🔧 快速更新脚本

### 使用 VS Code 全局替换

1. **打开查找替换** (Ctrl/Cmd + Shift + H)

2. **批量替换背景色**:
```
查找: bg-white
替换: bg-dark-secondary

查找: bg-gray-50
替换: bg-dark-primary

查找: bg-gray-100
替换: bg-dark-tertiary
```

3. **批量替换文本色**:
```
查找: text-gray-900
替换: text-text-primary

查找: text-gray-700
替换: text-text-secondary

查找: text-gray-500
替换: text-text-tertiary
```

4. **批量替换边框**:
```
查找: border-gray-300
替换: border-dark-border

查找: border-gray-200
替换: border-dark-border
```

### 注意事项

⚠️ **不要全局替换以下内容**:
- 已经更新的组件（Header, Footer, Toast 等）
- 特殊的颜色类（如 `text-red-600`, `bg-green-500` 等状态颜色）
- 第三方组件库的类名

## 🎯 更新优先级

### 高优先级 (用户常用)
1. ✅ Dashboard 页面 - 新建分析
2. ✅ Analysis 详情页面 - 查看结果
3. ✅ History 页面 - 历史记录

### 中优先级
4. Profile 页面 - 个人设置
5. Scheduled Tasks 页面 - 定时任务

### 低优先级
6. Admin 页面 - 管理功能
7. Intraday Trading 页面 - 短线交易

## 📝 更新检查清单

每个页面更新后检查：

- [ ] 页面背景是暗色
- [ ] 所有文本可读（对比度足够）
- [ ] 输入框有暗色背景和青色焦点
- [ ] 按钮有渐变效果和悬停动画
- [ ] 卡片有暗色背景和边框
- [ ] 表格行有悬停效果
- [ ] 所有图标颜色正确
- [ ] 移动端布局正常
- [ ] 没有控制台错误

## 🚀 快速测试

更新后运行：
```bash
npm run dev
```

访问各个页面检查：
- 视觉效果是否正确
- 交互是否流畅
- 响应式是否正常

## 💡 提示

1. **使用 AppNavbar**: 所有内部页面都应该使用 `<AppNavbar>` 组件
2. **保持一致性**: 使用相同的间距和圆角（`rounded-xl`, `p-6` 等）
3. **添加过渡**: 所有交互元素添加 `transition-all` 或 `transition-colors`
4. **测试对比度**: 确保文本在暗色背景上清晰可读

## 📚 参考资源

- [完整实施文档](./DARK_THEME_IMPLEMENTATION.md)
- [快速启动指南](./QUICK_START.md)
- [设计文档](../.kiro/specs/dark-fintech-theme/design.md)

---

**提示**: 如果遇到问题，参考已完成的页面（首页、登录页）作为示例。
