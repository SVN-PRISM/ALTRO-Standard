/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// License: MIT | SERGEI NAZARIAN (SVN).

/**
 * textUtils — Функции инъекции Unicode \u0301 и обработки текста.
 * U+0301 (combining acute accent) сохраняется во всех операциях.
 */

import { HOMONYM_DB, HOMONYM_WORD_FORMS } from '@/lib/altroData';
import { AltroTokenManager, ACCENT } from './tokenManager';

/** Символ ударения (combining acute accent). Реэкспорт из tokenManager для совместимости. */
export { ACCENT };
const COMBINING_ACUTE = 0x0301;

const VOWEL_CHAR_CODES: Record<string, number> = {
  'а': 0x0430, 'е': 0x0435, 'ё': 0x0451, 'и': 0x0438, 'о': 0x043E, 'у': 0x0443, 'ы': 0x044B, 'э': 0x044D, 'ю': 0x044E, 'я': 0x044F,
  'А': 0x0410, 'Е': 0x0415, 'Ё': 0x0401, 'И': 0x0418, 'О': 0x041E, 'У': 0x0423, 'Ы': 0x042B, 'Э': 0x042D, 'Ю': 0x042E, 'Я': 0x042F,
};

const STRESSED_VOWEL_MAP: Record<string, string> = {
  'а': 'а\u0301', 'А': 'А\u0301', 'е': 'е\u0301', 'Е': 'Е\u0301', 'ё': 'ё\u0301', 'Ё': 'Ё\u0301',
  'и': 'и\u0301', 'И': 'И\u0301', 'о': 'о\u0301', 'О': 'О\u0301', 'у': 'у\u0301', 'У': 'У\u0301',
  'ы': 'ы\u0301', 'Ы': 'Ы\u0301', 'э': 'э\u0301', 'Э': 'Э\u0301', 'ю': 'ю\u0301', 'Ю': 'Ю\u0301',
  'я': 'я\u0301', 'Я': 'Я\u0301',
};

const DECLENSION_FIXES: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bзамо\u0301ке\b/gu, replacement: 'замке\u0301' },
  { pattern: /\bо замо\u0301ке\b/gu, replacement: 'о замке\u0301' },
  { pattern: /\bна замо\u0301ке\b/gu, replacement: 'на замке\u0301' },
  { pattern: /\bв замо\u0301ке\b/gu, replacement: 'в замке\u0301' },
];

