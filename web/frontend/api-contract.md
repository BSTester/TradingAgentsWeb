# API 契约（前端视角）

> Issue: **WS-18** / `[story-001·前端]` — API 契约 + 前端技术方案
> 协作者：前端开发工程师（Agent `1381815f-…`）
> 权威源：`backend/openapi.yaml`（由 WS-13 产出，提交到 `main` 后为准）
> 状态：**起草稿（DRAFT）** — `backend/openapi.yaml` 当前尚未落地，本文档依据 `pm/requirements.md` §3/§6(M2–M5) 与现有后端路由（`web/backend/routes/*`）的现实结构起草，待 WS-13 `openapi.yaml` 落地后**逐项对齐**，对齐差异见文末「待后端确认 / 字段冻结清单」。

## 0. 范围与约定

本文档是 `frontend/`（本仓库即 `web/frontend/`）对后端 LLM 配置相关接口的**前端契约镜像**：

- 给出 TypeScript 类型、API client 方法签名、请求/响应结构、错误处理。
- 所有「已保存 KEY」相关响应**只暴露脱敏字段**，绝不包含明文 `api_key`。
- **明文 KEY 不写 `localStorage`，不进入前端持久状态**（仅在一次请求体 / 一次性表单态中短暂存在）。

前端新增的 API 调用统一收敛到一个新的 `llmSettingsAPI`（用户侧）+ `adminDefaultProviderAPI`（管理员系统默认）对象，挂在 `web/frontend/src/lib/apiClient.ts` 下，沿用现有 `apiClient`（axios，自动带 `Authorization`）。

---

## 1. 端点清单（前端需要）

| # | 方法 & 路径 | 用途 | 角色 | 对应需求 |
| --- | --- | --- | --- | --- |
| E1 | `GET /api/user/llm-settings` | 拉取当前用户全部 AI provider 配置（脱敏）+ 默认/迁移提示 | user | M2 / M3 |
| E2 | `POST /api/user/llm-settings/providers` | 新增一条用户 provider 配置（请求体携带一次性 KEY） | user | M2 / M3 |
| E3 | `PATCH /api/user/llm-settings/providers/{id}` | 编辑配置；`api_key` 为 `string`=替换、`null`=清除、省略=不变 | user | M2 / M3 |
| E4 | `DELETE /api/user/llm-settings/providers/{id}` | 删除一条配置 | user | M2 / M3 |
| E5 | `POST /api/user/llm-settings/providers/{id}/test` | 测试连接（请求体携带一次性 base_url + api_key） | user | M2 / M3 |
| E6 | `GET /api/config`（**扩展**） | 在现有响应上追加 `system_default` 摘要；供分析表单「来源」展示 | user | M4 / M5 |
| E7 | `PUT /api/admin/llm/system-default` | 管理员将一个 active provider 设为系统默认 | admin | M4 |
| E8 | `GET /api/config`（已存在）+ `POST /api/validate-key`（已存在） | 分析表单可选的一次性 KEY 验证与 active provider 列表 | user | M5 |

> 现有真实端点复核（已在仓库中）：
> - `GET /api/config` → 返回 `{ llm_providers: [{value,label,description,url}], models: { provider: { shallow:[...], deep:[...] } } }`（见 `routes/config_routes.py::get_config`）。
> - `POST /api/validate-key` → 请求 `{ provider, api_key }`，按 provider 实际调用校验（见 `routes/config_routes.py::validate_api_key`）。
> - `GET/PATCH/DELETE /api/admin/llm/providers/{id}` 已存在（见 `routes/llm_config_routes.py`），但**不含**系统默认设置入口，故新增 E7。

---

## 2. 共享类型（建议放入 `web/frontend/src/lib/types.ts`）

```ts
// ── 来源标记：分析表单展示「个人配置 / 系统默认」 ──────────────
export type LLMConfigSource =
  | 'user_explicit'      // 用户在表单显式选择的具体 provider
  | 'user_default'       // 用户默认 provider
  | 'system_default'     // 系统默认 provider（兜底）
  | 'request_override'   // 本次请求一次性 KEY 覆盖
  | 'none';              // 无可用配置

// ── KEY 脱敏载体：永远不出现明文 ─────────────────────────────
export interface ApiKeyMask {
  has_api_key: boolean;        // 是否已保存 KEY
  api_key_masked: string | null; // 如 "sk-***abcd"；未保存为 null
}

// ── 验证状态 ────────────────────────────────────────────────
export type ValidationStatus = 'ok' | 'failed' | 'untested' | null;
```

