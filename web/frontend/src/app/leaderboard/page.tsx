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

interface LeaderboardUser {
  user_id: number;
  username: string;
  market_type: string;
  total_assets: number;
  latest_snapshot_date: string;
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
    </div>
  );
}
