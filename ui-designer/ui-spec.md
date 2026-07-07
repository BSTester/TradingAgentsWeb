# WS-12 UI Spec · AI 设置 + 系统默认 Provider（重做：用户 KEY 前端存储）

> 配套高保真原型：`ui-designer/prototype/index.html`
> 依据更新后的 `pm/requirements.md`、`pm/story-map.md`（Designer Handoff）。
> 本规格覆盖整个产品（不按 story 拆分），与现有 `profile` / `admin` 视觉风格一致（Dark Fintech 主题）。
>
> **本版相对首稿（PR #11）的关键变更（WS-20 触发）：用户 API KEY 改存前端 `localStorage`（按 provider 维度），后端只保存 provider 元数据，不持久化/不回传用户 KEY。** 旧稿中「后端已保存 / 脱敏尾号 / has_api_key / api_key_masked」等概念已全部移除。管理员「系统默认 Provider」页不变（其 KEY 仍由后端保存、不外泄）。

---

## 0. 范围决策锁定（必须体现在 UI 中）

| # | 决策 | UI 体现 |
| --- | --- | --- |
| 1 | 多 Provider 多 KEY | Profile「AI 设置」是**列表**，每个 Provider 独立 KEY / 模型 / 默认标记 |
| 2 | Profile 页「AI 设置」入口 | 作为 profile 页内新增模块（与账户信息、密码设置并列） |
| 3 | 系统默认仅兜底，不覆盖用户 | 分析表单来源提示区分「个人配置 / 系统默认」；用户有 KEY 时不显示系统默认覆盖 |
| 4 | **管理员独立「系统默认 Provider」配置页** | admin 导航新增独立入口，与 LLM 目录管理（Provider/Model CRUD）分离；其 KEY 后端保存、前端不可见 |
| 5 | **用户 KEY 前端存储（localStorage）** | 用户 KEY 仅存浏览器本地，不进后端；UI 体现「本浏览器已保存 / 换浏览器需重填 / 不在后端回传」 |

---

## 1. 信息架构（IA）

```
个人中心 (/profile)
├─ 账户信息            （现有）
├─ 密码设置            （现有）
└─ AI 设置  ★新增模块
   ├─ 说明条：用户 KEY 仅存本浏览器，换浏览器需重填
   ├─ Provider 列表
   │   ├─ 卡片：图标 / 名称 / 默认标记 / 验证状态
   │   ├─ 卡片：本浏览器 KEY 状态（已保存 localStorage / 本浏览器无 KEY）
   │   └─ 行内操作：编辑 / 删除 / 查看·编辑 KEY / 测试连接 / 清除 KEY / 设为默认
   ├─ 新增/编辑 Provider 表单（modal 或独立页）
   ├─ 换浏览器未存 KEY 提示 + 内嵌填写
   └─ 空状态 / 错误态

管理员后台 (/admin)
├─ 用户列表            （现有）
├─ LLM 管理            （现有，Provider/Model 目录 CRUD）
└─ 系统默认 Provider  ★新增独立页（与首稿一致，未变）
   ├─ 当前默认摘要（非敏感）
   ├─ 从 active providers 选择
   └─ 保存前二次确认

分析表单 (/ 配置分析)
└─ 步骤 5 LLM 服务商
   ├─ 来源提示条（个人配置·本地 KEY / 系统默认）
   ├─ Provider 选择（个人配置 + 系统默认）
   └─ 本次一次性 KEY（可选，不持久化）
```

### 导航入口（admin）
- 在 `AppNavbar` 用户下拉菜单中新增「系统默认 Provider」项，与「LLM 管理」并列（同首稿，未变）。
- 普通用户下拉菜单不出现该系统默认入口。
- Profile「AI 设置」入口同首稿，置于 profile 页模块内。

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
| `--success` | `#00ff88` | 已验证 / 本浏览器已保存 |
| `--danger` | `#ff3366` | 错误 / 删除 / 清除 |
| `--warning` | `#ffaa00` | 系统默认兜底提示 / 本浏览器无 KEY 警告 |

