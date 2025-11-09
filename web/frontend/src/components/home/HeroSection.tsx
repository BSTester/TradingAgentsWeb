'use client';

import React from 'react';

interface HeroSectionProps {
  onNewAnalysis: () => void;
}

export function HeroSection({ onNewAnalysis }: HeroSectionProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-hero">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent-primary/5 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-secondary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center space-y-8 animate-fade-in">
          {/* Logo/Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-accent-primary/20 rounded-full blur-xl animate-glow-pulse" />
              <div className="relative bg-gradient-to-br from-dark-secondary to-dark-tertiary p-6 rounded-2xl border border-dark-border shadow-glow-cyan">
                <i className="fas fa-robot text-5xl text-accent-primary" />
              </div>
            </div>
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-accent-primary via-accent-secondary to-accent-primary bg-clip-text text-transparent animate-shimmer bg-[length:200%_100%]">
              TradingAgentsWeb
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl md:text-2xl lg:text-3xl font-light text-text-secondary max-w-3xl mx-auto">
            多智能体大语言模型金融交易框架
          </p>

          {/* Description */}
          <p className="text-base md:text-lg text-text-tertiary max-w-2xl mx-auto leading-relaxed">
            基于 LangGraph 的多智能体协作系统，整合分析师团队、研究团队、交易员和风险管理团队，
            为您提供全方位的智能投资决策支持
          </p>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
            {/* Feature 1 */}
            <div className="group bg-dark-secondary/50 backdrop-blur-sm border border-dark-border rounded-xl p-6 hover:border-accent-primary hover:shadow-glow-cyan transition-all duration-300">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-users-cog text-2xl text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">多智能体协作</h3>
                <p className="text-sm text-text-tertiary">
                  分析师、研究员、交易员、风险管理团队协同工作
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group bg-dark-secondary/50 backdrop-blur-sm border border-dark-border rounded-xl p-6 hover:border-accent-primary hover:shadow-glow-cyan transition-all duration-300">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-globe-americas text-2xl text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">多市场支持</h3>
                <p className="text-sm text-text-tertiary">
                  支持美股、港股、A股三大市场的全面分析
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group bg-dark-secondary/50 backdrop-blur-sm border border-dark-border rounded-xl p-6 hover:border-accent-primary hover:shadow-glow-cyan transition-all duration-300">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-accent-primary/20 to-accent-secondary/20 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <i className="fas fa-chart-line text-2xl text-accent-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary">实时分析追踪</h3>
                <p className="text-sm text-text-tertiary">
                  WebSocket 实时追踪分析进度和结果
                </p>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mt-12">
            <button
              onClick={onNewAnalysis}
              className="group relative px-8 py-4 bg-gradient-to-r from-accent-primary to-accent-secondary text-white text-lg font-semibold rounded-lg overflow-hidden transition-all duration-300 hover:shadow-glow-cyan hover:scale-105 active:scale-95"
            >
              {/* Button shimmer effect */}
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer" />
              
              {/* Button content */}
              <span className="relative flex items-center justify-center space-x-2">
                <i className="fas fa-plus-circle transition-transform duration-300 group-hover:rotate-90" />
                <span>开始新分析</span>
                <i className="fas fa-arrow-right transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </button>
          </div>

          {/* Scroll indicator */}
          <div className="mt-16 animate-bounce">
            <i className="fas fa-chevron-down text-2xl text-text-tertiary" />
          </div>
        </div>
      </div>
    </section>
  );
}
