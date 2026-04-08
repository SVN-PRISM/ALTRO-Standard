/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core | Stencil stub */
'use client';

import type { DomainWeights } from '@/lib/altroData';

/** Stub: Resonance Radar в archive */
export function ResonanceWidget({
  isDark,
  domainWeights,
  oprSlider,
  effectiveOpr,
  isListening = false,
  activeFileName,
  isFileProcessing = false,
  securityBlocked = false,
}: {
  isDark: boolean;
  domainWeights: DomainWeights;
  oprSlider: number;
  effectiveOpr?: number;
  isListening?: boolean;
  activeFileName?: string;
  isFileProcessing?: boolean;
  securityBlocked?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-2 text-[9px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>
      <span className="uppercase tracking-wider">RESONANCE</span>
      <span className="font-mono">—</span>
      {securityBlocked && <span className="text-red-500">SECURITY</span>}
    </div>
  );
}
