/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/** Базовые формы омонимов (без ударения) — маркеры потенциального смысла SVN. */
export const HOMONYM_BASE_WORDS: string[] = ['замок', 'дорога', 'атлас', 'мука', 'орган', 'завод', 'гриф', 'коса', 'ласка', 'ключ', 'брак', 'лук'];

export interface ValidationResult {
  status: 'PASSED' | 'FAILED' | 'WARNING';
  issues: ValidationIssue[];
  /** Одинаковые ударения / разные / в источнике без ударения / ошибка. */
  stressVerdict?: 'same' | 'different' | 'source_unmarked' | 'failed';
}

export interface ValidationIssue {
  word: string;
  position: number;
  reason: 'missing_stress' | 'missing_homonym';
}

/** Нормализованное слово (без апострофа и пунктуации) для сравнения с HOMONYM_BASE_WORDS. U+0301 сохраняется в исключениях. */
export function normalizeWordForHomonym(word: string): string {
  const withStress = word.replace(/'/g, '').toLowerCase().trim().replace(/[^a-zа-яё\u0301]/gi, '');
  return withStress.replace(/\u0301/g, ''); // strip for base comparison
}

/** Является ли слово омонимом (замок, дорога, атлас, мука и др.) — даже без символа ударения. */
export function isHomonymWord(word: string): boolean {
  const normalized = normalizeWordForHomonym(word);
  return normalized.length > 0 && HOMONYM_BASE_WORDS.includes(normalized);
}

/** Маркер ударения в Ядре: символ ' (Alt+39) сразу после гласной (например, за'мок). */
const VOWEL_BEFORE_STRESS = /[аеёиоуыэюяaeiou]\'/i;

/** Проверяет, что в слове есть маркер ударения сразу после гласной. Экспорт для подсветки в UI. */
export function hasStressInWord(word: string): boolean {
  return VOWEL_BEFORE_STRESS.test(word);
}

function wordHasStressMarker(word: string): boolean {
  return VOWEL_BEFORE_STRESS.test(word);
}

/** Возвращает слова из текста, содержащие маркер ударения (гласная + '). Позиция ' фиксирована в слове. */
export function getWordsWithStressMarker(text: string): string[] {
  if (!text.trim()) return [];
  const words = text.split(/\s+/);
  return words.filter((w) => wordHasStressMarker(w));
}

function textHasStressMarker(text: string): boolean {
  return getWordsWithStressMarker(text).length > 0;
}

/**
 * Валидация по стандарту ALTRO: проверка омонимов и ударений.
 * — Одинаковые ударения (за'мок и за'мок) → PASSED, stressVerdict 'same'.
 * — Разные ударения (за'мок и замо'к) → PASSED, stressVerdict 'different'.
 * — В источнике омоним без ударения → WARNING, stressVerdict 'source_unmarked'.
 * — Ошибка (потеря/смещение ударения в адаптации) → FAILED, stressVerdict 'failed'.
 */
export function validateTranscreation(sourceText: string, adaptationText: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  const sourceWords = sourceText.split(/\s+/).filter(Boolean);
  const sourceMarked = getWordsWithStressMarker(sourceText);
  const adaptMarked = getWordsWithStressMarker(adaptationText);

  // В источнике есть омоним без маркера ударения → Уточните смысл
  const sourceHasHomonymWithoutStress = sourceWords.some(
    (w) => isHomonymWord(w) && !wordHasStressMarker(w)
  );
  if (sourceHasHomonymWithoutStress && sourceMarked.length === 0) {
    return { status: 'WARNING', issues: [], stressVerdict: 'source_unmarked' };
  }
  if (sourceHasHomonymWithoutStress) {
    // Есть и помеченные, и непомеченные омонимы — предупреждение
    return { status: 'WARNING', issues: [], stressVerdict: 'source_unmarked' };
  }

  if (!sourceText.trim() && !adaptationText.trim()) {
    issues.push({ word: '', position: 0, reason: 'missing_homonym' });
    return { status: 'FAILED', issues, stressVerdict: 'failed' };
  }

  if (!sourceMarked.length && !adaptMarked.length) {
    if (sourceText.trim() || adaptationText.trim()) {
      issues.push({ word: '', position: 0, reason: 'missing_homonym' });
    }
    return { status: 'FAILED', issues, stressVerdict: 'failed' };
  }

  if (sourceMarked.length > 0 && adaptMarked.length === 0) {
    sourceMarked.forEach((word, i) => {
      issues.push({ word, position: i, reason: 'missing_stress' });
    });
    return { status: 'FAILED', issues, stressVerdict: 'failed' };
  }

  if (sourceMarked.length > 0 && adaptMarked.length > 0) {
    const everySourceWordMatches = sourceMarked.every((sw) => adaptMarked.includes(sw));
    if (!everySourceWordMatches) {
      sourceMarked.forEach((word, i) => {
        if (!adaptMarked.includes(word)) {
          issues.push({ word, position: i, reason: 'missing_stress' });
        }
      });
      return { status: 'FAILED', issues, stressVerdict: 'failed' };
    }
    // Все помеченные слова совпадают по форме: одинаковые ударения
    const hasDifferentStress = sourceMarked.some((sw) => {
      const inAdapt = adaptMarked.find((aw) => normalizeWordForHomonym(aw) === normalizeWordForHomonym(sw));
      return inAdapt != null && inAdapt !== sw;
    });
    return {
      status: 'PASSED',
      issues,
      stressVerdict: hasDifferentStress ? 'different' : 'same',
    };
  }

  return { status: 'PASSED', issues };
}
