# 前端技术方案（Frontend Tech Spec）

> Issue: **WS-18** / `[story-001·前端]` — API 契约 + 前端技术方案
> 协作者：前端开发工程师（Agent `1381815f-…`）
> 关联契约：[`web/frontend/api-contract.md`](./api-contract.md)
> 关联需求：`pm/requirements.md` §3/§6（M2–M5）、`pm/story-map.md`
> 状态：**方案稿（DRAFT）** —— 供 stage-2 各 story（WS-14/WS-15/WS-16/WS-17）前端实现直接落地；本期**只产出契约与方案，不改应用代码**。

---

## 1. 范围

本期交付两份文档（`api-contract.md` + 本文件），覆盖三处前端改造的设计：

| 模块 | 需求 | 落地 Story |
| --- | --- | --- |
| M3 Profile「AI 设置」模块 | 用户管理多 provider 配置 | WS-14 |
| M4 独立管理员「系统默认 Provider」配置页 | 管理员设置系统默认 | WS-15 |
| M5 `AnalysisConfigForm` 改造 | 加载有效配置、来源展示、不回填明文 KEY | WS-16 |

---

## 2. 技术栈与目录约定

### 2.1 现状（以仓库实际为准）
- 框架：**Next.js App Router + React + TypeScript**。
- 数据请求：`web/frontend/src/lib/apiClient.ts`（`axios` 实例 `apiClient`，自动带 `Authorization`）+ TanStack Query（`@tanstack/react-query`，见 `app/admin/llm-config/page.tsx`）。
- UI：仓库现有代码使用 **Tailwind + 自定义暗色主题原语**（`bg-dark-secondary`、`text-text-primary`、`accent-primary` 等）+ 自建组件（`AppNavbar`、`Toast`/`useToast`、`ConfirmDialog`）。**注意：这与此 runtime 的「MUST use Ant Design」规则不一致**（见 §9 协调待确认）。本方案默认沿用仓库现有 Tailwind 暗色体系，以保证与全站视觉/组件一致，新模块复用 `AppNavbar` / `ConfirmDialog` / `useToast` 等既有组件。

### 2.2 目录约定
新增文件统一落在 `web/frontend/src` 下：

```
app/
  profile/
    page.tsx                 # 现有：新增「AI 设置」入口卡片
    ai-settings/page.tsx     # 新增：AI 设置独立子视图（见 §3）
  admin/
    llm-config/page.tsx      # 现有（不动）
    system-default-provider/page.tsx   # 新增：M4 独立页
components/
  profile/
    AISettingsCard.tsx       # 入口卡片（profile 页内）
    ProviderList.tsx         # provider 配置列表
    ProviderFormDrawer.tsx   # 新增/编辑抽屉（含 KEY 三态）
    ProviderItem.tsx         # 单条配置（默认标记/测试/删除）
  admin/
    llm-config/...           # 现有（不动）
    system-default-provider/
      SystemDefaultForm.tsx  # 选择 active provider + 二次确认 + 当前摘要
hooks/
  useUserLLMSettings.ts      # 新增：用户 AI 设置（react-query 封装 E1–E5）
lib/
  apiClient.ts               # 新增 llmSettingsAPI / adminDefaultProviderAPI
  types.ts                   # 新增契约类型（见 api-contract.md §2–§10）
```

---

## 3. 状态管理、路由 与 `useUserConfig` 的关系

### 3.1 两个关注点分离（关键）
- **分析缓存（旧）**：`useUserConfig` 继续管理 `last_ticker / last_analysts / last_research_depth / last_llm_provider / last_api_key` 等「上次分析偏好」，仅作迁移/兼容来源（`pm/requirements.md` §5、§6 M5）。**不得**在其中新增/保留明文 KEY 读取。
- **用户 AI 设置（新）**：新增 `useUserLLMSettings`（基于 TanStack Query，对齐 `app/admin/llm-config/page.tsx` 的用法），封装 `llmSettingsAPI` 的 `getSettings / createProvider / updateProvider / deleteProvider / testProvider`，并维护 `queryKey: ['user','llm-settings']` 缓存。

