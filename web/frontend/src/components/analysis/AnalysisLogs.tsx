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
        return 'text-yellow-600 bg-yellow-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      case 'debug':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
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
    <div className="bg-white rounded-lg shadow-lg">
      {/* 头部 - 进度条和状态 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${
              hasError ? 'bg-red-500' : 
              isCompleted ? 'bg-green-500' : 
              isConnected ? 'bg-blue-500 animate-pulse' : 
              'bg-gray-400'
            }`} />
            <h3 className="text-lg font-semibold text-gray-900">
              <i className="fas fa-terminal mr-2 text-blue-600" />
              实时分析日志
            </h3>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              <i className="fas fa-layer-group mr-1" />
              {currentPhase}
            </span>
            <span className="text-sm text-gray-600">
              <i className="fas fa-tasks mr-1" />
              {currentStep}
            </span>
          </div>
        </div>

        {/* 进度条 */}
        <div className="relative">
          <div className="overflow-hidden h-4 text-xs flex rounded-full bg-gray-200">
            <div
              style={{ width: `${progress}%` }}
              className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-500 ${
                hasError ? 'bg-gradient-to-r from-red-500 to-red-600' :
                isCompleted ? 'bg-gradient-to-r from-green-500 to-green-600' :
                'bg-gradient-to-r from-blue-500 to-purple-500'
              }`}
            />
          </div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-sm font-medium text-gray-700">{progress.toFixed(1)}%</span>
            {isCompleted && (
              <span className="text-sm text-green-600 font-medium">
                <i className="fas fa-check-circle mr-1" />
                分析完成
              </span>
            )}
            {hasError && (
              <span className="text-sm text-red-600 font-medium">
                <i className="fas fa-exclamation-circle mr-1" />
                分析失败
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 日志内容 */}
      <div className="p-6">
        <div className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <i className="fas fa-spinner fa-spin text-2xl mb-2" />
              <p>等待日志...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-2 text-gray-300 hover:bg-gray-800 px-2 py-1 rounded transition-colors">
                  <span className="text-gray-500 text-xs whitespace-nowrap">
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
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
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
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-trash-alt mr-1" />
            清空日志
          </button>
        </div>
      </div>
    </div>
  );
}
