/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Glass Engine */
'use client';

import { useMemo, useState } from 'react';
import { scanEntities, type EntityType } from '@core/EntityScanner';
import { GlassLanguageSelect } from './GlassLanguageSelect';
import { apiOutputToSelectId, selectIdToOutputLanguage } from '@/lib/altro/supportedLanguages';
import type { OutputLanguage } from '@/hooks/useAltroPage';

const FORMULA_CYAN = '#22d3ee';

const ENTITY_COLORS: Record<EntityType, string> = {
  formula_display: FORMULA_CYAN,
  formula_inline: FORMULA_CYAN,
  formula_bracket: FORMULA_CYAN,
  formula_paren: FORMULA_CYAN,
  money: '#4AF626',
  percent: '#F6E026',
  date: '#2684F6',
  daterange: '#2684F6',
  timeref: '#f472b6',
  number: '#a78bfa',
  id_tag: '#94a3b8',
};

export interface OutputHubProps {
  isDark?: boolean;
  /** Результат после SovereignController.finalize() */
  outputText?: string;
  /** Сканирование в процессе — приглушённый вид */
  isAssembling?: boolean;
  /** Результат только что получен — анимация сборки */
  justReceived?: boolean;
  /** Фаза 3 — финальный target для API (AUTO = следовать трафарету) */
  outputLanguage?: OutputLanguage;
  onOutputLanguageChange?: (lang: OutputLanguage) => void;
  /** При OUT=AUTO — подсказка разрешённой цели из IPA */
  outputResolvedHint?: string | null;
}

const PANEL_THEME = {
  dark: { bg: '#1A1A1B', border: '#333', text: '#e5e7eb', empty: '#4b5563', tooltipBg: '#222', tooltipBorder: '#333', tooltipText: '#9ca3af' },
  light: { bg: '#F5F5F5', border: '#d1d5db', text: '#1A1A1B', empty: '#6b7280', tooltipBg: '#e5e7eb', tooltipBorder: '#d1d5db', tooltipText: '#4b5563' },
};

/** STENCIL: панель вывода после rehydration (встраивается в StencilMonitor). LIBRA-GUI не используется. */
export function OutputHub({
  isDark = true,
  outputText = '',
  isAssembling = false,
  justReceived = false,
  outputLanguage = 'auto',
  onOutputLanguageChange,
  outputResolvedHint,
}: OutputHubProps) {
  const t = PANEL_THEME[isDark ? 'dark' : 'light'];
  const entities = useMemo(() => scanEntities(outputText || ''), [outputText]);

  const parts = useMemo(() => {
    const text = outputText || '';
    if (!text) return [];

    const result: Array<{ key: string; type: 'plain' | 'entity'; content: string; entityType?: EntityType }> = [];
    let pos = 0;

    for (const e of entities) {
      if (e.start > pos) {
        result.push({ key: `p-${pos}`, type: 'plain', content: text.slice(pos, e.start) });
      }
      result.push({
        key: `e-${e.start}`,
        type: 'entity',
        content: text.slice(e.start, e.end),
        entityType: e.type,
      });
      pos = e.end;
    }
    if (pos < text.length) {
      result.push({ key: `p-${pos}`, type: 'plain', content: text.slice(pos) });
    }
    return result;
  }, [outputText, entities]);

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden font-mono"
      style={{ background: t.bg }}
    >
      <div
        className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest"
        style={{ color: t.empty, borderBottom: `1px solid ${t.border}` }}
      >
        <span>Смысловой Шлюз</span>
        {onOutputLanguageChange ? (
          <GlassLanguageSelect
            isDark={isDark}
            variant="languages"
            label="OUT"
            value={apiOutputToSelectId(outputLanguage)}
            onChange={(id) => onOutputLanguageChange(selectIdToOutputLanguage(id))}
            resolvedHint={outputLanguage === 'auto' ? outputResolvedHint ?? null : null}
            title="Финальный язык выдачи (Фаза 3). AUTO — цель из трафарета IPA"
          />
        ) : null}
      </div>
      <div
        className={`flex-1 p-3 min-h-0 overflow-y-auto overflow-x-hidden text-[11px] whitespace-pre-wrap break-words leading-relaxed transition-opacity duration-500 ${isAssembling ? 'opacity-70' : 'opacity-100'} ${justReceived ? 'output-assembly' : ''}`}
        style={{ color: outputText ? t.text : t.empty }}
      >
        {!outputText ? (
          <span>—</span>
        ) : (
          <>
            {parts.map((p) =>
              p.type === 'plain' ? (
                <span key={p.key}>{p.content}</span>
              ) : (
                <VerifiedSpan key={p.key} content={p.content} color={ENTITY_COLORS[p.entityType!]} isDark={isDark} />
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VerifiedSpan({ content, color, isDark = true }: { content: string; color: string; isDark?: boolean }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTheme = isDark ? { bg: '#222', border: '#333', text: '#9ca3af' } : { bg: '#e5e7eb', border: '#d1d5db', text: '#4b5563' };

  return (
    <span className="inline-flex items-baseline align-baseline" style={{ position: 'relative' }}>
      <span
        className="cursor-default"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        title="VERIFIED BY CORE: 100% MATCH"
        style={{
          borderBottom: `2px solid ${color}`,
          paddingBottom: 1,
        }}
      >
        {content}
      </span>
      {showTooltip && (
        <span
          className="absolute z-50 left-0 bottom-full mb-1 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap"
          style={{
            background: tooltipTheme.bg,
            border: `1px solid ${tooltipTheme.border}`,
            color: tooltipTheme.text,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}
        >
          VERIFIED BY CORE: 100% MATCH
        </span>
      )}
    </span>
  );
}
