'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { buildApiUrl } from '@/utils/api';
import { Header } from '@/components/leaderboard/Header';
import { HeroSection } from '@/components/home/HeroSection';
import { FeaturesShowcase } from '@/components/home/FeaturesShowcase';
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

export default function HomePage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeMarket, setActiveMarket] = useState<Market>('US');
  const [isNavigating, setIsNavigating] = useState(false);

  // Read market from URL params
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const market = params.get('market') as Market;
      if (market && ['US', 'HK', 'CN'].includes(market)) {
        setActiveMarket(market);
      }
    }
  }, []);

  // Fetch leaderboard data
  const { data, isLoading, isError } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const response = await fetch(buildApiUrl('/api/leaderboard'));
      if (!response.ok) throw new Error('获取排行榜失败');
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1 minute cache
    refetchOnWindowFocus: false,
  });

  const marketLabels: Record<Market, string> = {
    US: '美股',
    HK: '港股',
    CN: 'A股'
  };

  const handleCardClick = (analysisId: string) => {
    setIsNavigating(true);
    router.push(`/analysis?id=${analysisId}&from=leaderboard&market=${activeMarket}`);
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
      <div className="min-h-screen bg-dark-primary flex flex-col">
        <Header user={user} onLogout={logout} />
        
        {/* Add padding top to account for fixed header */}
        <div className="pt-16">
          {/* Hero Section - First Screen */}
          <HeroSection onNewAnalysis={handleNewAnalysis} />
          
          {/* Features Showcase Section */}
          <FeaturesShowcase />
          
          {/* Stock Listings Section */}
          <section className="relative py-20 bg-dark-primary">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent" />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              {/* Section Header */}
              <div className="text-center mb-12 space-y-4">
                <h2 className="text-4xl md:text-5xl font-bold text-text-primary">
                  最新分析
                </h2>
                <p className="text-lg text-text-secondary max-w-2xl mx-auto">
                  查看各市场最新的 AI 分析报告和投资建议
                </p>
              </div>

              {/* Market Tabs */}
              <MarketTabs 
                activeMarket={activeMarket}
                onMarketChange={setActiveMarket}
                marketLabels={marketLabels}
              />
              
              {/* Analysis Cards Grid */}
              <AnalysisCardsGrid
                analyses={data?.[activeMarket] || []}
                isLoading={isLoading || authLoading}
                isError={isError}
                onCardClick={handleCardClick}
              />
            </div>
          </section>
        </div>
        
        <Footer />
      </div>

      {/* Navigation Loading Overlay */}
      {isNavigating && (
        <div className="fixed inset-0 bg-dark-primary/90 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <div className="relative inline-block mb-4">
              {/* Outer ring */}
              <div className="w-20 h-20 border-4 border-accent-primary/20 border-t-accent-primary rounded-full animate-spin"></div>
              {/* Inner ring */}
              <div className="absolute top-2 left-2 w-16 h-16 border-4 border-accent-secondary/20 border-b-accent-secondary rounded-full animate-spin-reverse"></div>
            </div>
            <p className="text-text-primary font-medium text-lg">正在加载分析详情...</p>
            <p className="text-sm text-text-tertiary mt-2">请稍候</p>
          </div>
        </div>
      )}
    </>
  );
}
