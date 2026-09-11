'use client';

import React from 'react';

interface ProgressActionsProps {
  isCompleted: boolean;
  isStopping: boolean;
  onStop: () => void;
  onBackToConfig: () => void;
}

/** 操作按钮：中断分析 / 返回 */
export function ProgressActions({ isCompleted, isStopping, onStop, onBackToConfig }: ProgressActionsProps) {
  return (
    <div className="flex justify-end space-x-3 pt-4 border-t">
      {!isCompleted && (
        <button
          onClick={onStop}
          disabled={isStopping}
          className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isStopping ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2" />
              中断中...
            </>
          ) : (
            <>
              <i className="fas fa-stop mr-2" />
              中断分析
            </>
          )}
        </button>
      )}
      <button
        onClick={onBackToConfig}
        className="px-4 py-2 text-text-primary bg-dark-tertiary rounded-md hover:bg-dark-primary border border-dark-border transition-colors"
      >
        <i className="fas fa-arrow-left mr-2" />
        返回
      </button>
    </div>
  );
}