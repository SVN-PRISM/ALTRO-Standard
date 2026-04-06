/* ALTRO Core | MIT License | SERGEI NAZARIAN (SVN) */

import './globals.css';
import type { Metadata } from 'next';

import { CrystalWarmup } from '@/components/CrystalWarmup';

export const maxDuration = 300; // 5 минут

export const metadata: Metadata = {
  title: 'ALTRO Core - Transcreation System',
  description: 'ALTRO Core System for transcreation validation',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="h-full overflow-hidden">
      <body className="h-full max-h-screen overflow-hidden">
        <CrystalWarmup />
        {children}
      </body>
    </html>
  );
}
