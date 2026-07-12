/**
 * Canonical TradingAgents workflow stage model.
 *
 * Translated directly from `tradingagents/graph/setup.py` (`setup_graph`) and
 * `tradingagents/graph/conditional_logic.py` — NOT a hand-maintained fake pipeline.
 *
 * Five bands, twelve real nodes (auxiliary `tools_*` / `Msg Clear *` nodes are
 * intentionally hidden from the UI):
 *
 *   1. Research           — Market → Social → News → Fundamentals (each loops its tools)
 *   2. Research debate    — Bull ↔ Bear (alternating, max_debate_rounds each) → Research Manager
 *   3. Trading plan       — Trader (recommendation only; no order execution)
 *   4. Risk review        — Risky → Safe → Neutral (fixed rotation, max_risk_discuss_rounds each)
 *   5. Final              — Risk Judge (terminal node; emits final_trade_decision + investment_plan)
 *
 * `agent` codes align with the backend `node_to_agent_map`
 * (`web/backend/analysis_task.py`) carried by the analysis WebSocket `log` events.
 */

export type AgentStatusCode =
  | 'system'
  | 'market'
  | 'social'
  | 'news'
  | 'fundamentals'
  | 'bull'
  | 'bear'
  | 'invest_judge'
  | 'trader'
  | 'risky'
  | 'safe'
  | 'neutral'
  | 'risk_manager';

export interface WorkflowNode {
  /** Backend `data.agent` code carried on WS log events. */
  agent: AgentStatusCode;
  /** Graph node title (matches `workflow.add_node` name in setup.py). */
  node: string;
  /** Chinese display name. */
  label: string;
  /** One-line role description shown in the UI. */
  summary: string;
}

export interface WorkflowBand {
  id: number;
  /** Short uppercase id for the stage rail, e.g. "01 / RESEARCH". */
  code: string;
  name: string;
  description: string;
  /** Agent codes that belong to this band (used to route live events). */
  agents: AgentStatusCode[];
  nodes: WorkflowNode[];
}

export const WORKFLOW_BANDS: WorkflowBand[] = [
  {
    id: 1,
    code: '01 / RESEARCH',
    name: '研究 / 数据采集',
    description: '依次执行各分析师；工具调用完成后传递到下一个节点。',
    agents: ['system', 'market', 'social', 'news', 'fundamentals'],
    nodes: [
      { agent: 'market', node: 'Market Analyst', label: '市场分析师', summary: '价格、成交量与技术指标。' },
      { agent: 'social', node: 'Social Analyst', label: '社交分析师', summary: '社交讨论与情绪信号。' },
      { agent: 'news', node: 'News Analyst', label: '新闻分析师', summary: '新闻、内幕情绪与全球事件。' },
      { agent: 'fundamentals', node: 'Fundamentals Analyst', label: '基本面分析师', summary: '财务、现金流与估值。' },
    ],
  },
  {
    id: 2,
    code: '02 / DEBATE',
    name: '研究辩论',
    description: 'Bull Researcher 与 Bear Researcher 交替论证（max_debate_rounds），Research Manager 负责裁决。',
    agents: ['bull', 'bear', 'invest_judge'],
    nodes: [
      { agent: 'bull', node: 'Bull Researcher', label: '多头研究员', summary: '看多论点与证据。' },
      { agent: 'bear', node: 'Bear Researcher', label: '空头研究员', summary: '看空论点与证据。' },
      { agent: 'invest_judge', node: 'Research Manager', label: '研究经理', summary: '汇总多空分歧并产出投资计划。' },
    ],
  },
  {
    id: 3,
    code: '03 / PLAN',
    name: '交易计划',
    description: 'Trader 使用研究裁决与行情工具生成建议；这里只生成计划，不执行订单。',
    agents: ['trader'],
    nodes: [
      { agent: 'trader', node: 'Trader', label: '交易员', summary: '生成交易建议计划。' },
    ],
  },
  {
    id: 4,
    code: '04 / RISK',
    name: '风险审议',
    description: 'Risky → Safe → Neutral 按固定轮转讨论仓位与风险（max_risk_discuss_rounds）。',
    agents: ['risky', 'safe', 'neutral'],
    nodes: [
      { agent: 'risky', node: 'Risky Analyst', label: '激进风险分析师', summary: '激进视角的风险意见。' },
      { agent: 'safe', node: 'Safe Analyst', label: '保守风险分析师', summary: '保守视角的风险意见。' },
      { agent: 'neutral', node: 'Neutral Analyst', label: '中性风险分析师', summary: '中性视角的风险意见。' },
    ],
  },
  {
    id: 5,
    code: '05 / FINAL',
    name: '最终裁决',
    description: 'Risk Judge 汇总三方意见，输出最终交易建议与风险边界（终末节点）。',
    agents: ['risk_manager'],
    nodes: [
      { agent: 'risk_manager', node: 'Risk Judge', label: '风险裁决', summary: '产出最终交易决策与投资计划。' },
    ],
  },
];

/**
 * Maps a backend agent code to its band index (0-based) in WORKFLOW_BANDS.
 * Mirrors the routing in `setup.py` so live events land in the correct band.
 */
export const AGENT_TO_BAND_INDEX: Record<string, number> = WORKFLOW_BANDS.reduce(
  (acc, band, index) => {
    band.agents.forEach((agent) => {
      acc[agent] = index;
    });
    return acc;
  },
  {} as Record<string, number>,
);

/** Chinese display name for a backend agent code. */
export const AGENT_LABEL: Record<string, string> = WORKFLOW_BANDS.reduce(
  (acc, band) => {
    band.nodes.forEach((node) => {
      acc[node.agent] = node.label;
    });
    return acc;
  },
  {} as Record<string, string>,
);

/** Flat ordered list of the twelve real graph nodes (auxiliary nodes excluded). */
export const WORKFLOW_NODES: WorkflowNode[] = WORKFLOW_BANDS.flatMap((band) => band.nodes);
