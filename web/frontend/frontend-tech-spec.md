# 前端技术方案（Frontend Tech Spec）— WS-20 Rework 版

> Issue: **WS-18** / `[story-001·前端]` — API 契约 + 前端技术方案（rework）
> 协作者：前端开发工程师（Agent `1381815f-…`）
> 关联契约：[`web/frontend/api-contract.md`](./api-contract.md)（rework 版）
> 关联需求：`pm/requirements.md` §3/§6(M2–M5)/§7/§9（WS-20 更新）、`pm/story-map.md`、`pm/stories/story-001/002/004`
> 状态：**方案稿（DRAFT，WS-20 重做版）** —— 供 stage-2（WS-14/15/16/17）前端实现直接落地；本期**只产出契约与方案，不改应用代码**。

## 0. 重大模型变更（相对初版）

WS-20 用户追加决策：**用户 API KEY 存前端 `localStorage`（按 `用户 + provider` 维度），后端只保存 provider 元数据、不持久化/不回填用户 KEY**。系统默认 provider 的 KEY 仍后端保存，但前端契约按 openapi **不暴露任何 KEY 状态（含脱敏尾号）**：普通用户公开摘要仅非敏感元数据，管理员摘要仅 `credential_configured: boolean`（见 `api-contract.md` §9 / §10）。

由此带来的方案反转：
- 用户 AI 设置 API 与组件**不再处理脱敏回传**；KEY 的保存/替换/清除是**纯前端 `localStorage` 操作**。
- 分析表单**不从后端加载用户 KEY**，只在构造请求时从 `localStorage` 取本地 KEY 随请求下发。
- 新增本地 KEY 管理模块（`useLocalLLMKeys`）。

---

## 1. 范围

| 模块 | 需求 | 落地 Story |
| --- | --- | --- |
| M3 Profile「AI 设置」模块 | 用户管理 provider 元数据 + **本地 KEY 保存/替换/清除 + 换浏览器重填提示** | WS-14 |
| M4 独立管理员「系统默认 Provider」配置页 | 管理员设置系统默认（后端 KEY，不变） | WS-15 |
| M5 `AnalysisConfigForm` 改造 | 读本地 KEY 状态、随请求下发、来源展示、不回填 | WS-16 |

---

## 2. 技术栈与目录约定

### 2.1 现状（以仓库实际为准）
- 框架：**Next.js App Router + React + TypeScript**。
- 数据请求：`web/frontend/src/lib/apiClient.ts`（`axios`，自动带 `Authorization`）+ TanStack Query。
- UI：仓库现有 **Tailwind + 自定义暗色主题原语**（`bg-dark-secondary`、`accent-primary` 等）+ 自建组件（`AppNavbar`、`Toast`/`useToast`、`ConfirmDialog`）。**沿用仓库现有 Tailwind 暗色体系**（已在 WS-18 gate review 由开发组长确认：不迁移 Ant Design，避免破坏一致性）。

### 2.2 目录约定（同初版，新增本地 KEY 模块）
```
app/
  profile/
    page.tsx                 # 现有：新增「AI 设置」入口卡片
    ai-settings/page.tsx     # 新增：AI 设置独立子视图
  admin/
    llm-config/page.tsx      # 现有（不动）
    system-default-provider/page.tsx   # 新增：M4 独立页
components/
  profile/
    AISettingsCard.tsx
    ProviderList.tsx
    ProviderFormDrawer.tsx   # provider 元数据 + 本地 KEY 区
    ProviderItem.tsx
    LocalKeyField.tsx        # ★ 新增：本地 KEY 保存/替换/清除（localStorage）
  admin/system-default-provider/
    SystemDefaultForm.tsx
hooks/
  useUserLLMSettings.ts      # 用户 provider 元数据（react-query → llmSettingsAPI，无 KEY）
  useLocalLLMKeys.ts         # ★ 新增：localStorage 用户 KEY 管理（按 userId+providerKey）
lib/
  apiClient.ts               # llmSettingsAPI / adminDefaultProviderAPI（无 KEY 字段）
  keyVault.ts                # ★ 新增：localStorage KEY 读写工具（schema 见 api-contract.md §2）
  types.ts                   # 新增契约类型
```

