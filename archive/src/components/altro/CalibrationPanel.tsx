// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import { DomainSlider } from '@/components/DomainSlider';
import {
  INTERNAL_DOMAIN_LABELS,
  INTERNAL_DOMAIN_KEYS,
  INTERNAL_BAR_COLOR,
  SCENARIO_UI_WEIGHTS,
  type DomainWeights,
} from '@/lib/altroData';
import type { InternalDomainKey, ExternalDomainKey } from '@/lib/altro/foundation';
import { ExternalDomainsBlock } from './MeaningMenu';

export interface CalibrationPanelProps {
  isDark: boolean;
  domainWeights: DomainWeights;
  oprPrismValue: number;
  setOprPrismValue: (v: number) => void;
  selectedScenario: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
  setSelectedScenario: (v: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard') => void;
  setDomainWeights: (w: DomainWeights | ((prev: DomainWeights) => DomainWeights)) => void;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  handleInternalDomainChange: (key: InternalDomainKey, value: number) => void;
  handleExternalDomainChange: (key: ExternalDomainKey, value: number) => void;
  toolsModalMode: 'snapshot' | 'archive' | 'export' | null;
  setToolsModalMode: (v: 'snapshot' | 'archive' | 'export' | null) => void;
}

export function CalibrationPanel({
  isDark,
  domainWeights,
  oprPrismValue,
  setOprPrismValue,
  selectedScenario,
  setSelectedScenario,
  setDomainWeights,
  activePreset,
  handleInternalDomainChange,
  handleExternalDomainChange,
  toolsModalMode,
  setToolsModalMode,
}: CalibrationPanelProps) {
  return (
    <div className="mt-3 flex-shrink-0 flex flex-row items-stretch flex-nowrap overflow-x-auto" data-panel-container="true" style={{ width: '100%', minWidth: 0, gap: '12px' }}>
      {/* Блок 1: INTERNAL CORE — 5 горизонтальных слайдеров */}
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

      {/* OPR — 0..100 (слайдер). Внутренний расчёт резонанса может давать [-100, 100] при коллизии О-П. */}
      <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '72px', minWidth: '72px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 pt-0 pb-0.5" style={{ color: '#6b7280', lineHeight: 1.2 }}>OPR</p>
        <div className="flex flex-col items-center gap-0 flex-1 min-w-0" style={{ minWidth: '36px', margin: '0 auto' }}>
          <div className="flex items-center justify-center flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
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

      {/* Блок 3: СЦЕНАРИИ */}
      <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '180px', minWidth: '180px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>СЦЕНАРИИ</p>
        <div className="flex flex-col gap-2 flex-1">
          <select
            className="text-[10px] px-2 py-1.5 rounded border font-medium uppercase tracking-wider transition-colors w-full"
            style={{
              borderColor: isDark ? '#333' : '#ddd',
              background: isDark ? '#111' : '#fff',
              color: isDark ? '#e5e7eb' : '#111',
              opacity: activePreset === 'mirror' ? 0.5 : 1,
              cursor: activePreset === 'mirror' ? 'not-allowed' : 'pointer',
            }}
            value={selectedScenario}
            disabled={activePreset === 'mirror'}
            onChange={(e) => {
              const v = e.target.value as 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
              setSelectedScenario(v);
              if (v !== 'without') {
                const weights = SCENARIO_UI_WEIGHTS[v === 'poetry' ? 'poetics' : v];
                setDomainWeights({ ...weights });
              }
            }}
          >
            <option value="without">Without</option>
            <option value="poetry">Poetry</option>
            <option value="technocrat">Technocrat</option>
            <option value="sacred">Sacred</option>
            <option value="goldStandard">GOLD STANDARD</option>
          </select>
        </div>
      </div>

      {/* Блок 4: ИНСТРУМЕНТЫ */}
      <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '180px', minWidth: '180px' }}>
        <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>ИНСТРУМЕНТЫ</p>
        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
          <button
            type="button"
            onClick={() => setToolsModalMode('snapshot')}
            title="Слепок настроек (13 слайдеров + OPR)"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
            style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
            СЛЕПОК
          </button>
          <button
            type="button"
            onClick={() => setToolsModalMode('archive')}
            title="Архив сохранённых текстов"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
            style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
            АРХИВ
          </button>
          <button
            type="button"
            onClick={() => setToolsModalMode('export')}
            title="Экспорт: буфер, TXT, MD"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
            style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            ЭКСПОРТ
          </button>
        </div>
      </div>
    </div>
  );
}