---

## 3. E1 `GET /api/user/llm-settings` —— 用户 AI 设置总览

**响应 `200`** → `UserLLMSettingsResponse`

```ts
export interface UserLLMProviderSetting extends ApiKeyMask {
  id: string;                     // 配置主键（UUID 或数字串）
  provider_name: string;         // 系统 provider 标识，或用户自定义名称
  display_name: string;
  base_url: string;
  shallow_model: string | null;
  deep_model: string | null;
  is_enabled: boolean;
  is_default: boolean;           // 是否为该用户的默认 provider
  last_validated_at: string | null;   // ISO8601
  last_validation_status: ValidationStatus;
  created_at: string;            // ISO8601
  updated_at: string;            // ISO8601
}

export interface UserLLMSettingsResponse {
  providers: UserLLMProviderSetting[];
  default_provider_id: string | null;  // = providers 中 is_default 为 true 的 id
  has_legacy_config: boolean;          // 旧 UserConfig.last_* 是否仍有值（迁移提示）
}
```

**契约要点**
- 响应**绝不**包含 `api_key` 明文；KEY 仅以 `has_api_key` + `api_key_masked` 表示。
- `providers` 列表按 `is_default` → `updated_at` 排序，前端无需再排。
- `has_legacy_config=true` 时，前端在 AI 设置模块顶部展示一次性「迁移提示」（见 `frontend-tech-spec.md` M3 迁移提示）。

---

## 4. E2 `POST /api/user/llm-settings/providers` —— 新增配置

**请求体** `CreateUserLLMProviderRequest`

```ts
export interface CreateUserLLMProviderRequest {
  provider_name: string;   // 必填：系统 active provider 名，或自定义名
  display_name: string;    // 必填
  base_url: string;        // 必填（OpenAI-compatible 自定义也走这里）
  api_key: string;         // 必填：一次性传入；服务端加密存储，不回写明文
  shallow_model?: string | null;
  deep_model?: string | null;
  is_enabled?: boolean;    // 默认 true
  is_default?: boolean;    // 默认 false；true 时取消其他默认
}
```

**响应**
- `201` → `UserLLMProviderSetting`（新建记录，KEY 已脱敏）
- `400` → 校验失败（如 `provider_name` 为空、`api_key` 为空）
- `422` → 字段类型/格式错误

**契约要点**
- 请求体里的 `api_key` 是**唯一**允许出现明文 KEY 的地方，且仅在传输途中；前端不得将其存入 state/localStorage 或回显到输入框。
- 创建成功后前端用响应里的脱敏对象刷新列表，不保留用户刚输入的明文。

---

## 5. E3 `PATCH /api/user/llm-settings/providers/{id}` —— 编辑 / 替换 / 清除 KEY

**请求体** `UpdateUserLLMProviderRequest`（全字段可选，部分更新）

```ts
export interface UpdateUserLLMProviderRequest {
  display_name?: string;
  base_url?: string;
  /**
   * KEY 语义（关键）：
   *  - 省略该字段        → 不改动已保存 KEY
   *  - api_key: string   → 替换 KEY（新明文，一次性传输）
   *  - api_key: null     → 清除 KEY（has_api_key 置 false）
   */
  api_key?: string | null;
  shallow_model?: string | null;
  deep_model?: string | null;
  is_enabled?: boolean;
  is_default?: boolean;    // true 时取消该用户其他默认
}
```

**响应**
- `200` → `UserLLMProviderSetting`
- `404` → 配置不存在（`detail: "provider config not found"`）
- `400` → 非法更新（如把 `is_default` 设给 `is_enabled=false` 的配置）

**契约要点**
- 「替换 KEY」：提交新 `api_key` 字符串；成功后前端只更新脱敏状态，不保留明文。
- 「清除 KEY」：提交 `api_key: null`；成功后 `has_api_key=false`、`api_key_masked=null`。
- 表单交互态见 `frontend-tech-spec.md` M3 的「已保存 / 替换 / 清除」三态。

---

## 6. E4 `DELETE /api/user/llm-settings/providers/{id}` —— 删除

**响应**
- `204` → 无内容
- `404` → 配置不存在

**契约要点**
- 删除的是「用户配置」，不影响系统 `LLMProvider` 目录。
- 若删除的是 `is_default` 配置，响应后用户 `default_provider_id` 置 `null`，下次分析回退到系统默认。

---

