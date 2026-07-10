# API 契约（前端视角）— WS-20 Rework 版

> Issue: **WS-18** / `[story-001·前端]` — API 契约 + 前端技术方案（rework）
> 协作者：前端开发工程师（Agent `1381815f-…`）
> 权威源：`backend/openapi.yaml`（由 WS-13 rework 产出，PR #16，merge `133fc39`，已落地 `main` —— **本文档已据此对齐**）
> 状态：**已对齐（Aligned to `backend/openapi.yaml` v0.2.0，PR #16）** —— 系统默认 provider 摘要已按 openapi 移除 `has_api_key` / `api_key_masked` / 脱敏尾号概念（普通用户仅非敏感元数据；管理员仅 `credential_configured`）；E1–E5 与 `AnalysisRequest` 字段已逐项核对一致。

## 0. 重大模型变更（相对初版）

用户追加决策（WS-20，PR #13 已并入 `main`）：

- **用户 API KEY 存前端 `localStorage`（按 `用户 + provider` 维度），后端不持久化、不回填用户 KEY。**
- **用户 AI 设置 API 不再包含 `has_api_key` / `api_key_masked` / 明文 KEY 字段**；只返回 provider **元数据** + `last_validated_at` / `last_validation_status`。
- 分析启动时，前端从 `localStorage` 取出当前 provider 的 KEY **随请求下发**（亦允许一次性输入）；后端只使用、不保存、不回填。
- **系统默认 provider 的 KEY 仍由后端保存，但前端契约按 openapi 不再暴露任何 KEY 状态（含脱敏尾号）**：普通用户公开摘要（`PublicSystemDefaultProvider`，§9）仅含非敏感元数据；管理员摘要（`SystemDefaultProvider`，§10）仅用 `credential_configured: boolean` 表示「后端 KEY 是否已配置」，绝不暴露明文或 `sk-***` 尾号（见 §9 / §10）。

> 这是相对初版（`api-contract.md` v1，PR #10）的反转。初版的「后端存 KEY + 脱敏回传」模型已作废。

---

## 1. 端点清单（前端需要）

| # | 方法 & 路径 | 用途 | 角色 | 对应需求 |
| --- | --- | --- | --- | --- |
| E1 | `GET /api/user/llm-settings` | 拉取当前用户全部 provider **元数据**（无 KEY） | user | M2 / M3 |
| E2 | `POST /api/user/llm-settings/providers` | 新增一条 provider 元数据 | user | M2 / M3 |
| E3 | `PATCH /api/user/llm-settings/providers/{id}` | 编辑 provider 元数据（**无 api_key 字段**） | user | M2 / M3 |
| E4 | `DELETE /api/user/llm-settings/providers/{id}` | 删除一条 provider 元数据 | user | M2 / M3 |
| E5 | `POST /api/user/llm-settings/providers/{id}/test` | 测试连接（**临时**带 KEY，后端不持久化） | user | M2 / M3 |
| E6 | `GET /api/config`（**扩展**） | 在现有响应上追加 `system_default` **非敏感**摘要（无 KEY 状态） | user | M4 / M5 |
| E7 | `PUT /api/admin/llm/system-default` | 管理员设系统默认 provider（后端 KEY） | admin | M4 |
| E8 | `POST /api/analyze`（已存在） | 分析启动，KEY 来自前端 `localStorage` 或一次性输入 | user | M5 |

> 端点形态（E1–E7）与初版一致；**唯一语义变化：E1–E5 完全不含用户 KEY；E5 改为由前端临时下发 KEY 做验证**。系统默认（E6/E7）的 KEY 属后端，但前端契约按 openapi **不再暴露明文或脱敏尾号**：公开摘要仅非敏感元数据，管理员摘要仅 `credential_configured: boolean`（见 §9 / §10）。

---

## 2. 用户 KEY 本地存储契约（核心，取代原脱敏回传）

用户 KEY **不在任何后端响应里出现**，只存在于当前浏览器的 `localStorage`，按 `用户 + provider` 维度隔离。

### 2.1 localStorage schema

```
命名空间:  "taw:llmkey:v1"
完整 key:  `taw:llmkey:v1:<userId>:<providerKey>`
value:     JSON 字符串
```