/** Подсчёт слов (для проверки изоморфизма: вход и выход должны иметь одинаковое количество) */
export function countWords(text: string): number {
  if (!text?.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Проверка наличия знака ударения в слове */
export function hasStressMark(word: string): boolean {
  return /[\u0301]/.test(word) || /[аеёиоуыэюя]'/i.test(word);
}

/** Экранирование HTML для безопасного вывода */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Пре-процессинг: оборачивает слова с \u0301 в [STRESS]...[/STRESS] для Qwen. Делегирует к tokenManager. */
export function wrapStressTags(text: string): string {
  return AltroTokenManager.wrapStressTags(text);
}

/** Пост-процессинг: удаляет теги [STRESS] и [/STRESS], оставляя слова. \u0301 не затрагивается. */
export function stripStressTags(text: string): string {
  return AltroTokenManager.stripStressTags(text);
}

/** Локальная версия stripStressTags (для detectHomonyms и др.) */
export function stripStressTagsLocal(text: string): string {
  return AltroTokenManager.stripStressTags(text);
}

/** MORPHOLOGY FIX: исправление ошибочного склонения. "на замо́ке" → "на замке́" */
export function applyDeclensionFixes(text: string): string {
  if (!text) return text;
  let result = text;
  for (const { pattern, replacement } of DECLENSION_FIXES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/** Извлекает слова с ударением (U+0301) из текста */
export function extractAccentedWords(text: string): string[] {
  if (!text || !/[\u0301]/.test(text)) return [];
  const words = new Set<string>();
  const wordChar = /[а-яёА-ЯЁ\u0301]+/g;
  let m;
  while ((m = wordChar.exec(text)) !== null) {
    if (/[\u0301]/.test(m[0])) words.add(m[0]);
  }
  return Array.from(words);
}

/** Нормализует вариант с ударением: apostrophe (а') -> combining accent (а\u0301) */
function normalizeStressToCombiningAccent(variant: string): string {
  if (/[\u0301]/.test(variant)) return variant;
  return variant.replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])'/g, '$1\u0301');
}

function isVowel(ch: string): boolean {
  return /[аеёиоуыэюяАЕЁИОУЫЭЮЯ]/.test(ch);
}

/** Индекс ударной гласной в варианте (0 = первая гласная, 1 = вторая и т.д.) */
function getStressedVowelIndex(variant: string): number {
  const nfd = normalizeStressToCombiningAccent(variant).normalize('NFD');
  let vowelCount = 0;
  for (let i = 0; i < nfd.length; i++) {
    if (nfd.charCodeAt(i) === COMBINING_ACUTE) {
      return vowelCount > 0 ? vowelCount - 1 : 0;
    }
    if (isVowel(nfd[i])) {
      vowelCount++;
    }
  }
  return 0;
}

/**
 * Применяет ударение к исходному слову, сохраняя падежное окончание.
 * Вариант 'замо́к' + исходное 'замком' → 'замко́м'.
 * Логика: ударная гласная в варианте определяется по индексу (1-я, 2-я...),
 * та же гласная получает ударение в исходном слове.
 */
export function applyAccentPreservingInflection(originalWord: string, variantWithStress: string): string {
  const cleanOriginal = originalWord.normalize('NFD').replace(/[\u0301]/g, '');
  if (!/[\u0301]/.test(normalizeStressToCombiningAccent(variantWithStress))) return originalWord;

  const stressedVowelIdx = getStressedVowelIndex(variantWithStress);
  let vowelCount = 0;
  for (let i = 0; i < cleanOriginal.length; i++) {
    const ch = cleanOriginal[i];
    if (isVowel(ch)) {
      if (vowelCount === stressedVowelIdx) {
        const stressed = STRESSED_VOWEL_MAP[ch];
        if (stressed) {
          return cleanOriginal.slice(0, i) + stressed + cleanOriginal.slice(i + 1);
        }
      }
      vowelCount++;
    }
  }
  return variantWithStress;
}

/** Применение ударения к слову: замена ударной гласной на готовую букву из маппинга */
export function applyAccentToWord(word: string, accentVariant: string): string {
  return applyAccentPreservingInflection(word, accentVariant);
}

/**
 * Строит слово с ударением с сохранением флексии.
 * Символ \u0301 ставится строго после ударной гласной по варианту.
 */
export function buildAccentedWordWithCharCode(originalWord: string, variantWithStress: string): string {
  return applyAccentPreservingInflection(originalWord, variantWithStress);
}

/** Regex для поиска слова с учётом U+0301: матчит "замок" и "за́мок" */
export function buildAccentAwareWordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withOptionalAccent = escaped.replace(/([а-яёА-ЯЁ])/gi, '$1\\u0301?');
  return new RegExp(`\\b${withOptionalAccent}\\b`, 'giu');
}

/** STRESS ONLY: удаляет все маркеры, скобки с вариантами. Допустим только \u0301.
 * ЗАЩИТА: \u0301 НЕ удаляется — метод не содержит replace, затрагивающий combining characters. */
export function stripAdaptationMarkers(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[\=\]/g, '')
    .replace(/\[\/STRESS\]/g, '')
    .replace(/\[STRESS\]/g, '')
    .replace(/\s*\([^)]*\/[^)]*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * MANDATORY STRESS: принудительно вставляет ударения \u0301 во все омонимы.
 * Если в тексте есть "замок", результат ДОЛЖЕН содержать "за́мок" или "замо́к".
 */
export function ensureMandatoryStress(text: string): string {
  if (!text?.trim()) return text;
  let result = text;
  const combining = '[\\u0300-\\u036f]*';
  for (const entry of HOMONYM_DB) {
    const baseLower = entry.base.toLowerCase();
    const firstVariant = entry.variants[0]?.word;
    if (!firstVariant) continue;
    const wordForms = Object.entries(HOMONYM_WORD_FORMS)
      .filter(([, base]) => base.toLowerCase() === baseLower)
      .map(([form]) => form);
    const formsToMatch = wordForms.length > 0 ? wordForms : [entry.base];
    for (const form of formsToMatch) {
      const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = '\\b' + escaped.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(combining) + combining + '\\b';
      const regex = new RegExp(pattern, 'gi');
      result = result.replace(regex, (matched) => {
        if (hasStressMark(matched)) return matched;
        return applyAccentToWord(matched, firstVariant);
      });
    }
  }
  return result;
}
