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

  // 质量门禁：构建期强制执行 ESLint 与 TypeScript 类型检查。
  // 曾经为加速 Docker 构建而关闭（ignoreDuringBuilds / ignoreBuildErrors），
  // 导致类型/规范错误被静默放行。现已恢复，CI 中以 `next build` 作为门禁。
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
