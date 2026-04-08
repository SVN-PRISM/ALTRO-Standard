// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import { DomainSlider } from '@/components/DomainSlider';
import {
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  CLARIFICATION_OPTIONS,
  EXTERNAL_DOMAIN_KEYS,
  EXTERNAL_DOMAIN_LABELS,
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

/** 8 цивилизационных атрибутов — EXTERNAL DOMAINS block */
export function ExternalDomainsBlock({
  isDark,
  domainWeights,
  activePreset,
  handleExternalDomainChange,
}: Pick<MeaningMenuProps, 'isDark' | 'domainWeights' | 'activePreset' | 'handleExternalDomainChange'>) {
  return (
    <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', flexGrow: 1, minWidth: '280px' }}>
      <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 pt-0 pb-0.5" style={{ color: '#6b7280', lineHeight: 1.2 }}>EXTERNAL DOMAINS</p>
      <div className="flex gap-1 flex-1 justify-between items-stretch min-h-0" style={{ width: '100%', minWidth: 0 }}>
        {(EXTERNAL_DOMAIN_KEYS ?? []).map((key) => (
          <div key={key} className="flex flex-col items-center gap-0 flex-1 min-w-0" style={{ minWidth: '36px' }}>
            <div className="flex items-center justify-center flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
              <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>
                {(domainWeights?.[key] ?? 0) >= 0 ? '+' : ''}{(domainWeights?.[key] ?? 0).toFixed(2)}
              </span>
            </div>
            <DomainSlider
              domain={{ name: key, weight: domainWeights?.[key] ?? 0, status: 'active' }}
              onChange={(_, weight) => handleExternalDomainChange(key, weight)}
              showValue={false}
              showLabel={false}
              disabled={activePreset === 'mirror'}
              height={108}
            />
            <div className="flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
              <span className="text-[8px] text-center leading-tight w-full px-0.5 block whitespace-nowrap overflow-hidden truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{EXTERNAL_DOMAIN_LABELS[key]}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** УТОЧНИТЬ ОМОНИМ — кнопка и popover выбора значения */
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
