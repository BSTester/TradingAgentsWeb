'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { configAPI } from '@/lib/apiClient';
import { AppConfig } from '@/lib/types';
import { AnalysisConfigForm } from '@/components/analysis/AnalysisConfigForm';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { AnalysisHistory } from '@/components/analysis/AnalysisHistory';
import { useToast, Toast } from '@/components/ui/Toast';

export default function DashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentView, setCurrentView] = useState<'config' | 'progress' | 'results' | 'history'>('config');
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 认证保护逻辑
  useEffect(() => {
    // 给认证系统更多时间初始化，避免过早的重定向
    if (!authLoading && !user) {
      // 等待一点时间再检查，确保认证状态完全加载
      const timer = setTimeout(() => {
        // 再次检查用户状态
        const token = localStorage.getItem('access_token');
        if (!token && !user) {
          router.push('/auth');
        }
      }, 500); // 给500ms缓冲时间
      return () => clearTimeout(timer);
    }
    // 显式返回undefined以满足TypeScript要求
    return undefined;
  }, [user, authLoading, router]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configData = await configAPI.getConfig();
        setConfig(configData);
      } catch {
        showToast('获取配置失败', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      loadConfig();
    }
  }, [user]);

  const handleAnalysisStart = (analysisId: string) => {
    console.log('=== Dashboard: handleAnalysisStart ===');
    console.log('Received Analysis ID:', analysisId);
    setCurrentAnalysisId(analysisId);
    setCurrentView('progress');
    console.log('Switched to progress view');
  };

  const handleAnalysisComplete = () => {
    setCurrentView('results');
  };

  const handleBackToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // 返回顶部按钮显示逻辑
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 如果正在认证检查或加载配置，显示加载状态
  if (authLoading || isLoading || !user) {
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
      <nav className="bg-gray-900 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 cursor-pointer" onClick={() => router.push('/')}>
                <h1 className="text-white text-xl font-bold">
                  <i className="fas fa-chart-line mr-2" />
                  TradingAgents
                </h1>
              </div>
            </div>
            <div className="flex items-center flex-wrap gap-2 sm:space-x-4">
              <button
                onClick={() => setCurrentView('history')}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                <i className="fas fa-history mr-1" />
                分析历史
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => router.push('/admin/users')}
                  className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
                >
                  <i className="fas fa-users-cog mr-1" />
                  用户管理
                </button>
              )}
              <div className="relative">
                <button className="text-gray-300 hover:text-white flex items-center">
                  <i className={`fas ${user?.role === 'admin' ? 'fa-crown' : 'fa-user-circle'} mr-2`} />
                  {user?.username}
                  {user?.role === 'admin' && (
                    <span className="ml-2 px-2 py-0.5 bg-yellow-500 text-gray-900 text-xs font-bold rounded">
                      管理员
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium"
              >
                <i className="fas fa-power-off mr-1" />
                退出
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 w-full">
        {/* 欢迎横幅 */}
        {currentView === 'config' && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-6 text-white">
            <div className="text-center">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                <i className="fas fa-robot mr-3" />
                TradingAgents
              </h1>
              <p className="text-lg md:text-xl mb-2">多智能体大语言模型金融交易框架</p>
              <p className="text-base md:text-lg">
                <strong>工作流程：</strong>
                分析师团队 → 研究团队 → 交易员 → 风险管理 → 投资组合分析
              </p>
            </div>
          </div>
        )}

        {/* 内容渲染 */}
        {currentView === 'config' && config && (
          <AnalysisConfigForm
            config={config}
            onAnalysisStart={handleAnalysisStart}
            onShowToast={showToast}
          />
        )}

        {currentView === 'progress' && currentAnalysisId && (
          <AnalysisProgress
            analysisId={currentAnalysisId}
            onComplete={handleAnalysisComplete}
            onBackToConfig={() => setCurrentView('config')}
            onShowToast={showToast}
          />
        )}

        {currentView === 'results' && currentAnalysisId && (
          <AnalysisResults
            analysisId={currentAnalysisId}
            onBackToConfig={() => setCurrentView('config')}
            onBackToHistory={() => setCurrentView('history')}
            onShowToast={showToast}
          />
        )}

        {currentView === 'history' && (
          <AnalysisHistory
            onBackToConfig={() => setCurrentView('config')}
            onViewResults={(analysisId: string) => {
              setCurrentAnalysisId(analysisId);
              setCurrentView('results');
            }}
            onViewProgress={(analysisId: string) => {
              setCurrentAnalysisId(analysisId);
              setCurrentView('progress');
            }}
            onShowToast={showToast}
          />
        )}
      </div>

      {/* 回到顶部按钮，仅在查看报告页面且滚动超过300px时显示 */}
      {currentView === 'results' && showBackToTop && (
        <button
          onClick={handleBackToTop}
          className="fixed bottom-8 right-8 bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg hover:bg-blue-700 transition-all duration-300 flex items-center justify-center z-50 hover:scale-110"
          aria-label="返回顶部"
        >
          <i className="fas fa-arrow-up text-xl" />
        </button>
      )}

      {/* 页面底部版权信息 */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="text-center text-sm text-gray-500">
            <p>© {new Date().getFullYear()} SmartAIGC. 保留所有权利</p>
            <p className="mt-1">
              基于 <a href="https://github.com/TauricResearch/TradingAgents" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">TradingAgents</a> 构建
            </p>
          </div>
        </div>
      </footer>

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