```ts
export const LOCAL_KEY_NS = 'taw:llmkey:v1';

export interface LocalLLMKeyRecord {
  key: string;            // 明文 API KEY（用户已确认存前端；见 §2.4 安全约束）
  savedAt: string;        // ISO8601
  provider: string;       // 与 providerKey 对应的 provider 标识
}

// 组合 key 的工具
export function localKeyId(userId: string, providerKey: string): string {
  return `${LOCAL_KEY_NS}:${userId}:${providerKey}`;
}
```

- `providerKey`：对系统 provider 用 `provider_name`（如 `openai`）；对用户自定义 provider 用其配置的 `id` 或 `provider_name`，保证唯一。
- 按 `userId` 隔离：多账户共用一台浏览器时，不同用户的 KEY 不会串用；切换账户后前端用当前 `user.id` 读写。
- **仅此浏览器有效**：换浏览器 / 清站点数据 / 无痕模式无此记录，需用户重填（见 §2.3）。

### 2.2 TypeScript 类型（本地 Key Vault）

```ts
export interface UserKeyVaultState {
  // providerKey -> 是否存在本地 KEY（绝不暴露明文到组件层之外的日志/网络）
  hasLocalKey: (providerKey: string) => boolean;
  getLocalKey: (providerKey: string) => string | null;     // 仅请求构造时使用
  saveLocalKey: (providerKey: string, key: string) => void;
  replaceLocalKey: (providerKey: string, key: string) => void;
  clearLocalKey: (providerKey: string) => void;
}
```

### 2.3 交互语义（保存 / 替换 / 清除 / 换浏览器）

| 操作 | 行为 |
| --- | --- |
| **保存 KEY** | 用户在当前 provider 表单输入明文 KEY → `saveLocalKey(providerKey, key)` 写入 `localStorage`；可勾选「仅本次分析」(不保存) 或「保存到当前浏览器」。 |
| **替换 KEY** | 已有本地 KEY → 展开输入框输入新值 → `replaceLocalKey` 覆盖。 |
| **清除 KEY** | `clearLocalKey(providerKey)` 删除该 `localStorage` 项；清除后该 provider 在当前浏览器无 KEY。 |
| **换浏览器/清缓存/无痕** | `hasLocalKey` 为 false → 前端提示「当前浏览器未保存该 provider 的 KEY，请重新填写，或切换到系统默认 provider」。 |

### 2.4 安全约束（强制，取代初版 §12）

1. **不写后端**：明文 KEY 永不进入 `POST/PATCH` 的持久化字段；仅 E5（临时验证）与 E8（分析请求）在**请求体**中一次性携带，后端不得落库/回填。
2. **不进 localStorage 以外的前端存储**：仅 `localStorage`（用户已确认）；不写 `sessionStorage`/`IndexedDB`/Cookie 全局态。
3. **不进全局 React 状态**：明文只在表单局部 `useState` 与「构造请求前的那一刻」存在，提交/用完立即 `setApiKey('')`。
4. **不打印/不泄露**：`console.log` 不得打印明文 KEY；错误捕获不得把 KEY 写进前端日志或上报；分析记录/定时任务记录也不得含请求中的 KEY 明文（后端约束，前端配合）。
5. **XSS 风险缓解（建议）**：因 KEY 在 `localStorage` 明文可读，前端应强化 XSS 防护（CSP、避免 `dangerouslySetInnerHTML`、依赖最小、输入不拼进 innerHTML），并在 UI 文案明确「KEY 仅存于本浏览器」。

---

## 3. 共享类型（建议放入 `lib/types.ts`）

```ts
export type LLMConfigSource =
  | 'user_explicit'      // 用户在表单显式选择的个人 provider（KEY 来自本地）
  | 'user_default'       // 用户默认 provider
  | 'system_default'     // 系统默认 provider（兜底，后端 KEY）
  | 'request_override'   // 本次请求一次性 KEY
  | 'none';

export type ValidationStatus = 'ok' | 'failed' | 'untested' | null;
```

> 注意：**全文已无任何 `ApiKeyMask` / `has_api_key` / `api_key_masked` 类型**。系统默认摘要（§9 / §10）按 openapi 也不再含脱敏字段：公开摘要仅非敏感元数据，管理员摘要仅 `credential_configured: boolean`。

---

## 4. E1 `GET /api/user/llm-settings` —— 用户 provider 元数据总览

**响应 `200`** → `UserLLMSettingsResponse`

