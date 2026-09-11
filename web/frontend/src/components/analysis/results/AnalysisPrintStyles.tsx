'use client';

import React from 'react';

export function AnalysisPrintStyles() {
  return (
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
  );
}
