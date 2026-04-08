/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * trust-layer — Модуль 'Resonance Verification'.
 * Смысловая Печать: универсальный резонанс, лингвистическая нейтральность.
 * Формула 40/40/20: Структура / Якоря / Домены.
 * Zero-Baseline: Anchors и Domains = 0% по умолчанию. Баллы только при matchRoot.
 */

import { getActiveDomainsList, getDomainTermsForCheck, findDomainForWord } from './domain-processor';
import type { DomainCalibration, ResonanceVerificationResult, CivilizationalWeights } from './types/altro';
export type { ResonanceVerificationResult, VerifyResonanceParams, CivilizationalWeights } from './types/altro';

/** Паттерны для автономного распознавания 8 Цивилизационных Доменов (Октава ALTRO). Корни + словоформы. */
const OCTAVE_PATTERNS: Record<keyof CivilizationalWeights, RegExp> = {
  economics: /\d+[%$€₽]|ресурс|выгод|стоимост|цен[а-яё]*|обмен/giu,
  politics: /должен|обязан|вправе|закон|власт|статус|иерарх/giu,
  society: /люди|обществ|групп|взаимодейств|связ|норм/giu,
  history: /памят|корн|времен|ранее|причин|следств|было/giu,
  culture: /традиц|код|идентичн|язык|свой|чужой|ментальн/giu,
  aesthetics: /красот|стил|гармон|чувств|вкус|образ|форм/giu,
  technology: /инструмент|прогресс|алгоритм|будущ|интеграц|процесс/giu,
  spirituality: /смысл|сакральн|вечн|этик|высш|дух|абсолют/giu,
};

/** Автономное распознавание 8 Цивилизационных Доменов. Веса 0.0–1.0. */
export function detectOctaveDomains(text: string): CivilizationalWeights {
  const norm = (text ?? '').toLowerCase().replace(/[\u0301]/g, '');
  const result: CivilizationalWeights = {
    economics: 0,
    politics: 0,
    society: 0,
    history: 0,
    culture: 0,
    aesthetics: 0,
    technology: 0,
    spirituality: 0,
  };
  const keys = Object.keys(OCTAVE_PATTERNS) as (keyof CivilizationalWeights)[];
  for (const key of keys) {
    const matches = norm.match(OCTAVE_PATTERNS[key]);
    result[key] = matches && matches.length > 0 ? 1.0 : 0.0;
  }
  return result;
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[\u0301]/g, '').replace(/\s+/g, ' ');
}

/** Набор пунктуационных символов, критичных для mirror-режима. */
const MIRROR_PUNCTUATION_CHARS = ['«', '»', '„', '“', '.'] as const;

/** Проверка: все важные пунктуационные символы из входа присутствуют в выходе (сравнение по Unicode-кодам). */
function hasAllMirrorPunctuation(inputText: string, outputText: string): boolean {
  for (const ch of MIRROR_PUNCTUATION_CHARS) {
    if (inputText.includes(ch) && !outputText.includes(ch)) {
      return false;
    }
  }
  return true;
}

/** Классическое расстояние Левенштейна по Unicode-кодам (без удаления кавычек/спецсимволов). */
function levenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp = new Array<number>(lenB + 1);
  for (let j = 0; j <= lenB; j++) dp[j] = j;

  for (let i = 1; i <= lenA; i++) {
    let prev = dp[0];
    dp[0] = i;
    const chA = a.charAt(i - 1);
    for (let j = 1; j <= lenB; j++) {
      const tmp = dp[j];
      const chB = b.charAt(j - 1);
      const cost = chA === chB ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,          // удаление
        dp[j - 1] + 1,      // вставка
        prev + cost,        // замена
      );
      prev = tmp;
    }
  }

  return dp[lenB];
}

/** Нормализованное визуальное сходство: 1 - dist / maxLen. */
function calculateVisualSimilarity(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0 && lenB === 0) return 1;
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(lenA, lenB);
  if (maxLen === 0) return 1;
  return 1 - dist / maxLen;
}

/** Проверяет наличие семантического корня в тексте (RegExp). Окончания/падежи не обнуляют результат. */
function matchRoot(text: string, root: string): boolean {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped + '[\\p{L}\\p{M}]*', 'iu').test(text);
}

function countWords(text: string): number {
  return (text?.trim().split(/\s+/) ?? []).filter(Boolean).length;
}

