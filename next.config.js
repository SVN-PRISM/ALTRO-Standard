/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  // 404 SILENCER: dev-tools paths (/_next/*, /__nextjs_*) — Next.js internal, no impact on main code
  devIndicators: {
    buildActivity: true,
    appIsrStatus: false,
  },
  // HMR: транскреация не пишет файлы — Fast Refresh срабатывает только при сохранении.
  // Сохранение engine.ts/useAltroPage во время активного запроса может оборвать fetch.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = config.watchOptions ?? {};
      config.watchOptions.aggregateTimeout = 400;
    }
    return config;
  },
};

module.exports = nextConfig;
