'use client';

import React from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { useToast, Toast } from '@/components/ui/Toast';
import { Footer } from '@/components/leaderboard/Footer';
import { Header } from '@/components/leaderboard/Header';

export default function AnalysisDetailPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast } = useToast();
  
  // 返回顶部功能 - 必须在所有条件判断之前声明
  const [showBackToTop, setShowBackToTop] = React.useState(false);
  
  const analysisId = params.id as string;
  
  // 检查是否从排行榜进入（通过 URL 参数判断）
  const fromLeaderboard = searchParams.get('from') === 'leaderboard';
  const marketTab = searchParams.get('market') || 'US'; // 记住从哪个市场标签进入

  const handleBackToHome = () => {
    router.push('/');
  };

  const handleBackToHistory = () => {
    if (fromLeaderboard) {
      // 如果从排行榜进入，返回到对应的市场标签
      router.push(`/?market=${marketTab}`);
    } else if (user) {
      router.push('/dashboard');
    } else {
      router.push('/');
    }
  };

  // 鉴权逻辑：只有从历史记录进入时才需要登录
  React.useEffect(() => {
    // 如果从排行榜进入，不需要鉴权
    if (fromLeaderboard) {
      return undefined;
    }
    
    // 如果从历史记录进入，需要鉴权
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

  // 只有从历史记录进入时才显示加载状态
  if (!fromLeaderboard && (authLoading || !user)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 顶部导航栏 */}
      <Header user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={handleBackToHome}
              className="text-blue-600 hover:text-blue-800"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-gray-400 text-xs" />
            {fromLeaderboard && (
              <>
                <span className="text-gray-600">{getMarketName(marketTab)}</span>
                <i className="fas fa-chevron-right text-gray-400 text-xs" />
              </>
            )}
            <span className="text-gray-600">分析详情</span>
            <i className="fas fa-chevron-right text-gray-400 text-xs" />
            <span className="text-gray-900 font-medium">{analysisId}</span>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        <AnalysisResults
          analysisId={analysisId}
          onBackToConfig={handleBackToHome}
          onBackToHistory={handleBackToHistory}
          onShowToast={showToast}
          fromLeaderboard={fromLeaderboard}
        />
      </div>

      {/* Footer */}
      <Footer />

      {/* 返回顶部按钮 */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
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