```ts
export type ProviderProfileType = 'catalog' | 'custom';

export interface UserLLMProviderSetting {
  id: number;                     // 配置主键（openapi: integer）
  provider_name: string;         // 系统 provider 标识（小写 slug），或用户自定义名称
  provider_type: ProviderProfileType; // 'catalog' | 'custom'
  catalog_provider_id: number | null; // provider_type=catalog 时关联的系统 LLMProvider.id
  display_name: string;
  base_url: string;              // format: uri
  shallow_model: string;
  deep_model: string;
  is_enabled: boolean;
  is_default: boolean;           // 该用户的默认 provider
  last_validated_at: string | null;   // ISO8601（后端记录，不存 KEY）
  last_validation_status: ValidationStatus;
  created_at: string;
  updated_at: string;
}

export interface LegacyLLMConfigSummary {
  available: boolean;
  last_llm_provider: string | null;
  last_backend_url: string | null;
}

export interface UserLLMSettingsResponse {
  providers: UserLLMProviderSetting[];
  default_provider_id: number | null;
  has_legacy_config: boolean;    // 旧 UserConfig.last_* 是否仍有值（迁移提示）
  legacy_config: LegacyLLMConfigSummary | null; // 旧配置摘要（available + 非敏感 last_*）
}
```

**契约要点**
- 响应**完全不含** `api_key` / `has_api_key` / `api_key_masked`（AC #195）。用户 KEY 状态由前端从 `localStorage` 自行判断（见 §2）。
- `last_validated_at` / `last_validation_status`：由 E5 验证时在后端记录（仅状态/时间，不含 KEY），供列表展示「已验证/失败 + 时间」。

---

## 5. E2 `POST /api/user/llm-settings/providers` —— 新增 provider 元数据

**请求体** `CreateUserLLMProviderRequest`（**无 api_key 字段**）

```ts
// provider_type 取值（后端 openapi ProviderProfileType 枚举）
export type ProviderProfileType = 'catalog' | 'custom';

export interface CreateUserLLMProviderRequest {
  provider_name: string;                 // pattern: ^[a-zA-Z0-9_-]+$
  provider_type: ProviderProfileType;    // 必填（openapi 校验，缺则 422；BUG-001）
  catalog_provider_id?: number | null;  // provider_type=catalog 时关联系统 LLMProvider.id
  display_name: string;
  base_url: string;
  shallow_model: string;
  deep_model: string;
  is_enabled?: boolean;    // 默认 true
  is_default?: boolean;    // 默认 false；true 时取消其他默认
}
```

**响应**
- `201` → `UserLLMProviderSetting`
- `400` → 校验失败（如 `provider_name` 为空）
- `409` → provider_name 重复
- `422` → 字段类型/格式错误（**缺失必填 `provider_type` 即触发，见 BUG-001**）

**契约要点**
- 创建的是**元数据**；该 provider 的 KEY 由前端在本地 `localStorage` 保存（§2），**不经此接口**。

---

## 6. E3 `PATCH /api/user/llm-settings/providers/{id}` —— 编辑元数据

**请求体** `UpdateUserLLMProviderRequest`（全字段可选，**无 api_key**）

```ts
export interface UpdateUserLLMProviderRequest {
  display_name?: string;
  base_url?: string;
  shallow_model?: string | null;
  deep_model?: string | null;
  is_enabled?: boolean;
  is_default?: boolean;
}
```

**响应**
- `200` → `UserLLMProviderSetting`
- `404` → 配置不存在

**契约要点**
- 替换/清除 KEY 是**纯前端 `localStorage` 操作**（§2.3），不走此接口、不触发后端请求。

---

## 7. E4 `DELETE /api/user/llm-settings/providers/{id}` —— 删除元数据

**响应**
- `204` → 无内容
- `404` → 配置不存在

**契约要点**
- 删除后端元数据后，前端应同步 `clearLocalKey(providerKey)` 清掉本地 KEY（否则孤儿 KEY 残留）；可在 UI 确认时提示「同时清除本浏览器保存的 KEY」。

---

## 8. E5 `POST /api/user/llm-settings/providers/{id}/test` —— 测试连接（临时 KEY）

**请求体** `TestUserLLMProviderRequest`

```ts
export interface TestUserLLMProviderRequest {
  api_key: string;                 // writeOnly：一次性明文；优先用表单当前输入，其次本地 localStorage 取出的 KEY
  base_url?: string | null;        // 测试用 base URL 覆盖；省略则用保存的元数据
  model?: string | null;           // 可选模型名，用于轻量验证请求
}
```