> 二者解耦：AI 设置模块只依赖 `useUserLLMSettings`；分析表单同时消费两者（见 §5）。避免把 provider KEY 管理混入 `useUserConfig` 的明文字段，防止 KEY 明文回传风险扩大。

### 3.2 路由
- **Profile AI 设置**：在 `/profile` 现有「账户信息 / 密码设置」两张卡片下方新增「AI 设置」卡片（`AISettingsCard`），点击「管理」跳转到新增子路由 **`/profile/ai-settings`**（由 profile 入口进入的独立设置视图，符合 `pm/requirements.md` M3 的二选一）。不新增顶层导航。
- **管理员系统默认 Provider**：新增独立路由 **`/admin/system-default-provider`**，在 `AppNavbar` 的 admin 菜单中新增一项（位于现有 `/admin/llm-config` 之下，参考 `AppNavbar.tsx` 第 211/388 行的 `/admin/llm-config` 入口写法）。**不**集成进现有 `llm-config` 页（需求 M4 明确要求独立页）。

### 3.3 全局状态
- 不引入 Redux/Zustand。明文 KEY 不进入任何跨页面 state；仅存在于表单局部 `useState`，提交后立即 `setApiKey('')` 清空（强制约束见 `api-contract.md` §12）。
- 系统默认摘要通过 `/api/config` 的 `system_default` 字段进入分析表单的「来源」展示（react-query `['app','config']`）。

---

## 4. M3 Profile「AI 设置」模块

### 4.1 信息架构（IA）
```
个人中心 /profile
└─ 卡片：AI 设置（AISettingsCard）
   ├─ 摘要：已保存 N 个 provider，默认：<display_name>
   ├─ 按钮：管理 → /profile/ai-settings
                │
/profile/ai-settings
├─ 页头：AI 设置
├─ [迁移提示条] 仅当 has_legacy_config=true：
│   「检测到旧版 API KEY 缓存，建议迁移为 provider 配置」[立即迁移][暂不]
├─ ProviderList（ProviderItem[]）
│   ├─ 每项：display_name · provider_name · base_url
│   │       标签：默认 / 已启用 / 已验证(时间) / KEY 状态(已保存尾号 | 未保存)
│   │       操作：设为默认 / 编辑 / 测试连接 / 删除
│   └─ 空态：暂无 provider，[新增 provider]
└─ 按钮：+ 新增 provider → ProviderFormDrawer
```

### 4.2 组件拆分
- **`AISettingsCard`**：profile 页内入口；调用 `useUserLLMSettings` 读取 `default_provider_id` 与计数做摘要。
- **`ProviderList` / `ProviderItem`**：列表渲染；`ProviderItem` 承载「设为默认 / 编辑 / 测试连接 / 删除」四个动作。`删除` 复用 `ConfirmDialog`（对齐现有 `admin/llm-config` 的删除确认）。`设为默认` 调 `updateProvider(id,{is_default:true})`。
- **`ProviderFormDrawer`**（抽屉/模态）：新增与编辑共用，字段：
  - `provider_name`（从 `/api/config` 的 `llm_providers` 选择；自定义 provider 允许手填）
  - `display_name`、`base_url`
  - `shallow_model` / `deep_model`（模型可从所选 provider 的 `models` 选，自定义 provider 允许手填 —— 需求 §10 风险：自定义模型未知 → 允许手动输入并在测试连接验证）
  - `is_enabled` 开关
  - `is_default` 开关（新增时）
  - **API KEY 输入区（KEY 三态，见下）**

### 4.3 KEY 已保存 / 替换 / 清除 交互态（核心）
表单 KEY 区根据「当前配置是否已保存 KEY」呈现三态，对应契约 `api-contract.md` §3/§5：

| 状态 | 表现 | 提交语义 |
| --- | --- | --- |
| **未保存 KEY** | 显示明文输入框 +「测试连接」+「保存」 | `POST` 创建带 `api_key`（一次性） |
| **已保存 KEY** | 隐藏输入框，显示「已保存（尾号 `api_key_masked`）」+「替换 KEY」+「清除 KEY」 | 不传 `api_key` |
| **替换 KEY** | 点击「替换 KEY」→ 展开输入框，输入新值 | `PATCH` `api_key: <新明文>`（一次性） |
| **清除 KEY** | 点击「清除 KEY」→ `ConfirmDialog` 确认 | `PATCH` `api_key: null` |

