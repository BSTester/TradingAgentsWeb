'use client';

import React from 'react';
import LazyMarkdown from '@/components/common/LazyMarkdown';
import { PhaseResult, getPhaseColor } from './types';

interface ExportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'markdown' | 'image') => Promise<void>;
  market?: string;
  ticker?: string;
  companyName?: string;
  tradingDecision?: string;
  analysisDate?: string;
  phases?: PhaseResult[];
  finalSummary?: string;
  systemDomain: string;
}

export function ExportPreviewModal({ open, onClose, onExport, market, ticker, companyName, tradingDecision, analysisDate, phases, finalSummary, systemDomain }: ExportPreviewModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-0 md:p-4" onClick={onClose}>
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
            onClick={onClose}
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
                    {market === 'US' ? '美国股票市场' : market === 'HK' ? '香港股票市场' : market === 'CN' ? 'A股市场' : '股票市场'}
                  </span>
                </div>

                {/* 股票代码 */}
                <h2 className="text-7xl font-bold mb-6 tracking-wider">{ticker}</h2>

                {/* 公司名称 */}
                {companyName && (
                  <p className="text-2xl mb-12 opacity-95 font-light">{companyName}</p>
                )}

                {/* 分隔线 */}
                <div className="w-80 h-px bg-white opacity-40 mb-12"></div>

                {/* 投资建议标签 */}
                <p className="text-base tracking-widest mb-6 opacity-90">投资建议</p>

                {/* 投资建议卡片 */}
                <div className="bg-white bg-opacity-25 backdrop-blur-md rounded-3xl px-16 py-8 shadow-2xl border border-white border-opacity-30">
                  <p className="text-5xl font-bold tracking-wide">{tradingDecision}</p>
                </div>
              </div>

              {/* 底部信息 */}
              <div className="text-center space-y-2 opacity-90">
                <div className="w-full h-px bg-white opacity-30 mb-4"></div>
                <p className="text-sm">分析日期：{analysisDate}</p>
                <p className="text-sm">生成系统：TradingAgentsWeb 多智能体分析系统</p>
                <p className="text-xs opacity-75 mt-2">Powered by Multi-Agent AI Analysis</p>
              </div>
            </div>

            {/* 报告内容 */}
            <div className="p-8 space-y-8">
              {/* 渲染所有阶段 */}
              {phases?.map((phase: PhaseResult, phaseIdx: number) => (
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
                          <LazyMarkdown
                            preset="gfm"
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
                          >{agent.result}</LazyMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* 最终分析 */}
              {finalSummary && (
                <div className="page-break-inside-avoid">
                  <h2 className="text-2xl font-bold text-orange-600 mb-4 pb-2 border-b-2 border-orange-600 flex items-center">
                    <i className="fas fa-chart-bar mr-3" />
                    交易决策分析
                  </h2>
                  {finalSummary.split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
                    const lines = section.trim().split('\n');
                    const title = lines[0]?.replace(/^##\s*/, '') || '';
                    const content = lines.slice(1).join('\n').trim();

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                        <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-3 text-white">
                          <h3 className="font-bold text-base">{title}</h3>
                        </div>
                        <div className="p-4 bg-white">
                          <LazyMarkdown
                            preset="gfm"
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
                          >{content}</LazyMarkdown>
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
                      报告生成时间：{analysisDate} | 股票代码：{ticker}
                      {companyName && ` (${companyName})`}
                      {market && ` | 市场：${market === 'US' ? '美股' : market === 'HK' ? '港股' : market === 'CN' ? 'A股' : market}`}
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
                await onExport('pdf');
                onClose();
              }}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-glow-cyan transition-all flex items-center font-medium shadow-lg hover:scale-105"
            >
              <i className="fas fa-file-pdf mr-2" />
              导出为 PDF
            </button>
            <button
              onClick={async () => {
                await onExport('image');
                onClose();
              }}
              className="px-8 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:shadow-glow-cyan transition-all flex items-center font-medium shadow-lg hover:scale-105"
            >
              <i className="fas fa-image mr-2" />
              导出为图片
            </button>
            <button
              onClick={async () => {
                await onExport('markdown');
                onClose();
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
  );
}
