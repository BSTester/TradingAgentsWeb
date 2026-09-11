'use client';

import React from 'react';

interface DeleteConfirmDialogProps {
  ticker: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({ ticker, onCancel, onConfirm }: DeleteConfirmDialogProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-secondary rounded-lg shadow-xl border border-dark-border max-w-md w-full animate-fade-in">
        <div className="p-4 md:p-6">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-100 flex items-center justify-center mr-3 md:mr-4 flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-red-600 text-lg md:text-xl" />
            </div>
            <div>
              <h3 className="text-responsive-h4 text-text-primary">确认删除</h3>
              <p className="text-responsive-small text-text-secondary">此操作无法撤销</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-responsive-body text-text-secondary">
              确定要删除 <span className="font-bold text-text-primary">{ticker}</span> 的分析记录吗？
            </p>
            <p className="text-responsive-small text-text-tertiary mt-2">
              删除后，所有相关的分析数据和结果都将被永久删除。
            </p>
          </div>

          <div className="flex flex-col md:flex-row gap-3 md:space-x-3">
            <button
              onClick={onCancel}
              className="w-full md:flex-1 px-4 py-3 md:py-2 bg-dark-tertiary text-text-secondary rounded-lg hover:bg-dark-primary hover:text-text-primary transition-colors font-medium min-h-touch"
            >
              取消
            </button>
            <button
              onClick={onConfirm}
              className="w-full md:flex-1 px-4 py-3 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium min-h-touch"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}