# 下线订阅/积分/订单、后台 LLM 配置与定时任务

- 日期：2026-09-11
- 状态：设计已确认（方案 A「请求即配置」+ 定时任务一并下线）
- 影响面：前端 10 个页面、后端 4 个路由模块与 5 个服务、数据库 6 张表与 1 个列

## 1. 背景与目标

当前平台包含三块与"单机/自托管、用户自带密钥"定位不匹配的能力：

1. **订阅 / 积分 / 订单**：套餐管理、购买、积分流水、分析扣费门槛；
2. **后台 LLM 配置**：管理员维护 Provider/模型目录、系统默认 Provider、用户级持久化 LLM 设置；
3. **定时任务**：APScheduler 调度 + 任务级 LLM 凭据。

目标：全部下线，使 LLM 配置**只来自前端用户自定义能力**（浏览器 keyVault 保存密钥 +
localStorage 保存自定义 Base URL/模型），分析请求即配置，后端不再持久化任何全局或用户级
LLM 配置。分析与报告等核心能力保持不变。

## 2. 保留与移除

### 保留（用户自定义能力，纯前端）

| 组件 | 作用 |
|------|------|
| `src/lib/keyVault.ts` | 浏览器本地密钥保险箱（按用户+provider 存密钥，不落库） |
| `src/hooks/useLocalLLMKeys.ts` | 本地密钥读写 hook |
| `src/lib/customModelConfig.ts` | 自定义模型 Base URL / 模型名（localStorage） |
| `src/lib/providers.ts` | 前端本地 provider 目录常量（`COMMON_PROVIDERS`） |
| `src/app/settings/page.tsx` | 唯一的 LLM 配置入口（本地密钥 + 自定义 Base URL/模型） |
| `src/components/profile/LocalKeyField.tsx` | 本地密钥输入组件 |
| `AnalysisConfigForm` 的本地密钥路径 | 发起分析时读取 keyVault 密钥 |

分析、报告详情/导出、公开报告、研究页、用户管理、认证、邮件、Turnstile 等**不受影响**。

### 移除

**后端**

- 路由模块：`routes/llm_config_routes.py`、`routes/user_llm_settings_routes.py`、
  `routes/subscription_routes.py`、`routes/scheduled_task_routes.py`（整文件删除）
- 路由内端点：`admin_routes.py` 的订阅商品与订单端点；`config_routes.py` 的
  `/validate-key`、`/llm/fetch-models` 及 `/config` 中的 provider/model 目录；
  `analysis_routes.py` 的积分门槛与扣减（149-156 行）
- 服务：`services/scheduler_service.py`、`services/system_default_provider.py`、
  `services/task_executor.py`（仅服务于定时任务）、`services/llm_config_resolver.py`
  收敛为"请求配置校验"、`services/report_formatter.py` 的 `scheduled_task` 来源分支
- 模型：`ScheduledTask`、`LLMProvider`、`LLMModel`、`UserLLMProviderSetting`、
  `SubscriptionPlan`、`CreditTransaction`、`User.credit_balance`
- `app.py`：路由注册、APScheduler 启动/关闭钩子
- 依赖：`apscheduler`（pyproject.toml + requirements.txt）
- 测试：`tests/test_llm_config_resolver.py` 改造为"请求配置校验"测试

**前端**

- 页面：`/subscribe`、`/subscription`、`/me/subscription`、`/me/billing`、
  `/scheduled-tasks`、`/admin/subscription-products`、`/admin/orders`、
  `/admin/llm-config`、`/admin/system-default-provider`、`/profile/ai-settings`
- 组件：`components/admin/llm-config/*`、`components/admin/system-default-provider/*`、
  `components/scheduled-tasks/*`、
  `components/profile/{ProviderList,ProviderFormDrawer,ProviderItem,AISettingsCard}`
- hook / API：`hooks/useUserLLMSettings.ts`、`hooks/useScheduledTasks.ts`、
  `apiClient.ts` 的 `adminLLMAPI` / `adminDefaultProviderAPI` / `llmSettingsAPI` /
  `scheduledTasksAPI` / `configAPI.validateKey`、`lib/api.ts` 的 `scheduledTasksAPI`、
  `lib/api/workspace.ts` 的 `subscriptionAPI` / `adminAPI`
- 导航与入口：`SiteHeader`、`SiteFooter`、`site/AccountLayout`、`ws133/AccountLayout`、
  `ws133/Shell`、`ws133/AdminLayout`、`common/AppNavbar` 中的订阅/定时任务/LLM 配置入口；
  `/me`、`/admin` 首页的积分与订阅卡片；`/admin/users` 的积分调整
