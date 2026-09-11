'use client';

import React from 'react';

export interface AnalystOption {
  value: string;
  label: string;
  description: string;
}

interface AnalystTeamSectionProps {
  analysts: AnalystOption[];
  selectedAnalysts: string[];
  onToggleAnalyst: (analystId: string) => void;
}

export function AnalystTeamSection({ analysts, selectedAnalysts, onToggleAnalyst }: AnalystTeamSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
          3
        </div>
        <h4 className="text-lg font-medium text-text-primary">分析师团队</h4>
      </div>
      <div className="ml-11">
        <p className="text-sm text-text-secondary mb-4">选择您的LLM分析师智能体进行分析</p>
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {analysts.map((analyst) => (
            <div
              key={analyst.value}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedAnalysts.includes(analyst.value)
                ? 'border-accent-primary bg-accent-primary/10 shadow-glow-cyan'
                : 'border-dark-border hover:border-accent-primary/50 bg-dark-tertiary'
                }`}
              onClick={() => onToggleAnalyst(analyst.value)}
            >
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={selectedAnalysts.includes(analyst.value)}
                  onChange={() => onToggleAnalyst(analyst.value)}
                  className="mt-1 h-6 w-6 md:h-5 md:w-5 text-accent-primary focus:ring-accent-primary border-dark-border rounded cursor-pointer bg-dark-secondary min-w-touch min-h-touch md:min-w-0 md:min-h-0"
                />
                <div className="flex-1">
                  <h5 className="font-medium text-text-primary text-base md:text-sm">{analyst.label}</h5>
                  <p className="text-sm text-text-secondary">{analyst.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}