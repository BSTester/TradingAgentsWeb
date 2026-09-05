// 用户相关类型定义
export interface User {
  id: number;
  username: string;
  email: string;
  role: string;  // 'admin' or 'user'
  is_active: boolean;  // Whether user account is active
  can_access_intraday_trading: boolean;  // Whether user can access intraday trading features
  has_set_password: boolean;  // Whether user has explicitly set a password
  created_at: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

// 分析配置相关类型
export interface AnalysisConfig {
  ticker: string;
  analysis_date: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  api_key?: string;
  shallow_thinker?: string;
  deep_thinker?: string;
}

export interface AnalysisRequest extends AnalysisConfig {
  user_id: number;
}

// 分析状态相关类型
export interface AnalysisStatus {
  id: string;
  status: 'initializing' | 'running' | 'completed' | 'error';
  current_step?: string;
  progress?: number;
  message?: string;
}

export interface AnalysisResult {
  id: string;
  status: string;
  timestamp: string;
  request: AnalysisConfig;
  decision?: string;
  final_state?: Record<string, any>;
  error?: {
    message: string;
    details?: string;
  };
}

// 配置相关类型
export interface AppConfig {
  llm_providers: LLMProvider[];
  analysts: string[];
  research_depths: number[];
  backend_url: string;
}

// 系统默认 provider：后端 KEY，对普通用户仅暴露脱敏摘要（见 api-contract.md §9 / §10）
export interface SystemDefaultProviderSummary {
  provider_id: number;
  provider_name: string;
  display_name: string;
  base_url: string;
  has_api_key: boolean;          // 系统 KEY，后端持有
  api_key_masked: string | null; // 脱敏尾号，如 "sk-***abcd"
  is_active: boolean;
  shallow_model?: string | null;
  deep_model?: string | null;
}

export interface AppConfigWithSystemDefault extends AppConfig {
  system_default: SystemDefaultProviderSummary | null;
}

export interface SetSystemDefaultRequest {
  provider_id: number; // 必须是 active 的 LLMProvider.id
}

// 管理员 LLM 供应商目录（Provider/Model CRUD 源），用于系统默认页选择
export interface AdminLLMProvider {
  id: number;
  provider_name: string;
  display_name: string;
  api_key: string | null;
  base_url: string | null;
  description: string | null;
  is_active: boolean;
  models_count: number;
  created_at: string;
  updated_at: string;
}

export interface LLMProvider {
  id: string;
  name: string;
  models: LLMModel[];
  requires_api_key: boolean;
  api_key_placeholder?: string;
  help_text?: string;
}

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 历史记录类型
export interface AnalysisHistory {
  id: string;
  ticker: string;
  analysis_date: string;
  status: string;
  timestamp: string;
  decision?: string;
}
// 定时任务 相关类型
export interface ScheduledTask {
  id: number;
  user_id: number;
  task_name: string;
  ticker: string;
  market: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  shallow_thinker: string;
  deep_thinker: string;
  backend_url: string;
  is_public: boolean;
  execution_cycle: 'daily' | 'weekly' | 'workdays' | 'every_n_days';
  execution_time: string;
  interval_days?: number;
  day_of_week?: string;
  end_date?: string;
  is_enabled: boolean;
  status: 'pending' | 'completed';
  scheduler_job_id: string;
  total_executions: number;
  last_run_time?: string;
  next_run_time?: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledTaskCreate {
  task_name: string;
  ticker: string;
  analysts: string[];
  research_depth: number;
  llm_provider: string;
  backend_url: string;
  shallow_thinker: string;
  deep_thinker: string;
  is_public: boolean;
  execution_cycle: 'daily' | 'weekly' | 'workdays' | 'every_n_days';
  execution_time: string;
  interval_days?: number;
  day_of_week?: string;
  end_date?: string;
}

export interface ScheduledTaskUpdate {
  is_enabled?: boolean;
  task_name?: string;
}

export interface ScheduledTaskListResponse {
  items: ScheduledTask[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
  has_prev: boolean;
}

// ===== 用户 AI 设置 / 本地 KEY 契约类型（依据 web/frontend/api-contract.md）=====

export type LLMConfigSource =
  | 'user_explicit' // 用户在表单显式选择的个人 provider（KEY 来自本地）
  | 'user_default' // 用户默认 provider
  | 'system_default' // 系统默认 provider（兜底，后端 KEY）
  | 'request_override' // 本次请求一次性 KEY
  | 'none';

export type ValidationStatus = 'ok' | 'failed' | 'untested' | null;

// 用户 provider 元数据（E1 响应，完全不含 api_key）
export interface UserLLMProviderSetting {
  id: string; // 配置主键（UUID 或数字串）
  provider_name: string; // 系统 provider 标识，或用户自定义名称
  display_name: string;
  base_url: string;
  shallow_model: string | null;
  deep_model: string | null;
  is_enabled: boolean;
  is_default: boolean; // 该用户的默认 provider
  last_validated_at: string | null; // ISO8601（后端记录，不存 KEY）
  last_validation_status: ValidationStatus;
  created_at: string;
  updated_at: string;
}

export interface UserLLMSettingsResponse {
  providers: UserLLMProviderSetting[];
  default_provider_id: string | null;
  has_legacy_config: boolean; // 旧 UserConfig.last_* 是否仍有值（迁移提示）
}

// provider_type 取值（后端 openapi ProviderProfileType 枚举）
export type ProviderProfileType = 'catalog' | 'custom';

// E2 新增 provider 元数据（无 api_key 字段）
// 依据 backend/openapi.yaml (main) UserLLMProviderCreate：provider_type 为必填字段（BUG-001 修复点）
export interface CreateUserLLMProviderRequest {
  provider_name: string;
  provider_type: ProviderProfileType; // 必填，本表单新建的均为用户自定义 provider
  display_name: string;
  base_url: string;
  shallow_model?: string | null;
  deep_model?: string | null;
  catalog_provider_id?: number | null;
  is_enabled?: boolean;
  is_default?: boolean;
}

// E3 编辑 provider 元数据（全字段可选，无 api_key）
export interface UpdateUserLLMProviderRequest {
  display_name?: string;
  base_url?: string;
  shallow_model?: string | null;
  deep_model?: string | null;
  is_enabled?: boolean;
  is_default?: boolean;
}

// E5 测试连接（临时 KEY）
export interface TestUserLLMProviderRequest {
  base_url: string;
  api_key: string; // 一次性明文；优先用表单当前输入，其次本地 localStorage 取出的 KEY
}

export interface TestUserLLMProviderResponse {
  valid: boolean;
  message?: string;
  last_validated_at: string;
}

// ===== TradingAgents Web 重设计 · 报告 / 订阅 / 管理契约（WS-133）=====

export type Market = 'US' | 'HK' | 'CN';

// 风险等级：固定文字 + 图标，不与涨跌语义混淆
export type RiskLevel = 'low' | 'medium' | 'high';

// 榜单 / 报告列表卡片字段
export interface ReportPreview {
  id: string;               // = report id
  analysis_id: string;      // = report id
  ticker: string;
  company_name: string | null;
  market: Market | null;
  analysis_date: string | null;
  status: string;           // completed | running | error | interrupted ...
  is_public: boolean;
  created_at: string;
  // 角色链裁决摘要（榜单卡片补齐字段：收盘价/分析模型/推荐区间/买卖持仓建议）
  model: string | null;                 // 分析使用的模型
  close_price: number | null;           // 当天收盘价
  realtime_price: number | null;        // 实时价格
  recommendation: 'buy' | 'hold' | 'sell' | null;  // 买卖/持仓建议
  price_range: [number, number] | null; // 参考交易价格区间
  risk_level: RiskLevel | null;
  rating: number | null;                // 1-5 星
  confidence: number | null;            // 置信度 0-1 或 0-100
}

// 角色链中的一个可展开节点
export interface RoleChainNode {
  id: string;
  type: 'analysts' | 'bull' | 'bear' | 'trader' | 'risk-review' | 'summary' | 'risk-judge';
  title: string;
  summary: string;        // 简短结论
  content: string;        // markdown 正文（可展开日志）
  agent?: { name: string; result: string } | null;
  agents?: { name: string; result: string }[];  // 分析师团队：分角色子卡片
  decision?: string;
  price_range?: [number, number] | null;
  holding_period?: string | null;
}

// 报告详情：含完整角色链
export interface ReportDetail extends ReportPreview {
  trading_decision: string | null;
  final_summary: string | null;
  confidence: number | null;
  holding_period: string | null;    // 建议持有期限
  data_source_count: number | null; // 数据来源数量
  role_chain: RoleChainNode[];
  // 原始分析阶段数据（兼容）
  phases?: Record<string, unknown>[] | null;
  final_state?: Record<string, unknown> | null;
}

// 订阅 / 按次
export interface SubscriptionPlan {
  id: number;
  name: string;
  credits: number;         // 本次获得次数
  price: number;           // 价格（分或元，按 display 统一）
  is_active: boolean;
  description?: string | null;
  sort_order: number;
}

export type CreditTxnType = 'purchase' | 'consume' | 'refund' | 'grant';
export type CreditTxnStatus = 'paid' | 'pending' | 'refunded' | 'consumed';

export interface CreditTransaction {
  id: number;
  type: CreditTxnType;
  amount: number;          // 增减量（+/-）
  balance: number;         // 剩余量
  status: CreditTxnStatus;
  description: string | null;
  plan_name?: string | null;
  created_at: string;
}

export interface SubscriptionInfo {
  balance: number;                         // 当前可用次数
  transactions: CreditTransaction[];
}

// 管理控制台
export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  balance: number;                         // 剩余分析次数
}

export interface AdminPublicReportItem extends ReportPreview {
  owner: string | null;
}

export interface AdminSubscriptionPlan extends SubscriptionPlan {
  created_at: string;
  updated_at: string;
}

// 管理后台 · 订单列表（所有用户的次数流水）
export interface AdminOrder {
  id: number;
  user_id: number;
  username: string;
  type: 'purchase' | 'consume' | 'refund' | 'grant';
  amount: number;
  balance: number;
  status: string;
  description: string | null;
  plan_name: string | null;
  created_at: string;
}

