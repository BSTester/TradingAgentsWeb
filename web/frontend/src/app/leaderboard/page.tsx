'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/leaderboard/Footer';
import { useLeaderboardWebSocket } from '@/hooks/useLeaderboardWebSocket';
import { buildApiUrl } from '@/utils/api';
import { checkMarketStatus } from '@/utils/marketTime';
import { LeaderboardTrendChart } from '@/components/leaderboard/LeaderboardTrendChart';
import { UserDetailPanel } from '@/components/leaderboard/UserDetailPanel';
import apiClient from '@/lib/apiClient';

interface LeaderboardUser {
  user_id: number;
  username: string;
  market_type: string;
  total_assets: number;
  latest_snapshot_date: string;
}

// 申请开通智能盯盘按钮组件
function ApplyIntradayButton({ user }: { user: any }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleApply = async () => {
    if (!user) {
      router.push('/login?redirect=/leaderboard');
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await apiClient.post('/api/intraday/apply');
      
      if (response.data.status === 'success') {
        setMessage({ type: 'success', text: response.data.message || '申请已提交，我们将在1-2个工作日内处理您的申请' });
      } else if (response.data.status === 'info') {
        setMessage({ type: 'success', text: response.data.message });
      } else {
        setMessage({ type: 'error', text: response.data.message || '申请提交失败，请稍后重试' });
      }
    } catch (error: any) {
      console.error('申请失败:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.detail || '申请提交失败，请稍后重试' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-center">
        <button
          onClick={handleApply}
          disabled={isSubmitting}
          className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {isSubmitting ? (
            <>
              <i className="fas fa-spinner fa-spin mr-2" />
              提交中...
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane mr-2" />
              申请开通智能盯盘
            </>
          )}
        </button>
      </div>

      {message && (
        <div className={`mt-4 px-4 py-3 rounded-lg flex items-start ${
          message.type === 'success' 
            ? 'bg-success-500/10 border border-success-500/30' 
            : 'bg-danger-500/10 border border-danger-500/30'
        }`}>
          <i className={`fas ${message.type === 'success' ? 'fa-check-circle text-success-400' : 'fa-exclamation-circle text-danger-400'} mr-2 mt-0.5 flex-shrink-0`} />
          <span className={`text-sm ${message.type === 'success' ? 'text-success-400' : 'text-danger-400'}`}>
            {message.text}
          </span>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  // 市场选择 - 默认US，客户端挂载后从localStorage读取
  const [selectedMarket, setSelectedMarket] = useState<string>('US');
  
  // 用户选择
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  
  // 参加排名弹窗
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // 客户端挂载后从localStorage恢复市场选择
  useEffect(() => {
    const savedMarket = localStorage.getItem('leaderboard_selected_market');
    if (savedMarket) {
      setSelectedMarket(savedMarket);
    }
  }, []);

  // 市场状态
  const [marketStatus, setMarketStatus] = useState<{
    isOpen: boolean;
    message: string;
  }>({ isOpen: true, message: '' });

  // WebSocket连接
  const {
    users,
    isConnected,
    error: wsError,
    lastUpdate,
    connect,
    disconnect
  } = useLeaderboardWebSocket({
    token: user ? localStorage.getItem('access_token') || undefined : undefined,
    reconnectAttempts: 5,
    reconnectInterval: 3000,
  });

  // 连接WebSocket
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  // 处理市场切换
  const handleMarketChange = useCallback((market: string) => {
    setSelectedMarket(market);
    localStorage.setItem('leaderboard_selected_market', market);
  }, []);

  // 检查市场状态
  useEffect(() => {
    const updateMarketStatus = () => {
      const status = checkMarketStatus(selectedMarket);
      setMarketStatus({ isOpen: status.isOpen, message: status.message });
    };

    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000); // 每分钟检查一次
    return () => clearInterval(interval);
  }, [selectedMarket]);

  // 调试：查看接收到的数据
  useEffect(() => {
    console.log('📊 Leaderboard data:', {
      totalUsers: users.length,
      selectedMarket,
      users: users.map(u => ({ id: u.user_id, market: u.market_type, assets: u.total_assets }))
    });
  }, [users, selectedMarket]);

  // 过滤选定市场的用户
  const filteredUsers = users.filter(u => u.market_type === selectedMarket);
  
  // 按资产排序并取前10名
  const top10Users = [...filteredUsers]
    .sort((a, b) => b.total_assets - a.total_assets)
    .slice(0, 10);

  // 处理用户选择
  const handleUserSelect = (userId: number, username: string) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setIsPanelOpen(true);
  };

  // 关闭面板
  const handleClosePanel = () => {
    setIsPanelOpen(false);
    setTimeout(() => {
      setSelectedUserId(null);
      setSelectedUsername('');
    }, 300);
  };

  const usersLoading = !isConnected && users.length === 0;

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      <AppNavbar user={user} onLogout={logout} />

      <div className="pt-16 flex-1 flex flex-col">
        {/* 页面头部 */}
        <div className="bg-dark-secondary/80 backdrop-blur-lg border-b border-dark-border">
          <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  <i className="fas fa-trophy mr-2 text-accent-primary" />
                  实时排名
                </h1>
                <p className="text-sm text-text-secondary mt-1">
                  查看参与排名用户的资产变化趋势 • 数据每5分钟更新
                </p>
              </div>

              {/* 市场选择 */}
              <div className="flex items-center space-x-2 sm:space-x-4">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  {['US', 'HK', 'CN'].map((market) => (
                    <button
                      key={market}
                      onClick={() => handleMarketChange(market)}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                        selectedMarket === market
                          ? 'bg-accent-primary text-white'
                          : 'bg-dark-tertiary text-text-secondary hover:bg-dark-primary'
                      }`}
                    >
                      {market === 'US' ? '美股' : market === 'HK' ? '港股' : 'A股'}
                    </button>
                  ))}
                </div>

                {/* 连接状态 */}
                <div className={`w-2 h-2 sm:w-3 sm:h-3 rounded-full ${
                  isConnected ? 'bg-success-400 animate-pulse' : 'bg-danger-400'
                }`} title={isConnected ? '实时连接' : '连接断开'} />
              </div>
            </div>

            {/* 市场状态提示 */}
            {!marketStatus.isOpen && (
              <div className="mt-3 px-4 py-2 bg-warning-500/10 border border-warning-500/30 rounded-lg flex items-center">
                <i className="fas fa-clock text-warning-500 mr-2" />
                <span className="text-sm text-warning-400">{marketStatus.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* 主要内容区域 */}
        <div className="flex-1 relative">
          {usersLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="fas fa-spinner fa-spin text-3xl text-accent-primary mb-4" />
                <p className="text-text-secondary">连接实时数据中...</p>
              </div>
            </div>
          ) : wsError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="fas fa-exclamation-triangle text-3xl text-danger-500 mb-4" />
                <p className="text-text-secondary mb-4">连接失败: {wsError}</p>
                <button
                  onClick={connect}
                  className="px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-accent-secondary transition-colors"
                >
                  重新连接
                </button>
              </div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <i className="fas fa-inbox text-3xl text-text-tertiary mb-4" />
                <p className="text-text-secondary">该市场暂无参与排名的用户</p>
              </div>
            </div>
          ) : (
            <>
              {/* 趋势图 - 全屏宽度 */}
              <LeaderboardTrendChart
                users={top10Users}
                allUsers={filteredUsers}
                selectedMarket={selectedMarket}
                selectedUserId={selectedUserId}
                onUserSelect={handleUserSelect}
                onJoinClick={() => setIsJoinModalOpen(true)}
                lastUpdate={lastUpdate}
              />

              {/* 用户详情侧边栏 */}
              <UserDetailPanel
                isOpen={isPanelOpen}
                userId={selectedUserId}
                username={selectedUsername}
                market={selectedMarket}
                onClose={handleClosePanel}
              />
            </>
          )}
        </div>
      </div>

      <Footer />

      {/* 参加排名弹窗 */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsJoinModalOpen(false)}>
          <div className="bg-dark-secondary rounded-xl border border-dark-border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 */}
            <div className="sticky top-0 bg-dark-secondary border-b border-dark-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary flex items-center">
                <i className="fas fa-trophy mr-2 text-accent-primary" />
                如何参加实时排名
              </h2>
              <button
                onClick={() => setIsJoinModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-dark-tertiary transition-colors flex items-center justify-center text-text-tertiary hover:text-text-primary"
              >
                <i className="fas fa-times" />
              </button>
            </div>

            {/* 弹窗内容 */}
            <div className="p-6">
              <div className="space-y-5 text-text-secondary mb-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-accent-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-accent-primary font-bold text-lg">1</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold mb-2 text-base">注册账号并申请开通智能盯盘功能</h3>
                    <p className="text-sm leading-relaxed">点击下方"申请开通智能盯盘"按钮，我们将在1-2个工作日内为您开通权限。</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-accent-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-accent-primary font-bold text-lg">2</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold mb-2 text-base">准备大模型 API</h3>
                    <p className="text-sm leading-relaxed">
                      分析功能需要使用大模型服务（如 OpenAI、Anthropic、Google Gemini 等），请自备大模型接口的 API Key。开通方式请参考对应大模型提供方的官网。
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-accent-primary/20 rounded-full flex items-center justify-center">
                    <span className="text-accent-primary font-bold text-lg">3</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-text-primary font-semibold mb-2 text-base">部署富途虚拟交易 API</h3>
                    <p className="text-sm leading-relaxed mb-3">
                      需要自行部署富途虚拟交易 API 服务，参考项目：
                      <a 
                        href="https://github.com/BSTester/futu-paper-trade-api" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-accent-primary hover:text-accent-secondary ml-1 inline-flex items-center font-medium"
                      >
                        futu-paper-trade-api
                        <i className="fas fa-external-link-alt ml-1.5 text-xs" />
                      </a>
                    </p>
                    <div className="bg-accent-primary/10 border border-accent-primary/30 rounded-lg px-4 py-3">
                      <p className="text-sm">
                        💡 推荐部署到 <a 
                          href="https://www.leapcell.io/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-accent-primary hover:text-accent-secondary font-semibold"
                        >
                          Leapcell
                        </a> 平台，快速便捷，免费额度充足。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 申请按钮 */}
              <div className="flex justify-center pt-4 border-t border-dark-border">
                <ApplyIntradayButton user={user} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
