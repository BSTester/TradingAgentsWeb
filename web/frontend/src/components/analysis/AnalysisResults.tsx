'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildApiUrl, API_ENDPOINTS } from '../../utils/api';
import LazyMarkdown from '@/components/common/LazyMarkdown';
import { AnalysisResultsSkeleton } from './AnalysisResultsSkeleton';
import { logger } from '@/utils/logger';
import { RouteDataState } from '@/components/ui/RouteDataState';
import { PhaseResult } from './results/types';
import { AnalysisPrintStyles } from './results/AnalysisPrintStyles';
import { DecisionBanner } from './results/DecisionBanner';
import { PhaseTabs } from './results/PhaseTabs';
import { PhaseReportSection } from './results/PhaseReportSection';
import { ResultsActions } from './results/ResultsActions';
import { ExportPreviewModal } from './results/ExportPreviewModal';

interface AnalysisResultsProps {
  analysisId: string;
  onBackToConfig: () => void;
  onBackToHistory: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  fromLeaderboard?: boolean; // 是否从排行榜进入
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
              <LazyMarkdown
                preset="gfm"
                components={{
                  p: ({ children }) => <p style={{ marginBottom: '0.75rem' }}>{children}</p>,
                  strong: ({ children }) => <strong style={{ fontWeight: 'bold' }}>{children}</strong>,
                  ul: ({ children }) => <ul style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ marginLeft: '1.5rem', marginBottom: '0.75rem' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ marginBottom: '0.25rem' }}>{children}</li>,
                }}
              >
                {results.final_analysis}
              </LazyMarkdown>
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
                  <LazyMarkdown
                    preset="gfm"
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
                  >{agent.result}</LazyMarkdown>
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

  if (loading || isError || !results) return <RouteDataState loading={loading} loadingMessage="正在加载分析结果..." error={isError ? (error instanceof Error ? error : new Error('获取分析结果失败')) : null} errorTitle="分析结果加载失败" onRetry={() => window.location.reload()} empty={!isError && !loading && !results} emptyIcon="fa-file-lines" emptyTitle="暂无可查看的分析结果" emptyDescription="该分析尚未完成或结果已不可用。">{null}</RouteDataState>;

  return (
    <>
      {/* 打印样式 */}
      <AnalysisPrintStyles />
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
          <DecisionBanner
            market={results?.market}
            companyName={results?.company_name}
            ticker={results?.ticker}
            tradingDecision={results?.trading_decision}
          />

          {/* 阶段标签页 */}
          <PhaseTabs
            activePhase={activePhase}
            onSelectPhase={setActivePhase}
            phases={results?.phases}
          />

          {/* 内容区域 */}
          <PhaseReportSection
            activePhase={activePhase}
            finalSummary={results?.final_summary}
            phases={results?.phases}
          />
        </div>

        {/* 底部操作区域 */}
        <ResultsActions
          fromLeaderboard={fromLeaderboard}
          onOpenExportPreview={() => setShowExportPreview(true)}
          onBackToConfig={onBackToConfig}
        />
      </div>
      {/* 导出预览弹窗 */}
      <ExportPreviewModal
        open={showExportPreview}
        onClose={() => setShowExportPreview(false)}
        onExport={handleExport}
        market={results?.market}
        ticker={results?.ticker}
        companyName={results?.company_name}
        tradingDecision={results?.trading_decision}
        analysisDate={results?.analysis_date}
        phases={results?.phases}
        finalSummary={results?.final_summary}
        systemDomain={systemDomain}
      />
    </>
  );
}
