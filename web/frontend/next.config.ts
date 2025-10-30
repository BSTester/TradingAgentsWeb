import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // 移除 output: 'export' 以支持动态路由和API功能
  images: {
    unoptimized: true,
  },
  
  // 生产环境通过 Nginx 反代 /api，无需 Next 内部重写
  
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