- 必须迁移而非删除：`ConfirmDialog`（当前在 `components/admin/llm-config/`，被
  `profile/LocalKeyField.tsx` 使用）→ 移到 `components/ui/ConfirmDialog.tsx`

## 3. 配置解析新流程（请求即配置）

```
前端 keyVault + customModelConfig
        │  AnalysisRequest{ provider, backend_url, shallow_thinker, deep_thinker, api_key }
        ▼
轻量校验（替换原 resolve_llm_config 的目录/系统默认/用户设置回退）
  - provider / shallow_thinker / deep_thinker 非空
  - api_key 非空（缺失 → 400，错误码 REQUEST_API_KEY_REQUIRED）
  - backend_url 为 http(s) 且可解析
        ▼
analysis_task.run_analysis_task → TradingAgentsGraph(config=...)
```

- 保留 `AnalysisRecord` 的 `llm_provider / backend_url / shallow_thinker / deep_thinker /
  api_key` 字段（分析历史需要记录本次使用的配置）
- 错误处理：校验失败返回结构化 400（沿用 `llm_config_error_response` 的响应形态），
  不写库、不扣费、不启动任务
- 定时任务下线后，不再存在"后端无人值守运行"的凭据问题，后端不再保存任何密钥

## 4. 数据库迁移

新增 `web/backend/migrations/007_drop_subscription_llm_scheduled.py`：

1. 执行前把 SQLite 库文件复制为 `<db>.bak-<timestamp>`（可回滚）
2. DROP TABLE：`scheduled_tasks`、`subscription_plans`、`credit_transactions`、
   `llm_providers`、`llm_models`、`user_llm_provider_settings`
3. `users.credit_balance` 列：SQLite（3.35+）与 MySQL 均用
   `ALTER TABLE users DROP COLUMN credit_balance`，并以 try/except + 续跑保证幂等
   （SQLite 3.35 以下的老环境跳过该步并打印提示，列保留不影响运行）
4. `migrations/auto_migrate.py` 的 schema 同步清单移除被删模型；
   历史迁移脚本（`add_api_key_to_tasks.py` 等）保留不动，仅不再有新库需要它们

## 5. 测试与验证

| 门禁 | 命令 | 通过标准 |
|------|------|----------|
| 类型检查 | `npm run typecheck` | exit 0 |
| 规范 | `npm run lint` | 0 error |
| 单测 | `npm run test:run` | 全绿（移除相关用例后） |
| 构建 | `npm run build` | 成功 |
| 后端 | `pytest web/backend/tests/` | 全绿 |

补充验证：

- 残留扫描：`subscription|credit_balance|CreditTransaction|SubscriptionPlan|LLMProvider|
  LLMModel|UserLLMProviderSetting|scheduled_task|scheduler|apscheduler|system-default|
  llm-settings` 在 `web/`、`tradingagents/`、`pyproject.toml`、`requirements.txt` 中 0 命中
  （历史迁移脚本与 `docs/archive/` 白名单除外）
- 迁移实测：备份库 → 执行迁移 → 断言 6 张表与 `users.credit_balance` 已不存在 →
  启动应用（`python web/backend/app.py` 导入检查）→ 登录/分析请求校验路径正常
- 分析链路：无 api_key 的请求返回 400 且不建任务；带 keyVault 配置的请求可正常发起

## 6. 风险与回滚

| 风险 | 缓解 |
|------|------|
| 删表丢历史数据（订阅/积分/Provider/定时任务） | 迁移前自动备份 SQLite 文件；迁移脚本幂等 |
| 前端仍有入口指向已删页面 | 残留关键词扫描 + `next build` 会因缺失模块失败（构建即门禁） |
| 分析因缺少后端默认配置而无法发起 | 请求即配置 + 明确 400 提示"请在设置页配置本地密钥" |
| 回滚 | `git revert` 相应提交 + 用迁移前备份文件恢复数据库 |

## 7. 实施顺序

1. 后端：删除路由/服务/模型/扣费逻辑，收敛配置校验，移除 `apscheduler`
2. 迁移脚本 + `auto_migrate` 清理，SQLite 实测
3. 前端：删除页面/组件/hook/API，迁移 `ConfirmDialog`，清理导航与首页卡片
4. 测试调整（删除/改造相关用例）
5. 文档：README、AGENTS.md、.env.example 去引用
6. 全量门禁 → 提交 → 推送 GitHub 主干