/** 40% — Структура (OPR). Соотношение слов вход/выход. */
function calcStructureScore(inputText: string, outputText: string): { score: number; reason: string } {
  const inW = countWords(inputText);
  const outW = countWords(outputText);
  if (inW === 0) return { score: 40, reason: 'No input words' };
  const ratio = outW / inW;
  let score: number;
  if (ratio >= 0.5 && ratio <= 2) score = 40 * (1 - Math.abs(1 - ratio) * 0.3);
  else if (ratio >= 0.25 && ratio < 0.5) score = 40 * (ratio / 0.5);
  else if (ratio > 2) score = Math.max(0, 40 - (ratio - 2) * 15);
  else score = 40 * (ratio / 0.25);
  score = Math.round(Math.max(0, Math.min(40, score)));
  const reason = ratio < 0.25 ? 'Structure gap (output too short)' : ratio > 2 ? 'Structure gap (output too long)' : 'Structure preserved';
  return { score, reason };
}

/** 40% — Якоря. Zero-Baseline: 0% по умолчанию. Баллы ТОЛЬКО при matchRoot. Language Strictness: target hy = только DOMAIN_ROOTS.hy. */
function calcAnchorsScore(
  inputText: string,
  outputNorm: string,
  targetLanguage?: string
): { score: number; reason: string; matchedRoots: string[] } {
  const words = inputText
    .toLowerCase()
    .replace(/[\u0301]/g, '')
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4);
  const keyConcepts = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 8);
  if (keyConcepts.length === 0) return { score: 0, reason: 'No key concepts in input', matchedRoots: [] };

  const matchedRoots: string[] = [];
  let matched = 0;
  const targetLang = targetLanguage ?? 'ru';

  for (const word of keyConcepts) {
    const domainKey = findDomainForWord(word);
    if (domainKey) {
      const roots = getDomainTermsForCheck(domainKey, targetLang);
      const found = roots.find((r) => matchRoot(outputNorm, r));
      if (found) {
        matched++;
        matchedRoots.push(found);
        if (typeof window !== 'undefined') console.log(`[TRUST] Matched root: '${found}' in output (domain: ${domainKey})`);
      }
    } else {
      if (matchRoot(outputNorm, word) || outputNorm.includes(word)) {
        matched++;
        matchedRoots.push(word);
        if (typeof window !== 'undefined') console.log(`[TRUST] Matched root: '${word}' in output (no domain)`);
      }
    }
  }
  const score = matched === 0 ? 0 : Math.round((matched / keyConcepts.length) * 40);
  const reason = matched === 0 ? 'Semantic gap (no anchor match)' : `Anchors: ${matched}/${keyConcepts.length}`;
  if (typeof window !== 'undefined' && matchedRoots.length === 0) console.log(`[TRUST] Anchors: 0 — no roots matched in output`);
  return { score, reason, matchedRoots };
}

/** 20% — Домены. Zero-Baseline: 0% по умолчанию. Баллы ТОЛЬКО при matchRoot. target hy = только DOMAIN_ROOTS.hy. */
function calcDomainScore(outputNorm: string, activeDomains: string[], targetLanguage?: string): { score: number; reason: string; matchedRoots: string[] } {
  if (activeDomains.length === 0) return { score: 0, reason: 'No active domains', matchedRoots: [] };
  const DOMAIN_NAME_TO_KEY: Record<string, string> = {
    'История': 'history', 'Культура': 'culture', 'Духовность': 'spirituality', 'Экономика': 'economics',
    'Политика': 'politics', 'Общество': 'society', 'Эстетика': 'aesthetics', 'Технологии': 'technology',
    'Семантика': 'economics', 'Контекст': 'economics', 'Намерение': 'economics', 'Образность': 'aesthetics', 'Этика': 'spirituality',
  };
  const matchedRoots: string[] = [];
  let matched = 0;
  const targetLang = targetLanguage ?? 'ru';

  for (const d of activeDomains) {
    const key = DOMAIN_NAME_TO_KEY[d] ?? d.toLowerCase();
    const roots = getDomainTermsForCheck(key, targetLang);
    const found = roots.find((r) => matchRoot(outputNorm, r));
    if (found) {
      matched++;
      matchedRoots.push(found);
      if (typeof window !== 'undefined') console.log(`[TRUST] Matched root: '${found}' in output (domain: ${key})`);
    }
  }
  const score = matched === 0 ? 0 : Math.round((matched / activeDomains.length) * 20);
  const reason = matched === 0 ? 'No Domain match' : `Domain match: ${matched}/${activeDomains.length}`;
  if (typeof window !== 'undefined' && matchedRoots.length === 0) console.log(`[TRUST] Domains: 0 — no roots matched in output`);
  return { score, reason, matchedRoots };
}

