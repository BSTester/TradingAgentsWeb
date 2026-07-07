# WS-12 UI Spec · AI 设置 + 系统默认 Provider

> 配套高保真原型：`ui-designer/prototype/index.html`
> 依据 `pm/requirements.md`、`pm/story-map.md`（Designer Handoff）。
> 本规格覆盖整个产品（不按 story 拆分），与现有 `profile` / `admin` 视觉风格保持一致（Dark Fintech 主题）。

---

## 0. 范围决策锁定（必须体现在 UI 中）

| # | 决策 | UI 体现 |
| --- | --- | --- |
| 1 | 多 Provider 多 KEY | Profile「AI 设置」是**列表**，非单表单；每个 Provider 独立 KEY / 模型 / 默认标记 |
| 2 | Profile 页「AI 设置」入口 | 作为 profile 页内新增模块（与账户信息、密码设置并列） |
| 3 | 系统默认仅兜底，不覆盖用户 | 分析表单来源提示区分「个人配置 / 系统默认」；用户有配置时不显示系统默认覆盖 |
| 4 | **管理员独立「系统默认 Provider」配置页** | admin 导航新增独立入口，与 LLM 目录管理（Provider/Model CRUD）分离 |
| 5 | API KEY 脱敏（不明文回传） | 列表/表单/分析表单均只展示 `sk-****尾号`；无「显示明文」按钮；仅临时输入可眼睛预览 |

---

## 1. 信息架构（IA）

```
个人中心 (/profile)
├─ 账户信息            （现有）
├─ 密码设置            （现有）
└─ AI 设置  ★新增模块
   ├─ 来源说明条        （个人默认 vs 系统默认兜底）
   ├─ Provider 列表
   │   ├─ 卡片：图标 / 名称 / 默认标记 / 验证状态
   │   ├─ 卡片：KEY 脱敏尾号 / Base URL / 验证时间
   │   └─ 行内操作：编辑 / 删除 / 测试连接 / 替换 KEY / 清除 KEY / 设为默认
   ├─ 新增/编辑 Provider 表单（模态或独立页）
   └─ 空状态 / 错误态

管理员后台 (/admin)
├─ 用户列表            （现有）
├─ LLM 管理            （现有，Provider/Model 目录 CRUD）
└─ 系统默认 Provider  ★新增独立页
   ├─ 当前默认摘要（非敏感）
   ├─ 从 active providers 选择
   └─ 保存前二次确认

分析表单 (/ 配置分析)
└─ 步骤 5 LLM 服务商
   ├─ 来源提示条        （个人配置 / 系统默认）
   ├─ Provider 选择（个人配置 + 系统默认）
   └─ 本次一次性 KEY（可选，不持久化）
```

### 导航入口（admin）
- 在 `AppNavbar` 用户下拉菜单中，**新增**「系统默认 Provider」项，与「LLM 管理」并列，便于管理员区分「目录维护」与「默认兜底策略」两项职责，降低误操作。
- 普通用户下拉菜单**不**出现该系统默认入口。

---

## 2. 视觉规范（与现有风格一致）

复用现有 Dark Fintech 主题变量（`web/frontend/src/app/globals.css` / `tailwind.config.js`）：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg-primary` | `#0a0e1a` | 页面底 |
| `--bg-secondary` | `#141824` | 卡片底 |
| `--bg-tertiary` | `#1a1f2e` | 输入框 / 次级面 |
| `--border-default` | `#2d3748` | 边框 |
| `--accent-primary` | `#00d4ff` | 主强调（青） |
| `--accent-secondary` | `#0066ff` | 次强调（蓝，渐变终点） |
| `--success` | `#00ff88` | 已验证 / 已保存 |
| `--danger` | `#ff3366` | 错误 / 删除 / 清除 |
| `--warning` | `#ffaa00` | 系统默认兜底提示 / 无默认警告 |

- **主按钮**：`bg-gradient-to-r from-accent-primary to-accent-secondary text-white`，hover `shadow-glow-cyan`。
- **卡片**：`bg-dark-secondary rounded-lg border border-dark-border shadow-card-dark`。
- **输入框**：`bg-dark-tertiary border border-dark-border`，focus `ring-2 ring-accent-primary`。
- **图标**：FontAwesome 6（`fas` / `fab`），与现有页面一致。
- **字体**：系统字体栈（含中文回退）。