**响应** `TestUserLLMProviderResponse`

```ts
export interface TestUserLLMProviderResponse {
  valid: boolean;
  message: string;                 // 失败原因（不泄露 KEY）
  last_validated_at: string;       // ISO8601，后端记录验证状态/时间
  last_validation_status: ValidationStatus;
  details?: Record<string, unknown> | null; // 已脱敏诊断，不含密钥
}
```

**契约要点**
- 前端**临时**把 KEY 发给后端验证；后端只返回结果并写入 `last_validated_at`/`last_validation_status`，**不持久化 KEY**。
- 验证用的 KEY 不写入元数据、不回填；成功后前端仅更新本地「已验证/失败」状态（可选在本地记录验证时间，但 KEY 来源仍是 §2 的 `localStorage`）。

---

## 9. E6 `GET /api/config`（扩展）—— 系统默认**非敏感**摘要（无 KEY 状态）

`/api/config` 在现有响应上**追加** `system_default` 字段（向后兼容）。按 openapi `PublicSystemDefaultProvider`，**普通用户只能看到非敏感元数据，无任何 KEY 状态**（无 `has_api_key` / `api_key_masked` / 脱敏尾号）：

```ts
export interface AppConfig {
  analysts: { value: string; label: string; description?: string | null }[];
  research_depths: { value: number; label: string; description?: string | null }[];
  llm_providers: { value: string; label: string; description?: string | null; url?: string | null }[];
  models: Record<string, { shallow: { value: string; label: string }[]; deep: { value: string; label: string }[] }>;
  backend_url?: string;
}

// 系统默认 provider：仅非敏感元数据（对应 openapi PublicSystemDefaultProvider）
export interface PublicSystemDefaultProvider {
  provider_id: number;
  provider_name: string;
  display_name: string;
  base_url: string | null;        // format: uri
  shallow_model: string | null;
  deep_model: string | null;
  // 注意：无 has_api_key / api_key_masked —— 普通用户看不到任何 KEY 状态
}

export interface AppConfigWithSystemDefault extends AppConfig {
  system_default: PublicSystemDefaultProvider | null;
}
```

**契约要点**
- 普通用户**永远拿不到**系统默认 provider 的 KEY 明文、脱敏尾号或「是否已配置」布尔；`PublicSystemDefaultProvider` 仅含非敏感元数据（见 openapi `system_default` + `PublicSystemDefaultProvider`）。
- 分析表单「来源」展示只使用 `provider_name` / `display_name` / `base_url` / `models`（见 `frontend-tech-spec.md` §6.1 / §6.3），**绝不展示任何 KEY 状态**。

---

## 10. E7 `GET` / `PUT /api/admin/llm/system-default` —— 管理员系统默认 provider

### GET（读取当前系统默认摘要）

**响应**
- `200` → `SystemDefaultProvider | null`（没有配置的系统默认时为 `null`）
- `401` → 未登录
- `403` → 非管理员

```ts
// 管理员视角的系统默认 provider 摘要（对应 openapi SystemDefaultProvider）
export interface SystemDefaultProvider {
  provider_id: number;
  provider_name: string;
  display_name: string;
  is_active: boolean;
  credential_configured: boolean;  // 仅此布尔：后端 KEY 是否已配置；不暴露明文/脱敏尾号
  base_url: string | null;         // format: uri
  shallow_model: string | null;
  deep_model: string | null;
  updated_at: string | null;       // ISO8601
}
```

### PUT（设置系统默认 provider）

**请求体** `SetSystemDefaultRequest`

```ts
export interface SetSystemDefaultRequest {
  provider_id: number;   // 必须是 active 的 LLMProvider.id
}
```

**响应**
- `200` → `SystemDefaultProvider`（设置后的摘要，含 `credential_configured`）
- `400` → 所选 provider 非 active（`SYSTEM_DEFAULT_PROVIDER_INACTIVE`）或约束冲突
- `401` → 未登录
- `403` → 非管理员
- `404` → provider 不存在（`LLM_PROVIDER_NOT_FOUND`）
- `409` → 所选 provider 无后端托管凭据（`SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING`）

**契约要点**
- 管理员摘要**只暴露「是否已配置后端 KEY」**（`credential_configured: boolean`），**绝不暴露明文 KEY 或脱敏尾号 `sk-***`**（与 openapi `SystemDefaultProvider` + WS-19 设计一致）。
- 系统 KEY 仍后端持有；前端此页不涉及用户本地 KEY。

