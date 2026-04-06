/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Glass Engine */
'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { CommandBar } from './CommandBar';
import { GlassLanguageSelect } from './GlassLanguageSelect';
import type { IpaCoreBridge } from '@/hooks/useAltroCore';
import type { OutputLanguage } from '@/hooks/useAltroPage';
import { OutputHub } from './OutputHub';

const FORMULA_CYAN = '#22d3ee';

const TYPE_BORDER_COLORS: Record<string, string> = {
  formula: FORMULA_CYAN,
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
};

/** Доля высоты верхнего блока (Монитор трафарета); остальное — Смысловой Шлюз. */
const SPLIT_MIN = 0.22;
const SPLIT_MAX = 0.78;
const SPLIT_DEFAULT = 0.58;

/** Matches `{{IPA_N}}` or Double OPR `{{IPA_N: preview}}`. */
const IPA_REGEX = /\{\{\s*IPA_(\d+)(?:\s*:\s*[^}]*)?\s*\}\}/g;

export interface StencilMonitorProps {
  isDark?: boolean;
  /** Трафарет: текст с метками {{IPA_N}} */
  maskedText?: string;
  /** Маппинг IPA_N → тип для цвета рамки */
  ipaToEntity?: Array<{ ipaId: number; type: string }>;
  /** При наведении на блок — вызывается с IPA id */
  onHoverIPA?: (ipaId: number | null) => void;
  /** Сырой текст терминала для IPA Capture */
  sourceTextForCapture?: string;
  /** Синхронизация Command Bar → родитель (transcreate userIntent) */
  onSyncCommandIntent?: (intent: string) => void;
  /** Ядро ALTRO 1 (один экземпляр с page) */
  ipa: IpaCoreBridge;
  /** Разрешённая цель трафарета при режиме AUTO (подсказка в селекторе) */
  stencilResolvedTarget?: string;
  /** Нижняя зона: поток STENCIL после rehydration (бывш. отдельная панель «Смысловой Шлюз»). */
  stencilOutputText?: string;
  stencilOutputAssembling?: boolean;
  stencilOutputJustReceived?: boolean;
  outputLanguage?: OutputLanguage;
  onOutputLanguageChange?: (lang: OutputLanguage) => void;
  outputResolvedHint?: string | null;
}

/** Блок [ID: N] с цветной рамкой по типу */
function StencilBlock({
  ipaId,
  type,
  isDark,
  onMouseEnter,
  onMouseLeave,
}: {
  ipaId: number;
  type: string;
  isDark: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const borderColor =
    type.startsWith('formula') ? FORMULA_CYAN : (TYPE_BORDER_COLORS[type] ?? '#6b7280');
  const blockBg = isDark ? '#111' : '#d1d5db';

  return (
    <span
      className="inline-flex items-center align-baseline mx-0.5"
      onMouseEnter={() => {
        onMouseEnter();
        setShowTooltip(true);
      }}
      onMouseLeave={() => {
        onMouseLeave();
        setShowTooltip(false);
      }}
      style={{ position: 'relative' }}
    >
      <span
        className="inline-block px-1.5 py-0.5 rounded cursor-default text-[10px] font-mono"
        style={{
          border: `1px solid ${borderColor}`,
          color: borderColor,
          background: blockBg,
        }}
      >
        [ID: {ipaId}]
      </span>
      {showTooltip && (
        <span
          className="absolute z-50 left-1/2 -translate-x-1/2 -top-7 px-2 py-1 rounded text-[9px] font-mono whitespace-nowrap"
          style={{
            background: '#222',
            border: '1px solid #333',
            color: '#9ca3af',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}
        >
          SECURED IN VAULT
        </span>
      )}
    </span>
  );
}

const PANEL_THEME = {
  dark: { bg: '#1A1A1B', border: '#333', contentBg: '#111', text: '#e5e7eb', waiting: '#4b5563' },
  light: { bg: '#F5F5F5', border: '#d1d5db', contentBg: '#e5e7eb', text: '#1A1A1B', waiting: '#6b7280' },
};

/**
 * Вертикальный сплит без вложенного react-resizable-panels.
 *
 * Диагностика (QA): вложенный vertical Group внутри horizontal Panel давал groupSize Q() =
 * сумма offsetHeight панелей; при «схлопнутой» цепочке flex/min-h-0 Q мог быть 0 → в библиотеке
 * delta = (clientY - y0) / Q становится недопустимой, hover/cursor есть, drag не двигает макет.
 * Нативный split: доля высоты через flex-grow + координаты из getBoundingClientRect().
 */
function StencilVerticalSplit({
  topShare,
  onTopShareChange,
  isDark,
  handleBorder,
  top,
  bottom,
}: {
  topShare: number;
  onTopShareChange: (v: number) => void;
  isDark: boolean;
  handleBorder: string;
  top: ReactNode;
  bottom: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const bottomShare = 1 - topShare;

  const applyFromClientY = useCallback((clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const h = rect.height;
    if (h < 24) return;
    const r = (clientY - rect.top) / h;
    onTopShareChange(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, r)));
  }, [onTopShareChange]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      applyFromClientY(e.clientY);
    },
    [applyFromClientY]
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    e.stopPropagation();
  }, []);

  const gripBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{ flex: '1 1 0%', minHeight: 0 }}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{
          flex: `${topShare} 1 0`,
          minHeight: `${SPLIT_MIN * 100}%`,
        }}
      >
        {top}
      </div>

      <div
        role="separator"
        aria-orientation="horizontal"
        aria-valuemin={22}
        aria-valuemax={78}
        aria-valuenow={Math.round(topShare * 100)}
        tabIndex={0}
        className="relative z-20 h-2.5 w-full shrink-0 cursor-row-resize select-none"
        style={{
          touchAction: 'none',
          background: gripBg,
          borderTop: `1px solid ${handleBorder}`,
          borderBottom: `1px solid ${handleBorder}`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />

      <div
        className="flex min-h-0 min-w-0 flex-col overflow-hidden"
        style={{
          flex: `${bottomShare} 1 0`,
          minHeight: `${SPLIT_MIN * 100}%`,
        }}
      >
        {bottom}
      </div>
    </div>
  );
}

