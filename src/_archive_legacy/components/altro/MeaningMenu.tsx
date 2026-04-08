// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN) | Stencil: HomonymClarifyButton retained
'use client';

import {
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  CLARIFICATION_OPTIONS,
  type DomainWeights,
} from '@/lib/altroData';
import type { ExternalDomainKey } from '@/lib/altro/foundation';
import type { TextToken } from '@/lib/altro/engine';

export interface MeaningMenuProps {
  isDark: boolean;
  domainWeights: DomainWeights;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  textTokens: TextToken[];
  selectedTokenId: number | null;
  showHomonymClarify: boolean;
  unresolvedHomonyms: TextToken[];
  handleExternalDomainChange: (key: ExternalDomainKey, value: number) => void;
  handleHomonymVariantSelect: (tokenId: number, variantWord: string) => void;
  handleClarifyHomonym: () => void;
  setShowHomonymClarify: (v: boolean) => void;
  setSelectedTokenId: (v: number | null) => void;
  homonymClarifyRef: React.Ref<HTMLDivElement>;
}

/** Stub: EXTERNAL DOMAINS в archive */
export function ExternalDomainsBlock({
  isDark,
}: Pick<MeaningMenuProps, 'isDark' | 'domainWeights' | 'activePreset' | 'handleExternalDomainChange'>) {
  return (
    <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', minWidth: '120px' }}>
      <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: '#6b7280' }}>DOMAINS</p>
      <span className="text-[8px]" style={{ color: isDark ? '#6b7280' : '#9ca3af' }}>(archived)</span>
    </div>
  );
}

/** УТОЧНИТЬ ОМОНИМ — сохранён для точности данных */
export function HomonymClarifyButton({
  isDark,
  textTokens,
  selectedTokenId,
  showHomonymClarify,
  unresolvedHomonyms,
  handleHomonymVariantSelect,
  handleClarifyHomonym,
  setShowHomonymClarify,
  setSelectedTokenId,
  homonymClarifyRef,
}: Pick<MeaningMenuProps, 'isDark' | 'textTokens' | 'selectedTokenId' | 'showHomonymClarify' | 'unresolvedHomonyms' | 'handleHomonymVariantSelect' | 'handleClarifyHomonym' | 'setShowHomonymClarify' | 'setSelectedTokenId' | 'homonymClarifyRef'>) {
  return (
    <div className="relative" ref={homonymClarifyRef}>
      <button
        type="button"
        onClick={handleClarifyHomonym}
        disabled={!(Array.isArray(unresolvedHomonyms) && unresolvedHomonyms.length > 0)}
        title={Array.isArray(unresolvedHomonyms) && unresolvedHomonyms.length > 0 ? `Омонимы: ${unresolvedHomonyms.map((t) => t?.word ?? '').join(', ')}` : 'Нет неразрешённых омонимов'}
        className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
      >
        УТОЧНИТЬ ОМОНИМ
      </button>
      {showHomonymClarify && selectedTokenId !== null && (() => {
        const token = textTokens.find((t) => t.id === selectedTokenId);
        if (!token?.isHomonym) return null;
        const form = token.word.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
        const base = HOMONYM_WORD_FORMS[form] ?? form;
        const dbEntry = HOMONYM_DB.find((e) => e.base.toLowerCase() === base);
        const opts = dbEntry ? dbEntry.variants.map((v) => ({ label: `${v.word} (${v.meaning})`, value: v.word })) : (CLARIFICATION_OPTIONS[base] || []);
        if (opts.length === 0) return null;
        return (
          <div className="absolute left-0 top-full mt-1 p-2 rounded border shadow-lg z-50 flex flex-col gap-1 min-w-[200px]" style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? '#333' : '#ccc' }}>
            <span className="text-[9px] font-semibold" style={{ color: '#6b7280' }}>Выберите значение для «{token.word}»:</span>
            {opts.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleHomonymVariantSelect(selectedTokenId, opt.value)}
                className="text-left text-xs px-2 py-1.5 rounded border hover:opacity-90 transition-colors"
                style={{ borderColor: isDark ? '#333' : '#ddd', background: isDark ? '#1a1a1a' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