---

## 11. E8 分析启动的 KEY（来自 localStorage / 一次性输入）

`analysisAPI.startAnalysis` 请求体中的 `api_key` 字段语义更新为：**来自前端 `localStorage`（本地 KEY）或用户一次性输入**，且随请求下发后**后端不持久化、不回填**。

```ts
// 对应 openapi AnalysisRequest（WS-12 LLM 解析契约）
export interface StartAnalysisRequest {
  // —— 必填（openapi required）——
  ticker: string;
  analysis_date: string;        // format: date
  analysts: string[];           // enum: market | social | news | fundamentals（minItems: 1）
  research_depth: number;       // minimum: 1

  // —— 请求级 LLM 覆盖（均可为 null，省略则后端按优先级解析）——
  llm_provider?: string | null;     // 请求级 provider 选择（如 "openai"）
  backend_url?: string | null;      // format: uri，请求级 base URL
  shallow_thinker?: string | null;
  deep_thinker?: string | null;
  api_key?: string | null;          // writeOnly：来自 localStorage 或一次性输入；仅本次请求使用，后端绝不持久化

  // —— 兜底开关 ——
  use_system_default?: boolean;     // 未提供 api_key 时显式请求系统默认兜底（默认 false）

  // —— 现有开关 ——
  is_public?: boolean;              // 默认 false
  email_notification?: boolean;     // 默认 false
}
```

> **应用级扩展（非 WS-12 契约，待与 `backend/openapi.yaml` 对齐）**：本仓库现有 `AnalysisConfigForm` 另携带富途交易相关字段（`enable_trading_executor`、`futu_api_base_url`、`futu_api_key`，见 `frontend-tech-spec.md` §6.4）。这些**不在** WS-12 `AnalysisRequest` 内；若 stage-2 仍需保留，应在 openapi 中补充字段后再回流对齐，前端暂按既有实现透传，不写入本契约的权威形状。

**契约要点**
- 前端构造请求时：`api_key = getLocalKey(providerKey) ?? oneTimeInput`（见 §2.2）。
- 若用户既无本地 KEY 又无一次性输入 → **不**带 `api_key`，后端回退系统默认（M5）；若用户显式选了个人 provider 但前端未下发 KEY，后端**不**静默用系统默认，而返回可操作错误（§12）。
- 一次性 KEY「仅本次」时**不**写 `localStorage`；用户勾选「保存到当前浏览器」才 `saveLocalKey`。
- `api_key` 明文不进 `localStorage` 之外的存储、不进全局 state、不打印。

---

## 12. 错误处理约定

统一错误包络（与 `backend/openapi.yaml` 的 `ErrorResponse` 一致）：

```ts
interface ApiError {
  error: {
    code:
      | 'SYSTEM_DEFAULT_PROVIDER_NOT_SET'
      | 'SYSTEM_DEFAULT_PROVIDER_CREDENTIAL_MISSING'
      | 'REQUEST_PROVIDER_KEY_REQUIRED'
      | 'REQUEST_PROVIDER_INVALID'
      | 'INVALID_BASE_URL'
      | 'LLM_CONFIG_UNRESOLVED'
      | string;
    message: string;              // 不含 KEY 明文
    details?: Record<string, unknown> | null;
    request_id?: string | null;
  };
}
```

| HTTP | 场景 | 前端处理 |
| --- | --- | --- |
| 400 | 参数非法 / 请求级 provider 非法 / base URL 非法 | toast `error.message`；`REQUEST_PROVIDER_INVALID` 时提示刷新 provider 列表或切换 provider |
| 401 | 未登录 / token 失效 | 跳转登录 |
| 403 | 非管理员调 E7 | 提示无权限 |
| 404 | 配置 / provider 不存在 | toast；刷新列表 |
| 409 | **个人 provider 缺 KEY** / 系统默认未配置或不可用 | toast `error.message`；个人 provider 缺 KEY 时提示「请补充本浏览器 KEY 或切到系统默认」 |
| 422 | 请求体字段校验失败 | 表单字段级报错 |
| 429 | 限流（测试连接高频） | toast「操作过于频繁」 |

