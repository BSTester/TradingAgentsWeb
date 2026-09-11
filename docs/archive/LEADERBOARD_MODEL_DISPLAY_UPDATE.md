# 排行榜模型显示更新

## 更新内容

### 1. 只显示智能盯盘模型

**修改前**：
- 优先显示智能盯盘模型（`intraday_llm_model`）
- 如果没有，显示分析模型（`last_deep_thinker`）

**修改后**：
- **只显示**智能盯盘模型（`intraday_llm_model`）
- 如果没有配置智能盯盘模型，不显示模型标签

**原因**：
- 排行榜主要展示实时交易表现
- 智能盯盘模型才是真正用于交易决策的模型
- 分析模型与排行榜表现无关

### 2. 模型标签位置调整

**修改前**：
```
trader123
2024-11-17 • gpt-4-turbo
```
模型标签在日期旁边

**修改后**：
```
trader123  gpt-4-turbo
2024-11-17
```
模型标签在用户名旁边

**原因**：
- 更显眼，用户一眼就能看到
- 模型信息与用户名关联更紧密
- 日期信息相对次要，放在下方

## 视觉效果对比

### 修改前

```
┌─────────────────────────────────────┐
│ 1  trader123                        │
│    2024-11-17 • gpt-4-turbo         │
│                      $105,000       │
└─────────────────────────────────────┘
```

### 修改后

```
┌─────────────────────────────────────┐
│ 1  trader123  gpt-4-turbo           │
│    2024-11-17                       │
│                      $105,000       │
└─────────────────────────────────────┘
```

## 代码修改

### 后端修改

**文件**：`web/backend/routes/public_leaderboard_routes.py`

```python
# 只使用智能盯盘模型
user_data['model_name'] = config.intraday_llm_model if config.intraday_llm_model else None
```

### 前端修改

**文件**：`web/frontend/src/components/leaderboard/LeaderboardTrendChart.tsx`

```tsx
<div className="text-left flex-1">
  <div className="flex items-center gap-2 mb-1">
    <p className="text-sm font-medium text-text-primary">
      {user.username}
    </p>
    {user.model_name && (
      <span className="text-xs px-1.5 py-0.5 bg-accent-primary/10 text-accent-primary rounded border border-accent-primary/30 font-medium">
        {user.model_name}
      </span>
    )}
  </div>
  <p className="text-xs text-text-tertiary">
    {user.latest_snapshot_date}
  </p>
</div>
```

## 显示规则

### 有智能盯盘模型配置

**用户配置**：
- `intraday_llm_model`: `gpt-4-turbo`

**显示结果**：
```
trader123  gpt-4-turbo
2024-11-17
```

### 无智能盯盘模型配置

**用户配置**：
- `intraday_llm_model`: `null`
- `last_deep_thinker`: `claude-3-opus` （不显示）

**显示结果**：
```
trader123
2024-11-17
```

### 无任何配置

**用户配置**：
- 数据库中没有 UserConfig 记录

**显示结果**：
```
trader123
2024-11-17
```

## 样式细节

### 模型标签

- **位置**：用户名右侧
- **间距**：`gap-2` (0.5rem)
- **背景**：`bg-accent-primary/10` - 10%透明度的主题色
- **文字**：`text-accent-primary` - 主题色
- **边框**：`border border-accent-primary/30` - 30%透明度的边框
- **字体**：`text-xs font-medium` - 小号加粗
- **圆角**：`rounded` - 标准圆角
- **内边距**：`px-1.5 py-0.5` - 紧凑内边距

### 布局结构

```
┌─ 用户信息区域 ──────────────────────┐
│ ┌─ 第一行 ─────────────────────┐   │
│ │ 用户名  [模型标签]            │   │
│ └──────────────────────────────┘   │
│ ┌─ 第二行 ─────────────────────┐   │
│ │ 日期                          │   │
│ └──────────────────────────────┘   │
└────────────────────────────────────┘
```

## 用户体验改进

### 1. 信息层级更清晰

- **主要信息**：用户名 + 模型（第一行）
- **次要信息**：日期（第二行）
- **结果信息**：资产（右侧）

### 2. 视觉焦点

- 模型标签紧邻用户名，更容易注意到
- 颜色对比明显，一眼就能看到使用的模型
- 不需要扫描整行才能找到模型信息

### 3. 空间利用

- 第一行：用户名 + 模型标签
- 第二行：日期
- 充分利用垂直空间，避免横向拥挤

## 相关文档

- `docs/LEADERBOARD_MODEL_NAME_DISPLAY.md` - 原始实现文档
- `docs/LEADERBOARD_UI_IMPROVEMENTS.md` - UI改进文档
