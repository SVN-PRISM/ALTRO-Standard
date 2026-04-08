/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * ALTRO Engine — AltroOrchestrator, IPA loop, request flow.
 * Prompt generation → PromptBuilder. Chronos logging → ChronosService.
 */

/* STENCIL_MIGRATION_STEP_1: GOLDEN_RESERVE — см. src/archive/legacy_altro/altroGoldenReserve.ts (не подгружаем в engine). */
let systemAnchors: string[] = [];

import type { DomainWeights } from '@/lib/altroData';
import { SPELLCHECK_CORRECTIONS, HOMONYM_DB, HOMONYM_WORD_FORMS } from '@/lib/altroData';
import { AltroTokenManager, type TextToken } from './tokenManager';
import { applyDeclensionFixes, extractAccentedWords, countWords } from './textUtils';
import { getActiveDomainsList } from './domain-processor';
import { verifyResonance } from './trust-layer';
import type { WordDefinitions } from '@/archive/legacy_altro/dictionary';
import { AltroSqlAdapter, type SemanticIntent } from './adapters/sql-adapter';
import { detectSourceLanguage, applyArmenianOutputFilter } from './language-filter';
import { SemanticFirewall, calibrationToVector } from '@/security/SemanticFirewall';
import { wrapPrompt, inferDomainFocusFromCalibration, type SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';
import { runIpaPhase1Action } from '@/app/actions/ipaPhase1';
import {
  buildSystemPrompt,
  buildLockedMeaningLines,
  prepareForTranscreation,
  SCAN_AUDIT_PROMPT,
  type AltroCalibration,
  type BuildPromptParams,
} from '@/archive/legacy_altro/PromptBuilder';
import {
  logToChronos,
  logIpaAnalysisToChronos,
  logSecurityBlockToChronos,
} from './ChronosService';
import { validateResonance } from '@/archive/legacy_altro/ResonanceValidator';
import { AltroGuard, type GuardReport } from './AltroGuard';
import { MODEL_NOT_SET, MODEL_NOT_SET_USER_MESSAGE, resolveStencilDefaultModel } from '@/lib/stencilTransfigure';

/** Re-export for consumers */
export { detectSourceLanguage } from './language-filter';
export { getActiveDomainsList } from './domain-processor';
export { verifyResonance } from './trust-layer';
export type { ResonanceVerificationResult, VerifyResonanceParams } from './types/altro';
export type { GuardReport } from './AltroGuard';
export { buildSystemPrompt } from '@/archive/legacy_altro/PromptBuilder';
export type { BuildPromptParams, AltroCalibration } from '@/archive/legacy_altro/PromptBuilder';

/** Слова с двойным смыслом (омонимы) */
const HOMONYM_FORMS = new Set([
  ...HOMONYM_DB.map((e) => e.base.toLowerCase()),
  ...Object.keys(HOMONYM_WORD_FORMS).map((k) => k.toLowerCase()),
]);

const OCTAVE_KEYS = ['economics', 'politics', 'society', 'history', 'culture', 'aesthetics', 'technology', 'spirituality'] as const;

const TOP_ANCHORS_LIMIT = 7;

/**
 * Собирает Top-7 ANCHORS для [CONTEXT_INSIGHTS]. Приоритет: слова с U+0301, длинные термины.
 */
function buildAnchorsText(
  ipaPacket?: SemanticPacket | null,
  goldenReserveWords?: Array<{ word: string }>
): { anchorsText: string; anchorsSize: number } {
  const raw = new Set<string>();
  systemAnchors.forEach((w) => { if (w?.trim()) raw.add(w.trim()); });
  (ipaPacket?.structural_anchors ?? []).forEach((s) => { if (s?.trim()) raw.add(s.trim()); });
  (goldenReserveWords ?? []).map((w) => w.word?.trim()).filter(Boolean).forEach((w) => raw.add(w!));
  const scored = [...raw].map((w) => ({
    w,
    priority: (/\u0301/.test(w) ? 2 : 0) + (w.length >= 10 ? 1 : 0),
  }));
  scored.sort((a, b) => b.priority - a.priority);
  const top = scored.slice(0, TOP_ANCHORS_LIMIT).map((s) => s.w);
  return { anchorsText: top.join(', '), anchorsSize: raw.size };
}

export type PresetMode = 'mirror' | 'transfigure' | 'slang' | 'data_query';

export type ScenarioType = 'without' | 'poetics' | 'technocrat' | 'sacred' | 'goldStandard';

export type { CalculatedWeights } from './vectorEngine';

/** Известные технические правки (слипшиеся слова) для валидатора. вКрасноярске: предлог + имя собственное. */
const CONCATENATION_FIXES: Record<string, string> = {
  'папаимама': 'папа и мама',
  'Папаимама': 'Папа и мама',
  'ростовенадону': 'Ростове-на-Дону',
  'Ростовенадону': 'Ростове-на-Дону',
  'вКрасноярске': 'в Красноярске',
  'вкрасноярске': 'в Красноярске',
};

/** Согласование рода: технические константы Протокола ALTRO. U+0301 сохраняется.
 * DOMAIN ALIGNMENT: грамматическая целостность (Integrity) ПРИОРИТЕТНЕЕ метафор (Образность).
 * Путь (м.р.) → вел; дорога (ж.р.) → вела. */
const GENDER_AGREEMENT_FIXES: Array<{ pattern: RegExp; toWord: string; fromWord: string }> = [
  { pattern: /\b(крепость)\s+(мой)\b/gi, toWord: 'крепость', fromWord: 'моя' },
  { pattern: /\b(крепость)\s+(твой)\b/gi, toWord: 'крепость', fromWord: 'твоя' },
  { pattern: /\b(обитель)\s+(мой)\b/gi, toWord: 'обитель', fromWord: 'моя' },
  { pattern: /\b(обитель)\s+(твой)\b/gi, toWord: 'обитель', fromWord: 'твоя' },
  { pattern: /\b(мой)\s+(крепость)\b/gi, toWord: 'моя', fromWord: 'крепость' },
  { pattern: /\b(мой)\s+(обитель)\b/gi, toWord: 'моя', fromWord: 'обитель' },
  { pattern: /\b(твой)\s+(крепость)\b/gi, toWord: 'твоя', fromWord: 'крепость' },
  { pattern: /\b(твой)\s+(обитель)\b/gi, toWord: 'твоя', fromWord: 'обитель' },
];

function matchCase(source: string, target: string): string {
  if (source.length > 0 && source[0] === source[0].toUpperCase()) {
    return target.length > 0 ? target[0].toUpperCase() + target.slice(1) : target;
  }
  return target;
}

/**
 * Активная стерилизация: регистр + род. Сохраняет U+0301.
 * SCAN использует эту логику как БАЗУ для всех режимов.
 * Mirror Integrity: первая буква НИКОГДА не переводится в нижний регистр — только в верхний при необходимости.
 */
export function applyMirrorSterilization(text: string): string {
  if (!text?.trim()) return text || '';
  let result = text.trim();
  result = result.replace(/\s+/g, ' '); // Только пробелы; U+0301 (Combining Acute Accent) не в \s — сохраняется
  const firstLetter = result.match(/[а-яёА-ЯЁa-zA-Z]/);
  if (firstLetter && firstLetter.index !== undefined && firstLetter[0] === firstLetter[0].toLowerCase()) {
    const idx = firstLetter.index;
    result = result.slice(0, idx) + firstLetter[0].toUpperCase() + result.slice(idx + 1);
  }
  for (const { pattern, toWord, fromWord } of GENDER_AGREEMENT_FIXES) {
    result = result.replace(pattern, (_, p1: string, p2: string) => {
      const fixed1 = matchCase(p1, toWord);
      const fixed2 = matchCase(p2, fromWord);
      return `${fixed1} ${fixed2}`;
    });
  }
  // DOMAIN ALIGNMENT: путь (м.р.) → вел; грамматическая целостность приоритетнее метафор
  result = result.replace(/\b(путь|Путь)\s+((?:[^\s]+\s+)*)вела\b/gi, (_, path: string, middle: string) => path + (middle ? ' ' + middle : ' ') + 'вел');
  result = result.replace(/\b(путь|Путь)\s+((?:[^\s]+\s+)*)вело\b/gi, (_, path: string, middle: string) => path + (middle ? ' ' + middle : ' ') + 'вел');
  return result.trim();
}

/** Результат поиска омонимов */
export interface HomonymScanResult {
  has_homonyms: boolean;
  words: string[];
}

/** Запись аудита SCAN: слово-ловушка (омоним) */
export interface ScanAuditEntry {
  word: string;
  variants?: string[];
  reason?: string;
  priority?: boolean;
}

/** Результат сканирования SCAN: исходный текст + auditLog */
export interface ScanAuditResult {
  text: string;
  auditLog: ScanAuditEntry[];
}

/**
 * detectHomonyms: поиск омонимов в тексте (замок, стоит и т.д.).
 * Возвращает массив слов с двойным смыслом для кнопки «УТОЧНИТЬ ОМОНИМ».
 * Слова с ударением (\\u0301) игнорируются — ударение снимает неопределённость.
 */
export function detectHomonyms(text: string): string[] {
  if (!text?.trim()) return [];
  const cleanText = AltroTokenManager.stripStressTags(text);
  const found = new Set<string>();
  const combining = '[\\u0300-\\u036f]*';
  for (const form of HOMONYM_FORMS) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '\\b' + escaped.split('').join(combining) + combining + '\\b';
    const re = new RegExp(pattern, 'gi');
    let m;
    while ((m = re.exec(cleanText)) !== null) {
      if (!/[\u0301]/.test(m[0])) {
        const base = HOMONYM_WORD_FORMS[form] ?? form;
        found.add(base);
        break;
      }
    }
  }
  return Array.from(found);
}