- **主按钮**：`bg-gradient-to-r from-accent-primary to-accent-secondary text-white`，hover `shadow-glow-cyan`。
- **卡片**：`bg-dark-secondary rounded-lg border border-dark-border shadow-card-dark`。
- **输入框**：`bg-dark-tertiary border border-dark-border`，focus `ring-2 ring-accent-primary`。
- **图标**：FontAwesome 6（`fas` / `fab`）。
- **字体**：系统字体栈（含中文回退）。

---

## 3. 组件清单

### 3.1 Profile · AI 设置
- `AI 设置模块容器`：与账户信息、密码设置同款卡片。
- `说明条`（info alert）：用户 KEY 仅存本浏览器；换浏览器/清缓存需重填。
- `Provider 卡片`：
  - 头部：Provider 图标 + 显示名称 + 徽标（默认/已验证/验证失败）+ 行内操作（编辑、删除）。
  - 主体：本浏览器 KEY 状态（「本浏览器已保存 KEY」徽标 或 「本浏览器无 KEY」警告）、Base URL、最近验证时间；操作（查看·编辑 KEY、测试连接、清除 KEY）。
  - 「默认」态：外边框 `border-accent-primary/50` + 浅底 `bg-accent-primary/5`。
- `新增/编辑 Provider 表单`：显示名称、Provider 类型（系统目录 / 自定义 OpenAI 兼容）、Base URL、API KEY 输入（保存到本浏览器，眼睛切换）、快速/深度模型、设为默认、启用。
- `本地 KEY 状态组件`：见 §4。
- `换浏览器未存 KEY 提示`：warning alert + 卡片内嵌「在本浏览器填写 KEY」输入。
- `空状态`：虚线边框居中插画 + 引导按钮。
- `错误态`：danger alert + 失败卡片（验证失败徽标 + 重新测试 / 替换 KEY）。

### 3.2 Admin · 系统默认 Provider（同首稿，未变）
- `当前默认摘要卡`：图标 + 名称 + Base URL + 模型，**仅非敏感信息**；附「KEY 不暴露」说明（其 KEY 后端保存）。
- `选择表单`：从 active providers 下拉；inactive 项禁用且置灰。
- `二次确认对话框`：展示即将设置的 provider 非敏感摘要 + 兜底语义说明。
- `无默认警告`、`inactive 拒绝态`。

### 3.3 分析表单
- `来源提示条`：个人配置（本地 KEY）= 前端从 localStorage 取 KEY 随请求下发；系统默认（warning）= 兜底。
- `Provider 下拉`：分组「个人配置 / 系统默认 / + 新增」。
- `一次性 KEY 输入`：可选、不持久化、眼睛切换、附「仅本次生效」说明；明确保存才写入 localStorage。

---

## 4. 用户 KEY 本地存储交互规范（核心）

**原则：用户 API KEY 仅存前端 `localStorage`（按 provider），不进后端、不回传、不在后端响应中出现。** 系统默认 Provider 的 KEY 仍后端保存、前端不可见。

### 4.1 状态机（单个 Provider 的 KEY，前端视角）
```
[本浏览器无 KEY] --输入并保存到 localStorage--> [本浏览器已保存]
[本浏览器已保存] --编辑输入并保存--> [本浏览器已保存]（值更新）
[本浏览器已保存] --清除 KEY(二次确认)--> [本浏览器无 KEY]
[本浏览器已保存] --测试连接失败--> [本浏览器已保存 + 验证失败徽标]
[本浏览器已保存] --换浏览器/清缓存/无痕--> [本浏览器无 KEY]（需重填）
```

