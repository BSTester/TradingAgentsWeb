# 排行榜决策报告Markdown渲染

## 改进内容

将决策报告从纯文本显示改为Markdown格式渲染，与智能盯盘页面保持一致。

## 技术实现

### 依赖库

```json
{
  "react-markdown": "^10.1.0",
  "rehype-raw": "^7.0.0",
  "rehype-sanitize": "^6.0.0"
}
```

### 导入

```typescript
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
```

### 配置

使用与智能盯盘页面相同的配置，确保样式一致：

```tsx
<ReactMarkdown
  rehypePlugins={[rehypeRaw, rehypeSanitize]}
  components={{
    // 标题样式
    h1: ({node, ...props}) => (
      <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-4 mt-6 pb-2 border-b-2 border-accent-primary/30" {...props} />
    ),
    h2: ({node, ...props}) => (
      <h2 className="text-xl md:text-2xl font-bold text-text-primary mb-3 mt-6 pb-2 border-b border-accent-primary/20" {...props} />
    ),
    // ... 其他元素配置
  }}
>
  {selectedDecision.decision_report}
</ReactMarkdown>
```

## 支持的Markdown元素

### 1. 标题 (H1-H6)
- H1: 大标题，带下划线
- H2: 次级标题，带下划线
- H3-H6: 各级标题，逐级缩小

### 2. 文本格式
- **粗体**: `**text**` 或 `__text__`
- *斜体*: `*text*` 或 `_text_`
- `行内代码`: `` `code` ``

### 3. 列表
- 无序列表: `- item` 或 `* item`
- 有序列表: `1. item`
- 嵌套列表支持

### 4. 代码块
```python
# 支持语法高亮
def example():
    return "Hello"
```

### 5. 引用
> 引用文本使用 `>` 符号
> 支持多行引用

### 6. 表格
| 列1 | 列2 | 列3 |
|-----|-----|-----|
| 数据1 | 数据2 | 数据3 |

### 7. 链接和图片
- 链接: `[文本](URL)`
- 图片: `![alt](URL)`

### 8. 分隔线
使用 `---` 或 `***`

---

## 样式特点

### 深色主题适配
- 所有元素使用深色主题配色
- 文本颜色: `text-text-primary`, `text-text-secondary`
- 背景颜色: `bg-dark-primary`, `bg-dark-tertiary`
- 边框颜色: `border-dark-border`

### 响应式设计
- 使用 `md:` 前缀适配不同屏幕尺寸
- 移动端: 较小字体和间距
- 桌面端: 正常字体和间距

### 代码样式
- 行内代码: 高亮背景，accent颜色
- 代码块: 深色背景，等宽字体，横向滚动

### 表格样式
- 响应式容器，横向滚动
- 悬停高亮行
- 清晰的边框和分隔线

## 安全性

### rehype-sanitize
自动清理危险的HTML内容：
- 移除 `<script>` 标签
- 移除事件处理器 (onclick等)
- 移除危险的属性
- 保留安全的HTML元素

### rehype-raw
允许在Markdown中使用HTML标签，但会被sanitize过滤：
- 支持 `<br>`, `<hr>` 等安全标签
- 支持表格的HTML语法
- 不支持危险的标签和属性

## 使用示例

### 后端返回的Markdown格式

```markdown
# 决策分析报告

## 市场概况
当前市场处于**震荡上行**阶段。

## 持仓分析
- AAPL: 表现良好，建议持有
- TSLA: 波动较大，建议减仓

## 交易建议
1. 买入 MSFT 100股
2. 卖出 TSLA 50股

### 风险提示
> 市场存在不确定性，请谨慎操作

## 技术指标
| 指标 | 数值 | 状态 |
|------|------|------|
| RSI | 65 | 正常 |
| MACD | 正 | 看涨 |

```python
# 示例代码
def calculate_profit():
    return (sell_price - buy_price) * quantity
```
```

### 前端渲染效果

上述Markdown会被渲染为：
- 清晰的标题层级
- 格式化的列表
- 高亮的代码块
- 美观的表格
- 带样式的引用块

## 对比

### 修改前
```tsx
<pre className="text-sm text-text-primary whitespace-pre-wrap font-mono">
  {selectedDecision.decision_report}
</pre>
```

**问题：**
- 纯文本显示，无格式
- 无法识别Markdown语法
- 阅读体验差
- 与智能盯盘页面不一致

### 修改后
```tsx
<div className="prose prose-invert prose-sm md:prose-base max-w-none">
  <ReactMarkdown
    rehypePlugins={[rehypeRaw, rehypeSanitize]}
    components={{ /* 自定义样式 */ }}
  >
    {selectedDecision.decision_report}
  </ReactMarkdown>
</div>
```

**优点：**
- 完整的Markdown支持
- 美观的格式化显示
- 与智能盯盘页面一致
- 更好的阅读体验

## 相关文件

- `web/frontend/src/components/leaderboard/UserDetailPanel.tsx` - 排行榜用户详情面板
- `web/frontend/src/components/intraday/DecisionHistory.tsx` - 智能盯盘决策历史（参考实现）
- `web/frontend/src/components/analysis/AnalysisResults.tsx` - 分析结果页面（参考实现）

## 注意事项

1. **性能考虑**
   - Markdown渲染比纯文本慢
   - 对于长文档，可能需要虚拟滚动
   - 建议限制报告长度或分页显示

2. **内容安全**
   - 始终使用 `rehype-sanitize` 插件
   - 不要禁用安全过滤
   - 验证后端返回的内容

3. **样式一致性**
   - 保持与其他页面的样式一致
   - 使用相同的颜色变量
   - 遵循响应式设计原则

4. **可访问性**
   - 确保足够的颜色对比度
   - 支持键盘导航
   - 提供适当的语义化标签

## 测试建议

1. **功能测试**
   - 测试各种Markdown元素
   - 测试长文档滚动
   - 测试响应式布局

2. **安全测试**
   - 尝试注入 `<script>` 标签
   - 尝试注入事件处理器
   - 验证sanitize是否生效

3. **性能测试**
   - 测试大文档渲染速度
   - 测试多个决策同时打开
   - 监控内存使用

4. **兼容性测试**
   - 测试不同浏览器
   - 测试不同屏幕尺寸
   - 测试移动设备

## 未来改进

1. **语法高亮**
   - 添加 `rehype-highlight` 支持代码高亮
   - 支持更多编程语言

2. **数学公式**
   - 添加 `remark-math` 和 `rehype-katex`
   - 支持LaTeX数学公式

3. **图表支持**
   - 支持Mermaid图表
   - 支持流程图和时序图

4. **导出功能**
   - 导出为PDF
   - 导出为HTML
   - 复制为纯文本