## 7. E5 `POST /api/user/llm-settings/providers/{id}/test` —— 测试连接

**请求体** `TestUserLLMProviderRequest`

```ts
export interface TestUserLLMProviderRequest {
  base_url: string;   // 必填：优先用表单当前填写值
  api_key: string;    // 必填：一次性明文；若表单未填新 KEY，则用「替换」语义传当前明文
}
```

**响应** `TestUserLLMProviderResponse`

```ts
export interface TestUserLLMProviderResponse {
  valid: boolean;
  message?: string;          // 失败原因（不泄露 KEY）
  last_validated_at: string; // ISO8601，无论成功失败都回写本次尝试时间
}
```

**契约要点**
- 测试连接的 `api_key` 同样为一次性传输，**不持久化、不回显**。
- 成功后前端把 `last_validation_status` 置为 `ok`，并刷新 `last_validated_at`；失败置 `failed` 并 toast `message`。
- `message` 中禁止包含 KEY 明文（后端约束，见 `pm/requirements.md` §9 安全）。

---

## 8. E6 `GET /api/config`（扩展）—— 系统默认摘要

在**现有** `/api/config` 响应上**追加**一个字段（向后兼容，旧字段保留）：

```ts
// 现有响应（保持不变）
export interface AppConfig {
  llm_providers: LLMProviderOption[];   // { value, label, description, url }
  models: Record<string, { shallow: LLMModelOption[]; deep: LLMModelOption[] }>;
  // 以下为现有前端已使用字段（如后端实际未返回，前端保留兜底默认）
  analysts?: string[];
  research_depths?: number[];
  backend_url?: string;
}

// 新增字段
export interface SystemDefaultProviderSummary extends ApiKeyMask {
  provider_id: number;     // LLMProvider.id
  provider_name: string;
  display_name: string;
  base_url: string;
  is_active: boolean;
}

// 扩展后的配置响应
export interface AppConfigWithSystemDefault extends AppConfig {
  system_default: SystemDefaultProviderSummary | null; // 无系统默认时为 null
}
```

**契约要点**
- `system_default` 只含**非敏感摘要**，普通用户永远拿不到系统默认 provider 的明文 KEY（`api_key_masked` 已脱敏，`has_api_key` 仅布尔）。
- 分析表单默认选中逻辑见 `frontend-tech-spec.md` M5。

---

## 9. E7 `PUT /api/admin/llm/system-default` —— 设置系统默认 provider

**请求体**

```ts
export interface SetSystemDefaultRequest {
  provider_id: number;   // 必须是 active 的 LLMProvider.id
}
```

**响应**
- `200` → `SystemDefaultProviderSummary`（设置后的当前默认摘要）
- `400` → 所选 provider 非 active（`detail: "cannot set inactive provider as system default"`）
- `403` → 非管理员
- `404` → provider 不存在

**契约要点**
- 该端点**只选 active provider**；inactive 一律拒绝（安全约束 `pm/requirements.md` M4）。
- 全局同一时刻至多一个 active provider 为默认（后端保证）。
- 管理员页在保存前需二次确认（交互见 `frontend-tech-spec.md` M4）。

---

## 10. E8 分析启动的一次性 KEY（沿用 `/api/analyze`）

现有分析启动请求（`analysisAPI.startAnalysis`）继续允许 `api_key` 作为**单次覆盖**，契约约定：

```ts
export interface StartAnalysisRequest {
  ticker: string;
  analysis_date: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  backend_url?: string;
  shallow_thinker?: string;
  deep_thinker?: string;
  // 一次性 KEY：仅本次请求优先，不持久化、不回填表单
  api_key?: string;
  is_public?: boolean;
  email_notification?: boolean;
  enable_trading_executor?: boolean;
  futu_api_base_url?: string;
  futu_api_key?: string;
}
```

**契约要点**
- 若用户已保存配置，前端**不**把已保存 KEY 填入 `api_key`，仅当用户在表单**显式重新输入**一个 KEY 时才带 `api_key`。
- 用户显式输入但未保存的 KEY，仅对本次请求生效，不覆盖已保存 KEY（除非用户明确在 AI 设置里「替换」）。
- `api_key` 为一次性传输，**禁止**写入 `localStorage` 或前端全局 state。

---

## 11. 错误处理约定

所有接口统一错误包络（与现有 `apiClient` 解析一致）：

```ts
// 校验 / 业务错误：FastAPI 风格
interface ApiError {
  detail: string;        // 人类可读，不含 KEY 明文
}
// 部分旧接口可能用 message，前端 apiClient 已兼容：
// error.response?.data?.detail || error.response?.data?.message || error.message
```