### 4.2 展示与编辑规则
- **本浏览器已保存**：显示「本浏览器已保存 KEY」徽标（`localStorage` 标识）+ 可选的 KEY 输入框（password 型，眼睛按钮仅**在当前浏览器**预览明文）。说明「换浏览器需重填」。
- **无「脱敏尾号 / 后端已保存」概念**：不再展示 `sk-****尾号`，因为 KEY 本就在本机；眼睛预览是本地行为，不触达后端。
- **替换/编辑**：直接编辑输入框并「保存到本浏览器」；仅覆盖本机该 provider 的 KEY，不影响后端与其他浏览器。
- **清除**：二次确认「确认清除本浏览器的 API KEY？」→ 移除 localStorage 中该 provider KEY；提示「清除后本浏览器分析该 provider 时需重填或切换系统默认」。
- **迁移旧 KEY**：若用户仅有旧 `UserConfig.last_api_key`，首次访问 AI 设置时提示**在当前浏览器重新保存 KEY 到 localStorage**（不在后端新增用户密钥表，也不把旧 KEY 迁移到后端）。

### 4.3 测试连接
- 行内动作：前端把本浏览器 KEY 临时随请求下发到 `/api/user/llm-settings/providers/{id}/test`；后端**只返回验证结果与 `last_validated_at` / `last_validation_status`，不持久化该 KEY**。
- 成功 → 更新「验证通过 + 时间」；失败 → danger 说明与 detail（不含 KEY 明文）。

### 4.4 一次性 KEY（分析表单）
- 为单次请求输入，眼睛可预览（用户主动输入）。
- 文案明确「仅本次生效；只有明确保存时才写入本浏览器 localStorage」。
- 留空时：用户个人 provider 走 localStorage KEY；否则后端用系统默认兜底。

### 4.5 安全底线（前端视角）
- 用户 KEY 不明文出现在：后端数据库、日志、错误信息、用户配置 API 响应、分析/定时任务记录明文。
- 来源提示与分析记录中**不展示明文 KEY**，只标注「个人配置（本地 KEY）/ 系统默认」来源。
- 系统默认 KEY 对普通用户与前端**不可见**；分析表单仅展示「系统默认」来源，不展示其 KEY 值。
- 不在前端把用户 KEY 写入可被轻易读取的其它位置（如 URL、第三方脚本）。

---

## 5. 交互流

### 5.1 新增/编辑 Provider（M3）
1. 点击「新增 Provider」→ 打开表单。
2. 选择类型：系统目录（预填 Base URL/模型）或自定义（手动填 Base URL，模型可手输并在连接测试验证）。
3. 输入 API KEY（眼睛切换预览）→「测试连接」校验（前端临时下发，后端不落库）。
4. 保存 → provider 元数据存后端，KEY 存本浏览器 localStorage；列表新增卡片，KEY 标记为「本浏览器已保存」。

### 5.2 设置默认 Provider（用户侧）
- 列表中点「设为默认」→ 该卡片获得「默认」徽标，其余取消默认（单默认）。

### 5.3 管理员设置系统默认（M4，同首稿）
1. 进入「系统默认 Provider」页 → 查看当前默认非敏感摘要。
2. 从 active providers 选择 →「保存为系统默认」→ **二次确认**对话框（目标 provider 非敏感摘要 + 兜底语义）。
3. 确认 → 更新默认；回到配置页刷新摘要。
4. inactive provider：下拉禁用，保存时后端拒绝并前端明确报错。

### 5.4 分析启动的配置解析（M5，UI 侧展示来源）
优先级（后端 `resolve_llm_config` 实现，前端只消费结果）：
1. 请求级 KEY（前端从 `localStorage` 或一次性输入下发）+ provider/base URL/model → 来源「个人配置（本地 KEY）」。
2. 用户个人 provider 但本浏览器无 KEY → **不**静默用系统默认；展示错误「本浏览器未保存该 Provider 的 KEY」，给出「在本浏览器填写 KEY / 使用系统默认」入口。
3. 系统默认 provider（后端配置兜底）→ 来源「系统默认 Provider」。
4. 无可用配置 → 阻止启动，错误态 + 修复入口。

