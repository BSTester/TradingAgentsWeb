'use client';

import React from 'react';

interface AnalysisHistoryPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  isMobile: boolean;
  onPageChange: (page: number) => void;
}

export function AnalysisHistoryPagination({ page, totalPages, total, limit, isMobile, onPageChange }: AnalysisHistoryPaginationProps) {
  return (
    <div className="mt-6 p-4 border-t border-dark-border">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* 左侧：显示信息 */}
        <div className="text-sm text-text-secondary text-center sm:text-left">
          显示第 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 条，共 {total} 条记录
        </div>

        {/* 右侧：分页按钮 */}
        <div className="flex items-center space-x-2">
          {/* 上一页 */}
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-2 text-sm font-medium text-text-secondary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-touch"
          >
            <i className="fas fa-chevron-left mr-1" />
            <span className="hidden sm:inline">上一页</span>
          </button>

          {/* 页码 - 在移动端简化显示 */}
          <div className="flex items-center space-x-1">
            {isMobile ? (
              // Mobile: Simple page indicator
              <span className="px-3 py-2 text-sm font-medium text-text-primary">
                {page} / {totalPages}
              </span>
            ) : (
              // Desktop: Full pagination
              <>
              {/* 第一页 */}
              {page > 3 && (
                <>
                  <button
                    onClick={() => onPageChange(1)}
                    className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-secondary transition-colors"
                  >
                    1
                  </button>
                  {page > 4 && <span className="px-2 text-text-tertiary">...</span>}
                </>
              )}

              {/* 当前页附近的页码 */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p >= page - 2 && p <= page + 2)
                .map(p => (
                  <button
                    key={p}
                    onClick={() => onPageChange(p)}
                    className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${p === page
                      ? 'bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary shadow-glow-cyan'
                      : 'text-text-secondary bg-dark-tertiary border border-dark-border hover:bg-dark-secondary'
                      }`}
                  >
                    {p}
                  </button>
                ))}

              {/* 最后一页 */}
              {page < totalPages - 2 && (
                <>
                  {page < totalPages - 3 && <span className="px-2 text-text-tertiary">...</span>}
                  <button
                    onClick={() => onPageChange(totalPages)}
                    className="px-3 py-2 text-sm font-medium text-text-primary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-secondary transition-colors"
                  >
                    {totalPages}
                  </button>
                </>
              )}
              </>
            )}
          </div>

          {/* 下一页 */}
          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-2 text-sm font-medium text-text-secondary bg-dark-tertiary border border-dark-border rounded-md hover:bg-dark-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-touch"
          >
            <span className="hidden sm:inline">下一页</span>
            <i className="fas fa-chevron-right ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}