---

## 3. 组件清单

### 3.1 Profile · AI 设置
- `AI 设置模块容器`：与账户信息、密码设置同款卡片。
- `来源说明条`（info alert）：说明默认优先级与系统默认兜底。
- `Provider 卡片`：
  - 头部：Provider 图标 + 显示名称 + 徽标（默认/已验证/验证失败）+ 行内操作（编辑、删除）。
  - 主体：KEY 脱敏尾号、Base URL、最近验证时间；操作（测试连接、替换 KEY、清除 KEY）。
  - 选中「默认」态：外边框 `border-accent-primary/50` + 浅底 `bg-accent-primary/5`。
- `新增/编辑 Provider 表单`：显示名称、Provider 类型（系统目录 / 自定义 OpenAI 兼容）、Base URL、API KEY 输入（眼睛切换）、快速/深度模型、设为默认、启用。
- `KEY 状态组件`：见 §4。
- `空状态`：虚线边框居中插画 + 引导按钮。
- `错误态`：danger alert + 失败卡片（验证失败徽标 + 重新测试 / 替换 KEY）。

### 3.2 Admin · 系统默认 Provider
- `当前默认摘要卡`：图标 + 名称 + Base URL + 模型，**仅非敏感信息**；附「KEY 不暴露」说明。
- `选择表单`：从 active providers 下拉；inactive 项禁用且置灰。
- `二次确认对话框`：展示即将设置的 provider 非敏感摘要 + 兜底语义说明。
- `无默认警告`、`inactive 拒绝态`。

### 3.3 分析表单
- `来源提示条`：个人配置（accent）= 已应用保存 KEY；系统默认（warning）= 兜底。
- `Provider 下拉`：分组「个人配置 / 系统默认 / + 新增」。
- `一次性 KEY 输入`：可选、不持久化、眼睛切换、附「仅本次生效」说明。

---

## 4. KEY 安全交互规范（核心）

**原则：已保存的 API KEY 永不明文展示，前端不持有明文。**

### 4.1 状态机（单个 Provider 的 KEY）
```
[无 KEY] --输入并保存--> [已保存·脱敏]
[已保存·脱敏] --替换 KEY--> [输入新 KEY] --保存--> [已保存·脱敏]（尾号更新）
[已保存·脱敏] --清除 KEY(二次确认)--> [无 KEY]
[已保存·脱敏] --测试连接失败--> [已保存·脱敏 + 验证失败徽标]
```

### 4.2 展示规则
- **已保存**：显示脱敏尾号 `sk-****************3aF9`（保留前缀 + 末 4 位），徽标「已保存·脱敏」+（若有）「验证通过」。
- **不提供「显示明文」按钮**。列表与卡片中绝不明文。
- **替换**：点击「替换 KEY」展开输入区（本次输入，可眼睛预览），保存后**立即重新脱敏**，不明文留存。
- **清除**：点击「清除 KEY」弹出二次确认（展示将被清除的脱敏尾号 + 影响说明），确认后回到「无 KEY」。
- **测试连接**：行内动作；成功更新「验证通过 + 时间」，失败展示 danger 说明与 detail（不含 KEY 明文）。

### 4.3 一次性 KEY（分析表单）
- 为单次请求输入，眼睛可预览（用户主动输入，非已保存数据）。
- 文案明确「仅本次生效，不覆盖/不修改已保存 KEY」。
- 留空时后端使用已保存 / 系统默认 KEY。

### 4.4 安全文案底线
- 不在日志、错误信息、列表响应中展示明文 KEY（后端职责，UI 侧只消费脱敏字段）。
- 系统默认 Provider 的 KEY 对普通用户与前端**不可见**，分析表单仅展示「系统默认」来源，不展示其 KEY 尾号。

---

## 5. 交互流

