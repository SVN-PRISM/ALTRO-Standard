// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import { useState, useRef, useEffect } from 'react';

export type SourceLangOption = 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy';
export type TargetLangOption = 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy';

const SOURCE_OPTIONS: { value: SourceLangOption; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
  { value: 'fr', label: 'FR' },
  { value: 'it', label: 'IT (Italiano)' },
  { value: 'hy', label: 'HY (Հայերեն)' },
];

const TARGET_OPTIONS: { value: TargetLangOption; label: string }[] = [
  { value: 'ru', label: 'RU' },
  { value: 'en', label: 'EN' },
  { value: 'de', label: 'DE' },
  { value: 'fr', label: 'FR' },
  { value: 'it', label: 'IT (Italiano)' },
  { value: 'hy', label: 'HY (Հայերեն)' },
];

export interface LanguageSelectorProps<T extends SourceLangOption | TargetLangOption = SourceLangOption | TargetLangOption> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  isDark: boolean;
  title?: string;
}

export function LanguageSelector<T extends SourceLangOption | TargetLangOption>({ value, onChange, options, isDark, title }: LanguageSelectorProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({ top: rect.bottom + 4, left: rect.left, minWidth: rect.width });
    } else {
      setDropdownStyle({});
    }
  }, [open]);

  const handleOptionSelect = (opt: { value: T; label: string }) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(opt.value);
    setOpen(false);
  };

  const label = options.find((o) => o.value === value)?.label ?? value.toUpperCase();

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={title}
        className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider whitespace-nowrap flex items-center gap-1 transition-colors"
        style={{
          borderColor: isDark ? '#333' : '#aaa',
          background: isDark ? '#111' : '#fff',
          color: isDark ? '#e5e7eb' : '#111',
          fontFamily: value === 'hy' ? "'Noto Sans Armenian', 'DejaVu Sans', sans-serif" : 'inherit',
        }}
      >
        {label}
        <span className="text-[8px] opacity-70">▼</span>
      </button>
      {open && Object.keys(dropdownStyle).length > 0 && (
        <div
          className="fixed py-1 rounded border shadow-lg z-[1000] max-h-[70vh] overflow-y-auto"
          style={{
            ...dropdownStyle,
            background: isDark ? '#111' : '#fff',
            borderColor: isDark ? '#333' : '#ccc',
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={handleOptionSelect(opt)}
              className="w-full text-left text-[9px] px-2 py-1.5 uppercase tracking-wider hover:opacity-90 transition-opacity"
              style={{
                color: value === opt.value ? '#C8A2C8' : isDark ? '#e5e7eb' : '#111',
                background: value === opt.value ? 'rgba(200,162,200,0.15)' : 'transparent',
                fontFamily: opt.value === 'hy' ? "'Noto Sans Armenian', 'DejaVu Sans', sans-serif" : 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { SOURCE_OPTIONS, TARGET_OPTIONS };
