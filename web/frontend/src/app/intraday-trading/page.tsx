'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/leaderboard/Footer';
import { useToast, Toast } from '@/components/ui/Toast';
import { ControlPanel } from '@/components/intraday/ControlPanel';
import { PositionOverview } from '@/components/intraday/PositionOverview';
import { TodayOrders } from '@/components/intraday/TodayOrders';
import { DecisionHistory } from '@/components/intraday/DecisionHistory';
import { AccountInfo } from '@/components/intraday/AccountInfo';
import { useIntradayWebSocket } from '@/hooks/useIntradayWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { intradayTradingKeys } from '@/hooks/useIntradayTrading';
import { buildApiUrl } from '@/utils/api';

export default function IntradayTradingPage() {
  const { user, logout, isLoading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const queryClient = useQueryClient();

  // 管理排名参与状态
  const [participateInLeaderboard, setParticipateInLeaderboard] = useState<boolean>(
    user?.participate_in_leaderboard || false
  );

  // 当用户数据加载时，更新排名参与状态
  React.useEffect(() => {
    if (user) {
      setParticipateInLeaderboard(user.participate_in_leaderboard || false);
    }
  }, [user]);

  // 从 localStorage 读取上次选择的市场,如果没有则默认为 'US'
  const [selectedMarket, setSelectedMarket] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('intraday_selected_market');
      return cached || 'US';
    }
    return 'US';
  });

  // 处理市场切换,同时保存到 localStorage
  const handleMarketChange = useCallback((market: string) => {
    setSelectedMarket(market);
    if (typeof window !== 'undefined') {
      localStorage.setItem('intraday_selected_market', market);
    }
  }, []);

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'intraday_session_start':
        showToast('分析会话已开始', 'info');
        
        // Create a running decision record when session starts
        if (message.decision_id) {
          const currentDecisions = queryClient.getQueryData(
            intradayTradingKeys.decisionsList(1, 20)
          ) as any;
          
          // Create a temporary running decision record
          const runningDecision = {
            id: message.decision_id,
            session_id: message.session_id || '',
            market_type: message.market_type || selectedMarket,
            status: 'running',
            start_time: new Date().toISOString(),
            end_time: null,
            trades_count: 0,
            trades_executed: [],
          };
          
          if (currentDecisions) {
            // Check if this decision already exists (to avoid duplicates)
            const existingIndex = currentDecisions.items.findIndex(
              (item: any) => item.id === message.decision_id
            );
            
            let updatedItems;
            if (existingIndex >= 0) {
              // Update existing decision
              updatedItems = [...currentDecisions.items];
              updatedItems[existingIndex] = { ...updatedItems[existingIndex], status: 'running' };
            } else {
              // Add new running decision at the beginning
              updatedItems = [runningDecision, ...currentDecisions.items].slice(0, 20);
            }
            
            queryClient.setQueryData(
              intradayTradingKeys.decisionsList(1, 20),
              {
                ...currentDecisions,
                items: updatedItems,
                total: existingIndex >= 0 ? currentDecisions.total : currentDecisions.total + 1,
              }
            );
          } else {
            // If no decisions list exists yet, create one with just this running decision
            queryClient.setQueryData(
              intradayTradingKeys.decisionsList(1, 20),
              {
                items: [runningDecision],
                total: 1,
                page: 1,
                limit: 20,
              }
            );
          }
        }
        break;
        
      case 'analysis_trigger':
        // Analysis is being triggered by scheduler
        break;
        
      case 'tool_call':
        // Tool is being called
        break;
        
      case 'tool_result':
        // Tool result received
        // Only refresh the currently selected market to avoid unnecessary API calls
        if (message.tool === 'get_futu_account_info') {
          queryClient.invalidateQueries({ 
            queryKey: [...intradayTradingKeys.account(), selectedMarket] 
          });
        } else if (message.tool === 'get_futu_positions') {
          queryClient.invalidateQueries({ 
            queryKey: [...intradayTradingKeys.positions(), selectedMarket] 
          });
        } else if (message.tool === 'place_futu_order' || message.tool === 'cancel_futu_order') {
          // Refresh orders when order is placed or cancelled
          queryClient.invalidateQueries({ 
            queryKey: [...intradayTradingKeys.orders(), selectedMarket] 
          });
        }
        break;
        
      case 'agent_start':
        showToast('Agent开始分析', 'info');
        break;
        
      case 'agent_result':
        showToast('Agent分析完成', 'success');
        break;
        
      case 'decisions_initial':
        // Initial decisions list from WebSocket
        // Directly set the query data
        queryClient.setQueryData(
          intradayTradingKeys.decisionsList(1, 20),
          message.decisions
        );
        break;
      
      case 'intraday_session_complete':
        showToast('分析会话已完成', 'success');
        
        // Update the existing running decision to completed
        if (message.decision_record) {
          const currentDecisions = queryClient.getQueryData(
            intradayTradingKeys.decisionsList(1, 20)
          ) as any;
          
          if (currentDecisions) {
            // Find and update the existing decision
            const existingIndex = currentDecisions.items.findIndex(
              (item: any) => item.id === message.decision_record.id
            );
            
            let updatedItems;
            if (existingIndex >= 0) {
              // Update existing decision with complete data
              updatedItems = [...currentDecisions.items];
              updatedItems[existingIndex] = message.decision_record;
            } else {
              // If not found (shouldn't happen), add it
              updatedItems = [message.decision_record, ...currentDecisions.items].slice(0, 20);
            }
            
            queryClient.setQueryData(
              intradayTradingKeys.decisionsList(1, 20),
              {
                ...currentDecisions,
                items: updatedItems,
                total: existingIndex >= 0 ? currentDecisions.total : currentDecisions.total + 1,
              }
            );
          }
        }
        
        // Refresh account info, positions, and orders after decision is complete
        // This ensures the UI shows the latest data after trades are executed
        queryClient.invalidateQueries({ 
          queryKey: [...intradayTradingKeys.account(), selectedMarket] 
        });
        queryClient.invalidateQueries({ 
          queryKey: [...intradayTradingKeys.positions(), selectedMarket] 
        });
        queryClient.invalidateQueries({ 
          queryKey: [...intradayTradingKeys.orders(), selectedMarket] 
        });
        break;
        
      case 'intraday_session_error':
        showToast(`分析出错: ${message.message}`, 'error');
        
        // Update the running decision to failed status
        if (message.decision_id) {
          const currentDecisions = queryClient.getQueryData(
            intradayTradingKeys.decisionsList(1, 20)
          ) as any;
          
          if (currentDecisions) {
            const existingIndex = currentDecisions.items.findIndex(
              (item: any) => item.id === message.decision_id
            );
            
            if (existingIndex >= 0) {
              const updatedItems = [...currentDecisions.items];
              updatedItems[existingIndex] = {
                ...updatedItems[existingIndex],
                status: 'failed',
                end_time: new Date().toISOString(),
              };
              
              queryClient.setQueryData(
                intradayTradingKeys.decisionsList(1, 20),
                {
                  ...currentDecisions,
                  items: updatedItems,
                }
              );
            }
          }
        }
        
        queryClient.invalidateQueries({ queryKey: intradayTradingKeys.all });
        break;
        
      case 'scheduler_status_change':
        // Scheduler status changed
        queryClient.invalidateQueries({ queryKey: intradayTradingKeys.schedulerStatus() });
        break;
      
      case 'scheduler_status_sync':
      case 'scheduler_status_update':
        // Scheduler status sync/update - directly update cache
        // Create a new object to ensure React detects the change
        queryClient.setQueryData(
          intradayTradingKeys.schedulerStatus(),
          { ...message.status } // Spread to create new object reference
        );
        break;
      
      case 'scheduler_started':
        // Scheduler started confirmation
        // Create a new object to ensure React detects the change
        queryClient.setQueryData(
          intradayTradingKeys.schedulerStatus(),
          { ...message.status } // Spread to create new object reference
        );
        showToast('系统已启动', 'success');
        break;
      
      case 'scheduler_stopped':
        // Scheduler stopped confirmation
        // Create a new object to ensure React detects the change
        queryClient.setQueryData(
          intradayTradingKeys.schedulerStatus(),
          { ...message.status } // Spread to create new object reference
        );
        showToast('系统已停止', 'success');
        break;
        
      default:
        break;
    }
  }, [showToast, queryClient, selectedMarket]);

  // WebSocket connection (user-specific)
  const { status: wsStatus, isConnected } = useIntradayWebSocket(
    user?.id?.toString() || null, // Use user ID as channel
    {
      onMessage: handleWebSocketMessage,
      onStatusChange: (status) => {
        if (status === 'error') {
          console.warn('WebSocket connection failed');
        }
      },
      autoConnect: !!user,
    }
  );

  // 认证和权限保护逻辑
  useEffect(() => {
    if (!authLoading && user) {
      // 检查用户是否有访问权限（管理员或有短线交易权限）
      if (user.role !== 'admin' && !user.can_access_intraday_trading) {
        showToast('您没有访问短线交易功能的权限', 'error');
        router.push('/');
      }
    } else if (!authLoading && !user) {
      // 用户未登录，跳转到首页
      router.push('/');
    }
  }, [user, authLoading, router, showToast]);

  // 如果正在认证检查或没有权限，显示加载状态
  if (authLoading || !user || (user.role !== 'admin' && !user.can_access_intraday_trading)) {
    return (
      <div className="min-h-screen bg-dark-primary flex items-center justify-center">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-accent-primary mb-4" />
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-primary flex flex-col">
      {/* 顶部导航栏 */}
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-dark-secondary/80 backdrop-blur-lg border-b border-dark-border shadow-lg pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-10 overflow-hidden">
          <div className="flex items-center space-x-2 text-sm whitespace-nowrap">
            <button
              onClick={() => router.push('/')}
              className="text-accent-primary hover:text-accent-secondary transition-colors flex-shrink-0"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-text-tertiary text-xs flex-shrink-0" />
            <span className="text-text-primary font-medium">智能盯盘</span>
          </div>
        </div>
      </nav>

      {/* 主要内容区域 */}
      <div className="flex-1 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-responsive-h2 text-text-primary mb-2">
                  <i className="fas fa-chart-line mr-3 text-success-500" />
                  智能盯盘
                </h1>
                <p className="text-responsive-body text-text-secondary">
                  实时盯盘分析，智能决策，自动监控
                </p>
              </div>
              
              {/* Right side controls */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                {/* WebSocket Status Indicator - Icon only on all screens */}
                <div 
                  className={`flex items-center justify-center w-6 h-6 rounded-full ${
                    isConnected
                      ? 'bg-success-500/20'
                      : wsStatus === 'connecting'
                      ? 'bg-warning-500/20'
                      : wsStatus === 'error'
                      ? 'bg-warning-500/20'
                      : 'bg-dark-tertiary'
                  }`}
                  title={
                    isConnected
                      ? '实时连接'
                      : wsStatus === 'connecting'
                      ? '连接中'
                      : wsStatus === 'error'
                      ? '轮询模式'
                      : '未连接'
                  }
                >
                  <span className={`w-2 h-2 rounded-full ${
                    isConnected
                      ? 'bg-success-500 animate-pulse'
                      : wsStatus === 'connecting'
                      ? 'bg-warning-500 animate-pulse'
                      : wsStatus === 'error'
                      ? 'bg-warning-500'
                      : 'bg-text-tertiary'
                  }`} />
                </div>

                {/* Participate in Ranking Toggle */}
                <div className="flex items-center space-x-2">
                  <div className="relative group">
                    <i 
                      className="fas fa-info-circle text-text-tertiary cursor-pointer sm:cursor-help" 
                      onClick={(e) => {
                        // Mobile: toggle tooltip on click
                        if (window.innerWidth < 640) {
                          const tooltip = e.currentTarget.nextElementSibling as HTMLElement;
                          if (tooltip) {
                            tooltip.classList.toggle('opacity-0');
                            tooltip.classList.toggle('opacity-100');
                          }
                        }
                      }}
                    />
                    <div className="absolute bottom-full right-0 sm:left-1/2 sm:transform sm:-translate-x-1/2 mb-2 px-3 py-2 bg-dark-secondary border border-dark-border rounded-lg shadow-lg text-xs text-text-primary opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 w-64 sm:w-72 text-left whitespace-normal">
                      开启后，您的账户将参与实时排名，资产信息将公开展示（可随时关闭）
                      <div className="absolute top-full right-4 sm:left-1/2 sm:transform sm:-translate-x-1/2">
                        <div className="w-2 h-2 bg-dark-secondary border-r border-b border-dark-border transform rotate-45 -translate-y-1"></div>
                      </div>
                    </div>
                  </div>
                  <div className="relative group">
                    <label className="flex items-center cursor-pointer">
                      <span className="hidden sm:inline text-sm text-text-secondary mr-2">参加排名</span>
                      <div className="relative inline-block">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={participateInLeaderboard}
                          onChange={async (e) => {
                            const newCheckedState = e.target.checked;
                            setParticipateInLeaderboard(newCheckedState); // 立即更新UI

                            try {
                              const token = localStorage.getItem('access_token');
                              const response = await fetch(buildApiUrl('/api/user/leaderboard-toggle'), {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  'Authorization': `Bearer ${token}`,
                                },
                                credentials: 'include',
                              });

                              if (!response.ok) {
                                throw new Error('更新设置失败');
                              }

                              const result = await response.json();

                              // Update the actual state based on backend response
                              setParticipateInLeaderboard(result.participating);

                              // Refresh user data to sync with backend
                              if (refreshUser) {
                                await refreshUser();
                              }

                              showToast(
                                result.message || (result.participating ? '已开启排名展示' : '已关闭排名展示'),
                                'success'
                              );
                            } catch (error: any) {
                              showToast(error.message || '操作失败', 'error');
                              // Revert toggle on error
                              setParticipateInLeaderboard(!newCheckedState);
                            }
                          }}
                        />
                        <div className={`w-10 h-5 rounded-full shadow-inner transition-all duration-300 ease-in-out ${
                          participateInLeaderboard ? 'bg-accent-primary' : 'bg-dark-tertiary'
                        }`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ease-in-out translate-y-0.5 ${
                            participateInLeaderboard ? 'translate-x-5' : 'translate-x-0.5'
                          }`}></div>
                        </div>
                      </div>
                  </label>
                </div>
              </div>
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="mb-6">
            <ControlPanel onShowToast={showToast} />
          </div>

          {/* Account Info */}
          <div className="mb-6">
            <AccountInfo 
              selectedMarket={selectedMarket}
              onMarketChange={handleMarketChange}
              onShowToast={showToast} 
            />
          </div>

          {/* Position Overview */}
          <div className="mb-6">
            <PositionOverview 
              selectedMarket={selectedMarket}
              onShowToast={showToast} 
            />
          </div>

          {/* Today's Orders */}
          <div className="mb-6">
            <TodayOrders 
              selectedMarket={selectedMarket}
              onShowToast={showToast} 
            />
          </div>

          {/* Decision History */}
          <div className="mb-6">
            <DecisionHistory onShowToast={showToast} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />

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