交互约束：
- 保存/替换成功后，输入框立刻清空并回到「已保存」态；**绝不**把明文回显到输入框（契约 §12.4）。
- 明文 KEY 仅在 `ProviderFormDrawer` 局部 `useState`，关闭抽屉或提交后立即清空。
- 「测试连接」使用表单当前 `base_url` +（若有）刚输入的明文 `api_key`，调 `E5`，结果只更新「已验证/失败 + 时间」状态，不持久化 KEY（契约 §7）。

---

## 5. M4 独立管理员「系统默认 Provider」配置页

### 5.1 信息架构（IA）
```
/admin/system-default-provider
├─ 页头：系统默认 Provider
├─ 当前默认摘要（SystemDefaultProviderSummary）
│   display_name · provider_name · base_url · KEY 状态(已保存尾号/未保存) · 是否 active
│   （无默认时显示「尚未设置系统默认 Provider」）
├─ 表单 SystemDefaultForm
│   ├─ 选择器：从 active providers 中选择（调 GET /api/admin/llm/providers?include_inactive=true 过滤 is_active）
│   │   —— 仅允许选 active；inactive 在选项中禁用并提示「需先在 LLM 配置启用」
│   ├─ [保存] → 触发二次确认 ConfirmDialog
│   └─ 二次确认文案：「将 <display_name> 设为系统默认 Provider，所有未配置个人 provider 的用户将使用它兜底。确认？」
└─ 辅助入口：[前往 LLM 配置管理] → /admin/llm-config（需求 §10：降低割裂）
```

### 5.2 组件拆分
- **`SystemDefaultForm`**：`useQuery` 拉取 active providers（复用 `AppNavbar`/admin 现有 `fetch('/api/admin/llm/providers?include_inactive=true')` 模式），渲染 `<select>`（inactive 项 `disabled`）。
- **二次确认**：复用现有 `ConfirmDialog` 组件（与 `admin/llm-config` 删除确认同源），确认后再调 `adminDefaultProviderAPI.setSystemDefault({provider_id})`（契约 E7）。
- **当前默认摘要**：进入页面时从 `/api/config` 的 `system_default` 读取并展示非敏感摘要；设置成功后 `invalidateQueries(['app','config'])` 刷新。

### 5.3 安全约束
- 普通用户永不可见系统默认 provider 明文 KEY（摘要仅 `has_api_key`/`api_key_masked`，契约 §8/§9）。
- inactive provider 设为默认：前端禁用选项 + 后端 400 双保险（`pm/requirements.md` M4）。

---

## 6. M5 `AnalysisConfigForm` 改造

现有 `components/analysis/AnalysisConfigForm.tsx`（约 1130 行）目前用 `useUserConfig` 回填 `last_api_key` 明文到 `formData.api_key`（第 135 行），并据此 `setApiKeyValidated(true)`（第 145–148 行）。改造要点：

### 6.1 加载「有效 LLM 配置」（不回填 KEY）
- 保留 `useUserConfig` 用于加载 `last_ticker / last_analysts / last_research_depth`（向后兼容缓存）。
- 新增：从 `useUserLLMSettings` 取用户默认 provider（或第一个 `is_enabled` provider）的 `provider_name / shallow_model / deep_model`，**预选**表单的 `llm_provider / shallow_thinker / deep_thinker`。
- 若用户无配置，从 `/api/config` 的 `system_default` 预选系统默认（展示「来源：系统默认」）。
- **禁止**把已保存 KEY 写入 `formData.api_key`（删除第 135 行回填；删除第 145–148 行基于 `last_api_key` 的「已验证」逻辑）。

### 6.2 来源展示（个人配置 / 系统默认）
在「LLM 服务商」区块顶部新增一行来源提示（需求 §10 风险：避免语义混淆）：
- 预选来自用户默认 → 「来源：个人配置 · <display_name>」
- 预选来自系统默认 → 「来源：系统默认 Provider · <display_name>」
- 用户手动改选 → 来源标签随之更新；若改选到一个**未配置 KEY 的 provider**，不再静默回退系统默认，而是提示「该 provider 无已保存 KEY，请补充或切回默认」（契约 §11）。