**关键约束（UI 必须显式传达）**：
- 用户显式选择未配置 KEY 的 provider 时，不静默切换系统默认。
- 来源提示明确标注 KEY 来自「本浏览器（localStorage）」还是「系统默认（后端）」，避免语义混淆。

---

## 6. 空状态 / 错误态

### 6.1 Profile AI 设置 · 空状态
- 触发：用户无任何 Provider 配置。
- 表现：虚线卡片 + 插画 +「尚未配置任何 AI Provider」+ 引导按钮；提示未配置时分析将用系统默认兜底。

### 6.2 换浏览器未存 KEY（★本版新增核心态）
- 触发：provider 元数据存在，但**当前浏览器** localStorage 无该 provider KEY（换浏览器/清缓存/无痕）。
- 表现：warning alert「当前浏览器未保存该 Provider 的 KEY」+ 卡片内嵌「在本浏览器填写 KEY」输入 + 提示「仅保存到本机，不同步其他设备」。

### 6.3 Profile · 连接失败
- 触发：测试连接返回非 2xx / 鉴权失败。
- 表现：danger alert（不含 KEY）+ 失败卡片（验证失败徽标 + 最近失败时间 + 重新测试 / 替换 KEY）。
- 该 Provider 在补回有效 KEY 前不可用于分析。

### 6.4 分析表单 · 本浏览器未存 KEY
- 触发：所选个人 provider 在本浏览器无 KEY，且无系统默认兜底（或用户拒绝切换）。
- 表现：danger alert「无法启动分析：本浏览器未保存该 Provider 的 KEY」+ 两个修复入口（在本浏览器填写 KEY / 使用系统默认）；若无系统默认则必须本机补填。
- 不下拉自动替换，让用户决策。

### 6.5 Admin · 无系统默认 / inactive 拒绝
- 无默认：warning 提示「尚未设置系统默认 Provider」，引导尽快设置。
- inactive 拒绝：下拉中 inactive provider 禁用置灰；选中后保存按钮置灰/报错。

---

## 7. 可访问性 / 响应式
- 复用现有 `--safe-*` 安全区与 `min-h-touch`（44px）触控目标规范。
- 表单与卡片移动端单列堆叠，桌面端双列。
- 对话框 `role="dialog"`、`aria-modal`，ESC / 点击遮罩关闭（沿用现有 `ConfirmDialog`）。
- 危险操作（清除 KEY、更改系统默认）均走二次确认，避免误触。

---

## 8. 与前后端契约的待确认点（交给 WS-13 协调）
- 用户 AI 设置 API（`GET /api/user/llm-settings` 等）**不包含** `has_api_key` / `api_key_masked` / 明文 KEY 字段——只保存 provider 元数据。
- `/api/user/llm-settings/providers/{id}/test` 由前端临时传入 KEY，后端只返回验证结果与 `last_validated_at` / `last_validation_status`，不持久化。
- 分析启动请求：前端从 localStorage 或一次性输入取 KEY 随请求下发；是否继续允许 `api_key` 作为单次覆盖（本规格按「允许且不持久化，明确保存才写 localStorage」设计）。
- localStorage key 命名规范（按 provider 维度，建议 `ta_user_llm_key_<provider_id>`）与加密/防 XSS 读取策略（前端约定，非后端）。

---

## 9. 相对首稿（PR #11）的差异摘要
- 移除：脱敏尾号展示、后端「已保存/已验证」语义、`has_api_key`/`api_key_masked` 字段引用、替换后立即重新脱敏的描述。
- 新增：本浏览器已保存（localStorage）徽标、眼睛预览仅本机、换浏览器/清缓存需重填提示态与空态、清除 KEY 明确「仅当前浏览器」、迁移旧 KEY 指引。
- 不变：管理员「系统默认 Provider」独立页与二次确认、来源提示框架（措辞改为「本地 KEY / 系统默认」）、整体视觉与 IA 结构。
