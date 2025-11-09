# 暗黑金融科技主题 - 快速启动指南

## 🚀 立即查看效果

### 1. 安装依赖
```bash
cd web/frontend
npm install
```

### 2. 启动开发服务器
```bash
npm run dev
```

### 3. 访问应用
打开浏览器访问: `http://localhost:3000`

## 🎨 主要变化

### 首页布局
首页现在分为三个主要部分：

1. **Hero Section (首屏)**
   - 全屏高度展示
   - 动画渐变背景
   - 框架介绍和核心特性
   - 醒目的 CTA 按钮

2. **Features Showcase (第二屏)**
   - 详细功能介绍
   - 3列网格布局
   - 工作流程可视化

3. **Stock Listings (第三屏)**
   - 市场标签切换
   - 分析卡片网格
   - 保持原有功能

### 视觉风格
- 🌑 深色背景 (#0a0e1a)
- 💎 青色/蓝色强调色 (#00d4ff, #0066ff)
- ✨ 发光和动画效果
- 🔮 玻璃态设计元素

## 📱 响应式设计

### 移动端 (< 768px)
- 单列布局
- 简化导航
- 优化触摸目标

### 平板 (768px - 1023px)
- 2列网格
- 适中的间距
- 平衡的布局

### 桌面 (≥ 1024px)
- 3列网格
- 完整功能
- 最佳视觉效果

## 🎯 核心组件

### 新组件
- `components/home/HeroSection.tsx` - 首屏英雄区
- `components/home/FeaturesShowcase.tsx` - 功能展示区

### 更新组件
- `components/leaderboard/Header.tsx` - 固定顶部导航
- `components/leaderboard/AnalysisCard.tsx` - 暗黑卡片
- `components/leaderboard/MarketTabs.tsx` - 暗黑标签
- `components/leaderboard/Footer.tsx` - 暗黑页脚
- `components/common/AppNavbar.tsx` - 应用导航栏
- `components/ui/Toast.tsx` - 通知组件
- `components/ui/PageLoading.tsx` - 加载组件

## 🎨 使用主题色

### Tailwind 类名

#### 背景色
```jsx
className="bg-dark-primary"      // 主背景 #0a0e1a
className="bg-dark-secondary"    // 卡片背景 #141824
className="bg-dark-tertiary"     // 输入背景 #1a1f2e
```

#### 强调色
```jsx
className="text-accent-primary"  // 青色 #00d4ff
className="text-accent-secondary" // 蓝色 #0066ff
```

#### 文本色
```jsx
className="text-text-primary"    // 白色 #ffffff
className="text-text-secondary"  // 灰色 #a0aec0
className="text-text-tertiary"   // 深灰 #718096
```

#### 边框
```jsx
className="border-dark-border"   // 默认边框 #2d3748
className="border-accent-primary" // 青色边框
```

#### 特效
```jsx
className="shadow-glow-cyan"     // 青色发光
className="animate-glow-pulse"   // 脉冲动画
className="animate-float"        // 浮动动画
className="backdrop-blur-lg"     // 玻璃态效果
```

## 🔧 自定义组件示例

### 暗黑主题按钮
```jsx
<button className="px-6 py-3 bg-gradient-to-r from-accent-primary to-accent-secondary text-white rounded-lg hover:shadow-glow-cyan hover:scale-105 transition-all">
  点击我
</button>
```

### 暗黑主题卡片
```jsx
<div className="bg-dark-secondary border border-dark-border rounded-xl p-6 hover:border-accent-primary hover:shadow-glow-cyan transition-all">
  <h3 className="text-text-primary text-xl font-bold mb-2">标题</h3>
  <p className="text-text-secondary">内容</p>
</div>
```

### 暗黑主题输入框
```jsx
<input 
  type="text"
  className="w-full px-4 py-3 bg-dark-tertiary border border-dark-border text-white rounded-lg focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/20 transition-all"
  placeholder="输入内容..."
/>
```

## 📊 性能提示

### 优化建议
1. 使用 `transform` 和 `opacity` 进行动画（GPU 加速）
2. 避免在动画中使用 `width`、`height`、`top`、`left`
3. 为大列表使用虚拟滚动
4. 懒加载图片和重组件

### 动画性能
```jsx
// ✅ 好的做法
className="transition-transform hover:scale-105"

// ❌ 避免
className="transition-all hover:w-full"
```

## ♿ 可访问性

### 键盘导航
- 所有交互元素可通过 Tab 键访问
- 焦点指示器清晰可见（青色边框）

### 屏幕阅读器
- 保留所有 ARIA 标签
- 语义化 HTML 结构

### 对比度
- 所有文本符合 WCAG AA 标准
- 主文本对比度 > 4.5:1

### 减少动画
```jsx
// 系统设置中启用"减少动画"的用户将看到最小动画
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
  }
}
```

## 🐛 常见问题

### Q: 为什么某些颜色没有生效？
A: 确保运行了 `npm run dev` 重新编译 Tailwind CSS。

### Q: 动画在某些浏览器不流畅？
A: 检查是否使用了 GPU 加速的属性（transform, opacity）。

### Q: 移动端布局错乱？
A: 检查响应式类名是否正确（sm:, md:, lg:）。

### Q: 发光效果不显示？
A: 确保元素有足够的空间显示阴影，检查父元素的 overflow 属性。

## 📚 更多资源

- [完整实施文档](./DARK_THEME_IMPLEMENTATION.md)
- [进度追踪](../../.kiro/specs/dark-fintech-theme/PROGRESS.md)
- [设计文档](../../.kiro/specs/dark-fintech-theme/design.md)
- [需求文档](../../.kiro/specs/dark-fintech-theme/requirements.md)

## 🎉 开始探索

现在你已经准备好了！启动开发服务器，打开浏览器，体验全新的暗黑金融科技主题吧！

```bash
npm run dev
```

访问 `http://localhost:3000` 查看效果。

---

**提示**: 首次加载可能需要几秒钟来编译 Tailwind CSS。后续的热重载会非常快速。
