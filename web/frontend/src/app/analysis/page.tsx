'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/common/Footer';
import { AppNavbar } from '@/components/common/AppNavbar';
import { ErrorState } from '@/components/ui/ErrorState';
import { PageLoading } from '@/components/ui/PageLoading';

function AnalysisDetailContent() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast } = useToast();
  
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  
  // 从 URL 参数获取 ID
  const analysisId = searchParams.get('id') || '';
  const fromLeaderboard = searchParams.get('from') === 'leaderboard';
  const marketTab = searchParams.get('market') || 'US';

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleBackToHistory = () => {
    if (fromLeaderboard) {
      router.push(`/?market=${marketTab}`);
    } else if (user) {
      router.push('/');
    } else {
      router.push('/');
    }
  };

  const handleNewAnalysis = () => {
    if (user) {
      router.push('/');
    } else {
      router.push('/login');
    }
  };

  React.useEffect(() => {
    if (fromLeaderboard) {
      return undefined;
    }
    
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
  }, [user, authLoading, router, fromLeaderboard]);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!analysisId) {
    return <ErrorState title="缺少分析 ID" description="请从分析历史或排行榜重新打开报告。" onRetry={handleBackToHome} />;
  }

  if (!fromLeaderboard && (authLoading || !user)) {
    return <PageLoading message="正在加载分析报告..." />;
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getMarketName = (market: string) => {
    const marketNames: Record<string, string> = {
      'US': '美股',
      'HK': '港股',
      'CN': 'A股'
    };
    return marketNames[market] || '排行榜';
  };

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      {/* Breadcrumb Navigation */}
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
            {fromLeaderboard && (
              <>
                <span className="text-text-secondary flex-shrink-0">{getMarketName(marketTab)}</span>
                <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
              </>
            )}
            <span className="text-text-secondary flex-shrink-0">分析详情</span>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <span className="text-text-primary font-medium">{analysisId}</span>
          </div>
        </div>
      </nav>

      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisResults
          analysisId={analysisId}
          onBackToConfig={handleNewAnalysis}
          onBackToHistory={handleBackToHistory}
          onShowToast={showToast}
          fromLeaderboard={fromLeaderboard}
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

export default function AnalysisDetailPage() {
  return (
    <Suspense fallback={<PageLoading message="正在加载分析报告..." />}>
      <AnalysisDetailContent />
    </Suspense>
  );
}