| HTTP | 场景 | 前端处理 |
| --- | --- | --- |
| 400 | 参数非法 / 选了 inactive provider 作默认 | toast `detail`；不回退到系统默认 |
| 401 | 未登录 / token 失效 | 跳转登录 |
| 403 | 非管理员调用 E7 | 提示无权限 |
| 404 | 配置 / provider 不存在 | toast；刷新列表 |
| 422 | 请求体字段校验失败 | 表单字段级报错 |
| 429 | 限流（测试连接高频） | toast「操作过于频繁」 |

**关键约束**：用户显式选择了一个未配置 KEY 的 provider 时，后端**不**应静默回退系统默认，而应返回可操作错误（4xx），前端提示「请补充该 provider 的 KEY 或切换到默认 provider」（见 `pm/requirements.md` §7 关键约束）。

---

## 12. KEY 脱敏与前端禁令（强制）

1. **响应零明文**：所有用户/系统 provider 配置响应只含 `has_api_key` + `api_key_masked`，类型定义中**不存在** `api_key: string` 的「读取」字段。
2. **不落盘**：明文 KEY 绝不写入 `localStorage` / `sessionStorage` / `IndexedDB` / Cookie。
3. **不进全局态**：明文 KEY 不进入 Redux/Zustand/Context 等跨页面状态；仅在表单局部 `useState` 中短暂存在，提交后立即清空（`setApiKey('')`）。
4. **不回显**：保存/替换成功后，KEY 输入框不再显示明文，只显示「已保存 / 脱敏尾号 / 替换 / 清除」交互态。
5. **日志禁令**：`console.log` 不得打印明文 KEY（现有 `AnalysisConfigForm` 仅在 dev 打印「已验证（从缓存）」这类状态，不得打印值）。

---

## 13. 建议的 API Client 方法签名（新增于 `lib/apiClient.ts`）

```ts
// 用户侧 AI 设置
export const llmSettingsAPI = {
  getSettings: () => apiClient.get<UserLLMSettingsResponse>('/api/user/llm-settings').then(r => r.data),
  createProvider: (body: CreateUserLLMProviderRequest) =>
    apiClient.post<UserLLMProviderSetting>('/api/user/llm-settings/providers', body).then(r => r.data),
  updateProvider: (id: string, body: UpdateUserLLMProviderRequest) =>
    apiClient.patch<UserLLMProviderSetting>(`/api/user/llm-settings/providers/${id}`, body).then(r => r.data),
  deleteProvider: (id: string) =>
    apiClient.delete(`/api/user/llm-settings/providers/${id}`).then(r => r.data),
  testProvider: (id: string, body: TestUserLLMProviderRequest) =>
    apiClient.post<TestUserLLMProviderResponse>(`/api/user/llm-settings/providers/${id}/test`, body).then(r => r.data),
};

// 管理员系统默认 provider
export const adminDefaultProviderAPI = {
  setSystemDefault: (body: SetSystemDefaultRequest) =>
    apiClient.put<SystemDefaultProviderSummary>('/api/admin/llm/system-default', body).then(r => r.data),
};

// 现有 configAPI.getConfig() 返回类型升级为 AppConfigWithSystemDefault
```

---

## 14. 待后端确认 / 字段冻结清单（与 WS-13 对齐）

1. **配置文件落地路径**：本文档假设 `frontend/` = 仓库 `web/frontend/`。待 WS-13 `openapi.yaml` 落地后，以 `backend/openapi.yaml` 为准逐项核对端点名、字段名、状态码。
2. **用户 provider 配置主键类型**：本文档用 `string`（兼容 UUID/数字）；需与后端表主键对齐。
3. **E7 端点形态**：当前提议为 `PUT /api/admin/llm/system-default`；若后端选择复用 `PATCH /api/admin/llm/providers/{id}` 的 `is_default` 字段，前端相应调整。
4. **`/api/config` 是否追加 `system_default`**：需后端确认在现有 `get_config` 中补充，或另外提供独立端点。
5. **`has_legacy_config` 字段**：迁移提示依赖此字段；若后端不返回，前端改用「`providers` 为空且存在旧 `last_api_key`」推断。
6. **脱敏格式**：建议 `api_key_masked` 统一为 `"<prefix>***<last4>"`（与 `LLMProvider.to_dict` 现有 `"***"+last4` 对齐，建议补齐前缀）。
