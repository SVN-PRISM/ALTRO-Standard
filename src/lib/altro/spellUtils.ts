/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// License: MIT | SERGEI NAZARIAN (SVN).

/**
 * spellUtils — Fuzzy Matching для исправления орфографии.
 * Расстояние Левенштейна + порог уверенности OPR (70%).
 */

/** Расстояние Левенштейна между двумя строками */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/** Максимальная разница длины для кандидата (оптимизация) */
const MAX_LENGTH_DIFF = 4;

/** Максимальное расстояние Левенштейна для рассмотрения кандидата */
const MAX_EDIT_DISTANCE = 5;

export interface FuzzySpellResult {
  correction: string;
  confidence: number;
}

/**
 * Fuzzy Matching: находит наиболее вероятное исправление из словаря.
 * confidence = 1 - (distance / maxLen). Порог 70% для авто-замены.
 */
export function fuzzySpellSuggest(
  word: string,
  dictionary: Iterable<string>
): FuzzySpellResult | null {
  const lower = word.toLowerCase().replace(/[\u0301]/g, '');
  if (lower.length < 2) return null;

  let best: { word: string; distance: number } | null = null;

  for (const candidate of dictionary) {
    const candLower = candidate.toLowerCase();
    if (candLower === lower) return null; // слово уже правильное

    const lenDiff = Math.abs(lower.length - candLower.length);
    if (lenDiff > MAX_LENGTH_DIFF) continue;

    const distance = levenshteinDistance(lower, candLower);
    if (distance > MAX_EDIT_DISTANCE) continue;

    if (!best || distance < best.distance) {
      best = { word: candidate, distance };
    }
  }

  if (!best) return null;

  const maxLen = Math.max(lower.length, best.word.length);
  const confidence = 1 - best.distance / maxLen;

  return { correction: best.word, confidence };
}
