// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import { HOMONYM_DB } from '@/lib/altroData';
import type { TextToken } from '@/lib/altro/engine';
import type { ProcessedToken } from '@/hooks/useAltroPage';

export interface OutputMirrorProps {
  isDark: boolean;
  isScanning: boolean;
  adaptationFlash: boolean;
  displayTokens: (TextToken | ProcessedToken)[];
  auditLog: Array<{ word: string; variants?: string[]; priority?: boolean }>;
  selectedScannedTokenId: number | null;
  resolvedVariants: Map<number, string>;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  adaptationDisplayHtml: string;
  /** Показывать кнопку очистки только при наличии контента. */
  hasAdaptationContent?: boolean;
  normalizeForAuditMatch: (w: string) => string;
  handleMirrorTokenClick: (id: number) => void;
  handleScannedTokenClick: (id: number) => void;
  handleVariantSelect: (tokenId: number, variant: string) => void;
  clearAdaptation: () => void;
}

export function OutputMirror({
  isDark,
  isScanning,
  adaptationFlash,
  displayTokens,
  auditLog,
  selectedScannedTokenId,
  resolvedVariants,
  activePreset,
  adaptationDisplayHtml,
  hasAdaptationContent = false,
  normalizeForAuditMatch,
  handleMirrorTokenClick,
  handleScannedTokenClick,
  handleVariantSelect,
  clearAdaptation,
}: OutputMirrorProps) {
  return (
    <div
      className="relative flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{
        pointerEvents: isScanning ? 'none' : 'auto',
        opacity: isScanning ? 0.55 : 1,
        userSelect: isScanning ? 'none' : 'auto',
        transition: 'opacity 0.2s ease',
      }}
    >
      <div
        contentEditable={false}
        role="region"
        aria-label="Адаптация"
        className={`adaptation-text-field w-full p-3 rounded-lg whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto transition-opacity duration-300 ${isScanning ? 'synthesis-scanning' : ''}`}
        style={{
          fontFamily: "'Arial', 'Roboto', system-ui, sans-serif",
          background: isDark ? '#111' : '#fff',
          border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}`,
          color: isDark ? '#fff' : '#000',
          opacity: adaptationFlash ? 0.5 : 1,
        }}
      >
        {activePreset === 'mirror' && Array.isArray(displayTokens) && displayTokens.length > 0 ? (
          displayTokens.map((t) => {
            if (!t.word) return null;
            if (t.type !== 'word') {
              return <span key={t.id} style={{ display: 'inline' }}>{t.word}</span>;
            }
            const norm = normalizeForAuditMatch(t.word);
            const auditEntry = (auditLog ?? []).find((e) => normalizeForAuditMatch(e.word) === norm);
            const hasStressMarker = auditEntry && auditEntry.word.length > 1 && /[А-ЯЁ]/.test(auditEntry.word.slice(1));
            const hasPriority = auditEntry?.priority ?? hasStressMarker ?? false;
            const hasResolvedVariant = resolvedVariants.has(t.id);
            const isScanned = !!auditEntry;
            const isLocked = hasPriority || t.isLocked || hasResolvedVariant;
            const isScannedNotLocked = isScanned && !isLocked;
            const cls = [
              'cursor-pointer',
              isLocked ? 'altro-token-locked' : '',
              isScannedNotLocked ? 'altro-token-scanned' : '',
            ].filter(Boolean).join(' ');
            const onClick = isScannedNotLocked
              ? () => handleScannedTokenClick(t.id)
              : () => handleMirrorTokenClick(t.id);
            const isConfirmed = (t as ProcessedToken).isConfirmed === true;
            const goldenFrameStyle = isConfirmed
              ? { border: '1px solid gold', boxShadow: '0 0 5px gold', borderRadius: 4, padding: '0 2px' }
              : {};
            return (
              <span
                key={t.id}
                role="button"
                tabIndex={0}
                onClick={onClick}
                onKeyDown={(e) => e.key === 'Enter' && onClick()}
                className={cls}
                style={{
                  display: 'inline',
                  ...goldenFrameStyle,
                  ...(isScanning && { pointerEvents: 'none', userSelect: 'none' }),
                }}
              >
                {t.word}
              </span>
            );
          })
        ) : (
          <span dangerouslySetInnerHTML={{ __html: adaptationDisplayHtml ?? '' }} />
        )}
      </div>
      {selectedScannedTokenId !== null && (() => {
        const tokens = displayTokens ?? [];
        const token = tokens.find((t) => t.id === selectedScannedTokenId);
        if (!token || token.type !== 'word' || !token.word) return null;
        const norm = normalizeForAuditMatch(token.word);
        const auditEntry = (auditLog ?? []).find((e) => normalizeForAuditMatch(e.word) === norm);
        const dbEntry = HOMONYM_DB.find((e) => e.base.toLowerCase() === norm);
        const dbVariants: string[] = dbEntry
          ? (dbEntry.variants.some((v) => dbEntry.variants.filter((x) => x.word === v.word).length > 1)
              ? dbEntry.variants.map((v) => v.meaning)
              : dbEntry.variants.map((v) => v.word))
          : [];
        const variants = auditEntry?.variants?.length ? auditEntry.variants : dbVariants;
        const displayVariants = variants.length > 0 ? variants : dbVariants;
        if (displayVariants.length === 0) return null;
        const hasPhoneticVariants = displayVariants.some((v) => /[\u0301]/.test(v));
        const menuLabel = hasPhoneticVariants
          ? `Выберите ударение для «${token.word}»:`
          : `Выберите смысл для «${token.word}»:`;
        return (
          <div
            key={`meaning-menu-${selectedScannedTokenId}-${displayVariants.length}`}
            className="absolute left-3 bottom-3 p-2 rounded border shadow-lg z-50 flex flex-col gap-1 min-w-[160px]"
            style={{
              background: isDark ? '#111' : '#fff',
              borderColor: '#A9A9A9',
              maxHeight: 'none',
              overflowY: 'visible',
              display: 'block',
            }}
          >
            <span className="text-[9px] font-semibold" style={{ color: '#6b7280' }}>
              {menuLabel}
            </span>
            {displayVariants.map((v, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleVariantSelect(selectedScannedTokenId, v)}
                className="text-left text-xs px-2 py-1.5 rounded border hover:opacity-90 transition-colors"
                style={{ borderColor: isDark ? '#333' : '#ddd', background: isDark ? '#1a1a1a' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111' }}
              >
                {v}
              </button>
            ))}
          </div>
        );
      })()}
      {hasAdaptationContent && (
        <button
          type="button"
          onClick={clearAdaptation}
          title="Очистить адаптацию"
          aria-label="Очистить адаптацию"
          className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]"
          style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}
        >
          ×
        </button>
      )}
    </div>
  );
}
