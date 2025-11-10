import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 启用静态导出 - 构建为纯静态HTML/CSS/JS文件
  output: 'export',
  
  // 静态导出时图片优化必须禁用
  images: {
    unoptimized: true,
  },
  
  // 静态导出时禁用trailing slash（可选，根据需求调整）
  trailingSlash: true,
  
  // 生产构建时自动移除 console 语句
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Docker 构建时跳过 lint 和类型检查以加快构建速度
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
