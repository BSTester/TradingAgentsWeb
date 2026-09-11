import { phaseIndexForAgent } from './phaseModel';
import type { AnalysisPhase } from './types';

/** 阶段名称到索引的映射（兼容旧格式） */
const phaseMap: { [key: string]: number } = {
  '准备阶段': 0,  // 准备阶段也显示在第一阶段
  '初始化阶段': 0,
  '分析阶段': 0,
  '分析师团队': 0,
  '市场分析': 0,
  '情绪分析': 0,
  '新闻分析': 0,
  '基本面分析': 0,
  '投资辩论': 1,
  '研究团队': 1,
  '交易策略': 2,
  '交易团队': 2,
  '风险评估': 3,
  '风险管理': 3,
  '完成阶段': 4,
};

/** 智能体名称映射（英文 -> 中文，与 GraphSetup 节点对齐） */
const agentNameMap: { [key: string]: string } = {
  'system': '系统',
  'market': '市场分析师',
  'social': '社交媒体分析师',
  'news': '新闻分析师',
  'fundamentals': '基本面分析师',
  'researcher': '研究分析师',
  'bull': '多头研究员',
  'bear': '空头研究员',
  'trader': '交易员',
  'invest_judge': '研究经理',
  'risky': '激进风险分析师',
  'neutral': '中性风险分析师',
  'safe': '保守风险分析师',
  'risk_manager': '风险裁决',
};

export interface ProgressLogPayload {
  agent: string;
  phase: string;
  logMessage: string | undefined;
  step: string | undefined;
}

export interface ProgressLogResult {
  phases: AnalysisPhase[];
  currentPhaseIndex: number | null;
}

/**
 * 纯函数版 phase 状态机：应用一条 log 消息到阶段/智能体状态。
 * 仅在阶段由 pending 转入 running 时返回 currentPhaseIndex（供调用方 setCurrentPhaseIndex）。
 */
export function applyProgressLog(prevPhases: AnalysisPhase[], payload: ProgressLogPayload): ProgressLogResult {
  const { agent, phase, logMessage: logMsg, step } = payload;

  const newPhases = [...prevPhases];
  let nextCurrentPhaseIndex: number | null = null;

  // 优先使用智能体映射，其次使用阶段映射
  let phaseIdx = phaseIndexForAgent(agent, newPhases);
  if (phaseIdx === 0 && agent !== 'system' && !['market', 'social', 'news', 'fundamentals'].includes(agent)) {
    phaseIdx = phaseMap[phase] ?? 0;
  }

  // 确保 phaseIdx 在有效范围内
  if (phaseIdx < 0) phaseIdx = 0;
  if (phaseIdx >= newPhases.length) phaseIdx = newPhases.length - 1;

  if (phaseIdx >= 0 && phaseIdx < newPhases.length) {
    const currentPhase = newPhases[phaseIdx];

    if (currentPhase) {
      // 更新阶段状态
      if (currentPhase.status === 'pending') {
        currentPhase.status = 'running';
        nextCurrentPhaseIndex = phaseIdx;
      }

      const displayName = agentNameMap[agent] || agent;

      // 查找或创建智能体
      let agentObj = currentPhase.agents.find(a => a.name === displayName);
      if (!agentObj) {
        agentObj = {
          name: displayName,
          status: 'running',
          logs: []
        };
        currentPhase.agents.push(agentObj);
      }

      // 特殊处理：当真正的分析师开始工作时，自动标记系统为完成
      if (agent !== 'system' && phaseIdx === 0) {
        const systemAgent = currentPhase.agents.find(a => a.name === '系统');
        if (systemAgent && systemAgent.status === 'running') {
          systemAgent.status = 'completed';
          console.log('✅ 系统准备完成，分析师开始工作');
        }
      }

      // 检查是否是完成消息
      const isCompletedStep = step === '完成' || logMsg?.includes('完成分析') || logMsg?.includes('✅');

      // 更新智能体状态和日志
      if (isCompletedStep) {
        // 标记智能体为完成
        agentObj.status = 'completed';

        // 检查该阶段的所有智能体是否都完成了
        // 注意：排除"系统"智能体，它只是辅助性的，不算作实际的分析智能体
        // 应该检查所有非系统的智能体（包括pending的），因为pending表示还没开始，不应该算作完成
        console.log(`🔍 检查阶段完成状态 - 阶段: ${currentPhase.name}`);
        console.log(`   所有智能体:`, currentPhase.agents.map(a => `${a.name}(${a.status})`));

        // 获取所有应该参与的智能体（排除系统）
        const allAgents = currentPhase.agents.filter(a => a.name !== '系统');
        console.log(`   应参与的智能体:`, allAgents.map(a => `${a.name}(${a.status})`));

        // 只有当所有智能体都完成时，阶段才算完成
        const allCompleted = allAgents.length > 0 &&
          allAgents.every(a => a.status === 'completed');

        if (allCompleted) {
          currentPhase.status = 'completed';
          console.log(`✅ 阶段 "${currentPhase.name}" 完成 (${allAgents.length} 个智能体全部完成)`);
        } else {
          const completedCount = allAgents.filter(a => a.status === 'completed').length;
          console.log(`⏳ 阶段 "${currentPhase.name}" 进行中 (${completedCount}/${allAgents.length} 个智能体完成)`);
        }
      } else if (agentObj.status === 'pending') {
        agentObj.status = 'running';
      }

      if (logMsg) {
        const timestamp = new Date().toLocaleTimeString();
        const newLog = `${timestamp} - ${logMsg}`;

        // 去重：检查最后一条日志是否相同
        const lastLog = agentObj.logs[agentObj.logs.length - 1];
        if (lastLog !== newLog) {
          agentObj.logs.push(newLog);

          // 只保留最近10条日志
          if (agentObj.logs.length > 10) {
            agentObj.logs = agentObj.logs.slice(-10);
          }
        }
      }
    }
  }

  return { phases: newPhases, currentPhaseIndex: nextCurrentPhaseIndex };
}

/** error 事件：标记当前阶段和正在运行的智能体为错误。 */
export function applyErrorToPhases(phases: AnalysisPhase[], currentPhaseIndex: number, displayError: string): AnalysisPhase[] {
  const newPhases = [...phases];
  const currentPhase = newPhases[currentPhaseIndex];
  if (currentPhase) {
    currentPhase.status = 'error';

    // 标记正在运行的智能体为错误
    currentPhase.agents.forEach(agent => {
      if (agent.status === 'running') {
        agent.status = 'error';
        // 添加错误日志
        const timestamp = new Date().toLocaleTimeString();
        agent.logs.push(`${timestamp} - ❌ 执行失败: ${displayError.substring(0, 100)}`);
      }
    });
  }
  return newPhases;
}