---

## 3. 状态管理、路由 与 `useUserConfig` 的关系

### 3.1 三个关注点分离
- **分析缓存（旧）**：`useUserConfig` 继续管理 `last_ticker / last_analysts / last_research_depth` 等「上次分析偏好」，仅作兼容来源（需求 §5/§6 M5）。**不得**在其中新增用户 KEY 字段。
- **用户 provider 元数据（新）**：`useUserLLMSettings`（react-query，对齐 `admin/llm-config`）封装 `llmSettingsAPI` 的 E1–E5（仅元数据）。
- **用户 KEY（新，纯前端）**：`useLocalLLMKeys` 封装 `lib/keyVault.ts`，按 `userId + providerKey` 读写 `localStorage`（见 `api-contract.md` §2）。**不进后端、不进 react-query 缓存**。

> 三者解耦：AI 设置模块用 `useUserLLMSettings`（元数据）+ `useLocalLLMKeys`（KEY）；分析表单用三者组合。用户 KEY 永不明文出现在 react-query/redux 等跨页面状态。

### 3.2 路由
- **Profile AI 设置**：`/profile` 现有两张卡片下新增「AI 设置」卡片，跳转新增子路由 **`/profile/ai-settings`**。不新增顶层导航。
- **管理员系统默认 Provider**：新增独立路由 **`/admin/system-default-provider`**，在 `AppNavbar` admin 菜单（`/admin/llm-config` 之下）新增入口。**不**集成进现有 `llm-config` 页。

### 3.3 全局状态
- 明文 KEY 不进入跨页面 state；仅存在于 `LocalKeyField` / `AnalysisConfigForm` 局部 `useState`，用完即 `setApiKey('')`。
- 系统默认摘要经 `/api/config` 的 `system_default`（仅非敏感元数据，无 KEY 状态）进入分析表单「来源」展示。

---

## 4. M3 Profile「AI 设置」模块（含本地 KEY 管理）

### 4.1 信息架构（IA）
```
/profile
└─ 卡片：AI 设置（AISettingsCard）
   ├─ 摘要：已保存 N 个 provider，默认：<display_name>
   ├─ 按钮：管理 → /profile/ai-settings
/profile/ai-settings
├─ [迁移提示条] 仅当 has_legacy_config=true：
│   「检测到旧版 API KEY 缓存，建议在当前浏览器重新保存 KEY 到 localStorage」[立即处理][暂不]
├─ ProviderList（ProviderItem[]）
│   ├─ 每项：display_name · provider_name · base_url
│   │       标签：默认 / 已启用 / 验证状态(时间)
│   │       本地 KEY 状态徽标：<已保存本浏览器 KEY> | <当前浏览器未保存 KEY>
│   │       操作：设为默认 / 编辑 / 测试连接 / 删除
│   └─ 空态：暂无 provider，[新增 provider]
└─ 按钮：+ 新增 provider → ProviderFormDrawer
```

### 4.2 组件拆分
- **`AISettingsCard`**：读 `useUserLLMSettings` 做摘要；KEY 状态从 `useLocalLLMKeys` 取（仅布尔，不取明文）。
- **`ProviderList` / `ProviderItem`**：列表；`ProviderItem` 承载「设为默认 / 编辑 / 测试连接 / 删除」。删除复用 `ConfirmDialog`，并提示「同时清除本浏览器保存的 KEY」（调 `clearLocalKey`）。
- **`ProviderFormDrawer`**（元数据 + 本地 KEY 区）：
  - 元数据字段：`provider_name`、`display_name`、`base_url`、`shallow_model`/`deep_model`、`is_enabled`、`is_default`（调 `llmSettingsAPI` E2/E3）。
  - **`LocalKeyField`（本地 KEY 区）**：见 §4.3。