**关键约束**：用户显式选择了一个个人 provider 却未下发 KEY（本地无、也未一次性输入）时，后端返回 `REQUEST_PROVIDER_KEY_REQUIRED`，前端提示补充或切换系统默认（§7 关键约束、需求 §7）。请求级 provider 不在用户 provider 或后端 active catalog provider 集合内时，后端返回 `REQUEST_PROVIDER_INVALID`，不得启动分析或静默兜底。

---

## 13. 建议的 API Client 方法签名（新增于 `lib/apiClient.ts`）

```ts
// 用户侧 AI 设置（仅元数据，无 KEY）
export const llmSettingsAPI = {
  getSettings: () => apiClient.get<UserLLMSettingsResponse>('/api/user/llm-settings').then(r => r.data),
  createProvider: (body: CreateUserLLMProviderRequest) =>
    apiClient.post<UserLLMProviderSetting>('/api/user/llm-settings/providers', body).then(r => r.data),
  updateProvider: (id: number, body: UpdateUserLLMProviderRequest) =>
    apiClient.patch<UserLLMProviderSetting>(`/api/user/llm-settings/providers/${id}`, body).then(r => r.data),
  deleteProvider: (id: number) =>
    apiClient.delete(`/api/user/llm-settings/providers/${id}`).then(r => r.data),
  testProvider: (id: number, body: TestUserLLMProviderRequest) =>
    apiClient.post<TestUserLLMProviderResponse>(`/api/user/llm-settings/providers/${id}/test`, body).then(r => r.data),
};

// 管理员系统默认 provider（后端 KEY，仅 credential_configured 布尔，无明文/脱敏尾号）
export const adminDefaultProviderAPI = {
  getSystemDefault: () =>
    apiClient.get<SystemDefaultProvider | null>('/api/admin/llm/system-default').then(r => r.data),
  setSystemDefault: (body: SetSystemDefaultRequest) =>
    apiClient.put<SystemDefaultProvider>('/api/admin/llm/system-default', body).then(r => r.data),
};
```

> 用户 KEY 不在 `apiClient` 的任何返回/持久字段里；本地 KEY 由独立的 `useLocalLLMKeys`（见 `frontend-tech-spec.md` §3）读写 `localStorage`。

---

## 14. 待与 openapi 复核 / 字段冻结清单（已对齐 PR #16）

下列原「待确认」项已由 `backend/openapi.yaml`（PR #16，v0.2.0）落地并**已回流更新本文档**：

1. **配置文件落地路径**：`frontend/` = 仓库 `web/frontend/`。（已确认）
2. **主键类型**：已确认 —— `id` / 路径 `{provider_id}` 均为 **`integer`**（文档已改为 `number`）。
3. **E7 端点形态**：已确认 —— `PUT /api/admin/llm/system-default`；且 openapi 新增 `GET /api/admin/llm/system-default`（读当前摘要，可为 `null`）。文档 §10 已含 GET + PUT。
4. **`/api/config` 追加 `system_default`**：已确认 —— 类型为 `PublicSystemDefaultProvider | null`（仅非敏感元数据，无 KEY 状态）。文档 §9 已对齐。
5. **`has_legacy_config`**：已确认后端返回；并补充 `legacy_config: LegacyLLMConfigSummary | null`（含 `available` / 非敏感 `last_llm_provider` / `last_backend_url`）。文档 §4 已对齐。
6. **`last_validated_at` 由后端记录**：已确认 —— E5 返回并写入 `last_validated_at` / `last_validation_status`，前端列表据此展示。

**仍待协调 / 非阻塞项（随后续迭代回流）：**

7. **系统默认摘要彻底移除脱敏概念**（本次对齐核心）：普通用户 `PublicSystemDefaultProvider` 与管理员 `SystemDefaultProvider` 均**不再含** `has_api_key` / `api_key_masked` / `sk-***` 尾号；管理员改用 `credential_configured: boolean`。WS-19 `ui-spec.md` 亦确认移除。✅ 已对齐。
8. **`AnalysisRequest` 富途扩展字段（`enable_trading_executor` / `futu_api_base_url` / `futu_api_key`）**：不在 WS-12 `AnalysisRequest` 契约内。若 stage-2 仍需保留，应在 openapi 补充字段后再回流对齐（文档 §11 已标注为应用级扩展）。
9. 字段以 `backend/openapi.yaml` 为权威源；如后端调整字段，**先在 WS-13 / 本 issue 评论与后端/设计达成一致再改 openapi**，前端不单边改契约。
