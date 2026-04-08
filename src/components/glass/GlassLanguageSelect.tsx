/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Glass Engine — Language Matrix */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Globe, Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/lib/altro/supportedLanguages';

const GLASS_BTN =
  'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-tight transition-colors';

export interface GlassLanguageSelectProps {
  isDark?: boolean;
  /** Текущий id: AUTO | RU | EN | … */
  value: string;
  onChange: (id: string) => void;
  /** Короткая подпись слева от кнопки */
  label?: string;
  /** Globe — источник; Languages — трафарет / выход */
  variant?: 'globe' | 'languages';
  /** Подсказка при AUTO: разрешённый код (например RU) */
  resolvedHint?: string | null;
  title?: string;
}

export function GlassLanguageSelect({
  isDark = true,
  value,
  onChange,
  label,
  variant = 'globe',
  resolvedHint,
  title,
}: GlassLanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const upper = value.trim().toUpperCase();
  const current = SUPPORTED_LANGUAGES.find((o) => o.id === upper) ?? SUPPORTED_LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const Icon = variant === 'languages' ? Languages : Globe;

  const border = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const bg = isDark ? 'rgba(17,17,17,0.65)' : 'rgba(255,255,255,0.55)';
  const text = isDark ? '#e5e7eb' : '#1A1A1B';
  const muted = isDark ? '#6b7280' : '#6b7280';
  const accent = '#22c55e';

  const handlePick = useCallback(
    (id: string) => {
      onChange(id);
      setOpen(false);
    },
    [onChange]
  );

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5 shrink-0">
      {label ? (
        <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: muted }}>
          {label}
        </span>
      ) : null}
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={GLASS_BTN}
        style={{
          color: upper === 'AUTO' && resolvedHint ? accent : text,
          borderColor: border,
          background: bg,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <Icon className="w-3 h-3 shrink-0 opacity-80" strokeWidth={1.75} />
        <span>
          {current.id}
          {upper === 'AUTO' && resolvedHint ? `→${resolvedHint}` : ''}
        </span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-[100] mt-1 min-w-[9rem] max-h-48 overflow-y-auto rounded border py-1 shadow-lg"
          style={{
            borderColor: border,
            background: isDark ? 'rgba(26,26,27,0.92)' : 'rgba(245,245,245,0.95)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {SUPPORTED_LANGUAGES.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handlePick(opt.id)}
              className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[9px] font-mono uppercase tracking-tight hover:bg-white/10"
              style={{ color: opt.id === upper ? accent : text }}
            >
              <span>{opt.label}</span>
              <span className="normal-case opacity-60" style={{ color: muted }}>
                {opt.hint}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
