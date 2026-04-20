/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Glass Engine */
'use client';

import { useMemo, useRef, useEffect } from 'react';
import { scanEntities, type EntityType } from '@core/EntityScanner';
import { GlassLanguageSelect } from './GlassLanguageSelect';

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

export interface InputTerminalProps {
  isDark?: boolean;
  sourceText?: string;
  onSourceChange?: (value: string) => void;
  /** IPA ID при наведении в StencilMonitor → подсветка соответствующей сущности */
  hoveredIPAId?: number | null;
  /** STENCIL LOCK: блокировка ввода, данные зафиксированы */
  readOnly?: boolean;
  /** Языковая матрица — источник (AUTO + фикс. коды) */
  captureSourceLanguage?: string;
  onCaptureSourceLanguageChange?: (id: string) => void;
}

const ENTITY_BORDER_COLORS: Record<EntityType, string> = {
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

/** Рендерит текст с подсвеченными сущностями. При hoveredEntityIndex — пульсация. */
function HighlightedText({
  text,
  entities,
  hoveredEntityIndex,
}: {
  text: string;
  entities: Array<{ start: number; end: number; type: EntityType }>;
  hoveredEntityIndex?: number | null;
}) {
  if (text.length === 0) return null;

  const parts: Array<{ key: string; content: string; color?: string; entityIndex?: number }> = [];
  let pos = 0;
  let entityIndex = 0;

  for (const e of entities) {
    if (e.start > pos) {
      parts.push({
        key: `plain-${pos}`,
        content: text.slice(pos, e.start),
      });
    }
    parts.push({
      key: `entity-${e.start}`,
      content: text.slice(e.start, e.end),
      color: ENTITY_COLORS[e.type],
      entityIndex,
    });
    entityIndex++;
    pos = e.end;
  }
  if (pos < text.length) {
    parts.push({ key: `plain-${pos}`, content: text.slice(pos) });
  }

  return (
    <>
      {parts.map((p) => {
        if (!p.color) return <span key={p.key}>{p.content}</span>;
        const isHovered = p.entityIndex !== undefined && p.entityIndex === hoveredEntityIndex;
        const borderColor = ENTITY_BORDER_COLORS[entities[p.entityIndex!]?.type] ?? p.color;
        return (
          <span
            key={p.key}
            className={isHovered ? 'cross-highlight-pulse' : ''}
            style={{
              color: p.color,
              backgroundColor: `${p.color}22`,
              ...(isHovered ? { boxShadow: `0 0 12px ${borderColor}`, borderRadius: 2 } : {}),
            }}
          >
            {p.content}
          </span>
        );
      })}
    </>
  );
}

const PANEL_THEME = {
  dark: { bg: '#1A1A1B', border: '#333', header: '#6b7280', contentBg: '#111', text: '#e5e7eb', placeholder: '#4b5563', caret: '#e5e7eb' },
  light: { bg: '#F5F5F5', border: '#d1d5db', header: '#6b7280', contentBg: '#e5e7eb', text: '#1A1A1B', placeholder: '#6b7280', caret: '#1A1A1B' },
};

/** Панель ввода с подсветкой сущностей (деньги, проценты, даты). */
export function InputTerminal({
  isDark = true,
  sourceText = '',
  onSourceChange,
  hoveredIPAId,
  readOnly = false,
  captureSourceLanguage = 'AUTO',
  onCaptureSourceLanguageChange,
}: InputTerminalProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const t = PANEL_THEME[isDark ? 'dark' : 'light'];

  const entities = useMemo(() => scanEntities(sourceText), [sourceText]);
  const hoveredEntityIndex = hoveredIPAId != null ? hoveredIPAId - 1 : null;

  useEffect(() => {
    const ta = textareaRef.current;
    const hl = highlightRef.current;
    if (!ta || !hl) return;
    const sync = () => {
      hl.scrollTop = ta.scrollTop;
      hl.scrollLeft = ta.scrollLeft;
    };
    ta.addEventListener('scroll', sync);
    return () => ta.removeEventListener('scroll', sync);
  }, []);

  return (
    <div
      className="flex flex-col h-full min-h-0 overflow-hidden font-mono"
      style={{ background: t.bg, borderRight: `1px solid ${t.border}` }}
    >
      <div
        className="flex-shrink-0 px-3 py-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-widest"
        style={{ color: t.header, borderBottom: `1px solid ${t.border}` }}
      >
        <span>Терминал Захвата</span>
        {onCaptureSourceLanguageChange ? (
          <GlassLanguageSelect
            isDark={isDark}
            variant="globe"
            label="SRC"
            value={captureSourceLanguage}
            onChange={onCaptureSourceLanguageChange}
            title="Язык источника: AUTO — латиница/кириллица; иначе фиксированная подсказка для авто-цели трафарета"
          />
        ) : null}
      </div>

      <div
        className="flex-shrink-0 px-3 py-1.5 text-[10px] font-mono"
        style={{ color: '#22c55e', borderBottom: `1px solid ${t.border}`, background: isDark ? '#0d1117' : '#d1d5db' }}
      >
        [SYSTEM]: Scanning for sensitive data... OK.
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        <div
          ref={highlightRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden p-2 rounded text-[11px] whitespace-pre-wrap break-words pointer-events-none"
          style={{
            background: t.contentBg,
            border: `1px solid ${t.border}`,
            color: t.text,
            fontFamily: 'inherit',
            lineHeight: 1.5,
          }}
        >
          <HighlightedText text={sourceText || ''} entities={entities} hoveredEntityIndex={hoveredEntityIndex} />
          {!sourceText && <span style={{ color: t.placeholder }}>Source text...</span>}
        </div>
        {readOnly && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.4)' }}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: t.header }}>
              🔒 STENCIL LOCK — DATA FIXED
            </span>
          </div>
        )}
        <textarea
          ref={textareaRef}
          placeholder=""
          value={sourceText}
          onChange={(e) => {
            /* Полное значение поля; обрезки .slice / maxLength здесь нет */
            onSourceChange?.(e.target.value);
          }}
          onPaste={(e) => {
            if (readOnly) return;
            const pasted = e.clipboardData?.getData('text') ?? '';
            if (!pasted) return;
            e.preventDefault();
            const el = e.currentTarget;
            const start = el.selectionStart ?? sourceText.length;
            const end = el.selectionEnd ?? sourceText.length;
            const next = `${sourceText.slice(0, start)}${pasted}${sourceText.slice(end)}`;
            onSourceChange?.(next);
          }}
          readOnly={readOnly}
          disabled={false}
          className="absolute inset-0 w-full h-full p-2 rounded text-[11px] resize-none font-mono outline-none bg-transparent"
          style={{
            color: 'transparent',
            border: '1px solid transparent',
            lineHeight: 1.5,
            WebkitTextFillColor: 'transparent',
            caretColor: t.caret,
          }}
          spellCheck={false}
        />
      </div>
    </div>
  );
}
