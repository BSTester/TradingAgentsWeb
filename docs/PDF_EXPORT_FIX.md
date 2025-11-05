# PDF导出问题修复 - 最终方案

## 问题分析

### 问题1：使用html2canvas导出时页面空白
- **原因**：隐藏的DOM元素（`display: none`）在转换为canvas时，浏览器不会完整渲染
- **尝试的方案**：使用 `opacity: 0` 和 `position: fixed` 让元素透明但可见
- **结果**：仍然不稳定，某些情况下canvas尺寸为0

### 问题2：打印功能只能打印当前tab
- **原因**：页面使用tabs切换显示不同阶段的内容，打印时只能打印当前可见的tab
- **需求**：需要打印所有4个阶段的完整内容

## 最终解决方案：使用浏览器原生打印

### 方案说明

使用浏览器的 `window.print()` 功能配合CSS `@media print` 规则：

1. 页面包含两部分内容：
   - **屏幕显示内容**：tabs + 当前tab的内容
   - **打印专用内容**：`.pdf-export-content`（隐藏），包含所有阶段的完整内容

2. 点击"导出为PDF"时：
   - 添加 `printing-pdf` class到body
   - 触发 `window.print()`
   - 通过CSS隐藏屏幕内容，显示打印内容

3. 用户在打印对话框中选择"另存为PDF"

### 关键代码

#### 1. PDF导出按钮处理