/** Верификация резонанса: 40% структура + 40% якоря + 20% домены. Универсальная, без привязки к языку. */
export function verifyResonance(
  inputText: string,
  outputText: string,
  calibration?: DomainCalibration,
  options?: { targetLanguage?: string; oprValue?: number; mode?: 'mirror' | 'transfigure' | 'slang' | null }
): ResonanceVerificationResult {
  const inputTrim = inputText?.trim() ?? '';
  const outputTrim = outputText?.trim() ?? '';
  const targetLang = options?.targetLanguage ?? 'ru';

  if (!inputTrim || !outputTrim) {
    const score = inputTrim && outputTrim ? 100 : 0;
    const reason = !outputTrim ? 'No adaptation yet' : 'No source text';
    if (typeof window !== 'undefined') {
      console.log(`[ALTRO TRUST] Resonance Score calculated: ${score}%`);
      console.log(`[ALTRO TRUST] Reason for Score: ${reason}`);
      console.log(`[TRUST DIAGNOSTICS] Structure: —%, Anchors: —%, Domains: —%`);
    }
    return { verified: score >= 70, score, confidence: score / 100, reason };
  }

  const outputNorm = normalizeForMatch(outputTrim);
  const activeDomains = calibration ? getActiveDomainsList(calibration) : [];

  const isMirrorMode = options?.mode === 'mirror';

  let struct = calcStructureScore(inputTrim, outputTrim);
  const anchors = calcAnchorsScore(inputTrim, outputNorm, targetLang);
  const domains = calcDomainScore(outputNorm, activeDomains, targetLang);

  let mirrorPunctuationOk = false;
  let visualSimilarity = 0;

  if (isMirrorMode) {
    mirrorPunctuationOk = hasAllMirrorPunctuation(inputTrim, outputTrim);
    visualSimilarity = calculateVisualSimilarity(inputTrim, outputTrim);

    // В mirror-режиме идеальное совпадение ключевой пунктуации даёт полный вес структуры (40%).
    if (mirrorPunctuationOk) {
      struct = {
        score: 40,
        reason: 'Structure preserved (mirror punctuation match)',
      };
    }
  }

  let score = Math.max(0, Math.min(100, struct.score + anchors.score + domains.score));
  let reason: string;
  if (score < 70) {
    const reasons: string[] = [];
    if (struct.score < 16) reasons.push('Structure gap');
    if (anchors.score < 16) reasons.push('Semantic gap');
    if (domains.score < 10 && activeDomains.length > 0) reasons.push('No Domain match');
    if (reasons.length === 0) reasons.push('Language mismatch');
    reason = reasons.join(' / ');
  } else {
    reason = `${struct.reason} | ${anchors.reason} | ${domains.reason}`;
  }

  // В mirror-режиме, если визуальное сходство ≥ 95% и вся пунктуация на месте — форсируем Resonance Score = 100%.
  if (isMirrorMode && mirrorPunctuationOk && visualSimilarity >= 0.95) {
    score = 100;
    reason = 'Mirror mode: punctuation preserved and visual similarity ≥ 95%';
  }

  if (typeof window !== 'undefined') {
    console.log(`[ALTRO TRUST] Resonance Score calculated: ${score}%`);
    console.log(`[ALTRO TRUST] Reason for Score: ${reason}`);
    console.log(`[TRUST DIAGNOSTICS] Structure: ${struct.score}%, Anchors: ${anchors.score}%, Domains: ${domains.score}%`);
  }

  const result: ResonanceVerificationResult = {
    verified: score >= 70,
    score,
    confidence: score / 100,
    reason: score < 70 ? reason : undefined,
  };

  if (activeDomains.length === 0) {
    result.domains = detectOctaveDomains(outputTrim);
  }

  return result;
}

/** Сброс состояния TrustLayer (резервирование API). Модуль stateless — no-op. */
export function resetTrustLayer(): void {
  // Trust-layer stateless; no persistent state to clear.
}
