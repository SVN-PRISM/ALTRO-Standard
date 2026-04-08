/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * language-filter — Языковая фильтрация: Unicode Regex, определение языка, Script Purity.
 */

/** Unicode ranges for script detection (ISO 639-1) */
const SCRIPT_RANGES: Array<{ lang: string; re: RegExp; name: string }> = [
  { lang: 'hy', re: /[\u0531-\u058F\uFB13-\uFB17]/g, name: 'Armenian' },
  { lang: 'ru', re: /[\u0400-\u04FF]/g, name: 'Cyrillic' },
  { lang: 'en', re: /[a-zA-Z]/g, name: 'Latin' },
  { lang: 'de', re: /[a-zA-ZäöüÄÖÜß]/g, name: 'Latin' },
  { lang: 'fr', re: /[a-zA-Zàâäéèêëïîôùûüÿçæœ]/gi, name: 'Latin' },
  { lang: 'it', re: /[a-zA-Zàèéìòù]/gi, name: 'Latin' },
];

/** Detect source language from text using Unicode script heuristics. Returns ISO 639-1 code. */
export function detectSourceLanguage(text: string): string {
  if (!text?.trim()) return 'ru';
  const t = text.trim();
  let best = { lang: 'ru', count: 0 };
  for (const { lang, re } of SCRIPT_RANGES) {
    const m = t.match(re);
    const count = m ? m.length : 0;
    if (count > best.count) best = { lang, count };
  }
  return best.count > 0 ? best.lang : 'ru';
}

/** Armenian output filter: strip chars outside U+0530–U+058F and basic punctuation. */
export function applyArmenianOutputFilter(text: string): string {
  if (!text?.trim()) return text || '';
  return text.replace(/[^\u0530-\u058F\s.,!?;:'"\-–—\n\r\u0301]/g, '').replace(/\s+/g, ' ').trim();
}
