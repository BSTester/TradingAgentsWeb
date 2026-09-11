'use client';

import React from 'react';
import { PhaseResult } from './types';

interface PhaseTabsProps {
  activePhase: number;
  onSelectPhase: (index: number) => void;
  phases?: PhaseResult[];
}

export function PhaseTabs({ activePhase, onSelectPhase, phases }: PhaseTabsProps) {
  return (
    <div className="border-b border-gray-200 no-print -mx-4 md:mx-0 px-4 md:px-0">
      <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
        {/* 最终分析说明标签 */}
        <button
          onClick={() => onSelectPhase(-1)}
          className={`px-3 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap transition-all min-h-touch ${activePhase === -1
            ? 'border-b-2 border-accent-primary text-accent-primary'
            : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          <i className="fas fa-file-alt mr-1 md:mr-2" />
          <span className="hidden sm:inline">投资组合分析</span>
          <span className="sm:hidden">组合分析</span>
        </button>

        {/* 四个阶段标签 */}
        {phases?.map((phase: PhaseResult, index: number) => (
          <button
            key={phase.id}
            onClick={() => onSelectPhase(index)}
            className={`px-3 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap transition-all min-h-touch ${activePhase === index
              ? 'border-b-2 border-accent-primary text-accent-primary'
              : 'text-text-secondary hover:text-text-primary'
              }`}
          >
            <i className={`fas ${phase.icon} mr-1 md:mr-2`} />
            {phase.name}
          </button>
        ))}
      </div>
    </div>
  );
}
