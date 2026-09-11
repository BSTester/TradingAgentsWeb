import type { AnalysisPhase, WebSocketMessage } from './types';

const analystNames: Record<string, string> = {
  market: '市场分析师',
  social: '社交媒体分析师',
  news: '新闻分析师',
  fundamentals: '基本面分析师',
};

/** The five bands mirror GraphSetup. Risk Judge is always the terminal band. */
export function createAnalysisPhases(): AnalysisPhase[] {
  return [
    { id: 'analysts', name: '分析师团队', description: 'Market → Social → News → Fundamentals 依次研究', icon: 'fa-users', status: 'running', agents: Object.values(analystNames).map(name => ({ name, status: 'pending', logs: [] })) },
    { id: 'research', name: '研究辩论', description: 'Bull ↔ Bear 多空研究辩论，研究经理裁决', icon: 'fa-comments', status: 'pending', agents: ['多头研究员', '空头研究员', '研究经理'].map(name => ({ name, status: 'pending', logs: [] })) },
    { id: 'trader', name: '交易计划', description: '交易员生成交易建议（不执行订单）', icon: 'fa-chart-line', status: 'pending', agents: [{ name: '交易员', status: 'pending', logs: [] }] },
    { id: 'risk-debate', name: '风险审议', description: 'Risky → Safe → Neutral 三方风险审议', icon: 'fa-shield-halved', status: 'pending', agents: ['激进风险分析师', '保守风险分析师', '中性风险分析师'].map(name => ({ name, status: 'pending', logs: [] })) },
    { id: 'risk-judge', name: '最终裁决', description: '风险裁决输出最终交易建议', icon: 'fa-gavel', status: 'pending', agents: [{ name: '风险裁决', status: 'pending', logs: [] }] },
  ];
}

/** Config may select analysts, but cannot remove the terminal Risk Judge band. */
export function applyProgressConfig(phases: AnalysisPhase[], config: Pick<WebSocketMessage['data'], 'selected_analysts'> & { enable_trading_executor?: boolean }): AnalysisPhase[] {
  const next = phases.map(phase => ({ ...phase, agents: phase.agents.map(agent => ({ ...agent, logs: [...agent.logs] })) }));
  const analystPhase = next[0];
  if (analystPhase && Array.isArray(config.selected_analysts)) {
    analystPhase.agents = config.selected_analysts
      .filter(agent => Boolean(analystNames[agent]))
      .map(agent => ({ name: analystNames[agent]!, status: 'pending', logs: [] }));
  }
  return next;
}

export function phaseIndexForAgent(agent: string, phases: AnalysisPhase[]): number {
  const phaseId = ({
    system: 'analysts', market: 'analysts', social: 'analysts', news: 'analysts', fundamentals: 'analysts',
    researcher: 'research', bull: 'research', bear: 'research', invest_judge: 'research',
    trader: 'trader', risky: 'risk-debate', neutral: 'risk-debate', safe: 'risk-debate', risk_manager: 'risk-judge',
  } as Record<string, string>)[agent];
  return Math.max(0, phases.findIndex(phase => phase.id === phaseId));
}