### 4.3 `LocalKeyField` —— 本地 KEY 保存/替换/清除（核心）
依据 `useLocalLLMKeys`（`api-contract.md` §2）呈现三态：

| 状态 | 表现 | 行为 |
| --- | --- | --- |
| **当前浏览器未保存 KEY** | 显示明文输入框 +「测试连接」+ 勾选「保存到当前浏览器」 | 输入后 `saveLocalKey`（若勾选）或仅用于本次验证 |
| **已保存 KEY** | 隐藏明文，显示「已保存（本浏览器）」+「替换 KEY」+「清除 KEY」 | 不读明文回显 |
| **替换 KEY** | 展开输入框输入新值 | `replaceLocalKey` |
| **清除 KEY** | 点「清除 KEY」→ `ConfirmDialog` 确认 | `clearLocalKey` |

约束：
- 明文 KEY 仅在局部 `useState`，关闭抽屉/用完即清空（`api-contract.md` §2.4）。
- **换浏览器/清缓存/无痕**：`hasLocalKey=false` → 显示「当前浏览器未保存该 provider 的 KEY，请重新填写或切换到系统默认 provider」（需求 §10 风险「用户清除浏览器数据或换设备」）。
- 测试连接：KEY 优先取本地 `getLocalKey`，否则用刚输入的临时值，调 E5（后端临时验证、不持久化 KEY）。

---

## 5. M4 独立管理员「系统默认 Provider」配置页（不变）

与初版一致（系统 KEY 仍后端，前端仅见 `credential_configured` 布尔，无任何 KEY 明文/脱敏尾号）：
- `/admin/system-default-provider`：从 active providers 选择 + 二次确认（`ConfirmDialog`）+ 展示当前默认摘要（`SystemDefaultProvider`，含 `credential_configured: boolean`，**无** `api_key_masked` / 明文）。
- 仅允许 active provider；inactive 禁用 + 后端 400 双保险。
- 普通用户永不可见系统默认明文 KEY。

> 此页**不涉及用户本地 KEY**；其 KEY 属于后端，沿用初版 §5 设计。

---

## 6. M5 `AnalysisConfigForm` 改造（读本地 KEY、随请求下发）

现有 `AnalysisConfigForm.tsx` 当前从 `useUserConfig` 回填 `last_api_key` 明文（第 135/145 行）——**必须移除**。

### 6.1 加载「有效 LLM 配置」（不含 KEY）
- 保留 `useUserConfig` 仅用于 `last_ticker / last_analysts / last_research_depth`（兼容缓存）。
- 新增：从 `useUserLLMSettings` 取用户默认 provider（或首个 `is_enabled`）的元数据预选 `llm_provider / shallow_thinker / deep_thinker`；无用户配置时从 `/api/config` 的 `system_default` 预选（来源「系统默认」）。
- **不**从任何后端接口加载用户 KEY（需求 §7、story-004 §43）。

### 6.2 KEY 来源与随请求下发
- 构造请求前：`api_key = getLocalKey(providerKey) ?? oneTimeInput`（见 `api-contract.md` §11）。
- 一次性 KEY 语义：用户直接输入 KEY 时提供「仅本次分析（不保存）」与「保存到当前浏览器」两选项；选后者才 `saveLocalKey`。
- 提交时仅当 `api_key` 非空才放入 `requestData.api_key`（现有第 474–476 行逻辑满足）；该值不回写 `useUserConfig`/任何持久态。

### 6.3 来源展示（个人配置 / 系统默认）
在「LLM 服务商」区块顶部加来源提示（`role="status"`/`aria-live`）：
- 来自用户默认 → 「来源：个人配置（本浏览器 KEY）· <display_name>」
- 来自系统默认 → 「来源：系统默认 Provider · <display_name>」
- 用户手动改选到一个**本地无 KEY 的个人 provider** → 提示「当前浏览器未保存该 provider 的 KEY，请补充或切回默认」，不静默回退系统默认。

