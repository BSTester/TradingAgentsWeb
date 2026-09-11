'use client';

import React from 'react';
import LazyMarkdown from '@/components/common/LazyMarkdown';
import { PhaseResult, getPhaseColor } from './types';

interface PhaseReportSectionProps {
  activePhase: number;
  finalSummary?: string;
  phases?: PhaseResult[];
}

export function PhaseReportSection({ activePhase, finalSummary, phases }: PhaseReportSectionProps) {
  if (activePhase === -1) {
    /* 最终分析说明内容 - 按 h2 分割成卡片 */
    return (
    <div className="space-y-3 md:space-y-4">
      {(finalSummary || '').split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
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
              <LazyMarkdown
                preset="gfm"
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
              >{content}</LazyMarkdown>
            </div>
          </div>
        );
      })}
    </div>
    );
  }

  const phase = phases?.[activePhase];

  if (!phase) {
    return null;
  }

  /* 阶段内容 - Markdown 渲染 */
  return (
    <div className="space-y-3 md:space-y-4">
      {phase.agents.map((agent: any, index: number) => (
        <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow print-card">
          <div className={`bg-gradient-to-r ${getPhaseColor(phase.color)} p-3 md:p-4 text-white`}>
            <h4 className="font-bold text-base md:text-lg flex items-center">
              <i className="fas fa-user-tie mr-2 text-sm md:text-base" />
              {agent.name}
            </h4>
          </div>
          <div className="p-4 md:p-6 bg-dark-tertiary">
            <div className="markdown-content">
              <LazyMarkdown
                preset="gfm"
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
              >{agent.result}</LazyMarkdown>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
