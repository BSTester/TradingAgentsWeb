'use client';

import React from 'react';

export interface ResearchDepthOption {
  value: number;
  label: string;
  description: string;
}

interface ResearchDepthSectionProps {
  depths: ResearchDepthOption[];
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectDepth: (depthValue: number) => void;
}

export function ResearchDepthSection({ depths, value, onChange, onSelectDepth }: ResearchDepthSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
          4
        </div>
        <h4 className="text-lg font-medium text-text-primary">研究深度</h4>
      </div>
      <div className="ml-11">
        <p className="text-sm text-text-secondary mb-4">选择您的研究深度级别</p>
        <div className="space-y-3 md:grid md:grid-cols-3 md:gap-4 md:space-y-0">
          {depths.map((depth) => (
            <div
              key={depth.value}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${value === depth.value
                ? 'border-accent-primary bg-accent-primary/10 shadow-glow-cyan'
                : 'border-dark-border hover:border-accent-primary/50 bg-dark-tertiary'
                }`}
              onClick={() => onSelectDepth(depth.value)}
            >
              <div className="flex items-start space-x-3">
                <input
                  type="radio"
                  name="research_depth"
                  value={depth.value}
                  checked={value === depth.value}
                  onChange={onChange}
                  className="mt-1 h-5 w-5 text-accent-primary focus:ring-accent-primary border-dark-border cursor-pointer bg-dark-secondary"
                />
                <div>
                  <h5 className="font-medium text-text-primary">{depth.label}</h5>
                  <p className="text-sm text-text-secondary">{depth.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}