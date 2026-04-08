/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 — Лингвистическая нейтральность */

/** Трёхуровневая матрица: один список для Source / Stencil / Output (AUTO + фиксированные коды). */
export const SUPPORTED_LANGUAGES = [
  { id: 'AUTO', label: 'AUTO', hint: 'Авто' },
  { id: 'RU', label: 'RU', hint: 'Русский' },
  { id: 'EN', label: 'EN', hint: 'English' },
  { id: 'IT', label: 'IT', hint: 'Italiano' },
  { id: 'FR', label: 'FR', hint: 'Français' },
  { id: 'DE', label: 'DE', hint: 'Deutsch' },
  { id: 'ES', label: 'ES', hint: 'Español' },
  { id: 'HY', label: 'HY', hint: 'Армянский' },
] as const;

export type SupportedLanguageId = (typeof SUPPORTED_LANGUAGES)[number]['id'];

/** Код для API (lowercase), кроме AUTO — нужен fallback. */
export function languageIdToApiCode(id: string, fallback: string = 'ru'): string {
  const u = id.trim().toUpperCase();
  if (u === 'AUTO') return fallback;
  const map: Record<string, string> = {
    RU: 'ru',
    EN: 'en',
    IT: 'it',
    FR: 'fr',
    DE: 'de',
    ES: 'es',
    HY: 'hy',
  };
  return map[u] ?? fallback;
}

/** Значение для GlassLanguageSelect из кода API (auto | ru | …). */
export function apiOutputToSelectId(lang: string): string {
  const s = lang.trim().toLowerCase();
  if (s === 'auto') return 'AUTO';
  return lang.trim().toUpperCase();
}

/** Селектор id → код для setOutputLanguage. */
export function selectIdToOutputLanguage(id: string): 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy' | 'es' {
  const u = id.trim().toUpperCase();
  if (u === 'AUTO') return 'auto';
  return languageIdToApiCode(u) as 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy' | 'es';
}