### 6.3 一次性 KEY 语义
- 用户若想用一次性 KEY：在 API Key 输入框重新输入 → 调 `validateKey`（`/api/validate-key`，现有 `analysisAPI.validateKey`）→ 仅本次请求带 `api_key`（契约 §10）。
- 提交时：仅当 `formData.api_key` 非空才放入 `requestData.api_key`（现有逻辑第 474–476 行已满足），且**不**把该值写回 `useUserConfig`/任何持久态（现有 `confirmStartAnalysis` 已不回写，保持不变）。
- `api_key` 明文不进 `localStorage`、不进全局 state（契约 §12）。

### 6.4 兼容
- 旧 `last_llm_provider / last_backend_url / last_api_key` 仍用于「上次分析偏好」回填（ticker/analysts/depth），不与新 provider KEY 管理错配。
- 富途 API（`futu_api_*`）逻辑保持不变（属交易执行，非本方案范围）。

---

## 7. 组件 / 状态 / 路由 总览

| 新增/改动 | 类型 | 状态来源 | 路由/位置 |
| --- | --- | --- | --- |
| `useUserLLMSettings` | hook (react-query) | `llmSettingsAPI` (E1–E5) | — |
| `AISettingsCard` | 组件 | `useUserLLMSettings` | `/profile` 卡片 |
| `ai-settings/page.tsx` | 页面 | `useUserLLMSettings` | `/profile/ai-settings` |
| `ProviderList` / `ProviderItem` | 组件 | `useUserLLMSettings` | ai-settings 页 |
| `ProviderFormDrawer` | 组件 | 局部 useState（KEY 三态） | ai-settings 页（抽屉） |
| `system-default-provider/page.tsx` | 页面 | `adminDefaultProviderAPI` + `/api/config` | `/admin/system-default-provider` |
| `SystemDefaultForm` | 组件 | `['admin','llm-providers']` + 二次确认 | 系统默认页 |
| `AnalysisConfigForm` | 改动 | `useUserLLMSettings` + `/api/config` | 现有分析页（§6） |
| `AppNavbar` admin 菜单 | 改动 | — | 新增系统默认入口 |

---

## 8. 可访问性（a11y）与性能基线
- **a11y**：KEY 输入框配 `<label>` 与 `aria-label`；「清除/替换」操作为真实 `<button>` 且带可访问名称；`ConfirmDialog` 焦点陷阱与 `Esc` 关闭（沿用现有 `ConfirmDialog`）；来源提示用 `role="status"` 或 `aria-live="polite"`，便于屏幕阅读器感知「个人配置/系统默认」切换。
- **性能**：用户 AI 设置列表加载目标 < 500ms，且用 react-query 缓存 `['user','llm-settings']`，不阻塞 profile 其他信息渲染（需求 §9）；系统默认摘要随 `/api/config` 一并缓存；明文 KEY 不进任何可缓存前端存储。

---

## 9. 协调待确认（需 Leader / 后端 WS-13 拍板）
1. **UI 技术栈**：本 runtime 规则要求「MUST use React + Ant Design」，但仓库实际为 **Tailwind + 自定义暗色组件**，全站未引入 Ant Design。本方案默认沿用仓库现有 Tailwind 体系以保证一致性；若 Leader 要求统一迁移到 Ant Design，需在协调步骤明确并评估对现有页面的影响。
2. **系统默认端点形态**：本方案采用 `PUT /api/admin/llm/system-default`；若后端选择复用 `PATCH /api/admin/llm/providers/{id}` 的 `is_default`，前端相应调整（见 `api-contract.md` §14.3）。
3. **`/api/config` 是否追加 `system_default`**：需在现有 `get_config` 补充或另出端点（见 `api-contract.md` §14.4）。
4. **用户 provider 配置主键类型**（`string` vs `number`）、`has_legacy_config` 是否由后端返回（见 `api-contract.md` §14.2/§14.5）。
5. 上述字段最终以 WS-13 落地后的 `backend/openapi.yaml` 为准，本文档与其冲突处以后者优先，并回流更新本方案。
