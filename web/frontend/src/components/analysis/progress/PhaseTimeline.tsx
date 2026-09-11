'use client';

import React from 'react';
import type { AnalysisPhase } from './types';

interface PhaseTimelineProps {
  phases: AnalysisPhase[];
  currentPhaseIndex: number;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return 'fa-check-circle text-green-500';
    case 'running':
      return 'fa-spinner fa-spin text-blue-500';
    case 'error':
      return 'fa-times-circle text-red-500';
    default:
      return 'fa-circle text-text-muted';
  }
}

/** 阶段时间线：阶段头部、智能体状态与最近日志 */
export function PhaseTimeline({ phases, currentPhaseIndex }: PhaseTimelineProps) {
  return (
    <div className="space-y-4">
      {phases.map((phase, phaseIdx) => (
        <div
          key={phase.id}
          className={`border rounded-lg overflow-hidden transition-all ${phase.status === 'running' ? 'border-blue-500 shadow-md' :
              phase.status === 'completed' ? 'border-green-500' :
                phase.status === 'error' ? 'border-red-500 shadow-md' :
                  'border-gray-200'
            }`}
        >
          {/* 阶段头部 */}
          <div className={`p-4 border-b border-dark-border ${phase.status === 'running' ? 'bg-gradient-to-r from-accent-primary/20 to-accent-primary/10' :
              phase.status === 'completed' ? 'bg-gradient-to-r from-success-500/20 to-success-500/10' :
                phase.status === 'error' ? 'bg-gradient-to-r from-danger-500/20 to-danger-500/10' :
                  'bg-dark-tertiary/50'
                }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${phase.status === 'running' ? 'bg-accent-primary' :
                    phase.status === 'completed' ? 'bg-success-500' :
                      phase.status === 'error' ? 'bg-danger-500' :
                        'bg-text-muted'
                      }`}>
                  <i className={`fas ${phase.icon} text-white`} />
                </div>
                <div>
                  <h4 className="font-semibold text-text-primary">{phase.name}</h4>
                  <p className="text-sm text-text-secondary">{phase.description}</p>
                </div>
              </div>
              <i className={`fas ${getStatusIcon(phase.status)} text-xl`} />
            </div>
          </div>

          {/* 智能体列表 */}
          {(phase.status === 'running' || phase.status === 'completed' || phaseIdx === currentPhaseIndex) && (
            <div className="p-4 bg-dark-primary space-y-3">
              {phase.agents.map((agent, agentIdx) => (
                <div key={agentIdx} className="border-l-4 pl-4 py-2" style={{
                  borderColor: agent.status === 'completed' ? '#10b981' :
                    agent.status === 'running' ? '#3b82f6' :
                      agent.status === 'error' ? '#ef4444' :
                        '#d1d5db'
                }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <i className={`fas ${getStatusIcon(agent.status)}`} />
                      <span className="font-medium text-text-primary">{agent.name}</span>
                    </div>
                    {agent.status === 'running' && (
                      <span className="text-xs text-accent-primary font-medium">执行中...</span>
                    )}
                    {agent.status === 'completed' && (
                      <span className="text-xs text-green-600 font-medium">已完成</span>
                    )}
                    {agent.status === 'error' && (
                      <span className="text-xs text-red-600 font-medium">执行失败</span>
                    )}
                  </div>

                  {/* 智能体日志 */}
                  {agent.logs.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-dark-tertiary">
                      {agent.logs.slice(-10).map((log, logIdx) => (
                        <div key={logIdx} className="text-xs text-text-secondary pl-6 break-words">
                          {log}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}