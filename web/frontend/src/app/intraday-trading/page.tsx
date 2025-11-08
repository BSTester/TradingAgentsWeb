'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { AppNavbar } from '@/components/common/AppNavbar';
import { Footer } from '@/components/leaderboard/Footer';
import { useToast, Toast } from '@/components/ui/Toast';
import { ControlPanel } from '@/components/intraday/ControlPanel';
import { PositionOverview } from '@/components/intraday/PositionOverview';
import { DecisionHistory } from '@/components/intraday/DecisionHistory';
import { AccountInfo } from '@/components/intraday/AccountInfo';
import { useIntradayWebSocket } from '@/hooks/useIntradayWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { intradayTradingKeys } from '@/hooks/useIntradayTrading';

export default function IntradayTradingPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMarket, setSelectedMarket] = useState<string>('US'); // 市场状态管理

  // WebSocket message handler
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'intraday_session_start':
        showToast('分析会话已开始', 'info');
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
        
        // Add new decision to the list
        if (message.decision_record) {
          const currentDecisions = queryClient.getQueryData(
            intradayTradingKeys.decisionsList(1, 20)
          ) as any;
          
          if (currentDecisions) {
            // Prepend new decision to the list
            const updatedDecisions = {
              ...currentDecisions,
              items: [message.decision_record, ...currentDecisions.items].slice(0, 20),
              total: currentDecisions.total + 1,
            };
            
            queryClient.setQueryData(
              intradayTradingKeys.decisionsList(1, 20),
              updatedDecisions
            );
          }
        }
        break;
        
      case 'intraday_session_error':
        showToast(`分析出错: ${message.message}`, 'error');
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

  // 认证保护逻辑
  useEffect(() => {
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

  // 如果正在认证检查，显示加载状态
  if (authLoading || !user) {
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
      <AppNavbar user={user} onLogout={logout} />

      {/* 面包屑导航 */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center space-x-2 text-sm">
            <button
              onClick={() => router.push('/')}
              className="text-blue-600 hover:text-blue-800"
            >
              <i className="fas fa-home mr-1" />
              首页
            </button>
            <i className="fas fa-chevron-right text-gray-400 text-xs" />
            <span className="text-gray-900 font-medium">短线交易系统</span>
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
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  <i className="fas fa-chart-line mr-3 text-green-600" />
                  短线交易系统
                </h1>
                <p className="text-gray-600">
                  自动化短线交易分析，智能决策，实时监控
                </p>
              </div>
              
              {/* WebSocket Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`flex items-center px-3 py-1 rounded-full text-sm ${
                  isConnected 
                    ? 'bg-green-100 text-green-800' 
                    : wsStatus === 'connecting'
                    ? 'bg-yellow-100 text-yellow-800'
                    : wsStatus === 'error'
                    ? 'bg-orange-100 text-orange-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <span className={`w-2 h-2 rounded-full mr-2 ${
                    isConnected 
                      ? 'bg-green-600 animate-pulse' 
                      : wsStatus === 'connecting'
                      ? 'bg-yellow-600 animate-pulse'
                      : wsStatus === 'error'
                      ? 'bg-orange-600'
                      : 'bg-gray-600'
                  }`} />
                  {isConnected 
                    ? '实时连接' 
                    : wsStatus === 'connecting' 
                    ? '连接中' 
                    : wsStatus === 'error'
                    ? '轮询模式'
                    : '未连接'}
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
              onMarketChange={setSelectedMarket}
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
