'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { configAPI } from '@/lib/apiClient';
import { AppConfig } from '@/lib/types';
import { AnalysisConfigForm } from '@/components/analysis/AnalysisConfigForm';
import { AnalysisProgress } from '@/components/analysis/AnalysisProgress';
import { AnalysisResults } from '@/components/analysis/AnalysisResults';
import { useToast, Toast } from '@/components/ui/Toast';
import { AppNavbar } from '@/components/common/AppNavbar';

function DashboardContent() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast, showToast, hideToast } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentView, setCurrentView] = useState<'config' | 'progress' | 'results'>('config');
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Password setup modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

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
      
      // Check if we should show password setup modal (only once after registration)
      const setupPassword = searchParams?.get('setup_password');
      const modalKey = `password_modal_shown_${user.id}`;
      const hasShownModal = localStorage.getItem(modalKey);
      
      if (setupPassword === 'true' && !hasShownModal) {
        // Show modal after a short delay to ensure smooth transition
        setTimeout(() => {
          setShowPasswordModal(true);
        }, 500);
        
        // Mark modal as shown for this user
        localStorage.setItem(modalKey, 'true');
        
        // Remove the query parameter from URL
        router.replace('/dashboard', { scroll: false });
      }
    }
  }, [user, searchParams, router]);

  const handleAnalysisStart = (analysisId: string) => {
    setCurrentAnalysisId(analysisId);
    setCurrentView('progress');
  };

  const handleAnalysisComplete = () => {
    setCurrentView('results');
  };

  const handleBackToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  const handleSetPassword = async () => {
    if (password !== confirmPassword) {
      showToast('两次输入的密码不一致', 'error');
      return;
    }

    if (password.length < 6) {
      showToast('密码长度至少6位', 'error');
      return;
    }
    
    setIsSettingPassword(true);
    
    try {
      const { authAPI } = await import('@/lib/apiClient');
      await authAPI.setPassword(password);
      
      showToast('密码设置成功！', 'success');
      setShowPasswordModal(false);
      setPassword('');
      setConfirmPassword('');
      
      // Refresh user data to update has_set_password flag
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      showToast(error.message || '设置密码失败，请稍后重试', 'error');
    } finally {
      setIsSettingPassword(false);
    }
  };
  
  const handleSkipPassword = () => {
    setShowPasswordModal(false);
    setPassword('');
    setConfirmPassword('');
    showToast('您可以稍后在个人中心设置密码', 'info');
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
      <AppNavbar user={user} onLogout={logout} showNewAnalysis={false} />

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
            onBackToHistory={() => router.push('/history')}
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
      
      {/* Password Setup Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-green-600 text-2xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">注册成功！</h3>
              <p className="text-sm text-gray-600">
                为了账户安全，建议您设置登录密码
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="modal-password" className="block text-sm font-medium text-gray-700 mb-2">
                  设置密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="modal-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="请输入密码（至少6位）"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`} />
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="modal-confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                  确认密码
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <i className="fas fa-lock text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="modal-confirm-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full h-12 pl-10 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="请再次输入密码"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <i className={`fas ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-gray-400 hover:text-gray-600`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleSkipPassword}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                >
                  稍后设置
                </button>
                <button
                  type="button"
                  onClick={handleSetPassword}
                  disabled={isSettingPassword || !password || !confirmPassword}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSettingPassword ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2" />
                      设置中...
                    </>
                  ) : (
                    '确认设置'
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 text-center mt-4">
                <i className="fas fa-info-circle mr-1" />
                您也可以稍后在个人中心设置或修改密码
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}