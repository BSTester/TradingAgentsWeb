'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AnalysisHistory } from '@/components/analysis/AnalysisHistory';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/leaderboard/Footer';
import { AppNavbar } from '@/components/common/AppNavbar';

export default function HistoryPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();

  // 认证保护逻辑
  useEffect(() => {
    if (!authLoading && !user) {
      const timer = setTimeout(() => {
        const token = localStorage.getItem('access_token');
        if (!token && !user) {
          router.push('/login');
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [user, authLoading, router]);

  // 如果正在认证检查，显示加载状态
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航栏 */}
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-gray-400 text-xs" />
            <span className="text-gray-900 font-medium">分析历史</span>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisHistory
          onBackToConfig={() => router.push('/dashboard')}
          onViewResults={(analysisId: string) => {
            router.push(`/history/${analysisId}`);
          }}
          onViewProgress={(analysisId: string) => {
            router.push(`/history/${analysisId}/progress`);
          }}
          onShowToast={showToast}
        />
      </div>

      {/* Footer */}
      <Footer />

      {/* Toast组件 */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}
