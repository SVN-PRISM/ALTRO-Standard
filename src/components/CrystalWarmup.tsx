'use client';

import { useEffect } from 'react';

import { CrystalLoader } from '@/lib/altro/CrystalLoader';

/**
 * Прогрев бинарного ядра на клиенте до вызовов SemanticFirewall / maskSentence.
 */
export function CrystalWarmup(): null {
  useEffect(() => {
    CrystalLoader.getInstance()
      .load('/data/altro_crystal.bin')
      .catch((e) => {
        console.warn('[CrystalWarmup] crystal load failed:', e);
      });
  }, []);
  return null;
}
