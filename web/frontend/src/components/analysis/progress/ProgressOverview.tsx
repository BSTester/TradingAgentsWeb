'use client';

import React from 'react';

interface ProgressOverviewProps {
  progress: number;
}

/** 总体进度条 */
export function ProgressOverview({ progress }: ProgressOverviewProps) {
  return (
    <div>
      <div className="flex justify-between text-sm text-text-secondary mb-2">
        <span>总体进度</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
}