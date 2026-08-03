'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import dynamic from 'next/dynamic';
import { AnalysisResultsSkeleton } from '@/components/analysis/AnalysisResultsSkeleton';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/common/Footer';
import { AppNavbar } from '@/components/common/AppNavbar';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageLoading } from '@/components/ui/PageLoading';

// Code-split the heavy AnalysisResults (≈2k-line report view + markdown deps) so
// the route shell + skeleton paint on navigation instead of a white screen while
// the whole component downloads/parses. See frontend/issues/WS-86.
const AnalysisResults = dynamic(
  () => import('@/components/analysis/AnalysisResults').then((m) => m.AnalysisResults),
  { ssr: false, loading: () => <AnalysisResultsSkeleton /> },
);

function HistoryDetailContent() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast } = useToast();
  
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  
  // 从 URL 参数获取 ID
  const analysisId = searchParams.get('id') || '';

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleBackToHistory = () => {
    router.push('/history');
  };

  const handleNewAnalysis = () => {
    router.push('/');
  };

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

  if (!analysisId) {
    return <ErrorState title="缺少分析 ID" description="请从分析历史重新打开报告。" onRetry={handleBackToHistory} />;
  }

  if (authLoading || !user) {
    return <PageLoading message="正在加载分析详情..." />;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      <nav className="bg-dark-secondary/80 backdrop-blur-lg border-b border-dark-border shadow-lg pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-10 overflow-hidden">
          <div className="flex items-center space-x-2 text-sm whitespace-nowrap">
            <button
              onClick={handleBackToHome}
              className="text-accent-primary hover:text-accent-secondary transition-colors flex-shrink-0"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <button
              onClick={handleBackToHistory}
              className="text-accent-primary hover:text-accent-secondary transition-colors flex-shrink-0"
            >
              分析历史
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <span className="text-text-primary font-medium flex-shrink-0">分析详情</span>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <span className="text-text-secondary">{analysisId}</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisResults
          analysisId={analysisId}
          onBackToConfig={handleNewAnalysis}
          onBackToHistory={handleBackToHistory}
          onShowToast={showToast}
          fromLeaderboard={false}
        />
      </div>

      <Footer />

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary w-12 h-12 rounded-full shadow-glow-cyan hover:scale-110 transition-all duration-300 flex items-center justify-center z-50"
          aria-label="返回顶部"
        >
          <i className="fas fa-arrow-up text-xl" />
        </button>
      )}

      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
    </div>
  );
}

export default function HistoryDetailPage() {
  return (
    <Suspense fallback={<PageLoading message="正在加载分析详情..." />}>
      <HistoryDetailContent />
    </Suspense>
  );
}