### 6.4 兼容
- 旧 `last_llm_provider / last_backend_url / last_api_key` 仍用于「上次分析偏好」回填（ticker/analysts/depth），不与新 provider KEY 管理错配。
- 富途 API（`futu_api_*`）逻辑保持不变。

---

## 7. 组件 / 状态 / 路由 总览

| 新增/改动 | 类型 | 状态来源 | 位置 |
| --- | --- | --- | --- |
| `useUserLLMSettings` | hook (react-query) | `llmSettingsAPI` E1–E5（仅元数据） | — |
| `useLocalLLMKeys` ★ | hook | `lib/keyVault.ts`（localStorage） | — |
| `lib/keyVault.ts` ★ | 工具 | localStorage（按 userId+providerKey） | `lib/` |
| `AISettingsCard` | 组件 | 上述两 hook | `/profile` |
| `ai-settings/page.tsx` | 页面 | 上述两 hook | `/profile/ai-settings` |
| `ProviderList` / `ProviderItem` | 组件 | `useUserLLMSettings` | ai-settings 页 |
| `ProviderFormDrawer` | 组件 | 元数据 hook + `LocalKeyField` | ai-settings 页（抽屉） |
| `LocalKeyField` ★ | 组件 | `useLocalLLMKeys` | ProviderFormDrawer 内 |
| `system-default-provider/page.tsx` | 页面 | `adminDefaultProviderAPI` + `/api/config` | `/admin/system-default-provider` |
| `SystemDefaultForm` | 组件 | active providers + 二次确认 | 系统默认页 |
| `AnalysisConfigForm` | 改动 | 移除后端 KEY 回填；读本地 KEY | 现有分析页（§6） |
| `AppNavbar` admin 菜单 | 改动 | — | 新增系统默认入口 |

> ★ = WS-20 rework 新增（相对初版方案）。

---

## 8. 可访问性（a11y）与性能基线
- **a11y**：`LocalKeyField` 输入框配 `<label>` + `aria-label`；「清除/替换」为真实 `<button>`；来源提示用 `aria-live="polite"`；`ConfirmDialog` 焦点陷阱与 `Esc` 关闭（沿用现有）。
- **性能**：用户 AI 设置列表加载 < 500ms，react-query 缓存 `['user','llm-settings']`；本地 KEY 读取为同步 `localStorage` 操作，不阻塞渲染（需求 §9）；用户 KEY 只在浏览器本地与单次请求中出现，不进可缓存前端存储。

---

## 9. 协调待确认（需 Leader / 后端 WS-13 rework 拍板）
1. **UI 技术栈**：沿用仓库现有 Tailwind 暗色体系（已确认不迁 Ant Design）。
2. **系统默认端点形态**：已确认 —— `PUT /api/admin/llm/system-default`，且 openapi 新增 `GET /api/admin/llm/system-default`（读当前摘要，可为 `null`）；管理员摘要用 `credential_configured: boolean`，**无** `api_key_masked` / 明文（见 `api-contract.md` §10）。
3. **`/api/config` 追加 `system_default`**：已确认 —— 类型为 `PublicSystemDefaultProvider | null`，仅非敏感元数据（见 `api-contract.md` §9）。
4. **本地 KEY 是否加密存储**：用户决策为明文存 `localStorage`；建议仅做 XSS 防护与文案提示（「KEY 仅存于本浏览器」），不引入额外加密（避免与「换浏览器需重填」语义冲突）。如需 session-only 模式可后续增强。
5. **`has_legacy_config`**：已确认由后端返回（并补充 `legacy_config` 摘要，见 `api-contract.md` §4 / §14）。
6. 字段以 `backend/openapi.yaml` 为权威源；如后端调整字段，先在 WS-13 / WS-18 评论与后端/设计达成一致再改 openapi，前端不单边改契约。
