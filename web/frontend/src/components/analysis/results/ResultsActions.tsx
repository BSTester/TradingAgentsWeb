'use client';

import React from 'react';

interface ResultsActionsProps {
  fromLeaderboard: boolean;
  onOpenExportPreview: () => void;
  onBackToConfig: () => void;
}

export function ResultsActions({ fromLeaderboard, onOpenExportPreview, onBackToConfig }: ResultsActionsProps) {
  return (
    <div className="p-6 bg-dark-tertiary border-t border-dark-border no-print">
      {/* 操作按钮 - 排行榜模式下隐藏 */}
      {!fromLeaderboard && (
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <button
            onClick={onOpenExportPreview}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center font-medium"
          >
            <i className="fas fa-download mr-2" />
            导出报告
          </button>
          <button
            onClick={onBackToConfig}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium"
          >
            <i className="fas fa-plus-circle mr-2" />
            新建分析
          </button>
        </div>
      )}

      {/* 免责声明 - 始终显示 */}
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
        <div className="flex items-start">
          <i className="fas fa-exclamation-triangle text-yellow-600 text-xl mr-3 mt-1" />
          <div>
            <h4 className="text-sm font-bold text-yellow-800 mb-1">免责声明</h4>
            <p className="text-xs text-yellow-700 leading-relaxed">
              本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。
              投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。
              过往业绩不代表未来表现，市场波动可能导致本金损失。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
