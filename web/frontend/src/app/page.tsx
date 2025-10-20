'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { buildApiUrl } from '@/utils/api';
import { Header } from '@/components/leaderboard/Header';
import { HeroSection } from '@/components/leaderboard/HeroSection';
import { MarketTabs } from '@/components/leaderboard/MarketTabs';
import { AnalysisCardsGrid } from '@/components/leaderboard/AnalysisCardsGrid';
import { Footer } from '@/components/leaderboard/Footer';

type Market = 'US' | 'HK' | 'CN';

interface AnalysisCardData {
  analysis_id: string;
  ticker: string;
  company_name?: string;
  market: string;
  analysis_date: string;
  trading_decision: string;
  completed_at: string;
  progress_percentage: number;
}

interface LeaderboardData {
  US: AnalysisCardData[];
  HK: AnalysisCardData[];
  CN: AnalysisCardData[];
}

export default function LeaderboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeMarket, setActiveMarket] = useState<Market>('US');
  const [isNavigating, setIsNavigating] = useState(false);

  // 从 URL 参数中读取市场标签
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const market = params.get('market') as Market;
      if (market && ['US', 'HK', 'CN'].includes(market)) {
        setActiveMarket(market);
      }
    }
  }, []);

  // 获取排行榜数据
  const { data, isLoading, isError } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(buildApiUrl('/api/leaderboard'));
      if (!response.ok) throw new Error('获取排行榜失败');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
  });

  const marketLabels: Record<Market, string> = {
    US: '美股',
    HK: '港股',
    CN: 'A股'
  };

  const handleCardClick = (analysisId: string) => {
    // 显示loading状态
    setIsNavigating(true);
    // 传递来源和市场参数，用于返回时定位
    router.push(`/analysis/${analysisId}?from=leaderboard&market=${activeMarket}`);
  };

  const handleNewAnalysis = () => {
    if (user) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header user={user} onLogout={logout} />
        <HeroSection onNewAnalysis={handleNewAnalysis} />
        
        <div className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
          <MarketTabs 
            activeMarket={activeMarket}
            onMarketChange={setActiveMarket}
            marketLabels={marketLabels}
          />
          
          <AnalysisCardsGrid
            analyses={data?.[activeMarket] || []}
            isLoading={isLoading || authLoading}
            isError={isError}
            onCardClick={handleCardClick}
          />
        </div>
        
        <Footer />
      </div>

      {/* 页面跳转Loading遮罩 */}
      {isNavigating && (
        <div className="fixed inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="relative inline-block mb-4">
              {/* 外圈旋转 */}
              <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              {/* 内圈反向旋转 */}
              <div className="absolute top-2 left-2 w-16 h-16 border-4 border-purple-200 border-b-purple-600 rounded-full animate-spin-reverse"></div>
            </div>
            <p className="text-gray-700 font-medium text-lg">正在加载分析详情...</p>
            <p className="text-sm text-gray-500 mt-2">请稍候</p>
          </div>
        </div>
      )}
    </>
  );
}
