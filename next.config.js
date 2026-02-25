/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 404 SILENCER: dev-tools paths (/_next/*, /__nextjs_*) — Next.js internal, no impact on main code
  devIndicators: {
    buildActivity: true,
    appIsrStatus: false,
  },
};

module.exports = nextConfig;
