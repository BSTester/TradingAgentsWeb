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
// ===== 用户 AI 设置 / 本地 KEY 契约类型（依据 web/frontend/api-contract.md）=====

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

