/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ALTRO Core - Transcreation System',
  description: 'ALTRO Core System for transcreation validation',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full overflow-hidden">
      <body className="h-full max-h-screen overflow-hidden">{children}</body>
    </html>
  );
}
