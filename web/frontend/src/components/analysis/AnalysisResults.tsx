'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl, API_ENDPOINTS } from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { logger } from '@/utils/logger';
import { RouteDataState } from '@/components/ui/RouteDataState';

interface AnalysisResultsProps {
  analysisId: string;
  onBackToConfig: () => void;
  onBackToHistory: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  fromLeaderboard?: boolean; // 是否从排行榜进入
}

interface PhaseResult {
  id: number;
  name: string;
  icon: string;
  color: string;
  agents: {
    name: string;
    result: string;
  }[];
}

export function AnalysisResults({ analysisId, onBackToConfig, onBackToHistory, onShowToast, fromLeaderboard = false }: AnalysisResultsProps) {
  const [activePhase, setActivePhase] = useState(-1); // -1 表示显示最终分析说明
  const [systemDomain, setSystemDomain] = useState('');
  const [showExportPreview, setShowExportPreview] = useState(false);

  // 使用 useQuery 获取分析结果
  const { data: results, isLoading: loading, isError, error } = useQuery({
    queryKey: ['analysis', 'results', analysisId, fromLeaderboard],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      
      // 从排行榜进入时不需要 token，从历史记录进入时需要 token
      if (!fromLeaderboard && !token) {
        console.error('❌ 未找到 access_token');
        throw new Error('请先登录');
      }

      // 根据来源选择不同的 API 端点
      const endpoint = fromLeaderboard 
        ? `/api/public/analysis/${analysisId}/results`  // 公开接口
        : API_ENDPOINTS.ANALYSIS.RESULTS(analysisId);   // 私有接口

      logger.log('📡 请求分析结果:', {
        analysisId,
        endpoint,
        fromLeaderboard,
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none'
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // 只有在有 token 时才添加 Authorization header
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(buildApiUrl(endpoint), {
        headers
      });

      logger.log('📡 响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('❌ 请求失败:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });

        if (response.status === 401) {
          throw new Error('登录已过期，请重新登录');
        } else if (response.status === 404) {
          throw new Error('分析记录未找到');
        } else if (response.status === 400) {
          try {
            const errorData = JSON.parse(errorText);
            throw new Error(errorData.detail || '分析未完成');
          } catch {
            throw new Error('分析未完成');
          }
        }
        throw new Error(`获取分析结果失败: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      logger.log('✅ 成功获取分析结果:', data);
      return data;
    },
    retry: 10, // 最多重试10次
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  // 处理错误提示
  useEffect(() => {
    if (isError && error) {
      onShowToast(error instanceof Error ? error.message : '获取分析结果失败', 'error');
    }
  }, [isError, error, onShowToast]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const origin = window.location.origin.replace(/\/+$/, '');
        setSystemDomain(origin);
      } catch {}
    }
  }, []);

  // 渲染导出内容（预览和导出共用）
  const renderExportContent = () => {
    if (!results) return null;

    return (
      <>
        {/* 封面页 - 专业研报样式 */}
        <div className="report-cover" style={{ pageBreakAfter: 'always', height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '0', margin: '0', background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}>
          {/* 顶部区域 */}
          <div style={{ padding: '2.5rem 0 0 0', width: '100%' }}>
            <div style={{ textAlign: 'center', color: 'white', width: '100%' }}>
              <p style={{ fontSize: '14pt', letterSpacing: '0.3em', marginBottom: '0.75rem', opacity: '0.95', fontFamily: 'system-ui, -apple-system, sans-serif', textAlign: 'center', margin: '0 auto 0.75rem auto' }}>TRADING ANALYSIS REPORT</p>
              <h1 style={{ fontSize: '48pt', fontWeight: '300', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif', letterSpacing: '0.05em', textAlign: 'center' }}>股票投资分析报告</h1>
            </div>
          </div>

          {/* 中间区域 - 股票信息 */}
          <div style={{ padding: '0', flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '0' }}>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.95)', 
              borderRadius: '16px', 
              padding: '3rem 2rem', 
              width: '480px', 
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)', 
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0'
            }}>
              {/* 市场标签 */}
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ 
                  background: 'linear-gradient(135deg, #10b981, #3b82f6)', 
                  color: 'white',
                  padding: '0.6rem 1.8rem',
                  borderRadius: '20px',
                  fontSize: '11pt',
                  fontWeight: '500',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: '1',
                  minHeight: '2.5rem',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                } as React.CSSProperties}>
                  {results?.market === 'US' ? '美国股票市场' : results?.market === 'HK' ? '香港股票市场' : results?.market === 'CN' ? 'A股市场' : '股票市场'}
                </span>
              </div>

              {/* 股票代码 */}
              <div style={{ marginBottom: '0.8rem' }}>
                <h2 style={{ fontSize: '56pt', fontWeight: 'bold', margin: '0', padding: '0', color: '#1a1a1a', letterSpacing: '0.05em', fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.1', textAlign: 'center' }}>
                  {results?.ticker}
                </h2>
              </div>

              {/* 公司名称 */}
              {results?.company_name && (
                <div style={{ marginBottom: '1.8rem' }}>
                  <p style={{ fontSize: '15pt', margin: '0', padding: '0', color: '#666', fontFamily: 'system-ui, -apple-system, sans-serif', fontWeight: '400', lineHeight: '1.4', textAlign: 'center' }}>
                    {results.company_name}
                  </p>
                </div>
              )}

              {/* 分隔线 */}
              <div style={{ height: '2px', background: 'linear-gradient(to right, transparent, #e5e7eb, transparent)', margin: '1.8rem 0', width: '100%' }}></div>

              {/* 投资建议标签 */}
              <div style={{ marginBottom: '1rem' }}>
                <p style={{ fontSize: '12pt', color: '#666', letterSpacing: '0.2em', fontFamily: 'system-ui, -apple-system, sans-serif', margin: '0', padding: '0', textAlign: 'center' }}>投资建议</p>
              </div>

              {/* 投资建议卡片 */}
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #10b981, #3b82f6)',
                  borderRadius: '12px',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: '200px',
                  maxWidth: '90%',
                  paddingTop: '1rem',
                  paddingBottom: '1.2rem',
                  paddingLeft: '2.5rem',
                  paddingRight: '2.5rem',
                  WebkitPrintColorAdjust: 'exact',
                  printColorAdjust: 'exact'
                } as React.CSSProperties}>
                  <span style={{ 
                    fontSize: '36pt', 
                    fontWeight: 'bold', 
                    color: 'white', 
                    fontFamily: 'system-ui, -apple-system, sans-serif', 
                    letterSpacing: '0.05em', 
                    lineHeight: '1',
                    whiteSpace: 'nowrap',
                    display: 'block',
                    transform: 'translateY(-2px)'
                  }}>
                    {results?.trading_decision}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 底部区域 - 报告信息 */}
          <div style={{ padding: '0 0 2.5rem 0', width: '100%' }}>
            <div style={{ textAlign: 'center', color: 'white', fontSize: '10pt', fontFamily: 'system-ui, -apple-system, sans-serif', width: '100%' }}>
              <p style={{ marginBottom: '0.4rem', opacity: '0.95', textAlign: 'center', margin: '0 auto 0.4rem auto' }}>
                分析日期：{results?.analysis_date}
              </p>
              <p style={{ opacity: '0.9', textAlign: 'center', margin: '0 auto' }}>
                生成系统：TradingAgentsWeb 多智能体分析系统
              </p>
            </div>
          </div>
        </div>

        {/* 股票信息横幅 */}
        <div style={{ 
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', 
          padding: '1.5rem 2rem', 
          marginBottom: '2rem',
          borderRadius: '12px',
          border: '2px solid #bae6fd',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          pageBreakInside: 'avoid'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ 
              width: '4rem', 
              height: '4rem', 
              background: 'linear-gradient(135deg, #10b981, #3b82f6)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <i className="fas fa-chart-line" style={{ fontSize: '1.5rem', color: 'white' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0', color: '#0c4a6e', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {results?.ticker}
              </h2>
              {results?.company_name && (
                <p style={{ fontSize: '0.875rem', color: '#0369a1', margin: '0.25rem 0 0 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  {results.company_name}
                </p>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.75rem', color: '#0369a1', margin: '0 0 0.25rem 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>市场</p>
              <p style={{ fontSize: '1rem', fontWeight: 'bold', color: '#0c4a6e', margin: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {results?.market === 'US' ? '美股' : results?.market === 'HK' ? '港股' : results?.market === 'CN' ? 'A股' : '未知'}
              </p>
            </div>
            
            <div style={{ 
              background: results?.trading_decision === '买入' ? 'linear-gradient(135deg, #f03a55, #d91744)' : 
                          results?.trading_decision === '卖出' ? 'linear-gradient(135deg, #00a870, #008c5e)' : 
                          'linear-gradient(135deg, #f59e0b, #d97706)',
              color: 'white',
              padding: '0.75rem 2rem',
              borderRadius: '9999px',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            } as React.CSSProperties}>
              {results?.trading_decision}
            </div>
          </div>
        </div>

        {/* 最终分析说明 */}
        {results?.final_analysis && (
          <div style={{ 
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            border: '2px solid #fbbf24',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '2rem',
            pageBreakInside: 'avoid'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ 
                width: '3rem',
                height: '3rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '1rem',
                boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
              }}>
                <i className="fas fa-lightbulb" style={{ fontSize: '1.25rem', color: 'white' }} />
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#78350f', margin: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                最终投资建议
              </h3>
            </div>
            <div style={{ 
              fontSize: '11pt',
              lineHeight: '1.8',
              color: '#78350f',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={{
                  p: ({ children }) => <p style={{ marginBottom: '0.75rem' }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                  ul: ({ children }) => <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
                }}
              >
                {results.final_analysis}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* 各阶段分析 */}
        {results?.phases?.map((phase: PhaseResult) => (
          <div key={phase.id} style={{ marginBottom: '2rem', pageBreakInside: 'avoid' }}>
            <div style={{ 
              background: `linear-gradient(135deg, ${
                phase.color === 'blue' ? '#3b82f6, #2563eb' :
                phase.color === 'green' ? '#10b981, #059669' :
                phase.color === 'purple' ? '#8b5cf6, #7c3aed' :
                phase.color === 'orange' ? '#f59e0b, #d97706' :
                '#6b7280, #4b5563'
              })`,
              color: 'white',
              padding: '1.25rem 1.5rem',
              borderRadius: '12px',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
              WebkitPrintColorAdjust: 'exact',
              printColorAdjust: 'exact'
            } as React.CSSProperties}>
              <i className={`fas ${phase.icon}`} style={{ fontSize: '1.75rem', marginRight: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                {phase.name}
              </h2>
            </div>

            {phase.agents.map((agent, agentIndex) => (
              <div key={agentIndex} style={{ 
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '1.5rem',
                pageBreakInside: 'avoid'
              }}>
                <h3 style={{ 
                  fontSize: '1.125rem',
                  fontWeight: 'bold',
                  color: '#1f2937',
                  marginBottom: '1rem',
                  paddingBottom: '0.5rem',
                  borderBottom: '2px solid #e5e7eb',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  {agent.name}
                </h3>
                <div style={{ 
                  fontSize: '11pt',
                  lineHeight: '1.8',
                  color: '#374151',
                  fontFamily: 'system-ui, -apple-system, sans-serif'
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      h2: ({ children }) => (
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937', marginTop: '1.5rem', marginBottom: '0.75rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#374151', marginTop: '1.25rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <i className="fas fa-chevron-right" style={{ marginRight: '0.5rem', color: '#3b82f6', fontSize: '0.75rem' }} />
                          {children}
                        </h3>
                      ),
                      h4: ({ children }) => (
                        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#4b5563', marginTop: '0.75rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <span style={{ width: '0.5rem', height: '0.5rem', background: '#3b82f6', borderRadius: '50%', marginRight: '0.5rem' }}></span>
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => {
                        const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children));
                        const decoratedTitleMatch = text.match(/^[_\-]{3,}(.+?)[_\-]{3,}$/);
                        if (decoratedTitleMatch && decoratedTitleMatch[1]) {
                          const titleText = decoratedTitleMatch[1].trim();
                          return (
                            <div style={{ margin: '1.5rem 0', textAlign: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ flex: '1', height: '1px', background: 'linear-gradient(to right, transparent, #3b82f6, #3b82f6)' }}></div>
                                <h3 style={{ padding: '0 1rem', fontSize: '1.25rem', fontWeight: 'bold', color: '#1e40af', whiteSpace: 'nowrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{titleText}</h3>
                                <div style={{ flex: '1', height: '1px', background: 'linear-gradient(to left, transparent, #3b82f6, #3b82f6)' }}></div>
                              </div>
                            </div>
                          );
                        }
                        return <p style={{ color: '#4b5563', lineHeight: '1.75', marginBottom: '1rem', textAlign: 'justify', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</p>;
                      },
                      strong: ({ children }) => (
                        <strong style={{ fontWeight: 'bold', color: '#1f2937', background: '#fef3c7', padding: '0 0.25rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</strong>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ marginBottom: '1rem', marginLeft: '0', listStyle: 'none', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol style={{ marginBottom: '1rem', marginLeft: '1.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>{children}</ol>
                      ),
                      li: ({ children }) => (
                        <li style={{ marginLeft: '1.5rem', paddingLeft: '0.5rem', position: 'relative', marginBottom: '0.5rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          <span style={{ position: 'absolute', left: '-0.75rem', color: '#3b82f6', fontWeight: 'bold' }}>•</span>
                          {children}
                        </li>
                      ),
                      table: ({ children }) => (
                        <div style={{ overflowX: 'auto', margin: '1.5rem 0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                          <table style={{ minWidth: '100%', borderCollapse: 'collapse' }}>{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead style={{ background: '#f9fafb' }}>
                          {children}
                        </thead>
                      ),
                      tbody: ({ children }) => (
                        <tbody style={{ background: 'white' }}>
                          {children}
                        </tbody>
                      ),
                      tr: ({ children }) => (
                        <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                          {children}
                        </tr>
                      ),
                      th: ({ children }) => (
                        <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 'bold', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.875rem', color: '#4b5563', whiteSpace: 'nowrap', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                          {children}
                        </td>
                      ),
                      hr: () => (
                        <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #d1d5db' }} />
                      ),
                      code: ({ inline, children }: any) =>
                        inline ? (
                          <code style={{ background: '#f3f4f6', color: '#dc2626', padding: '0.125rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                            {children}
                          </code>
                        ) : (
                          <code style={{ display: 'block', background: '#1f2937', color: '#f3f4f6', padding: '1rem', borderRadius: '8px', overflowX: 'auto', fontSize: '0.875rem', fontFamily: 'monospace', margin: '1rem 0' }}>
                            {children}
                          </code>
                        ),
                      a: ({ href, children }) => (
                        <a
                          href={href}
                          style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: '500', fontFamily: 'system-ui, -apple-system, sans-serif' }}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {children}
                        </a>
                      ),
                    }}
                  >{agent.result}</ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        ))}

        {/* PDF 导出页尾显示平台地址 */}
        <div style={{ marginTop: '2rem', textAlign: 'right', fontSize: '0.75rem', color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
          平台地址：{systemDomain}
        </div>
      </>
    );
  };

  const handleExport = async (format: 'pdf' | 'markdown' | 'image') => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        onShowToast('请先登录', 'error');
        return;
      }

      // 新增：导出为图片（PNG）- 智能分页导出
      if (format === 'image') {
        try {
          onShowToast('正在生成图片，请稍候...', 'info');

          // 动态导入 html2canvas
          const html2canvas = (await import('html2canvas')).default;
          
          // 检查数据完整性
          if (!results?.phases || results.phases.length === 0) {
            throw new Error('分析报告数据不完整，无法导出图片。请刷新页面后重试。');
          }
          
          // 从预览弹窗中获取内容
          const exportContent = document.getElementById('export-preview-content');
          if (!exportContent) {
            throw new Error('找不到导出内容区域，请先打开导出预览');
          }

          // 获取内容总高度
          const totalHeight = exportContent.scrollHeight;
          console.log('Total content height:', totalHeight);

          // 浏览器 canvas 高度限制（保守值）
          const MAX_CANVAS_HEIGHT = 32767; // Chrome/Edge 限制
          const MAX_SAFE_HEIGHT = 25000; // 保守安全值
          
          // 判断是否需要分页
          const needsPagination = totalHeight > MAX_SAFE_HEIGHT;

          if (!needsPagination) {
            // 内容不长，直接导出单张图片
            console.log('Content fits in single image, exporting...');
            
            const canvas = await html2canvas(exportContent, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              allowTaint: true,
              windowWidth: exportContent.scrollWidth,
              windowHeight: exportContent.scrollHeight,
            } as any);

            console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);

            if (canvas.width === 0 || canvas.height === 0) {
              throw new Error('内容渲染失败，canvas尺寸为0。');
            }

            // 转换为 blob 并下载
            await new Promise<void>((resolve) => {
              canvas.toBlob((blob) => {
                if (!blob) {
                  onShowToast('生成图片失败', 'error');
                  resolve();
                  return;
                }

                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const filename = `${results.ticker}_分析报告_${results.analysis_date}.png`;
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                onShowToast('图片已下载', 'success');
                resolve();
              }, 'image/png', 0.95);
            });

          } else {
            // 内容过长，需要分页导出 - 平均分配高度
            console.log(`Content too long (${totalHeight}px), splitting into pages...`);
            
            // 计算需要多少页（向上取整）
            const pageCount = Math.ceil(totalHeight / MAX_SAFE_HEIGHT);
            
            // 计算每页的平均高度
            const avgPageHeight = Math.ceil(totalHeight / pageCount);
            
            console.log(`Will split into ${pageCount} pages, avg height: ${avgPageHeight}px per page`);
            onShowToast(`内容较长，将分成 ${pageCount} 张图片导出...`, 'info');

            // 克隆整个内容到临时容器
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-99999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '794px';
            tempContainer.style.backgroundColor = 'white';

            const clonedContent = exportContent.cloneNode(true) as HTMLElement;
            tempContainer.appendChild(clonedContent);
            document.body.appendChild(tempContainer);

            await new Promise(resolve => setTimeout(resolve, 1000));

            // 按平均高度切割导出
            for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
              const startY = pageIndex * avgPageHeight;
              const endY = Math.min(startY + avgPageHeight, totalHeight);
              const pageHeight = endY - startY;

              console.log(`Rendering page ${pageIndex + 1}/${pageCount}: ${startY}px to ${endY}px (height: ${pageHeight}px)`);

              // 渲染当前页
              const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                y: startY,
                height: pageHeight,
                windowHeight: tempContainer.scrollHeight,
              } as any);

              console.log(`Page ${pageIndex + 1} canvas:`, canvas.width, 'x', canvas.height);

              if (canvas.width === 0 || canvas.height === 0) {
                console.warn(`Page ${pageIndex + 1} is empty, skipping...`);
                continue;
              }

              // 下载图片
              await new Promise<void>((resolve) => {
                canvas.toBlob((blob) => {
                  if (!blob) {
                    console.error(`Page ${pageIndex + 1} blob generation failed`);
                    resolve();
                    return;
                  }

                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  const filename = `${results.ticker}_分析报告_${results.analysis_date}_第${pageIndex + 1}页.png`;
                  link.href = url;
                  link.download = filename;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);

                  resolve();
                }, 'image/png', 0.95);
              });

              // 添加延迟
              await new Promise(resolve => setTimeout(resolve, 300));
            }

            document.body.removeChild(tempContainer);
            onShowToast(`已成功导出 ${pageCount} 张图片`, 'success');
          }

        } catch (error) {
          console.error('Image generation error:', error);
          onShowToast(`图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
        return;
      }

      if (format === 'markdown') {
        // 导出 Markdown
        onShowToast('正在生成 Markdown...', 'info');

        const response = await fetch(buildApiUrl(API_ENDPOINTS.ANALYSIS.MARKDOWN(analysisId)), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('获取 Markdown 内容失败');
        }

        const data = await response.json();

        // 创建 Blob 并下载
        const blob = new Blob([data.content], { type: 'text/markdown;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${data.ticker || 'analysis'}_${data.analysis_date || 'report'}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        onShowToast('Markdown 文件已下载', 'success');
      } else if (format === 'pdf') {
        // 导出 PDF - 使用 html2canvas 和 jsPDF
        try {
          onShowToast('正在生成 PDF，请稍候...', 'info');

          // 检查数据完整性
          if (!results?.phases || results.phases.length === 0) {
            throw new Error('分析报告数据不完整，无法导出PDF。请刷新页面后重试。');
          }

          // 动态导入库
          const html2canvas = (await import('html2canvas')).default;
          const { jsPDF } = await import('jspdf');

          // 从预览弹窗中获取内容
          const exportContent = document.getElementById('export-preview-content');
          if (!exportContent) {
            throw new Error('找不到导出内容区域，请先打开导出预览');
          }

          // 创建 PDF 文档
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
          });

          const pageWidth = 210; // A4 宽度 mm
          const pageHeight = 297; // A4 高度 mm
          
          // 获取内容总高度
          const totalHeight = exportContent.scrollHeight;
          console.log('PDF: Total content height:', totalHeight);

          // 浏览器 canvas 高度限制
          const MAX_CANVAS_HEIGHT = 25000;
          
          // 判断是否需要分段渲染
          const needsSegmentation = totalHeight > MAX_CANVAS_HEIGHT;

          if (!needsSegmentation) {
            // 内容不长，直接渲染
            console.log('PDF: Content fits in single render');
            
            const canvas = await html2canvas(exportContent, {
              scale: 2,
              useCORS: true,
              logging: false,
              backgroundColor: '#ffffff',
              allowTaint: true,
              windowWidth: exportContent.scrollWidth,
              windowHeight: exportContent.scrollHeight,
            } as any);

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const imgWidth = pageWidth;
            const imgHeight = (canvas.height * pageWidth) / canvas.width;

            // 分页添加到 PDF
            let position = 0;
            let pageIndex = 0;

            while (position < imgHeight) {
              if (pageIndex > 0) {
                pdf.addPage();
              }

              pdf.addImage(
                imgData,
                'JPEG',
                0,
                -position,
                imgWidth,
                imgHeight
              );

              position += pageHeight;
              pageIndex++;
            }

          } else {
            // 内容过长，需要分段渲染
            console.log(`PDF: Content too long (${totalHeight}px), using segmented rendering`);
            
            // 计算需要多少段
            const segmentCount = Math.ceil(totalHeight / MAX_CANVAS_HEIGHT);
            const avgSegmentHeight = Math.ceil(totalHeight / segmentCount);
            
            console.log(`PDF: Will render in ${segmentCount} segments, avg height: ${avgSegmentHeight}px`);

            // 克隆整个内容到临时容器
            const tempContainer = document.createElement('div');
            tempContainer.style.position = 'absolute';
            tempContainer.style.left = '-99999px';
            tempContainer.style.top = '0';
            tempContainer.style.width = '794px';
            tempContainer.style.backgroundColor = 'white';

            const clonedContent = exportContent.cloneNode(true) as HTMLElement;
            tempContainer.appendChild(clonedContent);
            document.body.appendChild(tempContainer);

            await new Promise(resolve => setTimeout(resolve, 1000));

            let pdfPageIndex = 0;

            // 分段渲染
            for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
              const startY = segmentIndex * avgSegmentHeight;
              const endY = Math.min(startY + avgSegmentHeight, totalHeight);
              const segmentHeight = endY - startY;

              console.log(`PDF: Rendering segment ${segmentIndex + 1}/${segmentCount}: ${startY}px to ${endY}px`);

              // 渲染当前段
              const canvas = await html2canvas(tempContainer, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                allowTaint: true,
                y: startY,
                height: segmentHeight,
                windowHeight: tempContainer.scrollHeight,
              } as any);

              if (canvas.width === 0 || canvas.height === 0) {
                console.warn(`PDF: Segment ${segmentIndex + 1} is empty, skipping`);
                continue;
              }

              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              const imgWidth = pageWidth;
              const imgHeight = (canvas.height * pageWidth) / canvas.width;

              // 将当前段分页添加到 PDF
              let position = 0;

              while (position < imgHeight) {
                if (pdfPageIndex > 0) {
                  pdf.addPage();
                }

                pdf.addImage(
                  imgData,
                  'JPEG',
                  0,
                  -position,
                  imgWidth,
                  imgHeight
                );

                position += pageHeight;
                pdfPageIndex++;
              }
            }

            document.body.removeChild(tempContainer);
          }

          // 下载 PDF
          const filename = `${results.ticker}_分析报告_${results.analysis_date}.pdf`;
          pdf.save(filename);
          onShowToast('PDF 已下载', 'success');

        } catch (error) {
          console.error('PDF generation error:', error);
          onShowToast(`PDF 生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      onShowToast(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  const getPhaseColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'from-blue-500 to-blue-600',
      green: 'from-green-500 to-green-600',
      purple: 'from-purple-500 to-purple-600',
      red: 'from-red-500 to-red-600'
    };
    return colors[color] || 'from-gray-500 to-gray-600';
  };

  if (loading || isError || !results) return <RouteDataState loading={loading} loadingMessage="正在加载分析结果..." error={isError ? (error instanceof Error ? error : new Error('获取分析结果失败')) : null} errorTitle="分析结果加载失败" onRetry={() => window.location.reload()} empty={!isError && !loading && !results} emptyIcon="fa-file-lines" emptyTitle="暂无可查看的分析结果" emptyDescription="该分析尚未完成或结果已不可用。">{null}</RouteDataState>;

  return (
    <>
      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          /* 隐藏不需要打印的元素 */
          .no-print {
            display: none !important;
          }
          
          /* 隐藏页面header、footer、导航等 */
          header,
          footer,
          nav,
          .header,
          .footer,
          .navbar,
          .breadcrumb,
          .back-to-top,
          [class*="Header"],
          [class*="Footer"],
          [class*="Navigation"],
          [class*="Breadcrumb"],
          [id*="header"],
          [id*="footer"],
          [id*="nav"] {
            display: none !important;
          }
          
          /* 打印时：隐藏头部、tabs、当前tab内容、底部按钮 */
          body.printing-pdf .bg-white.rounded-lg.shadow-lg > div:not(.pdf-export-content) {
            display: none !important;
          }
          
          /* 打印时：移除主容器的样式 */
          body.printing-pdf .bg-white.rounded-lg.shadow-lg {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          
          /* 显示PDF导出内容 */
          body.printing-pdf .pdf-export-content {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          /* 打印时：隐藏所有固定定位的元素（通常是导航、返回顶部按钮等） */
          body.printing-pdf [style*="position: fixed"],
          body.printing-pdf [style*="position:fixed"],
          body.printing-pdf .fixed {
            display: none !important;
          }
          
          /* 打印时：确保body没有额外的padding/margin */
          body.printing-pdf {
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* 打印时：隐藏所有可能的浮动按钮 */
          body.printing-pdf button:not(.pdf-export-content button),
          body.printing-pdf .floating-button,
          body.printing-pdf .fab,
          body.printing-pdf [class*="float"],
          body.printing-pdf [class*="sticky"] {
            display: none !important;
          }
          
          /* 打印时：封面页样式 */
          body.printing-pdf .pdf-export-content .report-cover {
            page-break-after: always !important;
            page-break-inside: avoid !important;
            height: calc(100vh - 24mm) !important;
            max-height: calc(297mm - 24mm) !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            padding: 0 !important;
            margin: 0 !important;
            background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            overflow: hidden !important;
          }
          
          /* 打印时：确保封面页内的flex布局生效 */
          body.printing-pdf .pdf-export-content .report-cover > div {
            display: flex !important;
          }
          
          /* 打印时：确保渐变色背景和文字颜色正确显示 */
          body.printing-pdf .pdf-export-content [style*="linear-gradient"] {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body.printing-pdf .pdf-export-content [style*="color: white"],
          body.printing-pdf .pdf-export-content [style*="color:white"] {
            color: white !important;
          }
          
          /* 打印时：优化报告标题 */
          body.printing-pdf .pdf-export-content h1 {
            font-size: 1.5rem !important;
            margin-bottom: 0.5rem !important;
          }
          
          /* 打印时：缩小股票信息横幅 */
          body.printing-pdf .pdf-export-content > div:nth-child(2) {
            padding: 1rem !important;
            margin-bottom: 1rem !important;
          }
          
          body.printing-pdf .pdf-export-content > div:nth-child(2) .w-16 {
            width: 2.5rem !important;
            height: 2.5rem !important;
          }
          
          body.printing-pdf .pdf-export-content > div:nth-child(2) .text-3xl {
            font-size: 1.5rem !important;
          }
          
          body.printing-pdf .pdf-export-content > div:nth-child(2) .text-5xl {
            font-size: 2rem !important;
          }
          
          body.printing-pdf .pdf-export-content > div:nth-child(2) .w-20 {
            width: 3rem !important;
            height: 3rem !important;
          }
          
          body.printing-pdf .pdf-export-content > div:nth-child(2) i.text-5xl {
            font-size: 2rem !important;
          }
          
          /* 打印时：专业研报标题样式 */
          body.printing-pdf .pdf-export-content h1 {
            font-size: 14pt !important;
            margin-bottom: 0.75rem !important;
            margin-top: 1rem !important;
            font-weight: 600 !important;
            color: #1a202c !important;
            letter-spacing: 0.02em !important;
          }
          
          body.printing-pdf .pdf-export-content h2 {
            font-size: 13pt !important;
            margin-bottom: 0.75rem !important;
            margin-top: 1rem !important;
            padding-bottom: 0.5rem !important;
            font-weight: 600 !important;
            color: #2d3748 !important;
            letter-spacing: 0.01em !important;
          }
          
          body.printing-pdf .pdf-export-content h3 {
            font-size: 11.5pt !important;
            margin-bottom: 0.6rem !important;
            margin-top: 0.8rem !important;
            font-weight: 500 !important;
            color: #2d3748 !important;
          }
          
          body.printing-pdf .pdf-export-content h4 {
            font-size: 10.5pt !important;
            margin-bottom: 0.5rem !important;
            margin-top: 0.6rem !important;
            font-weight: 500 !important;
            color: #4a5568 !important;
          }
          
          /* 打印时：减小agent卡片的padding */
          body.printing-pdf .pdf-export-content .border.border-gray-200 > div:first-child {
            padding: 0.75rem !important;
          }
          
          body.printing-pdf .pdf-export-content .border.border-gray-200 > div:last-child {
            padding: 1rem !important;
          }
          
          /* 打印时：专业研报段落样式 */
          body.printing-pdf .pdf-export-content p {
            margin-bottom: 0.75rem !important;
            line-height: 1.8 !important;
            text-align: justify !important;
            text-indent: 2em !important;
            font-size: 10.5pt !important;
            color: #2c3e50 !important;
            font-weight: 400 !important;
          }
          
          /* 标题后的第一段不缩进 */
          body.printing-pdf .pdf-export-content h1 + p,
          body.printing-pdf .pdf-export-content h2 + p,
          body.printing-pdf .pdf-export-content h3 + p,
          body.printing-pdf .pdf-export-content h4 + p,
          body.printing-pdf .pdf-export-content h1 + div > p:first-child,
          body.printing-pdf .pdf-export-content h2 + div > p:first-child,
          body.printing-pdf .pdf-export-content h3 + div > p:first-child,
          body.printing-pdf .pdf-export-content h4 + div > p:first-child {
            text-indent: 0 !important;
          }
          
          /* 报告来源说明部分：左对齐，不缩进 */
          body.printing-pdf .pdf-export-content .report-source-section p {
            text-align: left !important;
            text-indent: 0 !important;
          }
          
          body.printing-pdf .pdf-export-content .report-source-section div {
            text-align: left !important;
          }
          
          /* 打印时：专业研报列表样式 */
          body.printing-pdf .pdf-export-content ul,
          body.printing-pdf .pdf-export-content ol {
            margin-bottom: 0.75rem !important;
            margin-top: 0.5rem !important;
            padding-left: 2em !important;
          }
          
          body.printing-pdf .pdf-export-content li {
            margin-bottom: 0.4rem !important;
            line-height: 1.8 !important;
            font-size: 10.5pt !important;
            color: #2c3e50 !important;
            font-weight: 400 !important;
          }
          
          /* 列表项内的段落不缩进 */
          body.printing-pdf .pdf-export-content li p {
            text-indent: 0 !important;
            margin-bottom: 0.3rem !important;
          }
          
          /* 打印时：减小卡片间距 */
          body.printing-pdf .pdf-export-content .mb-8 {
            margin-bottom: 1rem !important;
          }
          
          body.printing-pdf .pdf-export-content .mb-6 {
            margin-bottom: 0.75rem !important;
          }
          
          body.printing-pdf .pdf-export-content .mb-4 {
            margin-bottom: 0.5rem !important;
          }
          
          /* 页面设置 */
          @page {
            size: A4;
            margin: 12mm;
          }
          
          /* 确保内容适合打印 */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: white !important;
          }
          
          /* 打印时：使用更舒适的字体 */
          body.printing-pdf .pdf-export-content {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif !important;
          }
          
          body.printing-pdf .pdf-export-content * {
            font-family: inherit !important;
          }
          
          /* 打印时：隐藏所有图标和表情符号 */
          body.printing-pdf .pdf-export-content i,
          body.printing-pdf .pdf-export-content .fa,
          body.printing-pdf .pdf-export-content .fas,
          body.printing-pdf .pdf-export-content .far,
          body.printing-pdf .pdf-export-content .fab,
          body.printing-pdf .pdf-export-content [class*="fa-"],
          body.printing-pdf .pdf-export-content .icon,
          body.printing-pdf .pdf-export-content .emoji {
            display: none !important;
          }
          
          /* 封面页的图标保留（如果需要） */
          body.printing-pdf .pdf-export-content .report-cover i {
            display: inline !important;
          }
          
          /* 标题样式 - 避免标题后立即分页 */
          h1, h2, h3, h4 {
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          
          /* 表格样式 */
          table {
            page-break-inside: avoid;
          }
          
          /* 卡片样式 - 尽量避免分页，但允许在必要时分页 */
          .print-card {
            page-break-inside: auto;
            margin-bottom: 0.5rem !important;
          }
          
          /* 阶段容器 - 允许分页 */
          .page-break-inside-avoid {
            page-break-inside: auto;
          }
          
          /* Agent卡片 - 允许分页 */
          body.printing-pdf .pdf-export-content .border.border-gray-200 {
            page-break-inside: auto;
            margin-bottom: 0.5rem !important;
          }
          
          /* 确保渐变背景打印 */
          [style*="gradient"],
          [class*="gradient"] {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* 确保所有颜色和背景都打印 */
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* 避免孤行和寡行 */
          p {
            orphans: 3;
            widows: 3;
          }
          
          /* 打印时：优化加粗和强调文本 */
          body.printing-pdf .pdf-export-content strong {
            font-weight: 700 !important;
            color: #1a1a1a !important;
          }
          
          body.printing-pdf .pdf-export-content em {
            font-style: italic !important;
            color: #444 !important;
          }
          
          /* 打印时：优化表格样式 */
          body.printing-pdf .pdf-export-content table {
            margin: 1rem 0 !important;
            font-size: 9pt !important;
            line-height: 1.5 !important;
            width: 100% !important;
            table-layout: auto !important;
            border-collapse: collapse !important;
          }
          
          body.printing-pdf .pdf-export-content th {
            font-weight: 600 !important;
            background-color: #f5f5f5 !important;
            padding: 0.4rem 0.3rem !important;
            border: 1px solid #ddd !important;
            word-wrap: break-word !important;
            white-space: normal !important;
          }
          
          body.printing-pdf .pdf-export-content td {
            padding: 0.3rem 0.3rem !important;
            border: 1px solid #ddd !important;
            word-wrap: break-word !important;
            white-space: normal !important;
          }
          
          /* 表格容器 */
          body.printing-pdf .pdf-export-content .overflow-x-auto {
            overflow: visible !important;
          }
          
          /* 表格不要设置固定宽度 */
          body.printing-pdf .pdf-export-content td.whitespace-nowrap,
          body.printing-pdf .pdf-export-content th.whitespace-nowrap {
            white-space: normal !important;
          }
          
          /* 打印时：优化引用块 */
          body.printing-pdf .pdf-export-content blockquote {
            margin: 1rem 0 !important;
            padding: 0.75rem 1rem !important;
            font-size: 10.5pt !important;
            line-height: 1.7 !important;
            border-left-width: 3px !important;
          }
        }
        
        /* 默认隐藏打印内容 */
        @media screen {
          .print-only {
            display: none;
          }
        }
        
        /* 打印时显示 */
        @media print {
          .print-only {
            display: block !important;
          }
        }
      `}</style>

      <div className="bg-dark-secondary rounded-lg shadow-lg border border-dark-border">
        {/* 头部 */}
        <div className="p-4 md:p-6 border-b border-dark-border">
          <div className="flex justify-between items-start md:items-center gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="text-responsive-h3 text-text-primary truncate">
                <i className="fas fa-file-alt mr-2 text-accent-primary" />
                分析结果报告
              </h3>
              <div className="flex items-center mt-2 text-responsive-small text-text-secondary">
                <i className="far fa-calendar mr-1" />
                分析日期: {results?.analysis_date}
              </div>
            </div>
            <button
              onClick={onBackToHistory}
              className="flex items-center space-x-1 md:space-x-2 px-3 md:px-4 py-2 text-text-secondary hover:text-text-primary hover:bg-dark-tertiary rounded-lg transition-colors no-print flex-shrink-0 min-h-touch"
              title="返回"
            >
              <i className="fas fa-arrow-left text-base md:text-lg" />
              <span className="font-medium text-sm md:text-base">返回</span>
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-4 md:space-y-6">
          {/* 交易决策横幅 */}
          <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-3 md:p-6 text-white shadow-lg">
            <div className="flex items-center justify-between gap-2 md:gap-4">
              {/* 左侧：股票代码 */}
              <div className="flex items-center space-x-2 md:space-x-3 flex-shrink-0">
                <div className="w-10 h-10 md:w-16 md:h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-lg md:text-3xl" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs opacity-90 truncate">
                    {results?.market === 'US' ? '美股' : results?.market === 'HK' ? '港股' : results?.market === 'CN' ? 'A股' : '股票'}
                    {results?.company_name && ` | ${results.company_name}`}
                  </p>
                  <p className="text-xl md:text-3xl font-bold truncate">{results?.ticker}</p>
                </div>
              </div>

              {/* 中间：交易决策 */}
              <div className="flex-1 text-center px-2 md:px-6 min-w-0">
                <p className="text-xs opacity-90 mb-0.5 md:mb-1">最终交易决策</p>
                <p className="text-2xl md:text-5xl font-bold truncate">{results?.trading_decision}</p>
              </div>

              {/* 右侧：勾选图标 */}
              <div className="w-12 h-12 md:w-20 md:h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center flex-shrink-0">
                <i className="fas fa-check-circle text-2xl md:text-5xl" />
              </div>
            </div>
          </div>

          {/* 阶段标签页 */}
          <div className="border-b border-gray-200 no-print -mx-4 md:mx-0 px-4 md:px-0">
            <div className="flex space-x-1 overflow-x-auto scrollbar-hide">
              {/* 最终分析说明标签 */}
              <button
                onClick={() => setActivePhase(-1)}
                className={`px-3 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap transition-all min-h-touch ${activePhase === -1
                  ? 'border-b-2 border-accent-primary text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
                  }`}
              >
                <i className="fas fa-file-alt mr-1 md:mr-2" />
                <span className="hidden sm:inline">投资组合分析</span>
                <span className="sm:hidden">组合分析</span>
              </button>

              {/* 四个阶段标签 */}
              {results?.phases?.map((phase: PhaseResult, index: number) => (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(index)}
                  className={`px-3 md:px-4 py-2 md:py-3 font-medium text-xs md:text-sm whitespace-nowrap transition-all min-h-touch ${activePhase === index
                    ? 'border-b-2 border-accent-primary text-accent-primary'
                    : 'text-text-secondary hover:text-text-primary'
                    }`}
                >
                  <i className={`fas ${phase.icon} mr-1 md:mr-2`} />
                  {phase.name}
                </button>
              ))}
            </div>
          </div>

          {/* 内容区域 */}
          {activePhase === -1 ? (
            /* 最终分析说明内容 - 按 h2 分割成卡片 */
            <div className="space-y-3 md:space-y-4">
              {(results?.final_summary || '').split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
                const lines = section.trim().split('\n');
                const title = lines[0]?.replace(/^##\s*/, '') || '';
                const content = lines.slice(1).join('\n').trim();

                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow print-card">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 md:p-4 text-white">
                      <h2 className="font-bold text-base md:text-lg flex items-center">
                        <i className="fas fa-chart-bar mr-2 text-sm md:text-base" />
                        {title}
                      </h2>
                    </div>
                    <div className="p-4 md:p-6 bg-dark-tertiary">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          // 一级标题 - 大标题，带渐变背景和图标
                          h1: ({ children }) => (
                            <h1 className="text-lg md:text-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-3 md:px-4 py-2 md:py-3 rounded-lg mb-3 md:mb-4 shadow-sm flex items-center">
                              <i className="fas fa-star mr-2 md:mr-3 text-yellow-300 text-sm md:text-base" />
                              {children}
                            </h1>
                          ),
                          // 三级标题 - 小标题，带左侧装饰条和背景
                          h3: ({ children }) => (
                            <h3 className="text-base md:text-lg font-semibold text-text-primary mt-4 md:mt-5 mb-2 md:mb-3 pl-3 md:pl-4 pr-2 md:pr-3 py-2 border-l-4 border-accent-primary bg-dark-secondary rounded-r flex items-center">
                              <i className="fas fa-chevron-right mr-2 text-accent-primary text-xs md:text-sm" />
                              {children}
                            </h3>
                          ),
                          // 四级标题 - 带圆点装饰
                          h4: ({ children }) => (
                            <h4 className="text-sm md:text-base font-semibold text-text-primary mt-3 md:mt-4 mb-2 flex items-center">
                              <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-accent-primary rounded-full mr-2"></span>
                              {children}
                            </h4>
                          ),
                          // 段落 - 增加行高和段落间距，特殊处理带横线装饰的标题
                          p: ({ children }) => {
                            // 检查是否是带横线装饰的标题（如：────────四、最终建议────────）
                            const text = typeof children === 'string' ? children :
                              (Array.isArray(children) ? children.join('') : String(children));

                            // 匹配模式：连续的横线或下划线 + 标题文字 + 连续的横线或下划线
                            const decoratedTitleMatch = text.match(/^[─_\-]{3,}(.+?)[─_\-]{3,}$/);

                            if (decoratedTitleMatch && decoratedTitleMatch[1]) {
                              const titleText = decoratedTitleMatch[1].trim();
                              return (
                                <div className="my-6 text-center">
                                  <div className="flex items-center justify-center">
                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500 to-blue-500"></div>
                                    <h3 className="px-4 text-xl font-bold text-blue-700 whitespace-nowrap">
                                      {titleText}
                                    </h3>
                                    <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500 to-blue-500"></div>
                                  </div>
                                </div>
                              );
                            }

                            // 普通段落
                            return (
                              <p className="text-responsive-body text-text-secondary leading-relaxed mb-3 md:mb-4 text-justify">
                                {children}
                              </p>
                            );
                          },
                          // 加粗文字 - 使用深色和更粗的字体
                          strong: ({ children }) => (
                            <strong className="font-bold text-text-primary bg-accent-primary/10 px-1 text-sm md:text-base">
                              {children}
                            </strong>
                          ),
                          // 斜体
                          em: ({ children }) => (
                            <em className="italic text-text-tertiary text-sm md:text-base">
                              {children}
                            </em>
                          ),
                          // 无序列表 - 使用自定义样式
                          ul: ({ children }) => (
                            <ul className="mb-3 md:mb-4 space-y-1.5 md:space-y-2 text-text-secondary text-sm md:text-base">
                              {children}
                            </ul>
                          ),
                          // 有序列表 - 使用自定义样式
                          ol: ({ children }) => (
                            <ol className="mb-3 md:mb-4 space-y-1.5 md:space-y-2 text-text-secondary text-sm md:text-base">
                              {children}
                            </ol>
                          ),
                          // 列表项 - 带圆点和缩进
                          li: ({ children }) => (
                            <li className="ml-4 md:ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-blue-500 before:font-bold text-sm md:text-base">
                              {children}
                            </li>
                          ),
                          // 引用块 - 金融报告风格
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-accent-primary bg-dark-secondary pl-4 pr-4 py-3 my-4 italic text-text-secondary">
                              {children}
                            </blockquote>
                          ),
                          // 表格容器 - 添加阴影和边框
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-6 shadow-sm rounded-lg border border-gray-200">
                              <table className="min-w-full divide-y divide-gray-200">
                                {children}
                              </table>
                            </div>
                          ),
                          // 表头 - 深色背景
                          thead: ({ children }) => (
                            <thead className="bg-dark-secondary">
                              {children}
                            </thead>
                          ),
                          // 表体
                          tbody: ({ children }) => (
                            <tbody className="bg-dark-tertiary divide-y divide-dark-border">
                              {children}
                            </tbody>
                          ),
                          // 表格行 - 悬停效果
                          tr: ({ children }) => (
                            <tr className="hover:bg-dark-secondary transition-colors">
                              {children}
                            </tr>
                          ),
                          // 表头单元格 - 加粗和居中
                          th: ({ children }) => (
                            <th className="px-6 py-3 text-left text-xs font-bold text-text-primary uppercase tracking-wider">
                              {children}
                            </th>
                          ),
                          // 表格单元格 - 适当的内边距
                          td: ({ children }) => (
                            <td className="px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                              {children}
                            </td>
                          ),
                          // 水平分割线
                          hr: () => (
                            <hr className="my-6 border-t border-gray-300" />
                          ),
                          // 行内代码
                          code: ({ inline, children }: any) =>
                            inline ? (
                              <code className="bg-dark-secondary text-accent-primary px-2 py-0.5 rounded text-sm font-mono">
                                {children}
                              </code>
                            ) : (
                              <code className="block bg-[#0a0e1a] text-text-primary p-4 rounded-lg overflow-x-auto text-sm font-mono my-4 border border-dark-border">
                                {children}
                              </code>
                            ),
                          // 代码块
                          pre: ({ children }) => (
                            <pre className="bg-[#0a0e1a] text-text-primary p-4 rounded-lg overflow-x-auto my-4 border border-dark-border">
                              {children}
                            </pre>
                          ),
                          // 链接
                          a: ({ href, children }) => (
                            <a
                              href={href}
                              className="text-blue-600 hover:text-blue-800 underline font-medium"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {children}
                            </a>
                          ),
                        }}
                      >{content}</ReactMarkdown>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* 阶段内容 - Markdown 渲染 */
            results?.phases?.[activePhase] && (
              <div className="space-y-3 md:space-y-4">
                {results.phases[activePhase].agents.map((agent: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow print-card">
                    <div className={`bg-gradient-to-r ${getPhaseColor(results.phases[activePhase].color)} p-3 md:p-4 text-white`}>
                      <h4 className="font-bold text-base md:text-lg flex items-center">
                        <i className="fas fa-user-tie mr-2 text-sm md:text-base" />
                        {agent.name}
                      </h4>
                    </div>
                    <div className="p-4 md:p-6 bg-dark-tertiary">
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            // 标题
                            h1: ({ children }) => (
                              <h1 className="text-lg md:text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-3 md:px-4 py-2 rounded-lg mb-3 shadow-sm flex items-center">
                                <i className="fas fa-star mr-2 text-yellow-300 text-xs md:text-sm" />
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="text-base md:text-lg font-bold text-text-primary mb-2 md:mb-3 pb-2 border-b-2 border-accent-primary flex items-center">
                                <i className="fas fa-bookmark mr-2 text-accent-primary text-xs md:text-sm" />
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="text-sm md:text-base font-semibold text-text-primary mt-3 md:mt-4 mb-2 pl-3 md:pl-4 pr-2 md:pr-3 py-2 border-l-4 border-accent-primary bg-dark-secondary rounded-r flex items-center">
                                <i className="fas fa-chevron-right mr-2 text-accent-primary text-xs" />
                                {children}
                              </h3>
                            ),
                            h4: ({ children }) => (
                              <h4 className="text-xs md:text-sm font-semibold text-text-primary mt-2 md:mt-3 mb-2 flex items-center">
                                <span className="w-1.5 h-1.5 md:w-2 md:h-2 bg-accent-primary rounded-full mr-2"></span>
                                {children}
                              </h4>
                            ),
                            // 段落 - 特殊处理带横线装饰的标题
                            p: ({ children }) => {
                              // 检查是否是带横线装饰的标题
                              const text = typeof children === 'string' ? children :
                                (Array.isArray(children) ? children.join('') : String(children));

                              // 匹配模式：连续的横线或下划线 + 标题文字 + 连续的横线或下划线
                              const decoratedTitleMatch = text.match(/^[─_\-]{3,}(.+?)[─_\-]{3,}$/);

                              if (decoratedTitleMatch && decoratedTitleMatch[1]) {
                                const titleText = decoratedTitleMatch[1].trim();
                                return (
                                  <div className="my-6 text-center">
                                    <div className="flex items-center justify-center">
                                      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500 to-blue-500"></div>
                                      <h3 className="px-4 text-xl font-bold text-blue-700 whitespace-nowrap">
                                        {titleText}
                                      </h3>
                                      <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500 to-blue-500"></div>
                                    </div>
                                  </div>
                                );
                              }

                              // 普通段落
                              return (
                                <p className="text-text-secondary leading-7 mb-4 text-justify">
                                  {children}
                                </p>
                              );
                            },
                            // 加粗
                            strong: ({ children }) => (
                              <strong className="font-bold text-text-primary bg-accent-primary/10 px-1">
                                {children}
                              </strong>
                            ),
                            // 斜体
                            em: ({ children }) => (
                              <em className="italic text-text-tertiary">
                                {children}
                              </em>
                            ),
                            // 无序列表
                            ul: ({ children }) => (
                              <ul className="mb-4 space-y-2 text-text-secondary">
                                {children}
                              </ul>
                            ),
                            // 有序列表
                            ol: ({ children }) => (
                              <ol className="mb-4 space-y-2 text-text-secondary">
                                {children}
                              </ol>
                            ),
                            // 列表项
                            li: ({ children }) => (
                              <li className="ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-accent-primary before:font-bold">
                                {children}
                              </li>
                            ),
                            // 引用块
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-accent-primary bg-dark-secondary pl-4 pr-4 py-3 my-4 italic text-text-secondary">
                                {children}
                              </blockquote>
                            ),
                            // 表格
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 shadow-sm rounded-lg border border-dark-border">
                                <table className="min-w-full divide-y divide-dark-border">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-dark-secondary">
                                {children}
                              </thead>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="bg-dark-tertiary divide-y divide-dark-border">
                                {children}
                              </tbody>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-dark-secondary transition-colors">
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th className="px-6 py-3 text-left text-xs font-bold text-text-primary uppercase tracking-wider">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-6 py-4 text-sm text-text-secondary whitespace-nowrap">
                                {children}
                              </td>
                            ),
                            // 水平线
                            hr: () => (
                              <hr className="my-6 border-t border-dark-border" />
                            ),
                            // 代码
                            code: ({ inline, children }: any) =>
                              inline ? (
                                <code className="bg-dark-secondary text-accent-primary px-2 py-0.5 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-[#0a0e1a] text-text-primary p-4 rounded-lg overflow-x-auto text-sm font-mono my-4 border border-dark-border">
                                  {children}
                                </code>
                              ),
                            // 链接
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                className="text-accent-primary hover:text-accent-secondary underline font-medium"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >{agent.result}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* 底部操作区域 */}
        <div className="p-6 bg-dark-tertiary border-t border-dark-border no-print">
          {/* 操作按钮 - 排行榜模式下隐藏 */}
          {!fromLeaderboard && (
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <button
                onClick={() => setShowExportPreview(true)}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg hover:shadow-xl flex items-center font-medium"
              >
                <i className="fas fa-download mr-2" />
                导出报告
              </button>
              <button
                onClick={onBackToConfig}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium"
              >
                <i className="fas fa-plus-circle mr-2" />
                新建分析
              </button>
            </div>
          )}

          {/* 免责声明 - 始终显示 */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start">
              <i className="fas fa-exclamation-triangle text-yellow-600 text-xl mr-3 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-yellow-800 mb-1">免责声明</h4>
                <p className="text-xs text-yellow-700 leading-relaxed">
                  本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。
                  投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。
                  过往业绩不代表未来表现，市场波动可能导致本金损失。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 导出预览弹窗 */}
      {showExportPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-0 md:p-4" onClick={() => setShowExportPreview(false)}>
          <div className="bg-dark-secondary md:rounded-xl shadow-2xl max-w-4xl w-full h-full md:h-auto md:max-h-[90vh] flex flex-col border-0 md:border border-dark-border" onClick={(e) => e.stopPropagation()}>
            {/* 弹窗头部 - Fixed */}
            <div className="flex-shrink-0 flex items-center justify-between p-4 md:p-6 border-b border-dark-border bg-dark-secondary">
              <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-r from-accent-primary to-accent-secondary rounded-lg flex items-center justify-center shadow-glow-cyan flex-shrink-0">
                  <i className="fas fa-file-export text-white text-sm md:text-lg" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-responsive-h3 text-text-primary truncate">导出预览</h2>
                  <p className="text-responsive-small text-text-secondary hidden md:block">预览报告内容并选择导出格式</p>
                </div>
              </div>
              <button
                onClick={() => setShowExportPreview(false)}
                className="w-10 h-10 md:w-10 md:h-10 rounded-lg hover:bg-dark-tertiary transition-colors flex items-center justify-center text-text-secondary hover:text-text-primary flex-shrink-0 min-w-touch min-h-touch"
              >
                <i className="fas fa-times text-lg md:text-xl" />
              </button>
            </div>

            {/* 预览内容区域 - 显示完整的分析报告 */}
            <div className="flex-1 overflow-y-auto bg-dark-tertiary p-4">
              <div id="export-preview-content" className="max-w-[794px] mx-auto bg-white shadow-lg" style={{ minHeight: '100%' }}>
                {/* 封面页 - 蓝绿渐变背景 A4纸尺寸 */}
                <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-12 flex flex-col justify-between" style={{ minHeight: '1123px' }}>
                  {/* 顶部标题 */}
                  <div className="text-center">
                    <h1 className="text-3xl font-bold mb-1 tracking-wide">股票投资分析报告</h1>
                    <p className="text-sm opacity-75 tracking-widest mb-3">STOCK INVESTMENT ANALYSIS REPORT</p>
                    <div className="w-32 h-1 bg-white opacity-50 mx-auto"></div>
                  </div>

                  {/* 中间主要内容 */}
                  <div className="flex-1 flex flex-col justify-center items-center">
                    {/* 市场标签 */}
                    <div className="mb-8">
                      <span className="bg-white bg-opacity-20 backdrop-blur-sm px-6 py-3 rounded-full text-base font-medium">
                        {results?.market === 'US' ? '美国股票市场' : results?.market === 'HK' ? '香港股票市场' : results?.market === 'CN' ? 'A股市场' : '股票市场'}
                      </span>
                    </div>

                    {/* 股票代码 */}
                    <h2 className="text-7xl font-bold mb-6 tracking-wider">{results?.ticker}</h2>

                    {/* 公司名称 */}
                    {results?.company_name && (
                      <p className="text-2xl mb-12 opacity-95 font-light">{results.company_name}</p>
                    )}

                    {/* 分隔线 */}
                    <div className="w-80 h-px bg-white opacity-40 mb-12"></div>

                    {/* 投资建议标签 */}
                    <p className="text-base tracking-widest mb-6 opacity-90">投资建议</p>

                    {/* 投资建议卡片 */}
                    <div className="bg-white bg-opacity-25 backdrop-blur-md rounded-3xl px-16 py-8 shadow-2xl border border-white border-opacity-30">
                      <p className="text-5xl font-bold tracking-wide">{results?.trading_decision}</p>
                    </div>
                  </div>

                  {/* 底部信息 */}
                  <div className="text-center space-y-2 opacity-90">
                    <div className="w-full h-px bg-white opacity-30 mb-4"></div>
                    <p className="text-sm">分析日期：{results?.analysis_date}</p>
                    <p className="text-sm">生成系统：TradingAgentsWeb 多智能体分析系统</p>
                    <p className="text-xs opacity-75 mt-2">Powered by Multi-Agent AI Analysis</p>
                  </div>
                </div>

                {/* 报告内容 */}
                <div className="p-8 space-y-8">
                  {/* 渲染所有阶段 */}
                  {results?.phases?.map((phase: PhaseResult, phaseIdx: number) => (
                    <div key={phaseIdx} className="page-break-inside-avoid">
                      <h2 className="text-2xl font-bold text-blue-600 mb-4 pb-2 border-b-2 border-blue-600 flex items-center">
                        <i className={`fas ${phase.icon} mr-3`} />
                        {phase.name}
                      </h2>
                      <div className="space-y-4">
                        {phase.agents.map((agent: any, agentIdx: number) => (
                          <div key={agentIdx} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className={`bg-gradient-to-r ${getPhaseColor(phase.color)} p-3 text-white`}>
                              <h3 className="font-bold text-base flex items-center">
                                <i className="fas fa-user-tie mr-2" />
                                {agent.name}
                              </h3>
                            </div>
                            <div className="p-4 bg-white">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                  h1: ({ children }) => (
                                    <h1 className="text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 rounded-lg mb-3 shadow-sm flex items-center">
                                      <i className="fas fa-star mr-2 text-yellow-300 text-sm" />
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-500 flex items-center">
                                      <i className="fas fa-bookmark mr-2 text-blue-500 text-sm" />
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2 pl-4 pr-3 py-2 border-l-4 border-blue-500 bg-blue-50 rounded-r flex items-center">
                                      <i className="fas fa-chevron-right mr-2 text-blue-500 text-xs" />
                                      {children}
                                    </h3>
                                  ),
                                  h4: ({ children }) => (
                                    <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-2 flex items-center">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                      {children}
                                    </h4>
                                  ),
                                  p: ({ children }) => {
                                    const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children));
                                    const decoratedTitleMatch = text.match(/^[─_\-]{3,}(.+?)[─_\-]{3,}$/);
                                    if (decoratedTitleMatch && decoratedTitleMatch[1]) {
                                      const titleText = decoratedTitleMatch[1].trim();
                                      return (
                                        <div className="my-6 text-center">
                                          <div className="flex items-center justify-center">
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500 to-blue-500"></div>
                                            <h3 className="px-4 text-xl font-bold text-blue-700 whitespace-nowrap">{titleText}</h3>
                                            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500 to-blue-500"></div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return <p className="text-gray-700 leading-7 mb-4 text-justify">{children}</p>;
                                  },
                                  strong: ({ children }) => (
                                    <strong className="font-bold text-gray-900 bg-yellow-50 px-1">{children}</strong>
                                  ),
                                  em: ({ children }) => (
                                    <em className="italic text-gray-600">{children}</em>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="mb-4 space-y-2 text-gray-700">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="mb-4 space-y-2 text-gray-700">{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-blue-500 before:font-bold">{children}</li>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-3 my-4 italic text-gray-700">{children}</blockquote>
                                  ),
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-6 shadow-sm rounded-lg border border-gray-200">
                                      <table className="min-w-full divide-y divide-gray-200">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => (
                                    <thead className="bg-gray-50">{children}</thead>
                                  ),
                                  tbody: ({ children }) => (
                                    <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
                                  ),
                                  tr: ({ children }) => (
                                    <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
                                  ),
                                  th: ({ children }) => (
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">{children}</th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{children}</td>
                                  ),
                                  hr: () => (
                                    <hr className="my-6 border-t border-gray-300" />
                                  ),
                                  code: ({ inline, children }: any) =>
                                    inline ? (
                                      <code className="bg-gray-100 text-red-600 px-2 py-0.5 rounded text-sm font-mono">{children}</code>
                                    ) : (
                                      <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4">{children}</code>
                                    ),
                                  a: ({ href, children }) => (
                                    <a href={href} className="text-blue-600 hover:text-blue-800 underline font-medium" target="_blank" rel="noopener noreferrer">{children}</a>
                                  ),
                                }}
                              >{agent.result}</ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* 最终分析 */}
                  {results?.final_summary && (
                    <div className="page-break-inside-avoid">
                      <h2 className="text-2xl font-bold text-orange-600 mb-4 pb-2 border-b-2 border-orange-600 flex items-center">
                        <i className="fas fa-chart-bar mr-3" />
                        交易决策分析
                      </h2>
                      {results.final_summary.split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
                        const lines = section.trim().split('\n');
                        const title = lines[0]?.replace(/^##\s*/, '') || '';
                        const content = lines.slice(1).join('\n').trim();

                        return (
                          <div key={index} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                            <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 text-white">
                              <h3 className="font-bold text-base">{title}</h3>
                            </div>
                            <div className="p-4 bg-white">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm, remarkBreaks]}
                                components={{
                                  h1: ({ children }) => (
                                    <h1 className="text-xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 rounded-lg mb-3 shadow-sm flex items-center">
                                      <i className="fas fa-star mr-2 text-yellow-300 text-sm" />
                                      {children}
                                    </h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b-2 border-blue-500 flex items-center">
                                      <i className="fas fa-bookmark mr-2 text-blue-500 text-sm" />
                                      {children}
                                    </h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-base font-semibold text-gray-800 mt-4 mb-2 pl-4 pr-3 py-2 border-l-4 border-blue-500 bg-blue-50 rounded-r flex items-center">
                                      <i className="fas fa-chevron-right mr-2 text-blue-500 text-xs" />
                                      {children}
                                    </h3>
                                  ),
                                  h4: ({ children }) => (
                                    <h4 className="text-sm font-semibold text-gray-700 mt-3 mb-2 flex items-center">
                                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                                      {children}
                                    </h4>
                                  ),
                                  p: ({ children }) => {
                                    const text = typeof children === 'string' ? children : (Array.isArray(children) ? children.join('') : String(children));
                                    const decoratedTitleMatch = text.match(/^[─_\-]{3,}(.+?)[─_\-]{3,}$/);
                                    if (decoratedTitleMatch && decoratedTitleMatch[1]) {
                                      const titleText = decoratedTitleMatch[1].trim();
                                      return (
                                        <div className="my-6 text-center">
                                          <div className="flex items-center justify-center">
                                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-blue-500 to-blue-500"></div>
                                            <h3 className="px-4 text-xl font-bold text-blue-700 whitespace-nowrap">{titleText}</h3>
                                            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-blue-500 to-blue-500"></div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return <p className="text-gray-700 leading-7 mb-4 text-justify">{children}</p>;
                                  },
                                  strong: ({ children }) => (
                                    <strong className="font-bold text-gray-900 bg-yellow-50 px-1">{children}</strong>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="mb-4 space-y-2 text-gray-700">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="mb-4 space-y-2 text-gray-700">{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-blue-500 before:font-bold">{children}</li>
                                  ),
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-6 shadow-sm rounded-lg border border-gray-200">
                                      <table className="min-w-full divide-y divide-gray-200">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => (
                                    <thead className="bg-gray-50">{children}</thead>
                                  ),
                                  tbody: ({ children }) => (
                                    <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
                                  ),
                                  tr: ({ children }) => (
                                    <tr className="hover:bg-gray-50 transition-colors">{children}</tr>
                                  ),
                                  th: ({ children }) => (
                                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">{children}</th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">{children}</td>
                                  ),
                                }}
                              >{content}</ReactMarkdown>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 报告来源说明 */}
                  <div className="mt-8 pt-6 border-t border-gray-300">
                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
                        <i className="fas fa-info-circle mr-2 text-blue-600" />
                        报告来源说明
                      </h3>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p><strong>生成系统：</strong>TradingAgentsWeb 多智能体分析系统</p>
                        <p><strong>分析方法：</strong>本报告由多个专业智能体协同分析生成，包括基本面分析师、市场分析师、新闻分析师、社交媒体分析师、多空研究员、风险管理团队等。</p>
                        <p><strong>平台地址：</strong>{systemDomain || window.location.origin}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          报告生成时间：{results?.analysis_date} | 股票代码：{results?.ticker}
                          {results?.company_name && ` (${results.company_name})`}
                          {results?.market && ` | 市场：${results?.market === 'US' ? '美股' : results?.market === 'HK' ? '港股' : results?.market === 'CN' ? 'A股' : results?.market}`}
                        </p>
                      </div>
                    </div>

                    {/* 免责声明 */}
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                      <h3 className="text-sm font-bold text-yellow-800 mb-2 flex items-center">
                        <i className="fas fa-exclamation-triangle mr-2 text-yellow-600" />
                        免责声明
                      </h3>
                      <p className="text-xs text-yellow-700 leading-relaxed">
                        本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。
                        投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。
                        过往业绩不代表未来表现，市场波动可能导致本金损失。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 弹窗底部 - 导出按钮 */}
            <div className="p-6 border-t border-dark-border bg-dark-secondary rounded-b-xl">
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={async () => {
                    await handleExport('pdf');
                    setShowExportPreview(false);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-glow-cyan transition-all flex items-center font-medium shadow-lg hover:scale-105"
                >
                  <i className="fas fa-file-pdf mr-2" />
                  导出为 PDF
                </button>
                <button
                  onClick={async () => {
                    await handleExport('image');
                    setShowExportPreview(false);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-glow-cyan transition-all flex items-center font-medium shadow-lg hover:scale-105"
                >
                  <i className="fas fa-image mr-2" />
                  导出为图片
                </button>
                <button
                  onClick={async () => {
                    await handleExport('markdown');
                    setShowExportPreview(false);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-accent-primary to-accent-secondary text-dark-primary rounded-lg hover:shadow-glow-cyan transition-all flex items-center font-medium shadow-lg hover:scale-105"
                >
                  <i className="fas fa-file-code mr-2" />
                  导出为 Markdown
                </button>
              </div>
              <p className="text-center text-sm text-text-secondary mt-4">
                <i className="fas fa-info-circle mr-1" />
                选择导出格式后将生成完整的分析报告
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