/** Центральная панель: трафарет с блоками [ID: N]. */
export function StencilMonitor({
  isDark = true,
  maskedText = '',
  ipaToEntity = [],
  onHoverIPA,
  sourceTextForCapture = '',
  onSyncCommandIntent,
  ipa,
  stencilResolvedTarget,
  stencilOutputText = '',
  stencilOutputAssembling = false,
  stencilOutputJustReceived = false,
  outputLanguage = 'auto',
  onOutputLanguageChange,
  outputResolvedHint,
}: StencilMonitorProps) {
  const t = PANEL_THEME[isDark ? 'dark' : 'light'];
  const [topShare, setTopShare] = useState(SPLIT_DEFAULT);

  const ipaTypeMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const { ipaId, type } of ipaToEntity) {
      m.set(ipaId, type);
    }
    return m;
  }, [ipaToEntity]);

  const parts = useMemo(() => {
    if (!maskedText.trim()) return null;

    const result: Array<{ key: string; type: 'text' | 'ipa'; content?: string; ipaId?: number }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    IPA_REGEX.lastIndex = 0;
    while ((match = IPA_REGEX.exec(maskedText)) !== null) {
      if (match.index > lastIndex) {
        result.push({
          key: `t-${lastIndex}`,
          type: 'text',
          content: maskedText.slice(lastIndex, match.index),
        });
      }
      const ipaId = parseInt(match[1], 10);
      result.push({ key: `ipa-${ipaId}`, type: 'ipa', ipaId });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < maskedText.length) {
      result.push({ key: `t-${lastIndex}`, type: 'text', content: maskedText.slice(lastIndex) });
    }

    return result;
  }, [maskedText]);

  const isEmpty = !maskedText?.trim();

  const monitorBody = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div
        className="flex flex-shrink-0 items-center justify-between gap-2 px-3 py-2 text-[10px] uppercase tracking-widest"
        style={{ color: t.waiting, borderBottom: `1px solid ${t.border}` }}
      >
        <span>Монитор Трафарета</span>
        <GlassLanguageSelect
          isDark={isDark}
          variant="languages"
          label="STENCIL"
          value={ipa.stencilLanguageMode}
          onChange={ipa.setStencilLanguageMode}
          resolvedHint={ipa.stencilLanguageMode === 'AUTO' ? stencilResolvedTarget ?? null : null}
          title="Язык трафарета (targetLanguage): AUTO — resolveTargetLanguage + источник; иначе фиксированный код"
        />
      </div>

      <CommandBar
        isDark={isDark}
        ipa={ipa}
        sourceTextCapture={sourceTextForCapture}
        onSyncCommandIntent={onSyncCommandIntent}
      />

      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 text-[11px] leading-relaxed"
        style={{ color: t.text, background: t.contentBg }}
      >
        {isEmpty ? (
          <span style={{ color: t.waiting, fontStyle: 'italic' }}>
            [WAITING FOR DATA STRUCTURE...]
          </span>
        ) : parts ? (
          <>
            {parts.map((p) =>
              p.type === 'text' ? (
                <span key={p.key}>{p.content}</span>
              ) : (
                <StencilBlock
                  key={p.key}
                  ipaId={p.ipaId!}
                  type={ipaTypeMap.get(p.ipaId!) ?? 'unknown'}
                  isDark={isDark}
                  onMouseEnter={() => onHoverIPA?.(p.ipaId!)}
                  onMouseLeave={() => onHoverIPA?.(null)}
                />
              )
            )}
          </>
        ) : null}
      </div>
    </div>
  );

  const outputPane = (
    <OutputHub
      isDark={isDark}
      outputText={stencilOutputText}
      isAssembling={stencilOutputAssembling}
      justReceived={stencilOutputJustReceived}
      outputLanguage={outputLanguage}
      onOutputLanguageChange={onOutputLanguageChange}
      outputResolvedHint={outputResolvedHint}
    />
  );

  return (
    <div
      className="flex h-full min-h-0 w-full flex-col overflow-hidden font-mono"
      style={{ background: t.bg, borderRight: `1px solid ${t.border}` }}
    >
      <StencilVerticalSplit
        topShare={topShare}
        onTopShareChange={setTopShare}
        isDark={isDark}
        handleBorder={t.border}
        top={monitorBody}
        bottom={outputPane}
      />
    </div>
  );
}