/** Результат: has_homonyms и массив слов (для обратной совместимости) */
export function findHomonyms(text: string): HomonymScanResult {
  const words = detectHomonyms(text);
  return { has_homonyms: words.length > 0, words };
}

/** FROM LOG TO ACTION: возвращает омонимы с массивом вариантов для HomonymSelector */
export function getHomonymWordsWithVariants(text: string): { word: string; baseWord: string; variants: { word: string; meaning: string }[] }[] {
  const words = detectHomonyms(text);
  return words.map((baseWord) => {
    const entry = HOMONYM_DB.find((e) => e.base.toLowerCase() === baseWord.toLowerCase());
    return { word: baseWord, baseWord, variants: entry?.variants ?? [] };
  });
}

/** Локальный аудит: омонимы из HOMONYM_DB для мгновенной подсветки (фаза 1 сканирования) */
export function buildLocalAuditLog(text: string): ScanAuditEntry[] {
  const tokens = AltroTokenManager.tokenize(text);
  const seen = new Set<string>();
  const result: ScanAuditEntry[] = [];
  for (const t of tokens) {
    if (t.type !== 'word') continue;
    const lower = t.word.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
    const base = HOMONYM_WORD_FORMS[lower] ?? lower;
    if (seen.has(base)) continue;
    const entry = HOMONYM_DB.find((e) => e.base.toLowerCase() === base);
    if (!entry || /[\u0301]/.test(t.word)) continue;
    seen.add(base);
    const hasDuplicateWords = entry.variants.some(
      (v) => entry.variants.filter((x) => x.word === v.word).length > 1
    );
    const variants = hasDuplicateWords
      ? entry.variants.map((v) => v.meaning)
      : entry.variants.map((v) => v.word);
    if (variants.length > 0) result.push({ word: t.word, variants });
  }
  return result;
}

/** Результат валидации входного и выходного текста */
export interface SemanticValidationResult {
  semantic_ok: boolean;
  /** Описание причин, если semantic_ok === false */
  reason?: string;
}

