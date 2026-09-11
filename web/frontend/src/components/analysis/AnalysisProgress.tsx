'use client';

import React, { useState, useEffect, useRef } from 'react';
import { buildApiUrl, buildWebSocketUrl, API_ENDPOINTS } from '../../utils/api';
import { RouteDataState } from '@/components/ui/RouteDataState';
import { loadAnalysisProgressConfig } from './progress/analysisStatus';
import { applyProgressConfig, createAnalysisPhases, phaseIndexForAgent } from './progress/phaseModel';
import { applyErrorToPhases, applyProgressLog } from './progress/phaseReducer';
import type { AnalysisPhase, PhaseAgent, WebSocketMessage } from './progress/types';
import { PhaseTimeline } from './progress/PhaseTimeline';
import { ProgressActions } from './progress/ProgressActions';
import { ProgressOverview } from './progress/ProgressOverview';

export { loadAnalysisProgressConfig };
export { applyProgressConfig, createAnalysisPhases, phaseIndexForAgent };
export type { PhaseAgent, AnalysisPhase };

interface AnalysisProgressProps {
  analysisId: string;
  onComplete: () => void;
  onBackToConfig: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function AnalysisProgress({ analysisId, onComplete, onBackToConfig, onShowToast }: AnalysisProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [statusState, setStatusState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [statusError, setStatusError] = useState<Error | null>(null);
  const [statusRetry, setStatusRetry] = useState(0);

  const handleStopAnalysis = async () => {
    if (isStopping) return;

    setIsStopping(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(buildApiUrl(`/api/analysis/${analysisId}/stop`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        onShowToast('分析已中断', 'info');

        // 关闭 WebSocket（使用正常关闭码）
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close(1000, 'User stopped analysis');
        }

        // 返回配置页面
        setTimeout(() => onBackToConfig(), 1000);
      } else {
        const error = await response.json();
        onShowToast(error.detail || '中断失败', 'error');
        setIsStopping(false);
      }
    } catch (error) {
      console.warn('⚠️ Stop analysis error:', error);
      onShowToast('中断分析失败', 'error');
      setIsStopping(false);
    }
  };

  const [phases, setPhases] = useState<AnalysisPhase[]>(createAnalysisPhases);

  // Fetch analysis status to get configuration on mount
  useEffect(() => {
    let active = true;
    setStatusState('loading');
    setStatusError(null);

    void loadAnalysisProgressConfig(analysisId, localStorage.getItem('access_token'))
      .then((status) => {
        if (!active) return;
        console.log('📋 Fetched analysis config:', status);
        setPhases(prevPhases => applyProgressConfig(prevPhases, status));
        setStatusState('ready');
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.warn('⚠️ Failed to fetch analysis config:', error);
        setStatusError(error instanceof Error ? error : new Error('加载分析状态失败'));
        setStatusState('error');
      });

    return () => { active = false; };
  }, [analysisId, statusRetry]);

  // WebSocket 连接和消息处理
  useEffect(() => {
    console.log('=== AnalysisProgress mounted ===');
    console.log('Analysis ID:', analysisId);

    // Wait for a successful config response before connecting WebSocket.
    if (statusState !== 'ready') {
      console.log('⏳ Waiting for config initialization...');
      return;
    }

    // 防止重复连接
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
      console.log('⚠️  WebSocket already connecting or connected, skipping...');
      return;
    }

    const connectWebSocket = () => {
      // 再次检查，防止竞态条件
      if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) {
        console.log('⚠️  WebSocket already exists, skipping connection...');
        return;
      }

      // 构建 WebSocket URL，附带鉴权 token
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const baseWsUrl = buildWebSocketUrl(API_ENDPOINTS.WS.ANALYSIS(analysisId));
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      const wsUrl = baseWsUrl; // 使用子协议传递 token
      const subprotocol = token ? `jwt.${token}` : undefined;

      console.log('🔌 Attempting to connect to WebSocket:', wsUrl);
      console.log('Protocol:', protocol);
      console.log('Hostname:', window.location.hostname);

      try {
        const ws = subprotocol ? new WebSocket(wsUrl, [subprotocol]) : new WebSocket(wsUrl);
        wsRef.current = ws;
        console.log('WebSocket object created:', ws);

        ws.onopen = () => {
          console.log('✅ WebSocket connected successfully!');
          onShowToast('已连接到分析服务', 'success');
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', message);

            // 过滤非当前分析的消息
            if (message.analysis_id && message.analysis_id !== analysisId) {
              console.log('🔇 Ignored message for different analysis_id:', message.analysis_id);
              return;
            }

            if (message.type === 'config') {
              const { selected_analysts } = message.data;
              console.log('📋 Received config message');
              console.log('Selected analysts:', selected_analysts);
              setPhases(prevPhases => applyProgressConfig(prevPhases, message.data));
            } else if (message.type === 'log') {
              const { agent, message: logMsg, progress: logProgress, phase, step } = message.data;

              // 更新进度
              if (logProgress !== undefined) {
                setProgress(logProgress);
              }

              // 更新阶段和智能体状态
              if (agent && phase) {
                setPhases(prevPhases => {
                  const result = applyProgressLog(prevPhases, { agent, phase, logMessage: logMsg, step });
                  if (result.currentPhaseIndex !== null) {
                    setCurrentPhaseIndex(result.currentPhaseIndex);
                  }
                  return result.phases;
                });
              }
            } else if (message.type === 'complete') {
              console.log('Analysis completed');
              setIsCompleted(true);
              setProgress(100);

              // 标记所有阶段为完成
              setPhases(prevPhases =>
                prevPhases.map(phase => ({
                  ...phase,
                  status: 'completed',
                  agents: phase.agents.map(agent => ({
                    ...agent,
                    status: 'completed'
                  }))
                }))
              );

              onShowToast('分析完成！', 'success');
            } else if (message.type === 'interrupted') {
              console.log('Analysis interrupted');
              const interruptMsg = message.data.message || '分析任务已被中断';

              // 显示中断提示
              onShowToast(interruptMsg, 'warning');

              // 关闭 WebSocket 连接
              if (wsRef.current) {
                wsRef.current.close();
              }

              // 返回配置页面
              setTimeout(() => {
                onBackToConfig();
              }, 1500);
            } else if (message.type === 'error') {
              const errorMsg = message.data.error || '未知错误';

              // 如果是用户中断，不显示错误提示
              if (errorMsg.includes('用户中断') || errorMsg.includes('被中断')) {
                console.log('Analysis stopped by user');
                return;
              }

              // 使用 console.warn 而不是 console.error，避免 Next.js 错误覆盖层
              console.warn('⚠️ Analysis error:', errorMsg);

              // 友好的错误提示
              let displayError = errorMsg;

              // Token 超限错误
              if (errorMsg.includes('context_length_exceeded') || errorMsg.includes('maximum context length')) {
                displayError = '分析内容过多，超出模型上下文限制。建议减少分析师数量或使用更大上下文的模型';
              }
              // API 密钥错误 - 扩展检测
              else if (errorMsg.includes('api_key') ||
                errorMsg.includes('authentication') ||
                errorMsg.includes('API 密钥验证失败') ||
                errorMsg.includes('无效的令牌') ||
                errorMsg.includes('invalid') ||
                errorMsg.includes('unauthorized') ||
                errorMsg.includes('401')) {
                // 直接使用后端返回的错误消息，因为它已经包含了详细信息
                displayError = errorMsg;
              }
              // 网络错误
              else if (errorMsg.includes('connection') || errorMsg.includes('timeout')) {
                displayError = '网络连接失败，请检查网络或 API 服务';
              }
              // 限流错误
              else if (errorMsg.includes('rate_limit') || errorMsg.includes('too many requests')) {
                displayError = 'API 请求频率超限，请稍后再试';
              }
              // 如果错误消息太长，截断显示（但保留完整的API错误信息）
              else if (displayError.length > 300 && !displayError.includes('API 密钥')) {
                displayError = displayError.substring(0, 300) + '...';
              }

              // 显示错误提示
              onShowToast(`❌ ${displayError}`, 'error');

              // 标记当前阶段和正在运行的智能体为错误
              setPhases(prevPhases => applyErrorToPhases(prevPhases, currentPhaseIndex, displayError));
            }
          } catch (error) {
            console.warn('⚠️ Error parsing WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.warn('⚠️ WebSocket error:', error);
          onShowToast('WebSocket 连接错误', 'error');
        };

        ws.onclose = (event) => {
          console.log('🔌 WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);

          // 不再自动重连，避免在其他页面还在重连
          if (event.code === 1000 || event.reason === 'Analysis stopped by user') {
            console.log('✅ WebSocket closed normally');
          } else if (isCompleted || isStopping) {
            console.log('✅ Analysis completed or stopping');
          } else {
            console.log('⚠️ WebSocket disconnected unexpectedly');
            // 不显示错误提示，避免干扰用户
          }
        };
      } catch (error) {
        console.warn('⚠️ Error creating WebSocket:', error);
        onShowToast('无法创建 WebSocket 连接', 'error');
      }
    };

    console.log('🚀 Starting WebSocket connection...');
    connectWebSocket();

    // 清理函数
    return () => {
      console.log('🧹 Cleaning up WebSocket connection...');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [analysisId, statusState]);

  // 当分析完成时调用 onComplete
  useEffect(() => {
    if (isCompleted) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  return (
    <RouteDataState
      loading={statusState === 'loading'}
      loadingMessage="正在加载分析状态…"
      error={statusState === 'error' ? statusError : null}
      errorTitle="分析状态加载失败"
      onRetry={() => setStatusRetry(value => value + 1)}
    >
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border p-4 md:p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-text-primary">
          <i className="fas fa-chart-line mr-2 text-blue-600" />
          分析进度
        </h3>
        <button
          onClick={onBackToConfig}
          className="text-text-muted hover:text-text-secondary"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="space-y-6">
        {/* 总体进度条 */}
        <ProgressOverview progress={progress} />

        {/* 阶段列表 */}
        <PhaseTimeline phases={phases} currentPhaseIndex={currentPhaseIndex} />

        {/* 操作按钮 */}
        <ProgressActions
          isCompleted={isCompleted}
          isStopping={isStopping}
          onStop={handleStopAnalysis}
          onBackToConfig={onBackToConfig}
        />
      </div>
    </div>
    </RouteDataState>
  );
}