### 5.1 新增/编辑 Provider（M3）
1. 点击「新增 Provider」→ 打开表单。
2. 选择类型：系统目录（预填 Base URL/模型）或自定义（手动填 Base URL，模型可手输并在连接测试验证）。
3. 输入 API KEY（眼睛切换预览）→ 「测试连接」校验。
4. 保存 → 列表新增卡片，KEY 显示为脱敏尾号；若勾选默认则该 Provider 标记「默认」。

### 5.2 设置默认 Provider（用户侧）
- 列表中点「设为默认」→ 该卡片获得「默认」徽标，其余取消默认（单默认）。
- 来源说明条更新为指向新默认。

### 5.3 管理员设置系统默认（M4）
1. 进入「系统默认 Provider」页。
2. 查看当前默认摘要（非敏感）。
3. 从 active providers 选择新默认 → 点击「保存为系统默认」。
4. **二次确认对话框**：展示目标 provider 非敏感摘要 + 「仅兜底、不覆盖用户配置」说明。
5. 确认 → 更新默认；页面回到配置页并刷新摘要。
6. 若选择 inactive provider：下拉禁用，保存时后端拒绝并前端提示明确错误（§3.2 inactive 拒绝态）。

### 5.4 分析启动的配置解析（M5，UI 侧仅展示来源）
优先级（后端 `resolve_llm_config` 实现，前端只消费结果）：
1. 单次请求显式 KEY + provider → 来源提示「本次一次性 KEY」。
2. 用户已启用且匹配的 provider → 来源提示「个人配置「X」」。
3. 用户默认 provider → 来源提示「个人配置（默认）」。
4. 系统默认 provider → 来源提示「系统默认 Provider」。
5. 无可用配置 → **阻止启动**，展示错误态与修复入口（见 §6.3）。

**关键约束（UI 必须显式传达）**：
- 用户显式选择未配置 KEY 的 provider 时，**不**静默切换系统默认，而是报错并给出「去配置 KEY / 使用系统默认」两个明确入口。

---

## 6. 空状态 / 错误态

### 6.1 Profile AI 设置 · 空状态
- 触发：用户无任何 Provider 配置。
- 表现：虚线卡片 + 插画 + 文案「尚未配置任何 AI Provider」+「新增 Provider 配置」按钮。
- 同时提示：未配置时分析将使用系统默认兜底。

### 6.2 Profile · 连接失败
- 触发：测试连接返回非 2xx / 鉴权失败。
- 表现：danger alert 展示失败原因（不含 KEY）+ 失败卡片（验证失败徽标 + 最近失败时间 + 「重新测试 / 替换 KEY」）。
- 该 Provider 在补回有效 KEY 前不可用于分析。

### 6.3 分析表单 · 无有效配置
- 触发：所选 provider 无 KEY 且无系统默认兜底（或用户明确选择未配置项）。
- 表现：danger alert「无法启动分析：无有效 LLM 配置」+ 两个修复入口（去配置 KEY / 使用系统默认）。
- 不下拉自动替换，让用户决策。

### 6.4 Admin · 无系统默认 / inactive 拒绝
- 无默认：warning 提示「尚未设置系统默认 Provider」，引导尽快设置。
- inactive 拒绝：下拉中 inactive provider 禁用置灰；选中后保存按钮置灰/报错，文案「inactive provider 不可设为系统默认」。

---

## 7. 可访问性 / 响应式
- 复用现有 `--safe-*` 安全区与 `min-h-touch`（44px）触控目标规范。
- 表单与卡片在移动端单列堆叠，桌面端双列。
- 对话框 `role="dialog"`、`aria-modal`，ESC / 点击遮罩关闭（沿用现有 `ConfirmDialog` 行为）。
- 危险操作（清除 KEY、更改系统默认）均走二次确认，避免误触。

---

## 8. 与前后端契约的待确认点（交给 WS-13 协调）
- 用户 AI 设置 API 响应结构：`has_api_key` / `api_key_masked` / `last_validated_at` / `last_validation_status`，**无**明文 `api_key`。
- 系统默认 provider API 响应结构：非敏感摘要（名称 / Base URL / 模型），不含 KEY。
- 分析启动请求是否继续允许 `api_key` 作为单次覆盖（本规格按「允许且不持久化」设计）。
- KEY 脱敏、替换、清除的动作文案（本规格已拟定，待 Leader 确认）。
