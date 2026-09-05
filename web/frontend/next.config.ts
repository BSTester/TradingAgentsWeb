import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Server rendering (default). The `/reports/[id]` dynamic route requires a
  // running Next server (served via `next start` / the non-static Dockerfile),
  // so the static `output: 'export'` mode was removed. The static
  // docker-compose.static.yml variant would need a server-mode build.
  images: {
    unoptimized: true,
  },

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