```typescript
} else if (format === 'pdf') {
  try {
    if (!results?.phases || results.phases.length === 0) {
      throw new Error('分析报告数据不完整，无法导出PDF。请刷新页面后重试。');
    }

    // 添加打印标记
    document.body.classList.add('printing-pdf');
    
    // 触发打印对话框
    window.print();
    
    // 移除打印标记
    setTimeout(() => {
      document.body.classList.remove('printing-pdf');
    }, 100);

    onShowToast('请在打印对话框中选择"另存为PDF"或"Microsoft Print to PDF"', 'info');
  } catch (error) {
    console.error('PDF generation error:', error);
    document.body.classList.remove('printing-pdf');
    onShowToast(`PDF 生成失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
  }
}
```

#### 2. 打印样式（CSS）

```css
@media print {
  /* 隐藏不需要打印的元素 */
  .no-print {
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
  
  /* 页面设置 */
  @page {
    size: A4;
    margin: 15mm;
  }
  
  /* 确保颜色和背景都打印 */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

#### 3. 打印专用内容结构

```tsx
{/* PDF导出专用：完整内容（包含投资建议和报告来源） */}
<div className="pdf-export-content" style={{ display: 'none' }}>
  {/* 报告标题 */}
  <div className="mb-6">...</div>

  {/* 投资建议横幅 */}
  <div className="bg-gradient-to-r from-green-500 to-blue-500 ...">...</div>

  {/* 所有阶段按顺序显示 */}
  {results?.phases?.map((phase: PhaseResult, phaseIdx: number) => (
    <div key={phaseIdx} className="mb-8 page-break-inside-avoid">
      <h2>阶段{phaseIdx + 1}: {phase.name}</h2>
      {phase.agents.map((agent: any, agentIdx: number) => (
        <div key={agentIdx}>
          <h4>{agent.name}</h4>
          <ReactMarkdown>{agent.result}</ReactMarkdown>
        </div>
      ))}
    </div>
  ))}

  {/* 交易决策分析 */}
  {results?.final_summary && <div>...</div>}

  {/* 报告来源说明和免责声明 */}
  <div>...</div>
</div>
```

## 使用方法

1. 点击"导出为PDF"按钮
2. 浏览器弹出打印对话框
3. 在"目标打印机"中选择：
   - Windows: "Microsoft Print to PDF"
   - Mac: "Save as PDF"
   - Chrome: "另存为PDF"
4. 点击"打印"按钮
5. 选择保存位置和文件名

## 优势

1. **可靠性高**：使用浏览器原生功能，不依赖第三方库
2. **速度快**：不需要生成canvas和处理大图片
3. **质量好**：直接打印矢量内容，不是光栅化图片
4. **自动分页**：浏览器自动处理分页，不会截断内容
5. **完整内容**：包含所有4个阶段的完整分析报告

## 打印优化

为了提供更好的打印体验，我们对打印布局进行了以下优化：

### 1. 缩小元素尺寸
- **报告标题**：从3xl缩小到2xl
- **股票信息横幅**：padding从6缩小到4，图标和文字都相应缩小
- **阶段标题**：从2xl缩小到xl
- **Agent卡片**：padding从6/4缩小到4/3

### 2. 专业封面页设计（全屏渐变背景）
将股票信息和交易建议改为独立的封面页，使用原有的绿蓝渐变风格：

**封面页布局**（三段式，完全居中）：
- **顶部区域**：
  - 英文标题：TRADING ANALYSIS REPORT（12pt）
  - 中文标题：股票分析报告（40pt，细体）
  
- **中间区域**（主要内容，完全居中）：
  - 白色卡片（半透明，95%不透明度）
  - 市场标签（渐变背景，圆角胶囊，11pt）
  - 股票代码（52pt，粗体，居中）
  - 公司名称（14pt，居中）
  - 投资建议（38pt，渐变背景卡片，居中）
  
- **底部区域**：
  - 分析日期（10pt）
  - 生成系统信息（10pt）

**视觉效果**：
- 全屏渐变背景（#10b981 → #3b82f6）
- 白色半透明卡片（阴影效果）
- 渐变标签和按钮
- 高度自适应（calc(100vh - 24mm)），确保在一页内
- 封面后自动分页，无空白页
- 所有内容完全居中对齐

### 3. 舒适的字体系统
使用系统原生字体栈，提供最佳阅读体验：

**字体优先级**：
```
-apple-system, BlinkMacSystemFont, "Segoe UI", 
"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", 
"Helvetica Neue", Helvetica, Arial, sans-serif
```

**字体特点**：
- macOS: 使用 San Francisco 字体
- Windows: 使用 Segoe UI
- 中文: PingFang SC（苹果）/ Microsoft YaHei（微软）
- 字重优化：标题500-600，正文400
- 字间距优化：标题增加letter-spacing

### 4. 专业研报段落样式
采用正式研究报告的排版规范：

**段落样式**：
- 行高：1.8（提高可读性）
- 首行缩进：2em（中文研报标准）
- 两端对齐：`text-align: justify`
- 字体大小：10.5pt（更舒适）
- 字体颜色：#2c3e50（柔和深灰）
- 段落间距：0.75rem
- 标题后第一段不缩进

**列表样式**：
- 行高：1.8
- 列表项间距：0.4rem
- 字体大小：10.5pt
- 字体颜色：#2c3e50
- 列表内段落不缩进

**标题样式**：
- H1: 14pt, 字重600, #1a202c
- H2: 13pt, 字重600, #2d3748
- H3: 11.5pt, 字重500, #2d3748
- H4: 10.5pt, 字重500, #4a5568
- 标题增加letter-spacing提高可读性

**表格样式**（修复显示不全问题）：
- 字体：9pt（更小，容纳更多内容）
- 自动换行：`white-space: normal`
- 自动列宽：`table-layout: auto`
- 边框：1px实线
- 单元格padding：0.3rem
- 移除 `whitespace-nowrap` 限制

**其他元素**：
- 加粗文本：font-weight 700
- 引用块：10.5pt字体，左侧3px边框
- 避免孤行寡行（orphans/widows: 3）

### 4. 减小间距
- 所有 `mb-8` 改为 `mb-4`
- 所有 `mb-6` 改为 `mb-3` 或 `mb-2`
- 所有 `mb-4` 改为 `mb-2`

### 5. 优化分页
- 页边距从15mm减小到12mm，增加可用空间
- 允许长内容自动分页（`page-break-inside: auto`）
- 避免标题后立即分页（`page-break-after: avoid`）
- 设置孤行和寡行控制（`orphans: 3; widows: 3`）

### 6. 内容连续性
- 移除不必要的 `page-break-inside-avoid`，允许长内容跨页
- 保持标题和内容的连贯性
- 减少空白区域

### 7. 隐藏页面元素
打印时自动隐藏以下元素：
- **页面header和footer**：网站的顶部导航栏和底部信息
- **面包屑导航**：breadcrumb导航链接
- **返回顶部按钮**：浮动的back-to-top按钮
- **所有固定定位元素**：`position: fixed` 的元素
- **浮动按钮**：floating buttons、FAB等
- **Sticky元素**：粘性定位的元素
- **页面内的按钮**：除了PDF内容区域内的按钮外的所有按钮

### 8. 图标和表情符号处理
打印时自动隐藏所有图标和表情符号：
- FontAwesome图标（.fa, .fas, .far, .fab）
- 所有 `<i>` 标签
- 自定义图标类（.icon）
- 表情符号（.emoji）
- 封面页的图标保留（如果需要）

**原因**：打印时图标字体可能无法正确渲染，导致显示为方框或乱码

## 注意事项

1. 需要用户手动选择"另存为PDF"，不是直接下载PDF文件
2. 不同浏览器的打印对话框界面略有不同
3. **重要**：确保打印设置中启用了"背景图形"选项，以显示渐变背景
4. 如果内容过长，浏览器会自动分页，可能会在某些位置出现分页符
5. 封面页高度自适应，确保在一页内显示完整

## 修改的文件

- `web/frontend/src/components/analysis/AnalysisResults.tsx`
  - PDF导出功能改用 `window.print()`
  - 更新打印样式CSS
  - 修复图片导出的类型错误
