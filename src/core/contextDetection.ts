/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/** Контекстные триггеры для омонима «замок»: замо'к (механизм). В пределах 3–4 слов. */
const TRIGGERS_LOCK = ['открыт', 'закрыт', 'ключ', 'дверь', 'железный'];

/** Контекстные триггеры для омонима «замок»: за'мок (здание). В пределах 3–4 слов. */
const TRIGGERS_CASTLE = ['старый', 'стены', 'башня', 'ров', 'ворота'];

const WINDOW = 4;
const ZAMOK_NORMALIZED = 'замок';

function normalizeWord(w: string): string {
  return w.replace(/'/g, '').toLowerCase().trim();
}

export type ContextLabel = 'Архитектура' | 'Механика' | 'Архитектура / Механика';

export interface ZamokContextResult {
  contextLabel: ContextLabel | null;
  zamokIndicesWithContext: Set<number>;
}

/**
 * Определяет контекст омонима «замок» по соседним словам (3–4 слова).
 */
export function getZamokContext(text: string): ZamokContextResult {
  const zamokIndicesWithContext = new Set<number>();
  const words = text.split(/\s+/).filter(Boolean);
  const normalized = words.map(normalizeWord);

  let hasCastle = false;
  let hasLock = false;

  for (let i = 0; i < normalized.length; i++) {
    if (normalized[i] !== ZAMOK_NORMALIZED) continue;

    const start = Math.max(0, i - WINDOW);
    const end = Math.min(normalized.length, i + WINDOW + 1);
    const windowWords = normalized.slice(start, end);

    const foundCastle = TRIGGERS_CASTLE.some((t) => windowWords.includes(t));
    const foundLock = TRIGGERS_LOCK.some((t) => windowWords.includes(t));

    if (foundCastle || foundLock) {
      zamokIndicesWithContext.add(i);
      if (foundCastle) hasCastle = true;
      if (foundLock) hasLock = true;
    }
  }

  let contextLabel: ContextLabel | null = null;
  if (hasCastle && hasLock) contextLabel = 'Архитектура / Механика';
  else if (hasCastle) contextLabel = 'Архитектура';
  else if (hasLock) contextLabel = 'Механика';

  return { contextLabel, zamokIndicesWithContext };
}