/** Типичные ошибки согласования рода: местоимение м.р. + сущ. ж.р. или сущ. ж.р. + местоимение м.р. */
const GENDER_ERRORS = [
  /\bмой\s+крепость\b/gi,
  /\bмой\s+обитель\b/gi,
  /\bмой\s+цитадель\b/gi,
  /\bтвой\s+крепость\b/gi,
  /\bтвой\s+обитель\b/gi,
  /\bнаш\s+крепость\b/gi,
  /\bваш\s+крепость\b/gi,
  /\bкрепость\s+мой\b/gi,
  /\bкрепость\s+твой\b/gi,
  /\bобитель\s+мой\b/gi,
  /\bобитель\s+твой\b/gi,
];

/**
 * Проверка явных ошибок: регистр, пробелы, точки, род.
 * Semantic OK только если ВСЕ пункты выполнены.
 */
export function hasNoObviousErrors(text: string): boolean {
  if (!text?.trim()) return true;
  const t = text.trim();
  if (t.length === 0) return true;
  const firstLetter = t.match(/[а-яёА-ЯЁa-zA-Z]/);
  if (firstLetter && firstLetter[0] === firstLetter[0].toLowerCase()) return false;
  if (/\s{2,}/.test(t)) return false;
  if (/\.{2,}/.test(t)) return false;
  if (/\s+([.,!?;:])/.test(t) || /([.,!?;:])\S/.test(t)) return false;
  if (/\bв[Кк]расноярске\b|папаимама|вкрасноярске/i.test(t)) return false; // слипшиеся слова
  for (const re of GENDER_ERRORS) {
    if (re.test(t)) return false;
  }
  return true;
}

/**
 * Валидатор: сравнивает входной и выходной текст.
 * Если правки носят только технический характер (опечатки, слипшиеся слова, пунктуация) — semantic_ok: true.
 */
export function validateSemanticChanges(inputText: string, outputText: string): SemanticValidationResult {
  const normalize = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const inNorm = normalize(inputText);
  const outNorm = normalize(outputText);

  if (inNorm === outNorm) {
    return { semantic_ok: true };
  }

  // Применяем известные технические правки к входу
  let expected = inputText;
  const allFixes: Record<string, string> = { ...SPELLCHECK_CORRECTIONS, ...CONCATENATION_FIXES };
  for (const [from, to] of Object.entries(allFixes)) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    expected = expected.replace(re, to);
  }

  const expectedNorm = normalize(expected);
  if (expectedNorm === outNorm) {
    return { semantic_ok: true };
  }

  // Допускаем незначительные отличия пунктуации (лишние/убраные пробелы вокруг знаков)
  const expectedClean = expectedNorm.replace(/\s*([.,!?;:]+)\s*/g, '$1 ');
  const outClean = outNorm.replace(/\s*([.,!?;:]+)\s*/g, '$1 ');
  if (expectedClean === outClean) {
    return { semantic_ok: true };
  }

  return {
    semantic_ok: false,
    reason: 'Обнаружены семантические изменения, выходящие за рамки технических правок',
  };
}

/** Параметры запроса к Ollama */
export interface OllamaRequestParams {
  text: string;
  /** Токены с isLocked — при наличии и совпадении с text используются для обёртки в <fixed> */
  tokens?: TextToken[];
  mode: PresetMode;
  calibration?: AltroCalibration;
  targetLanguage?: string;
  /** Язык источника: 'auto' = автоопределение по тексту */
  sourceLanguage?: string;
  goldenReserveWords?: Array<{ word: string; tokenId: number; definitions: WordDefinitions }>;
  forcePreserveAccents?: boolean;
  /** Директива из Командного модуля (Ваша Воля) */
  directive?: string;
  /** false = DOMAIN SILENCE. true по умолчанию для Phase 2 (ADAPT). */
  isFinalAdaptation?: boolean;
  /** Стриминг: callback для пословного вывода. При наличии — stream: true. */
  onChunk?: (chunk: string) => void;
  /** Уникальный ID сессии — очистка контекста Ollama перед каждым запросом */
  sessionId?: string;
  /** Инструкция DomainEngine: использовать метафорику (Imagery/Sacred) для обогащения */
  domainEngineDirective?: string;
  /** Семантические уточнения (последнее слово перед user): [слово] = значение */
  resolvedVariantsHint?: string;
  /** @internal Флаг повторного запроса при низком резонансе */
  _resonanceRetry?: boolean;
  /** IPA Phase 1: двухфазный режим (Анализ → Исполнение). Только для transfigure. */
  useIPA?: boolean;
  /** Callback при смене фазы IPA: 'analysis' | 'execution' — для UI статуса. */
  onPhaseChange?: (phase: 'analysis' | 'execution') => void;
  /** @internal Семантический пакет из фазы анализа (передаётся при useIPA). */
  ipaPacket?: SemanticPacket;
  /** Client-side timeout for fetch (ms). Default REGENERATION_TIMEOUT_MS. Use 180000+ to avoid 502. */
  timeoutMs?: number;
}


/** Параметры конфигурации Ollama */
export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

const DEFAULT_OLLAMA_CONFIG: Required<OllamaConfig> = {
  baseUrl: 'http://localhost:11434',
  model: resolveStencilDefaultModel(),
};

export { applyDeclensionFixes, extractAccentedWords } from './textUtils';
export { AltroTokenManager };

/** Извлечение полезного payload между [OUTPUT_START] и [OUTPUT_END]. Вне тегов — игнорируется. */
function extractOutputPayload(rawContent: string | undefined | null, fallback: string): string {
  const trimmed = rawContent?.trim();
  if (!trimmed) return fallback;
  const startTag = '[OUTPUT_START]';
  const endTag = '[OUTPUT_END]';
  const startIdx = trimmed.indexOf(startTag);
  if (startIdx === -1) {
    return trimmed || fallback;
  }
  const contentStart = startIdx + startTag.length;
  const endIdx = trimmed.indexOf(endTag, contentStart);
  const slice = endIdx !== -1 ? trimmed.slice(contentStart, endIdx) : trimmed.slice(contentStart);
  const inner = slice.trim();
  return inner || fallback;
}

