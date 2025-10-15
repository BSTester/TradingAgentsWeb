'use client';

import React, { useState, useEffect, useRef } from 'react';
import { buildApiUrl, buildWebSocketUrl, API_ENDPOINTS } from '../../utils/api';

interface AnalysisProgressProps {
  analysisId: string;
  onComplete: () => void;
  onBackToConfig: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

interface PhaseAgent {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  logs: string[];
}

interface AnalysisPhase {
  id: number;
  name: string;
  description: string;
  icon: string;
  agents: PhaseAgent[];
  status: 'pending' | 'running' | 'completed' | 'error';
}

interface WebSocketMessage {
  type: 'log' | 'complete' | 'error' | 'interrupted' | 'config';
  timestamp: string;
  data: {
    level?: string;
    message?: string;
    agent?: string;
    step?: string;
    progress?: number;
    phase?: string;
    status?: string;
    trading_decision?: string;
    error?: string;
    selected_analysts?: string[];
    research_depth?: number;
  };
}

export function AnalysisProgress({ analysisId, onComplete, onBackToConfig, onShowToast }: AnalysisProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  
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
  
  const [phases, setPhases] = useState<AnalysisPhase[]>([
    {
      id: 1,
      name: '分析师团队',
      description: '收集和分析市场数据',
      icon: 'fa-users',
      status: 'running',
      agents: [
        { name: '市场分析师', status: 'pending', logs: [] },
        { name: '社交媒体分析师', status: 'pending', logs: [] },
        { name: '新闻分析师', status: 'pending', logs: [] },
        { name: '基本面分析师', status: 'pending', logs: [] }
      ]
    },
    {
      id: 2,
      name: '研究团队',
      description: '深度研究和辩论',
      icon: 'fa-search',
      status: 'pending',
      agents: [
        { name: '多头研究员', status: 'pending', logs: [] },
        { name: '空头研究员', status: 'pending', logs: [] },
        { name: '投资评审', status: 'pending', logs: [] }
      ]
    },
    {
      id: 3,
      name: '交易团队',
      description: '制定交易策略',
      icon: 'fa-chart-line',
      status: 'pending',
      agents: [
        { name: '交易员', status: 'pending', logs: [] }
      ]
    },
    {
      id: 4,
      name: '风险管理',
      description: '评估和管理风险',
      icon: 'fa-shield-alt',
      status: 'pending',
      agents: [
        { name: '激进风险分析师', status: 'pending', logs: [] },
        { name: '中性风险分析师', status: 'pending', logs: [] },
        { name: '保守风险分析师', status: 'pending', logs: [] },
        { name: '风险管理评审', status: 'pending', logs: [] }
      ]
    }
  ]);

  // WebSocket 连接和消息处理
  useEffect(() => {
    console.log('=== AnalysisProgress mounted ===');
    console.log('Analysis ID:', analysisId);
    
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
      
      // 构建 WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = buildWebSocketUrl(API_ENDPOINTS.WS.ANALYSIS(analysisId));
      
      console.log('🔌 Attempting to connect to WebSocket:', wsUrl);
      console.log('Protocol:', protocol);
      console.log('Hostname:', window.location.hostname);
      
      try {
        const ws = new WebSocket(wsUrl);
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

          if (message.type === 'config') {
            // 接收配置信息，更新显示的智能体
            const { selected_analysts } = message.data;
            console.log('📋 Received config message');
            console.log('Selected analysts:', selected_analysts);
            
            if (selected_analysts && Array.isArray(selected_analysts)) {
              console.log(`🔄 Updating analyst team with ${selected_analysts.length} analysts`);
              
              setPhases(prevPhases => {
                const newPhases = [...prevPhases];
                
                // 更新分析师团队，只显示选中的分析师
                const analystPhase = newPhases[0];
                if (analystPhase) {
                  console.log('Current analyst phase:', analystPhase.name);
                  console.log('Current agents:', analystPhase.agents.map(a => a.name));
                  
                  // 分析师映射
                  const analystMap: { [key: string]: string } = {
                    'market': '市场分析师',
                    'social': '社交媒体分析师',
                    'news': '新闻分析师',
                    'fundamentals': '基本面分析师'
                  };
                  
                  // 只保留选中的分析师
                  const newAgents: PhaseAgent[] = selected_analysts
                    .filter(a => {
                      const hasMapping = !!analystMap[a];
                      console.log(`Analyst ${a}: has mapping = ${hasMapping}`);
                      return hasMapping;
                    })
                    .map(a => ({
                      name: analystMap[a]!,  // 使用非空断言，因为已经过滤了
                      status: 'pending' as const,
                      logs: []
                    }));
                  
                  console.log('New agents:', newAgents.map(a => a.name));
                  analystPhase.agents = newAgents;
                  
                  console.log(`✅ 更新分析师团队: ${analystPhase.agents.length} 个分析师`);
                } else {
                  console.warn('⚠️ Analyst phase not found!');
                }
                
                return newPhases;
              });
            } else {
              console.warn('⚠️ Invalid selected_analysts:', selected_analysts);
            }
          } else if (message.type === 'log') {
            const { agent, message: logMsg, progress: logProgress, phase, step } = message.data;
            
            // 更新进度
            if (logProgress !== undefined) {
              setProgress(logProgress);
            }

            // 更新阶段和智能体状态
            if (agent && phase) {
              setPhases(prevPhases => {
                const newPhases = [...prevPhases];
                
                // 查找对应的阶段
                // 智能体到阶段的映射
                const agentToPhaseMap: { [key: string]: number } = {
                  'system': 0,  // system 也显示在第一阶段
                  'market': 0,
                  'social': 0,
                  'news': 0,
                  'fundamentals': 0,
                  'researcher': 1,
                  'bull': 1,
                  'bear': 1,
                  'invest_judge': 1,
                  'trader': 2,
                  'risky': 3,
                  'neutral': 3,
                  'safe': 3,
                  'risk_manager': 3
                };
                
                // 阶段名称到索引的映射（兼容旧格式）
                const phaseMap: { [key: string]: number } = {
                  '准备阶段': 0,  // 准备阶段也显示在第一阶段
                  '初始化阶段': 0,
                  '分析阶段': 0,
                  '分析师团队': 0,
                  '市场分析': 0,
                  '情绪分析': 0,
                  '新闻分析': 0,
                  '基本面分析': 0,
                  '投资辩论': 1,
                  '研究团队': 1,
                  '交易策略': 2,
                  '交易团队': 2,
                  '风险评估': 3,
                  '风险管理': 3,
                  '完成阶段': 3
                };
                
                // 优先使用智能体映射，其次使用阶段映射
                let phaseIdx = agentToPhaseMap[agent] ?? phaseMap[phase] ?? 0;

                // 确保 phaseIdx 在有效范围内
                if (phaseIdx < 0) phaseIdx = 0;
                if (phaseIdx >= newPhases.length) phaseIdx = newPhases.length - 1;

                if (phaseIdx >= 0 && phaseIdx < newPhases.length) {
                  const currentPhase = newPhases[phaseIdx];
                  
                  if (currentPhase) {
                    // 更新阶段状态
                    if (currentPhase.status === 'pending') {
                      currentPhase.status = 'running';
                      setCurrentPhaseIndex(phaseIdx);
                    }

                    // 智能体名称映射（英文 -> 中文）
                    const agentNameMap: { [key: string]: string } = {
                      'system': '系统',
                      'market': '市场分析师',
                      'social': '社交媒体分析师',
                      'news': '新闻分析师',
                      'fundamentals': '基本面分析师',
                      'researcher': '研究分析师',
                      'bull': '多头研究员',
                      'bear': '空头研究员',
                      'trader': '交易员',
                      'invest_judge': '投资评审',
                      'risky': '激进风险分析师',
                      'neutral': '中性风险分析师',
                      'safe': '保守风险分析师',
                      'risk_manager': '风险管理评审'
                    };
                    
                    const displayName = agentNameMap[agent] || agent;
                    
                    // 查找或创建智能体
                    let agentObj = currentPhase.agents.find(a => a.name === displayName);
                    if (!agentObj) {
                      agentObj = {
                        name: displayName,
                        status: 'running',
                        logs: []
                      };
                      currentPhase.agents.push(agentObj);
                    }

                    // 特殊处理：当真正的分析师开始工作时，自动标记系统为完成
                    if (agent !== 'system' && phaseIdx === 0) {
                      const systemAgent = currentPhase.agents.find(a => a.name === '系统');
                      if (systemAgent && systemAgent.status === 'running') {
                        systemAgent.status = 'completed';
                        console.log('✅ 系统准备完成，分析师开始工作');
                      }
                    }

                    // 检查是否是完成消息
                    const isCompletedStep = step === '完成' || logMsg?.includes('完成分析') || logMsg?.includes('✅');
                    
                    // 更新智能体状态和日志
                    if (isCompletedStep) {
                      // 标记智能体为完成
                      agentObj.status = 'completed';
                      
                      // 检查该阶段的所有智能体是否都完成了
                      // 注意：排除"系统"智能体，它只是辅助性的，不算作实际的分析智能体
                      // 应该检查所有非系统的智能体（包括pending的），因为pending表示还没开始，不应该算作完成
                      console.log(`🔍 检查阶段完成状态 - 阶段: ${currentPhase.name}`);
                      console.log(`   所有智能体:`, currentPhase.agents.map(a => `${a.name}(${a.status})`));
                      
                      // 获取所有应该参与的智能体（排除系统）
                      const allAgents = currentPhase.agents.filter(a => a.name !== '系统');
                      console.log(`   应参与的智能体:`, allAgents.map(a => `${a.name}(${a.status})`));
                      
                      // 只有当所有智能体都完成时，阶段才算完成
                      const allCompleted = allAgents.length > 0 && 
                                          allAgents.every(a => a.status === 'completed');
                      
                      if (allCompleted) {
                        currentPhase.status = 'completed';
                        console.log(`✅ 阶段 "${currentPhase.name}" 完成 (${allAgents.length} 个智能体全部完成)`);
                      } else {
                        const completedCount = allAgents.filter(a => a.status === 'completed').length;
                        console.log(`⏳ 阶段 "${currentPhase.name}" 进行中 (${completedCount}/${allAgents.length} 个智能体完成)`);
                      }
                    } else if (agentObj.status === 'pending') {
                      agentObj.status = 'running';
                    }
                    
                    if (logMsg) {
                      const timestamp = new Date().toLocaleTimeString();
                      const newLog = `${timestamp} - ${logMsg}`;
                      
                      // 去重：检查最后一条日志是否相同
                      const lastLog = agentObj.logs[agentObj.logs.length - 1];
                      if (lastLog !== newLog) {
                        agentObj.logs.push(newLog);
                        
                        // 只保留最近10条日志
                        if (agentObj.logs.length > 10) {
                          agentObj.logs = agentObj.logs.slice(-10);
                        }
                      }
                    }
                  }
                }

                return newPhases;
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
            setPhases(prevPhases => {
              const newPhases = [...prevPhases];
              const currentPhase = newPhases[currentPhaseIndex];
              if (currentPhase) {
                currentPhase.status = 'error';
                
                // 标记正在运行的智能体为错误
                currentPhase.agents.forEach(agent => {
                  if (agent.status === 'running') {
                    agent.status = 'error';
                    // 添加错误日志
                    const timestamp = new Date().toLocaleTimeString();
                    agent.logs.push(`${timestamp} - ❌ 执行失败: ${displayError.substring(0, 100)}`);
                  }
                });
              }
              return newPhases;
            });
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
  }, [analysisId]);

  // 当分析完成时调用 onComplete
  useEffect(() => {
    if (isCompleted) {
      onComplete();
    }
  }, [isCompleted, onComplete]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'fa-check-circle text-green-500';
      case 'running':
        return 'fa-spinner fa-spin text-blue-500';
      case 'error':
        return 'fa-times-circle text-red-500';
      default:
        return 'fa-circle text-gray-300';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          <i className="fas fa-chart-line mr-2 text-blue-600" />
          分析进度
        </h3>
        <button
          onClick={onBackToConfig}
          className="text-gray-500 hover:text-gray-700"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="space-y-6">
        {/* 总体进度条 */}
        <div>
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>总体进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        {/* 阶段列表 */}
        <div className="space-y-4">
          {phases.map((phase, phaseIdx) => (
            <div 
              key={phase.id} 
              className={`border rounded-lg overflow-hidden transition-all ${
                phase.status === 'running' ? 'border-blue-500 shadow-md' : 
                phase.status === 'completed' ? 'border-green-500' : 
                phase.status === 'error' ? 'border-red-500 shadow-md' :
                'border-gray-200'
              }`}
            >
              {/* 阶段头部 */}
              <div className={`p-4 ${
                phase.status === 'running' ? 'bg-blue-50' : 
                phase.status === 'completed' ? 'bg-green-50' : 
                phase.status === 'error' ? 'bg-red-50' :
                'bg-gray-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      phase.status === 'running' ? 'bg-blue-500' : 
                      phase.status === 'completed' ? 'bg-green-500' : 
                      phase.status === 'error' ? 'bg-red-500' :
                      'bg-gray-300'
                    }`}>
                      <i className={`fas ${phase.icon} text-white`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">{phase.name}</h4>
                      <p className="text-sm text-gray-600">{phase.description}</p>
                    </div>
                  </div>
                  <i className={`fas ${getStatusIcon(phase.status)} text-xl`} />
                </div>
              </div>

              {/* 智能体列表 */}
              {(phase.status === 'running' || phase.status === 'completed' || phaseIdx === currentPhaseIndex) && (
                <div className="p-4 bg-white space-y-3">
                  {phase.agents.map((agent, agentIdx) => (
                    <div key={agentIdx} className="border-l-4 pl-4 py-2" style={{
                      borderColor: agent.status === 'completed' ? '#10b981' : 
                                   agent.status === 'running' ? '#3b82f6' : 
                                   agent.status === 'error' ? '#ef4444' :
                                   '#d1d5db'
                    }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <i className={`fas ${getStatusIcon(agent.status)}`} />
                          <span className="font-medium text-gray-900">{agent.name}</span>
                        </div>
                        {agent.status === 'running' && (
                          <span className="text-xs text-blue-600 font-medium">执行中...</span>
                        )}
                        {agent.status === 'completed' && (
                          <span className="text-xs text-green-600 font-medium">已完成</span>
                        )}
                        {agent.status === 'error' && (
                          <span className="text-xs text-red-600 font-medium">执行失败</span>
                        )}
                      </div>
                      
                      {/* 智能体日志 */}
                      {agent.logs.length > 0 && (
                        <div className="mt-2 max-h-32 overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                          {agent.logs.slice(-10).map((log, logIdx) => (
                            <div key={logIdx} className="text-xs text-gray-600 pl-6 break-words">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          {!isCompleted && (
            <button
              onClick={handleStopAnalysis}
              disabled={isStopping}
              className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStopping ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2" />
                  中断中...
                </>
              ) : (
                <>
                  <i className="fas fa-stop mr-2" />
                  中断分析
                </>
              )}
            </button>
          )}
          <button
            onClick={onBackToConfig}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2" />
            返回
          </button>
        </div>
      </div>
    </div>
  );
}