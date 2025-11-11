'use client';

import React from 'react';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  details: string[];
}

function FeatureCard({ icon, title, description, details }: FeatureCardProps) {
  return (
    <div className="group bg-dark-secondary border border-dark-border rounded-xl p-4 md:p-6 lg:p-8 hover:border-accent-primary hover:shadow-glow-cyan transition-all duration-300 h-full">
      <div className="flex flex-col space-y-4 h-full">
        {/* Icon */}
        <div className="w-16 h-16 bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <i className={`${icon} text-3xl text-accent-primary`} />
        </div>

        {/* Title */}
        <h3 className="text-responsive-h3 text-text-primary">{title}</h3>

        {/* Description */}
        <p className="text-responsive-body text-text-secondary leading-relaxed">{description}</p>

        {/* Details */}
        <ul className="space-y-2 flex-grow">
          {details.map((detail, index) => (
            <li key={index} className="flex items-start space-x-2 text-sm text-text-tertiary">
              <i className="fas fa-check-circle text-accent-primary mt-0.5 flex-shrink-0" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FeaturesShowcase() {
  const features: FeatureCardProps[] = [
    {
      icon: 'fas fa-project-diagram',
      title: '多智能体工作流',
      description: '基于 LangGraph 的智能体协作系统，模拟真实投资团队的工作流程',
      details: [
        '市场分析师：技术面、基本面、新闻面、社交媒体分析',
        '研究团队：多空双方深度研究报告',
        '交易员：综合决策与执行建议',
        '风险管理：风险评估与投资组合优化',
      ],
    },
    {
      icon: 'fas fa-globe',
      title: '全球市场覆盖',
      description: '支持美股、港股、A股三大市场，自动选择最优数据源',
      details: [
        '美股：yfinance、akshare、alpha_vantage',
        '港股：akshare、yfinance 双重支持',
        'A股：akshare、baostock、tushare',
        '智能数据源切换与容错机制',
      ],
    },
    {
      icon: 'fas fa-bolt',
      title: '实时分析引擎',
      description: 'WebSocket 实时通信，任务队列管理，支持多用户并发',
      details: [
        '实时进度追踪与日志流式传输',
        '用户级任务队列防止资源冲突',
        '支持定时任务与历史分析查询',
        '完整的分析结果导出（PDF/Markdown/图片）',
      ],
    },
  ];

  return (
    <section className="relative py-20 bg-dark-primary">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent-primary/50 to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-responsive-h1 text-text-primary">
            核心功能
          </h2>
          <p className="text-responsive-body text-text-secondary max-w-2xl mx-auto">
            强大的 AI 驱动分析能力，为您的投资决策提供全方位支持
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <FeatureCard {...feature} />
            </div>
          ))}
        </div>

        {/* Workflow Diagram */}
        <div className="mt-20 bg-dark-secondary border border-dark-border rounded-xl p-4 md:p-6 lg:p-8">
          <h3 className="text-responsive-h3 text-text-primary mb-8 text-center">
            智能体协作流程
          </h3>
          <div className="flex flex-col md:flex-row items-center justify-between space-y-4 md:space-y-0 md:space-x-4">
            {[
              { icon: 'fa-search-dollar', label: '分析师团队', color: 'from-blue-500 to-cyan-500' },
              { icon: 'fa-book-reader', label: '研究团队', color: 'from-cyan-500 to-teal-500' },
              { icon: 'fa-hand-holding-usd', label: '交易员', color: 'from-teal-500 to-green-500' },
              { icon: 'fa-shield-alt', label: '风险管理', color: 'from-green-500 to-emerald-500' },
              { icon: 'fa-chart-pie', label: '投资组合', color: 'from-emerald-500 to-accent-primary' },
            ].map((step, index) => (
              <React.Fragment key={index}>
                <div className="flex flex-col items-center space-y-2 group">
                  <div className={`w-20 h-20 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <i className={`fas ${step.icon} text-2xl text-white`} />
                  </div>
                  <span className="text-sm font-medium text-text-secondary text-center">
                    {step.label}
                  </span>
                </div>
                {index < 4 && (
                  <>
                    <i className="fas fa-arrow-down text-2xl text-accent-primary md:!hidden" />
                    <i className="fas fa-arrow-right text-2xl text-accent-primary !hidden md:!block" />
                  </>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