/** Парсинг JSON-ответа Mirror: {"text": "..."}. При неудаче — fallback. */
function extractMirrorTextFromJson(rawContent: string, fallback: string): string {
  const trimmed = rawContent?.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as { text?: string };
    if (typeof parsed?.text === 'string') return parsed.text || fallback;
  } catch {
    /* не JSON — используем raw или fallback */
  }
  return trimmed || fallback;
}

/** ALTRO LIBRA: дисклеймеры только для transfigure (mirror — без них для ускорения SCAN) */
const LIBRA_DISCLAIMER_TRANSFIGURE_ETHICS =
  'Внимание: Данная адаптация является результатом частного использования инструмента семантической оркестровки. Ответственность за распространение несет пользователь. License: MIT | SERGEI NAZARIAN (SVN).';

/** OPR Level 2: Object-Predicate Relations — проверка целостности фразы после транскреации.
 * Короткие точные ответы (≤3 слов на вход) не блокируются — LLM может дать лаконичный результат. */
function checkOprPhraseIntegrity(result: string, inputText: string): boolean {
  const trimmed = (result || '').trim();
  if (!trimmed) return false;
  const inputWords = countWords(inputText);
  const outputWords = countWords(trimmed);
  if (outputWords < 1) return false;
  if (inputWords <= 3) return true;
  if (inputWords > 0 && outputWords < Math.floor(inputWords * 0.25)) return false;
  if (trimmed.endsWith('-') && !trimmed.endsWith(' -')) return false;
  return true;
}

function applyLibraPostProcessing(
  finalText: string,
  params: { mode: PresetMode; calibration?: AltroCalibration; text?: string; targetLanguage?: string }
): string {
  let result = AltroTokenManager.stripStressTags(finalText);
  result = applyDeclensionFixes(result);
  if (params.targetLanguage === 'hy') {
    result = applyArmenianOutputFilter(result);
  }
  if (params.mode === 'transfigure' && params.text != null && !checkOprPhraseIntegrity(result, params.text)) {
    result = params.text;
  }
  if (params.mode === 'mirror' && params.text != null && countWords(result) !== countWords(params.text)) {
    result = params.text;
  }
  // ALTRO LIBRA: дисклеймер только ОДИН раз в самом конце (mirror — без него)
  if (
    params.mode === 'transfigure' &&
    (params.calibration?.internal?.ethics ?? 0) > 50 &&
    !result.includes('[ALTRO LIBRA]')
  ) {
    result += `\n\n---\n[ALTRO LIBRA] ${LIBRA_DISCLAIMER_TRANSFIGURE_ETHICS}`;
  }
  return result;
}

/**
 * AltroOrchestrator — класс оркестрации запросов к Ollama.
 * Принцип Нулевой Точки: в режиме Зеркало формирует запрос только на исправление опечаток, ошибок и пунктуации.
 * Влияние всех 5 доменов принудительно равно 0.
 */
export class AltroOrchestrator {
  private config: Required<OllamaConfig>;
  private currentController: AbortController | null = null;
  private lastGuardReport: GuardReport | null = null;
  private isProcessing = false;

