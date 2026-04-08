// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import {
  INTERNAL_DOMAIN_LABELS,
  INTERNAL_DOMAIN_KEYS,
  INTERNAL_BAR_COLOR,
  SCENARIO_UI_WEIGHTS,
  type DomainWeights,
} from '@/lib/altroData';
import type { InternalDomainKey, ExternalDomainKey } from '@/lib/altro/foundation';
import type { GuardReport } from '@/lib/altro/AltroGuard';
import { ExternalDomainsBlock } from './MeaningMenu';

export interface ControlPanelProps {
  isDark: boolean;
  domainWeights: DomainWeights;
  oprPrismValue: number;
  setOprPrismValue: (v: number) => void;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  handleInternalDomainChange: (key: InternalDomainKey, value: number) => void;
  handleExternalDomainChange: (key: ExternalDomainKey, value: number) => void;
  isScanning?: boolean;
  lastGuardReport?: GuardReport | null;
}

export function ControlPanel({
  isDark,
  domainWeights,
  oprPrismValue,
  setOprPrismValue,
  activePreset,
  handleInternalDomainChange,
  handleExternalDomainChange,
  isScanning,
  lastGuardReport,
}: ControlPanelProps) {
  return (
    <div className="mt-3 flex-shrink-0 flex flex-row items-stretch flex-nowrap overflow-x-auto" data-panel-container="true" style={{ width: '100%', minWidth: 0, gap: '12px' }}>
      <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '315px', minWidth: '315px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>INTERNAL CORE</p>
        <div className="flex flex-col flex-1 justify-between gap-3 min-h-0" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
          {(INTERNAL_DOMAIN_KEYS ?? []).map((key) => (
            <div key={key} className="flex items-center gap-2 min-w-0 flex-shrink-0">
              <span className={`font-medium uppercase tracking-wider w-24 flex-shrink-0 whitespace-nowrap ${key === 'ethics' ? 'text-[8px]' : 'text-[9px]'}`} style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>{INTERNAL_DOMAIN_LABELS[key]}</span>
              <div className="flex-1 min-w-0 flex items-center gap-1">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={domainWeights?.[key] ?? 0}
                  onChange={(e) => handleInternalDomainChange(key, parseFloat(e.target.value))}
                  className="internal-core-range flex-1 cursor-pointer"
                  disabled={activePreset === 'mirror'}
                  style={{
                    background: `linear-gradient(to right, ${INTERNAL_BAR_COLOR} 0%, ${INTERNAL_BAR_COLOR} ${(domainWeights?.[key] ?? 0) * 100}%, ${isDark ? '#333' : '#e5e7eb'} ${(domainWeights?.[key] ?? 0) * 100}%, ${isDark ? '#333' : '#e5e7eb'} 100%)`,
                  }}
                />
                <span className="text-[9px] font-mono font-bold tabular-nums w-10 flex-shrink-0 text-right px-1 py-0.5 rounded" style={{ background: isDark ? '#333' : '#e5e7eb', color: isDark ? '#e5e7eb' : '#374151' }}>
                  {((domainWeights?.[key] ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '72px', minWidth: '72px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 pt-0 pb-0.5" style={{ color: '#6b7280', lineHeight: 1.2 }}>OPR</p>
        <div className="flex flex-col items-center gap-0 flex-1 min-w-0" style={{ minWidth: '36px', margin: '0 auto' }}>
          <div className="flex flex-col items-center justify-center flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
            <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>
              {oprPrismValue}
            </span>
          </div>
          <div className="flex flex-col items-center gap-0.5 py-0.5 shrink-0 w-full">
            <div className="relative flex flex-col items-center flex-shrink-0" style={{ height: 108 }}>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.max(0, Math.min(100, oprPrismValue))}
                onChange={(e) => setOprPrismValue(parseInt(e.target.value, 10))}
                className="vertical-slider-lilac"
                data-opr-prism
                title="0 — Суперпозиция, 100 — Пик Присутствия"
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)',
                  width: '4px',
                  height: '108px',
                  ['--value' as string]: `${Math.max(0, Math.min(100, oprPrismValue))}%`,
                  accentColor: '#C8A2C8',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
          <div className="flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
            <span className="text-[8px] text-center leading-tight w-full px-0.5 block whitespace-nowrap overflow-hidden truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }} title="0 — Суперпозиция, 100 — Пик Присутствия">0..100</span>
          </div>
        </div>
      </div>

      <ExternalDomainsBlock
        isDark={isDark}
        domainWeights={domainWeights}
        activePreset={activePreset}
        handleExternalDomainChange={handleExternalDomainChange}
      />

      <div id="firewall-monitor-slot" className="flex flex-col flex-shrink-0 rounded overflow-hidden relative" style={{ border: '1px dashed #333', padding: '10px', height: '180px', width: '360px', minWidth: '360px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2 relative z-10" style={{ color: '#6b7280' }}>FIREWALL MONITOR (RESERVED)</p>
        <div className="p-4 flex flex-col h-full border border-neutral-800 relative z-10 min-h-0">
          <h3 className="text-sm font-mono text-neutral-400 flex-shrink-0">
            STATUS: {lastGuardReport ? 'ACTIVE' : 'IDLE'}
          </h3>
          <div className="flex-grow bg-neutral-900 border border-neutral-700 mt-2 p-2 min-h-0 overflow-auto">
            {!lastGuardReport ? (
              <p className="font-mono text-xs text-neutral-600">[Monitoring...]</p>
            ) : lastGuardReport.status === 'CLEAN' ? (
              <p className="font-mono text-xs text-green-500">SYSTEM_SECURE</p>
            ) : lastGuardReport.status === 'HEALED' ? (
              <div className="font-mono text-xs text-orange-500 space-y-1">
                <p>INTEGRITY_RESTORED</p>
                <p className="text-neutral-500">
                  Score: {Math.round(lastGuardReport.initialScore * 100)} → {Math.round(lastGuardReport.finalScore * 100)}
                </p>
                {lastGuardReport.lostMeanings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-neutral-800">
                    <p className="text-[10px] text-neutral-500 mb-1 uppercase tracking-tighter">Impacted Anchors:</p>
                    <div className="flex flex-wrap gap-1">
                      {lastGuardReport.lostMeanings.map((anchor) => (
                        <span key={anchor} className="px-1 py-0.5 bg-red-950/30 border border-red-900/50 text-red-400 text-[9px] rounded-sm">
                          {anchor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="font-mono text-xs text-red-500 animate-pulse">SEMANTIC_BREACH</p>
                {lastGuardReport.lostMeanings.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-neutral-800">
                    <p className="text-[10px] text-neutral-500 mb-1 uppercase tracking-tighter">Impacted Anchors:</p>
                    <div className="flex flex-wrap gap-1">
                      {lastGuardReport.lostMeanings.map((anchor) => (
                        <span key={anchor} className="px-1 py-0.5 bg-red-950/30 border border-red-900/50 text-red-400 text-[9px] rounded-sm">
                          {anchor}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <div className={`absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none transition-opacity duration-300 ${isScanning ? 'opacity-30' : 'opacity-0'}`}>
          <div className="w-full h-full border-2 border-blue-500 rounded-lg animate-pulse" style={{ borderColor: isDark ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.3)' }} />
        </div>
        <div className={`absolute left-0 right-0 top-0 h-full overflow-hidden pointer-events-none transition-opacity duration-300 ${isScanning ? 'opacity-20' : 'opacity-0'}`}>
          <div className="w-full h-[2px] bg-blue-500 shadow-[0_0_8px_2px_rgba(59,130,246,0.8)]" style={{ animation: 'firewallScan 3s linear infinite' }} />
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes firewallScan {
            0% { transform: translateY(-10px); }
            100% { transform: translateY(190px); }
          }
        `}} />
      </div>
    </div>
  );
}
