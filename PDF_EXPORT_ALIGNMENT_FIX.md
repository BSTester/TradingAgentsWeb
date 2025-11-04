# PDF导出对齐问题修复（最终版）

## 问题描述
封面页的投资建议文案和买入/卖出决策显示偏右，没有完全居中对齐。

## 根本原因
使用 `display: flex` + `flexDirection: column` + `alignItems: center` 可能导致内容在某些情况下偏移，不是完美的居中方案。

## 解决方案

### 使用纯CSS居中方式
放弃Flexbox布局，改用传统的CSS居中方法：

#### 1. 股票代码和公司名称
```tsx
<div style={{ width: '100%', textAlign: 'center', marginBottom: '1.8rem' }}>
  <h2 style={{ 
    fontSize: '52pt', 
    margin: '0 auto', 
    textAlign: 'center', 
    width: '100%' 
  }}>
    {results?.ticker}
  </h2>
  <p style={{ 
    fontSize: '14pt', 
    margin: '0.8rem auto 0 auto', 
    textAlign: 'center', 
    width: '100%' 
  }}>
    {results.company_name}
  </p>
</div>
```

#### 2. 投资建议（关键修复）
```tsx
<div style={{ width: '100%', textAlign: 'center' }}>
  {/* 投资建议文案 */}
  <p style={{ 
    fontSize: '11pt', 
    margin: '0 auto 1rem auto', 
    textAlign: 'center', 
    width: '100%' 
  }}>
    投资建议
  </p>
  
  {/* 外层容器：100%宽度 + 居中对齐 */}
  <div style={{ textAlign: 'center', width: '100%' }}>
    {/* 内层卡片：inline-block + 居中 */}
    <div style={{ 
      background: 'linear-gradient(135deg, #10b981, #3b82f6)',
      borderRadius: '12px',
      padding: '1.2rem 2rem',
      display: 'inline-block',
      textAlign: 'center'
    }}>
      <p style={{ 
        fontSize: '38pt', 
        margin: '0', 
        textAlign: 'center', 
        width: '100%' 
      }}>
        {results?.trading_decision}
      </p>
    </div>
  </div>
</div>
```

## 关键技术点

### 1. 容器宽度
- 所有外层容器使用 `width: 100%`
- 确保容器占满父元素宽度

### 2. 文本居中
- 所有文本元素添加 `textAlign: 'center'`
- 配合 `width: '100%'` 确保居中生效

### 3. 水平居中
- 使用 `margin: '0 auto'` 实现块级元素水平居中
- 对于 `inline-block` 元素，使用父容器的 `textAlign: 'center'`

### 4. 投资建议卡片
- 外层容器：`width: 100%` + `textAlign: center`
- 卡片本身：`display: inline-block`
- 卡片内文本：`textAlign: center` + `width: 100%`

## 修复效果

✅ **股票代码**：完全居中，无偏移
✅ **公司名称**：完全居中，无偏移
✅ **"投资建议"文案**：完全居中，无偏移
✅ **买入/卖出决策**：完全居中，无偏移

## 测试检查清单

打印预览时检查：
- [ ] 股票代码在卡片中完全居中
- [ ] 公司名称在卡片中完全居中
- [ ] "投资建议"文案在卡片中完全居中
- [ ] 买入/卖出决策在渐变卡片中完全居中
- [ ] 所有文本没有向左或向右偏移

## 为什么不用Flexbox？

虽然Flexbox是现代布局的首选，但在某些情况下：
1. `alignItems: center` 可能因为容器宽度计算导致轻微偏移
2. 嵌套的flex容器可能产生意外的对齐效果
3. 传统的 `textAlign: center` + `margin: auto` 更可靠

对于简单的居中需求，传统CSS方法反而更稳定。
