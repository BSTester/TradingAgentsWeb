'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/leaderboard/Footer';
import { AppNavbar } from '@/components/common/AppNavbar';

export default function HistoryProgressPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast, showToast, hideToast } = useToast();
  
  const analysisId = params.id as string;

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleBackToHistory = () => {
    router.push('/history');
  };

  const handleComplete = () => {
    router.push(`/history/${analysisId}`);
  };

  // 鉴权逻辑
  React.useEffect(() => {
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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      {/* 顶部导航栏 */}
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-dark-secondary/80 backdrop-blur-lg border-b border-dark-border shadow-lg pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-10">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={handleBackToHome}
              className="text-accent-primary hover:text-accent-secondary transition-colors"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs" />
            <button
              onClick={handleBackToHistory}
              className="text-accent-primary hover:text-accent-secondary transition-colors"
            >
              分析历史
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs" />
            <span className="text-text-primary font-medium">分析进度</span>
            <i className="fas fa-chevron-right text-text-tertiary text-xs" />
            <span className="text-text-secondary">{analysisId}</span>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisProgress
          analysisId={analysisId}
          onComplete={handleComplete}
          onBackToConfig={handleBackToHistory}
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
