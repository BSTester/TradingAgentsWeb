'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/leaderboard/Footer';
import { AppNavbar } from '@/components/common/AppNavbar';

export default function HistoryDetailPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast, showToast, hideToast } = useToast();
  
  // 返回顶部功能
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  
  const analysisId = params.id as string;

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleBackToHistory = () => {
    router.push('/history');
  };

  const handleNewAnalysis = () => {
    // 跳转到分析配置页面（dashboard）
    router.push('/dashboard');
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

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
            <span className="text-text-primary font-medium">分析详情</span>
            <i className="fas fa-chevron-right text-text-tertiary text-xs" />
            <span className="text-text-secondary">{analysisId}</span>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisResults
          analysisId={analysisId}
          onBackToConfig={handleNewAnalysis}
          onBackToHistory={handleBackToHistory}
          onShowToast={showToast}
          fromLeaderboard={false}
        />
      </div>

      {/* Footer */}
      <Footer />

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-accent-primary to-accent-secondary text-white w-12 h-12 rounded-full shadow-glow-cyan hover:scale-110 transition-all duration-300 flex items-center justify-center z-50"
          aria-label="返回顶部"
        >
          <i className="fas fa-arrow-up text-xl" />
        </button>
      )}

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