  constructor(config: OllamaConfig = {}) {
    this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config };
  }

  abort() {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  /** Последний GuardReport (после verifyAndHeal в transfigure+IPA или синтетический из trust-layer в Legacy Flow). */
  getLastGuardReport(): GuardReport | null {
    return this.lastGuardReport;
  }

  /** Создаёт синтетический GuardReport из trust-layer при Legacy Flow (IPA Phase 1 не вернул пакет). */
  private buildLegacyGuardReport(
    finalText: string,
    resonance: { score: number },
    params: OllamaRequestParams
  ): GuardReport {
    const scoreNorm = resonance.score / 100;
    const status: GuardReport['status'] = scoreNorm >= 0.8 ? 'CLEAN' : 'BREACH';
    return {
      finalText,
      initialScore: scoreNorm,
      finalScore: scoreNorm,
      isHealed: false,
      iterations: 0,
      lostMeanings: [],
      timestamp: new Date().toISOString(),
      status,
    };
  }

  /** Авто-коррекция: при resonanceScore < 50 — повторный запрос с CRITICAL-директивой. */
  private async processAndMaybeRetry(finalText: string, params: OllamaRequestParams): Promise<string> {
    // DATA_QUERY: Libra/Resonance не применяются, возвращаем сырое содержимое.
    if (params.mode === 'data_query') return finalText;

    const processed = applyLibraPostProcessing(finalText, params);
    if (params.mode === 'mirror' || !params.calibration || params._resonanceRetry) return processed;
    const resonance = verifyResonance(params.text ?? '', processed, params.calibration, {
      targetLanguage: params.targetLanguage,
      oprValue: params.calibration?.opr,
      mode: params.mode,
    });
    if (resonance.score < 50) {
      const activeDomains = getActiveDomainsList(params.calibration).join(', ');
      const retryParams: OllamaRequestParams = {
        ...params,
        domainEngineDirective: `CRITICAL: Low resonance. Re-verify semantic anchors for [${activeDomains}].`,
        _resonanceRetry: true,
        onChunk: undefined, // Retry без стриминга — полная замена результата
      };
      if (typeof window !== 'undefined') console.log(`[ALTRO TRUST] Low resonance (${resonance.score}%). Auto-retry with CRITICAL directive.`);
      return this.request(retryParams);
    }
    return processed;
  }

  /**
   * Recalibration after Phase 1. Sanitizes anchors, infers domains from calibration, builds packet.
   * Called ONLY after rawIpaData is validated (non-empty structural_anchors).
   */
  private recalibrateOctave(
    rawIpaData: SemanticPacket,
    params: OllamaRequestParams
  ): SemanticPacket {
    const sourceLower = params.text?.trim().toLowerCase() ?? '';
    const sanitizedAnchors = rawIpaData.structural_anchors.filter((a) => {
      if (typeof a !== 'string' || a.length >= 20) return false;
      return sourceLower.includes(a.toLowerCase().replace(/\u0301/g, ''));
    });
    const domain_focus = inferDomainFocusFromCalibration(params.calibration);
    const domainLabels = domain_focus.join(', ');
    const packet: SemanticPacket = {
      ...rawIpaData,
      structural_anchors: sanitizedAnchors,
      intent_summary: `Transcreation focus: ${domainLabels}. Preserve anchors.`,
      domain_focus,
    };
    if (typeof window !== 'undefined' && params.calibration?.external) {
      console.group('ALTRO_OCTAVE_DIAGNOSTIC');
      console.log('[TIMESTAMP]', new Date().toISOString());
      console.log('[PHASE1→KERNEL] Domains inferred from calibration:', domain_focus);
      console.log('[PHASE1→KERNEL] Anchors extracted:', sanitizedAnchors.length);
      const ext = params.calibration.external;
      console.log('Octave weights:', { economics: ext.economics, politics: ext.politics, society: ext.society, history: ext.history, culture: ext.culture, aesthetics: ext.aesthetics, technology: ext.technology, spirituality: ext.spirituality });
      console.groupEnd();
    }
    return packet;
  }

  /**
   * Формирует payload для Ollama.
   * В режиме mirror: только промпт на исправление ошибок, веса доменов = 0.
   */
  buildOllamaPayload(params: OllamaRequestParams): {
    model: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    options?: Record<string, unknown>;
    keep_alive?: string;
  } {
    const { text, mode } = params;

    if (mode === 'transfigure' || mode === 'slang') {
      prepareForTranscreation(); // ATOMIC PHASES: Explicit context flush before Transcreation prompt.
    }

    const tokens =
      params.tokens && params.tokens.map((t) => t.word).join('') === text
        ? params.tokens
        : AltroTokenManager.tokenize(text);
    const lockedMeanings = tokens.filter(
      (t) => t.type === 'word' && t.isLocked && t.meaning
    );
    const hasHomonymClarifications =
      (params.resolvedVariantsHint?.trim()?.length ?? 0) > 0 || lockedMeanings.length > 0;

    // OPR Meta-Anchor (Method B): compute locked meanings first, inject at start of prompt.
    const lockedMeaningLines = buildLockedMeaningLines(
      params.resolvedVariantsHint,
      lockedMeanings.map((t) => ({ word: t.word, meaning: t.meaning ?? undefined }))
    );

    const anchorsResult =
      mode !== 'mirror'
        ? buildAnchorsText(params.ipaPacket ?? undefined, params.goldenReserveWords)
        : { anchorsText: '', anchorsSize: 0 };

    let systemPrompt =
      mode === 'mirror'
        ? buildSystemPrompt({
            mode: 'mirror',
            calibration: {} as AltroCalibration,
            targetLanguage: params.targetLanguage,
            isFinalAdaptation: params.isFinalAdaptation ?? true,
            lockedMeaningLines,
          })
        : buildSystemPrompt({
            mode,
            calibration: params.calibration!,
            targetLanguage: params.targetLanguage,
            goldenReserveWords: params.goldenReserveWords,
            sourceText: params.text,
            directive: params.directive,
            isFinalAdaptation: params.isFinalAdaptation ?? true,
            domainEngineDirective: params.domainEngineDirective,
            anchorsText: anchorsResult.anchorsText || undefined,
            hasHomonymClarifications,
            lockedMeaningLines,
            semanticPacket: params.ipaPacket ?? undefined,
          });
    // Do not append resolvedVariantsHint again — it is already in [LOCKED_MEANING] when present.

    const textWithFixedTags = AltroTokenManager.wrapTokensForQwen(tokens);
    const userContent = params.ipaPacket
      ? wrapPrompt(params.ipaPacket, textWithFixedTags)
      : `[INPUT_START]\n${textWithFixedTags}\n[INPUT_END]`;

    const isTransfigure = mode === 'transfigure' || mode === 'slang';
    const hasScannerTrace =
      isTransfigure &&
      (systemPrompt.includes('Сканер') ||
        systemPrompt.includes('Scanner') ||
        systemPrompt.includes('Linguistic Extractor') ||
        systemPrompt.includes('Extract ONLY'));
    if (isTransfigure && !params._resonanceRetry) {
      if (typeof window !== 'undefined') {
        console.log(hasScannerTrace ? '[KERNEL-CONTAMINATION] Phase 2 prompt has Scanner traces!' : '[KERNEL-CLEAN] Phase 2 prompt verified. No Scanner traces found.');
      }
    }

    const base = {
      model: this.config.model,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
        { role: 'assistant' as const, content: '[OUTPUT_START]\n' },
      ],
      options:
        mode === 'mirror'
          ? { temperature: 0, top_p: 1, presence_penalty: 0.0, num_predict: 200, stop: ['[OUTPUT_END]', '<thought>', '---'] }
          : { temperature: 0.75, top_p: 0.9, presence_penalty: 0.0, num_predict: 200, stop: ['[OUTPUT_END]', '###'] },
      keep_alive: '15m',
    };
    // FORCE-MIRROR HUNT: forcePreserveAccents zeros OPR & domains. Only set by explicit caller — never from UI.
    if (params.forcePreserveAccents) {
      return {
        ...base,
        forcePreserveAccents: true,
        internalDomains: { semantics: 0, context: 0, intent: 0, imagery: 0, ethics: 0 },
        civilizational: 0,
        opr: 0,
      } as ReturnType<AltroOrchestrator['buildOllamaPayload']>;
    }
    return base;
  }

  /**
   * DATA SYNC: mock Firebird schema sync via AltroSqlAdapter.
   * Legislative Core: builds a SemanticIntent; Executive Shell: builds SQL.
   * In UI this is surfaced as [DATA SYNC]; here we only log SQL.
   */
  async syncDatabaseSchema(): Promise<string> {
    const adapter = new AltroSqlAdapter(3);

    // Minimal schema intent (Firebird system tables can be mapped later).
    const intent: SemanticIntent = {
      entity: 'RDB$RELATIONS',
      fields: ['RDB$RELATION_NAME'],
      filters: [],
      limit: 100,
      offset: 0,
    };

    const result = adapter.buildFirebirdSelect(intent);
    if (result.deniedReason) {
      throw new Error(result.deniedReason);
    }
    if (!result.sql) {
      throw new Error('ALTRO DATA_SYNC: SQL not generated by AltroSqlAdapter.');
    }
    if (typeof window !== 'undefined') {
      console.log('[ALTRO DATA_SYNC SQL]', result.sql, result.params);
    }
    return result.sql;
  }

  /** Проверка наличия омонимов в тексте; возвращает has_homonyms для индикатора */
  scanHomonyms(text: string): HomonymScanResult {
    return findHomonyms(text);
  }

  /** Код ошибки при пустом/невалидном JSON ответе — не очищать поле Адаптации */
  static readonly OPR_RESONANCE_ERROR = 'ALTRO: Ожидание резонанса OPR...';

  /** Таймаут fetch: 5 мин. */
  static readonly REGENERATION_TIMEOUT_MS = 300_000;

  /** IPA Phase 1: таймаут 5 мин. При превышении — fallback в Legacy Flow. */
  static readonly IPA_ANALYSIS_TIMEOUT_MS = 300_000;

  /** Scan Audit: таймаут 5 мин. */
  static readonly SCAN_AUDIT_TIMEOUT_MS = 300_000;

  /** Сообщение для UI при 502 — показывать в поле Адаптации */
  static readonly ERROR_502_MESSAGE = '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]';

  /**
   * Отправляет запрос к Ollama и возвращает результат.
   * При onChunk — stream: true, результат пословно в callback.
   * Пре-процессинг: [STRESS] теги. Пост-процессинг: удаление тегов.
   */
  async request(params: OllamaRequestParams): Promise<string> {
    if (!params._resonanceRetry && this.isProcessing) {
      if (typeof window !== 'undefined') console.warn('[ALTRO] Request skipped: engine busy.');
      return '';
    }
    if (!params._resonanceRetry) this.isProcessing = true;
    this.lastGuardReport = null;
    const start = Date.now();
    try {
    if (this.config.model === MODEL_NOT_SET) {
      if (typeof window !== 'undefined') console.error(MODEL_NOT_SET_USER_MESSAGE);
      return MODEL_NOT_SET_USER_MESSAGE;
    }
    const firewall = SemanticFirewall.getInstance();
    const intentVector = params.calibration
      ? calibrationToVector(params.calibration)
      : calibrationToVector({});
    const lockedTokens = (params.tokens ?? [])
      .filter((t) => t.type === 'word')
      .map((t) => ({ id: t.id, word: t.word, isLocked: t.isLocked }));

    const url = typeof window !== 'undefined' ? '/api/transcreate' : `${this.config.baseUrl}/api/chat`;
    const guard = new AltroGuard(url, { verifyResonance: validateResonance }, this.config.model);

    // MIRROR INTEGRITY: Firewall bypass — Mirror is pass-through, no TDP/OPR or Learning logs.
    if (params.mode !== 'mirror') {
      try {
        const firewallResult = firewall.evaluate(intentVector, {
          lockedTokens,
          requestText: params.text ?? '',
        });
        if (!firewallResult.allowed) {
          const msg = `⚠️ Семантическая блокировка: ${firewallResult.reportLine}`;
          if (typeof window !== 'undefined') console.warn(msg);
          return msg;
        }
      } catch (err) {
        const msg = `⚠️ Семантическая блокировка: ${err instanceof Error ? err.message : String(err)}`;
        if (typeof window !== 'undefined') console.warn(msg);
        return msg;
      }
    }

    // IPA Phase 1: Nano-Extractor. NO buildSystemPrompt, NO getGlobalContext, NO CommonInstructions.
    // runIpaPhase1Action uses ONLY buildPhase1Prompt(SemanticPackager) — isolated payload.
    let effectiveParams = params;
    if (params.useIPA && params.mode === 'transfigure' && params.text?.trim()) {
      params.onPhaseChange?.('analysis');
      try {
        const rawIpaData = await runIpaPhase1Action(params.text.trim(), this.config.model);

        if (!rawIpaData || !Array.isArray(rawIpaData.structural_anchors) || rawIpaData.structural_anchors.length === 0) {
          console.error('[KERNEL-BLOCK] Смысловой суверенитет под угрозой. Пакет пуст.');
          if (typeof window !== 'undefined') {
            console.warn('[IPA] Fallback to Legacy Flow. Phase 2 will use UI slider weights.');
          }
        } else {
          console.log('[KERNEL] Starting Recalibration with REAL data...');
          const packet = this.recalibrateOctave(rawIpaData, params);
          logIpaAnalysisToChronos(
            { mode: params.mode, text: params.text, calibration: params.calibration },
            packet
          );
          effectiveParams = { ...params, ipaPacket: packet };
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (e) {
        if (typeof window !== 'undefined') console.warn('[IPA] Phase 1 error:', e);
      }
      params.onPhaseChange?.('execution');
    }

    let sourceDetected: string | undefined;
    if (params.sourceLanguage === 'auto' && params.text?.trim()) {
      sourceDetected = detectSourceLanguage(params.text);
      if (typeof window !== 'undefined') {
        console.log(`Source Language Detected: ${sourceDetected.toUpperCase()}`);
      }
    }

    // ATOMIC PHASES: Phase 2 fetch is a fresh request. No Phase 1 Scanner context or history.
    const doFetch = async (signal?: AbortSignal) => {
      const payload = this.buildOllamaPayload(effectiveParams);
      const fullPayload = {
        ...payload,
        stream: true,
        ...(typeof window !== 'undefined' && {
          _altroDebug: {
            targetLanguage: params.targetLanguage ?? 'ru',
            oprIntensity: (params.calibration?.opr ?? 0) * 100,
            ...(sourceDetected && { sourceLanguageDetected: sourceDetected }),
          },
        }),
      };
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
        signal,
      });
    };

    try {
      // ALTRO_OCTAVE_DIAGNOSTIC: ONLY in recalibrateOctave() after rawIpaData — no duplicate here.
      const startTime = Date.now();
      const payload = this.buildOllamaPayload(effectiveParams);
      const { model } = payload;
      if (typeof window !== 'undefined') {
        const oprVal = (params as { intensity?: number }).intensity ?? (params.calibration?.opr ?? 0) * 100;
        console.log('🔴 [OPR-DEBUG]: Current Intensity:', oprVal, '| calibration.opr:', params.calibration?.opr, '| mode:', params.mode);
        console.log('ACTIVE ENGINE:', model);
        console.log('SENDING TO LLM:', { model, stream: true, sessionId: params.sessionId });
      }

      this.abort(); // Cancel any previous requests
      const controller = new AbortController();
      this.currentController = controller;
      const requestTimeout = params.timeoutMs ?? AltroOrchestrator.REGENERATION_TIMEOUT_MS;
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

      let response: Response;
      try {
        response = await doFetch(controller.signal);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          const simplifiedParams: OllamaRequestParams = {
            ...params,
            onChunk: undefined,
            directive: `УПРОЩЕНИЕ: Метафоры упрости. Сохрани ВСЕ [STRESS] токены и \u0301 в неприкосновенности. Вывод: ТОЛЬКО чистый текст.`,
          };
          const fallbackPayload = this.buildOllamaPayload(simplifiedParams);
          const fallbackRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...fallbackPayload, stream: false }),
          });
          if (!fallbackRes.ok) {
            if (fallbackRes.status === 502 && typeof window !== 'undefined') {
              console.error(`[ENGINE] Ollama Overloaded or Timeout. Context size: ${(params.text ?? '').length}`);
            }
            const msg = fallbackRes.status === 502 ? AltroOrchestrator.ERROR_502_MESSAGE : `Ollama request failed: ${fallbackRes.status}`;
            throw new Error(msg);
          }
          const rawBody = await fallbackRes.text();
          if (!rawBody?.trim()) throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
          let data: { message?: { content?: string } } | null = null;
          try {
            data = JSON.parse(rawBody) as { message?: { content?: string } };
          } catch {
            throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
          }
          let finalText = extractOutputPayload(data?.message?.content, params.text);
          if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
          
          const finalResult = await this.processAndMaybeRetry(finalText, params);
          logToChronos(
            { mode: params.mode, text: params.text, calibration: params.calibration },
            finalResult,
            model,
            startTime
          );
          if (effectiveParams.ipaPacket) {
            const guardReport = await guard.verifyAndHeal(params.text ?? '', finalResult, effectiveParams.ipaPacket);
            this.lastGuardReport = guardReport;
            return guardReport.finalText;
          }
          if (params.mode === 'transfigure' && params.calibration) {
            const resonance = verifyResonance(params.text ?? '', finalResult, params.calibration, {
              targetLanguage: params.targetLanguage,
              oprValue: params.calibration?.opr,
              mode: params.mode,
            });
            this.lastGuardReport = this.buildLegacyGuardReport(finalResult, resonance, params);
          }
          return finalResult;
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        let msg: string;
        let body: { error?: string; code?: string; reason?: string } = {};
        try {
          body = (await response.json()) as { error?: string; code?: string; reason?: string };
          msg = body?.error ?? `Ollama request failed: ${response.status} ${response.statusText}`;
        } catch {
          msg = response.status === 502 ? AltroOrchestrator.ERROR_502_MESSAGE : `Ollama request failed: ${response.status} ${response.statusText}`;
        }
        if (response.status === 502 && typeof window !== 'undefined') {
          console.error(`[ENGINE] Ollama Overloaded or Timeout. Context size: ${(params.text ?? '').length}`);
        }
        if (response.status === 403 && typeof window !== 'undefined') {
          const code = body?.code ?? 'UNKNOWN';
          const reason = body?.reason ?? msg;
          logSecurityBlockToChronos(
            { mode: params.mode, text: params.text, calibration: params.calibration },
            code,
            reason
          );
        }
        throw new Error(msg);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        let readChunkCount = 0;
        // stream: true сохраняет состояние между чанками — \u0301 и др. multi-byte UTF-8 не разрываются
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          readChunkCount++;
          if (typeof window !== 'undefined' && (readChunkCount <= 10 || readChunkCount % 50 === 0)) {
            console.log('[ENGINE] Chunk received:', readChunkCount);
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
              const chunk = obj?.message?.content ?? '';
              if (chunk) {
                fullText += chunk;
                params.onChunk?.(chunk);
              }
            } catch {
              /* skip malformed line */
            }
          }
        }
        if (typeof window !== 'undefined') {
          console.log('[ENGINE] Stream ended. Total read chunks:', readChunkCount);
        }
        if (buffer.trim()) {
          try {
            const obj = JSON.parse(buffer) as { message?: { content?: string } };
            const chunk = obj?.message?.content ?? '';
            if (chunk) {
              fullText += chunk;
              params.onChunk?.(chunk);
            }
          } catch {
            /* skip */
          }
        }
        let finalText = extractOutputPayload(fullText, params.text);
        if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
        
        let finalResult = await this.processAndMaybeRetry(finalText, params);
        logToChronos(
            { mode: params.mode, text: params.text, calibration: params.calibration },
            finalResult,
            model,
            startTime
          );
        if (effectiveParams.ipaPacket) {
          const guardReport = await guard.verifyAndHeal(
            params.text ?? '',
            finalResult,
            effectiveParams.ipaPacket
          );
          this.lastGuardReport = guardReport;
          finalResult = guardReport.finalText;
        } else if (params.mode === 'transfigure' && params.calibration) {
          const resonance = verifyResonance(params.text ?? '', finalResult, params.calibration, {
            targetLanguage: params.targetLanguage,
            oprValue: params.calibration?.opr,
            mode: params.mode,
          });
          this.lastGuardReport = this.buildLegacyGuardReport(finalResult, resonance, params);
        }
        return finalResult;
      }

      const rawBody = await response.text();
      if (!rawBody?.trim()) throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
      let data: { message?: { content?: string } } | null = null;
      try {
        data = JSON.parse(rawBody) as { message?: { content?: string } };
      } catch {
        throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
      }
      let finalText = extractOutputPayload(data?.message?.content, params.text);
      if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
      
      let finalResult = await this.processAndMaybeRetry(finalText, params);
      logToChronos(
        { mode: params.mode, text: params.text, calibration: params.calibration },
        finalResult,
        model,
        startTime
      );
      if (effectiveParams.ipaPacket) {
        const guardReport = await guard.verifyAndHeal(
          params.text ?? '',
          finalResult,
          effectiveParams.ipaPacket
        );
        this.lastGuardReport = guardReport;
        finalResult = guardReport.finalText;
      } else if (params.mode === 'transfigure' && params.calibration) {
        const resonance = verifyResonance(params.text ?? '', finalResult, params.calibration, {
          targetLanguage: params.targetLanguage,
          oprValue: params.calibration?.opr,
          mode: params.mode,
        });
        this.lastGuardReport = this.buildLegacyGuardReport(finalResult, resonance, params);
      }
      return finalResult;
    } catch (err) {
      if (typeof window !== 'undefined') console.error('ALTRO CORE ERROR:', err);
      throw err;
    } finally {
      if (typeof window !== 'undefined') console.log('[DEBUG-TIMER] Total processing time:', Date.now() - start, 'ms');
    }
    } finally {
      if (!params._resonanceRetry) this.isProcessing = false;
    }
  }

  /** Результат сканирования: исходный текст + auditLog (омонимы с variants) */
  static parseScanAuditResponse(rawContent: string, originalText: string): ScanAuditResult {
    const trimmed = rawContent?.trim();
    if (!trimmed) return { text: originalText, auditLog: [] };
    try {
      const parsed = JSON.parse(trimmed);
      const auditLog = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as { auditLog?: ScanAuditEntry[] })?.auditLog)
          ? (parsed as { auditLog: ScanAuditEntry[] }).auditLog
          : [];
      return { text: originalText, auditLog };
    } catch {
      return { text: originalText, auditLog: [] };
    }
  }

  /**
   * Сканирование омонимов. Возвращает исходный текст без изменений + auditLog.
   */
  async requestScanAudit(text: string): Promise<ScanAuditResult> {
    if (this.config.model === MODEL_NOT_SET) {
      if (typeof window !== 'undefined') console.error(MODEL_NOT_SET_USER_MESSAGE);
      return { text, auditLog: [] };
    }
    // Ленивый запуск аудита, чтобы не конкурировать с основным LLM-запросом
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    const url = typeof window !== 'undefined' ? '/api/transcreate' : `${this.config.baseUrl}/api/chat`;
    const payload = {
      model: this.config.model,
      messages: [
        { role: 'system' as const, content: SCAN_AUDIT_PROMPT },
        { role: 'user' as const, content: text },
      ],
      stream: false,
      keep_alive: '15m',
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AltroOrchestrator.SCAN_AUDIT_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        if (response.status === 502 && typeof window !== 'undefined') {
          console.error(`[ENGINE] Ollama Overloaded or Timeout. Context size: ${text.length}`);
        }
        throw new Error(`Ollama ${response.status}`);
      }
      const data = (await response.json()) as { message?: { content?: string } };
      const raw = data?.message?.content?.trim() ?? '';
      return AltroOrchestrator.parseScanAuditResponse(raw, text);
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        if (typeof window !== 'undefined') console.warn('Audit skipped (timeout)');
        return { text, auditLog: [] };
      }
      if (typeof window !== 'undefined') console.error('ALTRO SCAN AUDIT ERROR:', err);
      throw err;
    }
  }

  /**
   * Один вызов API: коррекция + поиск омонимов.
   */
  async requestMirrorCorrection(text: string): Promise<{ text: string; homonyms: string[]; semantic_ok: boolean }> {
    const corrected = await this.request({ text, mode: 'mirror' });
    const homonyms = detectHomonyms(corrected);
    const semanticOk = hasNoObviousErrors(corrected);
    return { text: corrected, homonyms, semantic_ok: semanticOk };
  }

  /**
   * process — главная точка входа для SCAN. Соединяет Ядро с UI.
   * @param text — входной текст
   * @param mode — режим (mirror | transfigure | slang)
   * @param sanitizer — опциональная функция санации (орфография, омонимы). Если передана — вызывается первым.
   * @param directive — опциональная директива из Nexus Command (передаётся при нажатии SCAN).
   */
  process(
    text: string,
    mode: PresetMode,
    sanitizer?: (input: string) => string,
    directive?: string
  ): string {
    const sanitized = sanitizer ? sanitizer(text) : text;
    if (mode === 'mirror') {
      return applyMirrorSterilization(sanitized);
    }
    return sanitized;
  }
}

/** Re-exports from orchestration (consolidated engine entry point) */
export { resetOrchestrationContext } from './orchestration';
export {
  applyBaseCorrection,
  transformPlain,
  tokenizeText,
  detectContextualErrors,
  resolveHomonymByStress,
  detectHomonymsInText,
  diffHighlight,
  orchestrate,
  calculateWeights,
  getActivePattern,
  areWeightsInStandby,
  calculateScenarioWeights,
  escapeHtml,
  applyAccentToWord,
  buildAccentAwareWordRegex,
  stripStressTagsLocal,
  stripAdaptationMarkers,
  ensureMandatoryStress,
} from './orchestration';
export type { TextToken, SemanticSuggestion } from './orchestration';
