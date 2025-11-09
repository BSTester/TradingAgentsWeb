'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnalysisWebSocket } from '@/lib/api';

interface AnalysisLogsProps {
  analysisId: string;
  onComplete?: () => void;
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  agent?: string;
  step?: string;
  progress?: number;
  phase?: string;
}

export function AnalysisLogs({ analysisId, onComplete }: AnalysisLogsProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('初始化...');
  const [currentPhase, setCurrentPhase] = useState('准备阶段');
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasError, setHasError] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<AnalysisWebSocket | null>(null);

  useEffect(() => {
    // 创建WebSocket连接
    const ws = new AnalysisWebSocket(
      analysisId,
      (data) => {
        // 处理接收到的消息
        if (data.type === 'log') {
          const logData = data.data;
          setLogs((prev) => [
            ...prev,
            {
              timestamp: data.timestamp,
              level: logData.level,
              message: logData.message,
              agent: logData.agent,
              step: logData.step,
              progress: logData.progress,
              phase: logData.phase,
            },
          ]);

          // 更新进度、步骤和阶段
          if (logData.progress !== undefined) {
            setProgress(logData.progress);
          }
          if (logData.step) {
            setCurrentStep(logData.step);
          }
          if (logData.phase) {
            setCurrentPhase(logData.phase);
          }
          
          // 检查是否有错误
          if (logData.level === 'error') {
            setHasError(true);
          }
        } else if (data.type === 'complete') {
          // 分析完成
          setProgress(100);
          setCurrentStep('分析完成');
          setCurrentPhase('完成');
          setIsCompleted(true);
          if (onComplete) {
            setTimeout(() => onComplete(), 2000); // 延迟2秒后跳转
          }
        } else if (data.type === 'error') {
          // 分析错误
          setHasError(true);
          setCurrentStep('分析失败');
        }
      },
      (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      },
      () => {
        console.log('WebSocket closed');
        setIsConnected(false);
      }
    );

    ws.connect();
    setIsConnected(true);
    wsRef.current = ws;

    // 清理函数
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, [analysisId, onComplete]);

  // 自动滚动到最新日志
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warning':
        return 'text-warning-500 bg-warning-500/20';
      case 'info':
        return 'text-accent-primary bg-accent-primary/20';
      case 'debug':
        return 'text-text-secondary bg-dark-tertiary';
      default:
        return 'text-text-secondary bg-dark-tertiary';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
        return 'fa-exclamation-circle';
      case 'warning':
        return 'fa-exclamation-triangle';
      case 'info':
        return 'fa-info-circle';
      case 'debug':
        return 'fa-bug';
      default:
        return 'fa-circle';
    }
  };

  return (
    <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
      {/* 头部 - 进度条和状态 */}
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              hasError ? 'bg-danger-500' : 
              isCompleted ? 'bg-success-500' : 
              isConnected ? 'bg-accent-primary animate-pulse' : 
              'bg-text-muted'
            }`} />
            <h3 className="text-lg font-semibold text-text-primary">
              <i className="fas fa-terminal mr-2 text-accent-primary" />
              实时分析日志
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-text-secondary">
              <i className="fas fa-layer-group mr-1" />
              {currentPhase}
            </span>
            <span className="text-sm text-text-secondary">
              <i className="fas fa-tasks mr-1" />
              {currentStep}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="relative">
          <div className="overflow-hidden h-4 text-xs flex rounded-full bg-dark-tertiary">
            <div
              style={{ width: `${progress}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                hasError ? 'bg-gradient-to-r from-danger-500 to-danger-600' :
                isCompleted ? 'bg-gradient-to-r from-success-500 to-success-600' :
                'bg-gradient-to-r from-accent-primary to-accent-secondary'
              }`}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium text-text-primary">{progress.toFixed(1)}%</span>
            {isCompleted && (
              <span className="text-sm text-success-500 font-medium">
                <i className="fas fa-check-circle mr-1" />
                分析完成
              </span>
            )}
            {hasError && (
              <span className="text-sm text-danger-500 font-medium">
                <i className="fas fa-exclamation-circle mr-1" />
                分析失败
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 日志内容 */}
      <div className="p-6">
        <div className="bg-dark-primary rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-text-tertiary text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl mb-2" />
              <p>等待日志...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 text-text-secondary hover:bg-dark-secondary px-2 py-1 rounded transition-colors">
                  <span className="text-text-tertiary text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString('zh-CN')}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                    <i className={`fas ${getLevelIcon(log.level)} mr-1`} />
                    {log.level.toUpperCase()}
                  </span>
                  {log.phase && (
                    <span className="text-cyan-400 text-xs">
                      [{log.phase}]
                    </span>
                  )}
                  {log.agent && log.agent !== 'system' && (
                    <span className="text-purple-400 text-xs">
                      [{log.agent}]
                    </span>
                  )}
                  <span className="flex-1">{log.message}</span>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>

        {/* 日志统计 */}
        <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
          <div className="flex items-center space-x-4">
            <span>
              <i className="fas fa-list mr-1" />
              总计: {logs.length} 条
            </span>
            <span>
              <i className="fas fa-exclamation-circle mr-1 text-red-500" />
              错误: {logs.filter((l) => l.level === 'error').length}
            </span>
            <span>
              <i className="fas fa-exclamation-triangle mr-1 text-yellow-500" />
              警告: {logs.filter((l) => l.level === 'warning').length}
            </span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-text-muted hover:text-text-secondary"
          >
            <i className="fas fa-trash-alt mr-1" />
            清空日志
          </button>
        </div>
      </div>
    </div>
  );
}
