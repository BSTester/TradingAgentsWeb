'use client';

import React, { useState, useEffect } from 'react';
import { buildApiUrl, API_ENDPOINTS } from '../../utils/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface AnalysisResultsProps {
  analysisId: string;
  onBackToConfig: () => void;
  onShowToast: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
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

export function AnalysisResults({ analysisId, onBackToConfig, onShowToast }: AnalysisResultsProps) {
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activePhase, setActivePhase] = useState(-1); // -1 表示显示最终分析说明

  useEffect(() => {
    // 获取分析结果
    const fetchResults = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          onShowToast('请先登录', 'error');
          setLoading(false);
          return;
        }

        const response = await fetch(buildApiUrl(API_ENDPOINTS.ANALYSIS.RESULTS(analysisId)), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            onShowToast('登录已过期，请重新登录', 'error');
          } else if (response.status === 404) {
            onShowToast('分析记录未找到', 'error');
          } else if (response.status === 400) {
            const error = await response.json();
            onShowToast(error.detail || '分析未完成', 'error');
          } else {
            throw new Error('获取分析结果失败');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        console.log('📊 Fetched results:', data);
        setResults(data);
      } catch (error) {
        console.error('Error fetching results:', error);
        onShowToast('获取分析结果失败', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [analysisId]);

  const handleExport = async (format: 'pdf' | 'markdown') => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        onShowToast('请先登录', 'error');
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
        // 导出 PDF - 使用 jspdf 和 html2canvas 直接生成 PDF
        onShowToast('正在生成 PDF，请稍候...', 'info');

        try {
          // 动态导入库
          const { default: jsPDF } = await import('jspdf');
          const html2canvas = (await import('html2canvas')).default;

          // 找到打印专用的完整内容区域
          const printContent = document.querySelector('.pdf-export-content') as HTMLElement;
          if (!printContent) {
            throw new Error('找不到打印内容');
          }

          // 创建一个临时容器，克隆内容到body中（可见但在屏幕外）
          const tempContainer = document.createElement('div');
          tempContainer.style.position = 'absolute';
          tempContainer.style.left = '-9999px';
          tempContainer.style.top = '0';
          tempContainer.style.width = '794px'; // A4 宽度
          tempContainer.style.backgroundColor = 'white';
          tempContainer.style.padding = '40px';

          // 克隆内容
          const clonedContent = printContent.cloneNode(true) as HTMLElement;
          clonedContent.style.display = 'block';
          clonedContent.style.position = 'static';
          clonedContent.style.width = '100%';

          tempContainer.appendChild(clonedContent);
          document.body.appendChild(tempContainer);

          // 等待渲染完成
          await new Promise(resolve => setTimeout(resolve, 500));

          // 转换为 canvas
          const canvas = await html2canvas(tempContainer, {
            useCORS: true,
            logging: true,
            backgroundColor: '#ffffff',
            scale: 2, // 提高清晰度
            windowWidth: 874, // 794 + 80 (padding)
            allowTaint: true,
          } as any);

          console.log('Canvas size:', canvas.width, 'x', canvas.height);

          // 移除临时容器
          document.body.removeChild(tempContainer);

          // 验证 canvas 尺寸
          if (canvas.width === 0 || canvas.height === 0) {
            throw new Error('内容渲染失败，请重试');
          }

          // 创建 PDF
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const pdfHeight = pdf.internal.pageSize.getHeight();

          // 计算图片在 PDF 中的尺寸（保持宽高比）
          const imgWidth = pdfWidth;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;

          console.log('PDF size:', pdfWidth, 'x', pdfHeight);
          console.log('Image size in PDF:', imgWidth, 'x', imgHeight);

          // 验证尺寸
          if (imgWidth <= 0 || imgHeight <= 0 || !isFinite(imgWidth) || !isFinite(imgHeight)) {
            throw new Error('PDF 尺寸计算错误');
          }

          let heightLeft = imgHeight;
          let position = 0;

          // 添加第一页
          pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;

          // 如果内容超过一页，添加更多页
          while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pdfHeight;
          }

          // 保存 PDF
          const filename = `${results?.ticker || 'analysis'}_${results?.analysis_date || 'report'}.pdf`;
          console.log('Saving PDF:', filename);
          pdf.save(filename);

          onShowToast('PDF 文件已下载', 'success');
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4" />
          <p className="text-gray-600">正在加载分析结果...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* 打印样式 */}
      <style jsx global>{`
        @media print {
          /* 隐藏不需要打印的元素 */
          .no-print {
            display: none !important;
          }
          
          /* 页面设置 */
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* 确保内容适合打印 */
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          /* 标题样式 */
          h1, h2, h3, h4 {
            page-break-after: avoid;
          }
          
          /* 表格样式 */
          table {
            page-break-inside: avoid;
          }
          
          /* 卡片样式 */
          .print-card {
            page-break-inside: avoid;
            margin-bottom: 1rem;
          }
          
          /* 打印时显示所有阶段 */
          .print-all-content {
            display: block !important;
          }
          
          /* 确保渐变背景打印 */
          [style*="gradient"] {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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

      <div className="bg-white rounded-lg shadow-lg">
        {/* 头部 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900">
                <i className="fas fa-file-alt mr-2 text-blue-600" />
                分析结果报告
              </h3>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <i className="far fa-calendar mr-1" />
                分析日期: {results?.analysis_date}
              </div>
            </div>
            <button
              onClick={onBackToConfig}
              className="text-gray-500 hover:text-gray-700 no-print"
            >
              <i className="fas fa-times text-xl" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 交易决策横幅 */}
          <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center justify-between">
              {/* 左侧：股票代码 */}
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-3xl" />
                </div>
                <div>
                  <p className="text-sm opacity-90">股票代码</p>
                  <p className="text-3xl font-bold">{results?.ticker}</p>
                </div>
              </div>

              {/* 中间：交易决策 */}
              <div className="flex-1 text-center px-6">
                <p className="text-sm opacity-90 mb-1">最终交易决策</p>
                <p className="text-5xl font-bold">{results?.trading_decision}</p>
              </div>

              {/* 右侧：勾选图标 */}
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <i className="fas fa-check-circle text-5xl" />
              </div>
            </div>
          </div>

          {/* 阶段标签页 */}
          <div className="border-b border-gray-200 no-print">
            <div className="flex space-x-1 overflow-x-auto">
              {/* 最终分析说明标签 */}
              <button
                onClick={() => setActivePhase(-1)}
                className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all ${activePhase === -1
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <i className="fas fa-file-alt mr-2" />
                交易决策分析
              </button>

              {/* 四个阶段标签 */}
              {results?.phases?.map((phase: PhaseResult, index: number) => (
                <button
                  key={phase.id}
                  onClick={() => setActivePhase(index)}
                  className={`px-4 py-3 font-medium text-sm whitespace-nowrap transition-all ${activePhase === index
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  <i className={`fas ${phase.icon} mr-2`} />
                  {phase.name}
                </button>
              ))}
            </div>
          </div>

          {/* 内容区域 */}
          {activePhase === -1 ? (
            /* 最终分析说明内容 - 按 h2 分割成卡片 */
            <div className="space-y-4">
              {(results?.final_summary || '').split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
                const lines = section.trim().split('\n');
                const title = lines[0]?.replace(/^##\s*/, '') || '';
                const content = lines.slice(1).join('\n').trim();

                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow print-card">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 text-white">
                      <h2 className="font-bold text-lg flex items-center">
                        <i className="fas fa-chart-bar mr-2" />
                        {title}
                      </h2>
                    </div>
                    <div className="p-6 bg-white">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkBreaks]}
                        components={{
                          // 一级标题 - 大标题，带渐变背景和图标
                          h1: ({ children }) => (
                            <h1 className="text-2xl font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 rounded-lg mb-4 shadow-sm flex items-center">
                              <i className="fas fa-star mr-3 text-yellow-300" />
                              {children}
                            </h1>
                          ),
                          // 三级标题 - 小标题，带左侧装饰条和背景
                          h3: ({ children }) => (
                            <h3 className="text-lg font-semibold text-gray-800 mt-5 mb-3 pl-4 pr-3 py-2 border-l-4 border-blue-500 bg-blue-50 rounded-r flex items-center">
                              <i className="fas fa-chevron-right mr-2 text-blue-500 text-sm" />
                              {children}
                            </h3>
                          ),
                          // 四级标题 - 带圆点装饰
                          h4: ({ children }) => (
                            <h4 className="text-base font-semibold text-gray-700 mt-4 mb-2 flex items-center">
                              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
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
                              <p className="text-gray-700 leading-7 mb-4 text-justify">
                                {children}
                              </p>
                            );
                          },
                          // 加粗文字 - 使用深色和更粗的字体
                          strong: ({ children }) => (
                            <strong className="font-bold text-gray-900 bg-yellow-50 px-1">
                              {children}
                            </strong>
                          ),
                          // 斜体
                          em: ({ children }) => (
                            <em className="italic text-gray-600">
                              {children}
                            </em>
                          ),
                          // 无序列表 - 使用自定义样式
                          ul: ({ children }) => (
                            <ul className="mb-4 space-y-2 text-gray-700">
                              {children}
                            </ul>
                          ),
                          // 有序列表 - 使用自定义样式
                          ol: ({ children }) => (
                            <ol className="mb-4 space-y-2 text-gray-700">
                              {children}
                            </ol>
                          ),
                          // 列表项 - 带圆点和缩进
                          li: ({ children }) => (
                            <li className="ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-blue-500 before:font-bold">
                              {children}
                            </li>
                          ),
                          // 引用块 - 金融报告风格
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-3 my-4 italic text-gray-700">
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
                            <thead className="bg-gray-50">
                              {children}
                            </thead>
                          ),
                          // 表体
                          tbody: ({ children }) => (
                            <tbody className="bg-white divide-y divide-gray-200">
                              {children}
                            </tbody>
                          ),
                          // 表格行 - 悬停效果
                          tr: ({ children }) => (
                            <tr className="hover:bg-gray-50 transition-colors">
                              {children}
                            </tr>
                          ),
                          // 表头单元格 - 加粗和居中
                          th: ({ children }) => (
                            <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              {children}
                            </th>
                          ),
                          // 表格单元格 - 适当的内边距
                          td: ({ children }) => (
                            <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
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
                              <code className="bg-gray-100 text-red-600 px-2 py-0.5 rounded text-sm font-mono">
                                {children}
                              </code>
                            ) : (
                              <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4">
                                {children}
                              </code>
                            ),
                          // 代码块
                          pre: ({ children }) => (
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
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
              <div className="space-y-4">
                {results.phases[activePhase].agents.map((agent: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow print-card">
                    <div className={`bg-gradient-to-r ${getPhaseColor(results.phases[activePhase].color)} p-4 text-white`}>
                      <h4 className="font-bold text-lg flex items-center">
                        <i className="fas fa-user-tie mr-2" />
                        {agent.name}
                      </h4>
                    </div>
                    <div className="p-6 bg-white">
                      <div className="markdown-content">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkBreaks]}
                          components={{
                            // 标题
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
                                <p className="text-gray-700 leading-7 mb-4 text-justify">
                                  {children}
                                </p>
                              );
                            },
                            // 加粗
                            strong: ({ children }) => (
                              <strong className="font-bold text-gray-900 bg-yellow-50 px-1">
                                {children}
                              </strong>
                            ),
                            // 斜体
                            em: ({ children }) => (
                              <em className="italic text-gray-600">
                                {children}
                              </em>
                            ),
                            // 无序列表
                            ul: ({ children }) => (
                              <ul className="mb-4 space-y-2 text-gray-700">
                                {children}
                              </ul>
                            ),
                            // 有序列表
                            ol: ({ children }) => (
                              <ol className="mb-4 space-y-2 text-gray-700">
                                {children}
                              </ol>
                            ),
                            // 列表项
                            li: ({ children }) => (
                              <li className="ml-6 pl-2 relative before:content-['•'] before:absolute before:left-[-12px] before:text-blue-500 before:font-bold">
                                {children}
                              </li>
                            ),
                            // 引用块
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-4 border-blue-500 bg-blue-50 pl-4 pr-4 py-3 my-4 italic text-gray-700">
                                {children}
                              </blockquote>
                            ),
                            // 表格
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-6 shadow-sm rounded-lg border border-gray-200">
                                <table className="min-w-full divide-y divide-gray-200">
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children }) => (
                              <thead className="bg-gray-50">
                                {children}
                              </thead>
                            ),
                            tbody: ({ children }) => (
                              <tbody className="bg-white divide-y divide-gray-200">
                                {children}
                              </tbody>
                            ),
                            tr: ({ children }) => (
                              <tr className="hover:bg-gray-50 transition-colors">
                                {children}
                              </tr>
                            ),
                            th: ({ children }) => (
                              <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                                {children}
                              </th>
                            ),
                            td: ({ children }) => (
                              <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                                {children}
                              </td>
                            ),
                            // 水平线
                            hr: () => (
                              <hr className="my-6 border-t border-gray-300" />
                            ),
                            // 代码
                            code: ({ inline, children }: any) =>
                              inline ? (
                                <code className="bg-gray-100 text-red-600 px-2 py-0.5 rounded text-sm font-mono">
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono my-4">
                                  {children}
                                </code>
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
                        >{agent.result}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* PDF导出专用：完整内容（包含投资建议和报告来源） */}
        <div className="pdf-export-content" style={{ display: 'none' }}>
          {/* 报告标题 */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              <i className="fas fa-file-alt mr-2 text-blue-600" />
              股票分析报告
            </h1>
            <div className="text-sm text-gray-600">
              <i className="far fa-calendar mr-1" />
              分析日期: {results?.analysis_date}
            </div>
          </div>

          {/* 投资建议横幅 */}
          <div className="bg-gradient-to-r from-green-500 to-blue-500 rounded-xl p-6 text-white shadow-lg mb-6">
            <div className="flex items-center justify-between">
              {/* 左侧：股票代码 */}
              <div className="flex items-center space-x-3">
                <div className="w-16 h-16 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <i className="fas fa-chart-line text-3xl" />
                </div>
                <div>
                  <p className="text-sm opacity-90">股票代码</p>
                  <p className="text-3xl font-bold">{results?.ticker}</p>
                </div>
              </div>

              {/* 中间：交易决策 */}
              <div className="flex-1 text-center px-6">
                <p className="text-sm opacity-90 mb-1">最终交易决策</p>
                <p className="text-5xl font-bold">{results?.trading_decision}</p>
              </div>

              {/* 右侧：勾选图标 */}
              <div className="w-20 h-20 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <i className="fas fa-check-circle text-5xl" />
              </div>
            </div>
          </div>

          {/* 所有阶段按顺序显示 */}
          {results?.phases?.map((phase: PhaseResult, phaseIdx: number) => (
            <div key={phaseIdx} className="mb-8 page-break-inside-avoid">
              <h2 className="text-2xl font-bold text-blue-600 mb-4 border-b-2 border-blue-600 pb-2">
                <i className={`fas ${phase.icon} mr-2`} />
                {phase.name}
              </h2>
              <div className="space-y-4">
                {phase.agents.map((agent: any, agentIdx: number) => (
                  <div key={agentIdx} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <div className={`bg-gradient-to-r ${getPhaseColor(phase.color)} p-4 text-white`}>
                      <h4 className="font-bold text-lg">
                        <i className="fas fa-user-tie mr-2" />
                        {agent.name}
                      </h4>
                    </div>
                    <div className="p-6 bg-white">
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
                            const decoratedTitleMatch = text.match(/^[_\-]{3,}(.+?)[_\-]{3,}$/);
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
                      >{agent.result}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* 交易决策分析 */}
          {results?.final_summary && (
            <div className="mb-8 page-break-inside-avoid">
              <h2 className="text-2xl font-bold text-orange-600 mb-4 border-b-2 border-orange-600 pb-2">
                <i className="fas fa-chart-bar mr-2" />
                交易决策分析
              </h2>
              {results.final_summary.split(/(?=##\s)/).filter((section: string) => section.trim()).map((section: string, index: number) => {
                const lines = section.trim().split('\n');
                const title = lines[0]?.replace(/^##\s*/, '') || '';
                const content = lines.slice(1).join('\n').trim();

                return (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden mb-4">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-4 text-white">
                      <h3 className="font-bold text-lg">{title}</h3>
                    </div>
                    <div className="p-6 bg-white">
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
                            const decoratedTitleMatch = text.match(/^[_\-]{3,}(.+?)[_\-]{3,}$/);
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
          <div className="mt-8 pt-6 border-t-2 border-gray-300">
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center">
                <i className="fas fa-info-circle mr-2 text-blue-600" />
                报告来源说明
              </h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>
                  <strong>生成系统：</strong>TradingAgents 多智能体分析系统
                </p>
                <p>
                  <strong>分析方法：</strong>本报告由多个专业智能体协同分析生成，包括基本面分析师、市场分析师、新闻分析师、社交媒体分析师、多空研究员、风险管理团队等。
                </p>
                <p className="text-xs text-gray-500 mt-4">
                  报告生成时间：{results?.analysis_date} | 股票代码：{results?.ticker}
                </p>
              </div>
            </div>

            {/* 免责声明 */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded">
              <h3 className="text-lg font-bold text-yellow-800 mb-3 flex items-center">
                <i className="fas fa-exclamation-triangle mr-2 text-yellow-600" />
                免责声明
              </h3>
              <div className="text-sm text-yellow-700 space-y-2 leading-relaxed">
                <p>
                  本报告由AI智能体系统生成，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。
                  投资者应当根据自身风险承受能力、投资目标和财务状况，独立做出投资决策并自行承担投资风险。
                  过往业绩不代表未来表现，市场波动可能导致本金损失。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作按钮 */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 no-print">
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => handleExport('pdf')}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center font-medium"
            >
              <i className="fas fa-file-pdf mr-2" />
              导出为PDF
            </button>
            <button
              onClick={() => handleExport('markdown')}
              className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center font-medium"
            >
              <i className="fas fa-file-code mr-2" />
              导出为Markdown
            </button>
            <button
              onClick={onBackToConfig}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center font-medium"
            >
              <i className="fas fa-plus-circle mr-2" />
              新建分析
            </button>
          </div>

          {/* 免责声明 */}
          <div className="mt-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
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
    </>
  );
}