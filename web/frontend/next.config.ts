import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  
  // 生产环境通过 Nginx 反代 /api，无需 Next 内部重写
};

export default nextConfig;
