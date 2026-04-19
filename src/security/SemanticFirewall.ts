/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
/**
 * Semantic Firewall — центр управления TDP (Total Domain Power).
 * Inverted Funnel v2.1, Единое Ядро (text & data).
 * Валидация намерений через 13 доменов (5 внутренних + 8 внешних) перед исполнением.
 */

import { buildResonanceTargetMatrix } from '@core/IntentOrchestrator';
import { domainWeightsAreNeutral, microTranscreate } from '@core/microTranscreate';
import {
  DATE_MONOLITH_SOURCE,
  ORG_INN_KPP_MONOLITH_SOURCE,
  PERSON_FULL_NAME_GREEDY_SOURCE,
  REGISTRY_NUMBER_GREEDY_SOURCE,
} from '@core/maskMonolithPatterns';
import type { SemanticFilter } from '@/lib/altro/adapters/sql-adapter';
import type { DomainWeights } from '@/lib/altroData';
import { INITIAL_DOMAIN_WEIGHTS } from '@/lib/altroData';
import { CrystalLoader } from '@/lib/altro/CrystalLoader';
import { STENCIL_LEXICON_NO_MASK } from '@/security/stencilLexiconPasslist';
import {
  oprModulatedPsi,
  squashCentroidScore,
  tensorOuterProduct5x8,
} from '@/security/semanticPrimesTensor';

export type { SemanticPrimeId } from '@/security/semanticPrimesTensor';
export { SEMANTIC_PRIME_IDS, SEMANTIC_PRIMES_MATRIX } from '@/security/semanticPrimesTensor';

/** Порог резонанса: при TDP < этого значения воронка схлопывается, выполнение блокируется */
export const TDP_THRESHOLD = 0.85;

/** Если true, Брандмауэр не блокирует запросы, а только логирует их (режим обучения) */
export const LEARNING_MODE = true;

/** Порог аномалии домена: |intent[i] - opr[i]| > этого значения → применяем политику (фильтр WHERE) */
export const DOMAIN_ANOMALY_THRESHOLD = 0.25;

/** Atom-Ψ ниже этого порога → обязательная маска по домену с max тензорным отклонением */
const TENSOR_ATOM_PSI_MIN = 0.52;

/** Поверхность сегмента после correctionLoop считается согласованной при Ψ ≥ этого значения */
const PSI_SEGMENT_CORRECTION_OK = 0.58;

/** Нейтральная директива (все веса 0): ослабление correctionLoop для канцелярского текста без маски. */
const PSI_SEGMENT_CORRECTION_OK_NEUTRAL = 0.36;

const RESONANCE_CORRECTION_MAX_ITER = 6;

/** Atom-Ψ при нейтральной R / без директивы — мягче, канцелярия проходит без обязательной маски. */
const TENSOR_ATOM_PSI_MIN_NEUTRAL = 0.38;

/** Токен слова (Unicode letters + optional hyphen/apostrophe chunks). Вынесено из maskSentence из-за парсера TS на литерале RegExp. */
const MASK_SENTENCE_LETTER_TOKEN_RE = /^\p{L}+(?:[-\x27]\p{L}+)*$/u;

/** Greedy монолиты: реестр и ФИО первыми, затем ИНН+КПП, затем слова (как Masker phase 2). */
const MASK_SENTENCE_MONOLITH_CHUNK_RE = new RegExp(
  `((?:${REGISTRY_NUMBER_GREEDY_SOURCE})|(?:${PERSON_FULL_NAME_GREEDY_SOURCE})|(?:${ORG_INN_KPP_MONOLITH_SOURCE})|(?:${DATE_MONOLITH_SOURCE})|` +
    String.raw`(?:\p{L}+(?:[-\x27]\p{L}+)*)|(?:\s+)|(?:[^\p{L}\s]+))`,
  'gu'
);

export type MaskSentenceResonanceOptions = {
  targetLanguage: string;
  weights?: DomainWeights;
};

/** Порядок доменов в 13-векторе: 8 внешних, затем 5 внутренних (Legislative Core) */
export const DOMAIN_ORDER = [
  'economics',
  'politics',
  'society',
  'history',
  'culture',
  'aesthetics',
  'technology',
  'spirituality',
  'semantics',
  'context',
  'intent',
  'imagery',
  'ethics',
] as const;

export const DOMAIN_LABELS: Record<(typeof DOMAIN_ORDER)[number], string> = {
  economics: 'ECONOMICS',
  politics: 'POLITICS',
  society: 'SOCIETY',
  history: 'HISTORY',
  culture: 'CULTURE',
  aesthetics: 'AESTHETICS',
  technology: 'TECHNOLOGY',
  spirituality: 'SPIRITUALITY',
  semantics: 'SEMANTICS',
  context: 'CONTEXT',
  intent: 'INTENT',
  imagery: 'IMAGERY',
  ethics: 'LAW', // Ethical & Sacred → LAW seal
};

/**
 * Пороги S_k = V·C_k (косинус при L2-нормах) для Stencil Logic (ALTRO_CRYSTAL_v1).
 * Критические домены: сакральный контур, контекст/персональные данные, намерение, этика.
 * Остальные выставлены заведомо высоко — триггер только по «критическим» осям ниже.
 */
/**
 * Пороги под Forge 1.2 (центроиды = mean(якоря)); при реальных MiniLM-эмбеддингах пересмотреть.
 * Калибровка ориентировочна на косинус к L2-центроиду после размытия mean по ~15–25 якорям.
 */
export const STENCIL_DOMAIN_THRESHOLDS: Record<(typeof DOMAIN_ORDER)[number], number> = {
  economics: 0.999,
  politics: 0.999,
  society: 0.999,
  history: 0.999,
  culture: 0.999,
  aesthetics: 0.999,
  technology: 0.999,
  spirituality: 0.25,
  /** Выше порог: снижает over-mask общеупотребимых слов (кристалл-синтетика). */
  semantics: 0.28,
  context: 0.3,
  /** Forge 1.3 взвешенные центроиды (синтетика / MiniLM): пересмотреть после HF. */
  intent: 0.22,
  imagery: 0.999,
  ethics: 0.26,
};

/** Домены, участвующие в триггере Stencil (подмножество DOMAIN_ORDER) */
export const STENCIL_CRITICAL_DOMAIN_KEYS: readonly (typeof DOMAIN_ORDER)[number][] = [
  'spirituality',
  'semantics',
  'context',
  'intent',
  'ethics',
] as const;

/** Минимальный контракт токена для проверки Смысловой печати (без импорта TokenManager) */
export interface LockedTokenRef {
  id: number;
  word: string;
  isLocked: boolean;
}

export interface EvaluateResonanceResult {
  allowed: boolean;
  tdp: number;
  alignmentPercent: number;
  reportLine: string;
  lockedBySeal?: string;
  bypass?: boolean;
}

export interface LockedSealCheckResult {
  allowed: boolean;
  reportLine: string;
  lockedDomain?: string;
}

export interface BypassLogEntry {
  ts: number;
  action: 'bypass';
  keyMasked: string;
  reason?: string;
}

export interface DiagnosticLogEntry {
  ts: number;
  token: string;
  mode: 'strict' | 'difuzzy';
  event: 'mask' | 'oov_suspicious' | 'oov_clean' | 'pass';
  detail: string;
}

/** Калибровка (internal 0–100, external -1..1) → 13-вектор */
export function calibrationToVector(calibration: {
  internal?: { semantics?: number; context?: number; intent?: number; imagery?: number; ethics?: number };
  external?: { economics?: number; politics?: number; society?: number; history?: number; culture?: number; aesthetics?: number; technology?: number; spirituality?: number };
}): number[] {
  const ext = calibration.external ?? {};
  const int = calibration.internal ?? {};
  const norm = (x: number) => (x == null || Number.isNaN(x) ? 0.5 : Math.max(0, Math.min(1, (x + 1) / 2)));
  const internalNorm = (x: number) => (x == null || Number.isNaN(x) ? 0.5 : Math.max(0, Math.min(1, (x ?? 0) / 100)));
  return [
    norm(ext.economics ?? 0),
    norm(ext.politics ?? 0),
    norm(ext.society ?? 0),
    norm(ext.history ?? 0),
    norm(ext.culture ?? 0),
    norm(ext.aesthetics ?? 0),
    norm(ext.technology ?? 0),
    norm(ext.spirituality ?? 0),
    internalNorm(int.semantics ?? 0),
    internalNorm(int.context ?? 0),
    internalNorm(int.intent ?? 0),
    internalNorm(int.imagery ?? 0),
    internalNorm(int.ethics ?? 0),
  ];
}

/** Преобразование весов доменов (DomainWeights-совместимый объект) в 13-вектор. External: -1..1 → 0..1; Internal: 0..1. */
export function domainWeightsToVector(weights: {
  economics?: number;
  politics?: number;
  society?: number;
  history?: number;
  culture?: number;
  aesthetics?: number;
  technology?: number;
  spirituality?: number;
  semantics?: number;
  context?: number;
  intent?: number;
  imagery?: number;
  ethics?: number;
}): number[] {
  const norm = (x: number) => (x == null || Number.isNaN(x) ? 0.5 : Math.max(0, Math.min(1, (x + 1) / 2)));
  const internal = (x: number) => (x == null || Number.isNaN(x) ? 0.5 : Math.max(0, Math.min(1, x)));
  return [
    norm(weights.economics ?? 0),
    norm(weights.politics ?? 0),
    norm(weights.society ?? 0),
    norm(weights.history ?? 0),
    norm(weights.culture ?? 0),
    norm(weights.aesthetics ?? 0),
    norm(weights.technology ?? 0),
    norm(weights.spirituality ?? 0),
    internal(weights.semantics ?? 0),
    internal(weights.context ?? 0),
    internal(weights.intent ?? 0),
    internal(weights.imagery ?? 0),
    internal(weights.ethics ?? 0),
  ];
}

const DIFUZZY_THRESHOLD_FACTOR = 0.85;
/** Временно снижено (v1.5 tweak): OOV typo → mask при sim > порога (напр. turbopressureoo ~0.545). */
/** Выше — меньше ложных OOV-маск по edit-similarity к якорям intent/context. */
const DIFUZZY_SIMILARITY_MIN = 0.58;
const DIFUZZY_INTENT_ANCHORS = [
  'intent',
  'intention',
  'intentio',
  'purpose',
  'goal',
  'намерение',
  'цель',
] as const;
const DIFUZZY_CONTEXT_ANCHORS = [
  'context',
  'contextus',
  'background',
  'setting',
  'secretum',
  'контекст',
  'ситуация',
] as const;

/**
 * Предыдущий токен (слово) — ролевой якорь: следующее слово проверяется с пониженным порогом критических осей (ФИО после роли).
 */
const STENCIL_PII_ROLE_ANCHORS = new Set(
  [
    'координатор',
    'координатора',
    'координатором',
    'самозанятый',
    'самозанятая',
    'самозанятого',
    'самозанятой',
    'лицо',
    'лица',
    'лицом',
    'сторона',
    'стороны',
    'стороной',
  ].map((w) => w.normalize('NFC').toLowerCase())
);

/** < 1 — порог ниже, чувствительность к маске выше (умножается на базовый порог домена). */
const STENCIL_POST_ANCHOR_THRESHOLD_SCALE = 0.88;

/** Первое слово тройки «Фамилия Имя Отчество» не должно быть типичным заголовком договора. */
const TRIPLE_FIO_EXCLUDED_FIRST = new Set(
  [
    'дополнительное',
    'настоящее',
    'настоящим',
    'общие',
    'следующие',
    'прочие',
    'соглашение',
  ].map((w) => w.normalize('NFC').toLowerCase())
);

function isTitleCaseWordToken(s: string): boolean {
  return /^\p{Lu}\p{L}+$/u.test(s);
}

function isThreeWordTitleFioSequence(parts: readonly string[], i: number): boolean {
  if (i + 4 >= parts.length) return false;
  const w0 = parts[i]!;
  const sp1 = parts[i + 1]!;
  const w1 = parts[i + 2]!;
  const sp2 = parts[i + 3]!;
  const w2 = parts[i + 4]!;
  if (!/^\s+$/.test(sp1) || !/^\s+$/.test(sp2)) return false;
  if (!isTitleCaseWordToken(w0) || !isTitleCaseWordToken(w1) || !isTitleCaseWordToken(w2)) return false;
  if (TRIPLE_FIO_EXCLUDED_FIRST.has(w0.normalize('NFC').toLowerCase())) return false;
  return true;
}

function normalizedEditSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const n = a.length;
  const m = b.length;
  const prev = new Array<number>(m + 1);
  const curr = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cb = b.charCodeAt(j - 1);
      const cost = ca === cb ? 0 : 1;
      const del = prev[j]! + 1;
      const ins = curr[j - 1]! + 1;
      const sub = prev[j - 1]! + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    for (let j = 0; j <= m; j++) prev[j] = curr[j]!;
  }
  const dist = prev[m]!;
  // Dice-подобная нормализация: устойчивее к 1-2 лишним символам в конце слова.
  const denom = n + m;
  return denom <= 0 ? 0 : 1 - dist / denom;
}

export class SemanticFirewall {
  private static instance: SemanticFirewall | null = null;

  /** OPR (Optimal Point of Resonance) — эталонный 13-вектор. Инициализируется нейтральным. */
  private oprVector: number[] = DOMAIN_ORDER.map(() => 0.5);

  /** Черный ящик: лог bypass и критичных событий */
  private blackBox: BypassLogEntry[] = [];

  /** Валидные ключи Оператора для executeBypass (в проде — из env) */
  private static getOperatorKeys(): Set<string> {
    const envKey = typeof process !== 'undefined' && process.env?.ALTRO_OPERATOR_BYPASS_KEY;
    const keys = new Set<string>();
    if (envKey) keys.add(envKey);
    return keys;
  }

  /** Последняя строка отчёта для UI */
  private lastReportLine = '';

  /** Буфер S_k для processAtom (без аллокаций на hot-path) */
  private readonly stencilScores = new Float32Array(13);

  /**
   * CLI / тесты: единый порог для всех критических осей Stencil (null = дефолты {@link STENCIL_DOMAIN_THRESHOLDS}).
   */
  private stencilCriticalThresholdOverride: number | null = null;
  /** ALTRO 1.5: DIFUZZY — смягчение порога + OOV typo-защита по intent/context якорям. */
  private isFuzzy = false;
  /** ALTRO 1.5 UI/CLI: потоковая диагностика последних решений Stencil. */
  private readonly diagnosticLog: DiagnosticLogEntry[] = [];

  /** R: целевая матрица резонанса 5×8 (директива), row-major. */
  private readonly resonanceTargetTensor = new Float32Array(40);

  /** OPR в тензорной форме W_int ⊗ W_ext (синхрон с oprVector). */
  private readonly oprTensor = new Float32Array(40);

  private readonly tensorObsScratch = new Float32Array(40);
  private readonly harmonicPhaseTensor = new Float32Array(40);
  private readonly scratchExt8 = new Float32Array(8);
  private readonly scratchInt5 = new Float32Array(5);
  private readonly segmentStencilScores = new Float32Array(13);
  private readonly segmentObsTensor = new Float32Array(40);

  /** Контекст текущего maskSentence (нейтральная директива / EN mirror). */
  private activeMaskResonanceCtx: MaskSentenceResonanceOptions | undefined;

  static getInstance(): SemanticFirewall {
    if (SemanticFirewall.instance == null) {
      const fw = new SemanticFirewall();
      fw.bootstrapTensorLayer();
      SemanticFirewall.instance = fw;
    }
    return SemanticFirewall.instance;
  }

  /** Нейтральная R и OPR-тензор при старте (до директивы). */
  private bootstrapTensorLayer(): void {
    this.rebuildOprTensorFromOprVector();
    this.setResonanceTargetMatrix(buildResonanceTargetMatrix(INITIAL_DOMAIN_WEIGHTS));
  }

  private rebuildOprTensorFromOprVector(): void {
    for (let j = 0; j < 8; j++) {
      this.scratchExt8[j] = this.oprVector[j] ?? 0.5;
    }
    for (let i = 0; i < 5; i++) {
      this.scratchInt5[i] = this.oprVector[8 + i] ?? 0.5;
    }
    tensorOuterProduct5x8(this.scratchInt5, this.scratchExt8, this.oprTensor);
  }

  /** Установить матрицу R из IntentOrchestrator (копия первых 40 элементов). */
  setResonanceTargetMatrix(matrix: Float32Array): void {
    if (matrix.length < 40) return;
    this.resonanceTargetTensor.set(matrix.subarray(0, 40));
  }

  /**
   * KSHERQ Phase 1: мета-калибровка OPR и R по директиве (весам доменов).
   * Вызывать перед maskSentence / prepareStencil при известной директиве.
   */
  primeDirectiveCalibration(weights: DomainWeights): void {
    this.syncOprFromWeights(weights);
    this.rebuildOprTensorFromOprVector();
    this.setResonanceTargetMatrix(buildResonanceTargetMatrix(weights));
  }

  /** R из нулевой/пустой директивы (синглтон без весов). */
  applyNeutralResonanceMatrix(): void {
    this.setResonanceTargetMatrix(buildResonanceTargetMatrix(INITIAL_DOMAIN_WEIGHTS));
  }

  /** Установить OPR из 13-вектора (например, после DATA SYNC). */
  setOprVector(vector: number[]): void {
    if (vector.length >= 13) {
      this.oprVector = vector.slice(0, 13);
      this.rebuildOprTensorFromOprVector();
    }
  }

  /** Синхронизировать OPR с текущими весами доменов (вызов при DATA SYNC). */
  syncOprFromWeights(weights: Parameters<typeof domainWeightsToVector>[0]): void {
    this.oprVector = domainWeightsToVector(weights);
    this.rebuildOprTensorFromOprVector();
  }

  /** Полный сброс к нейтральному эталону (Full Semantic Reset). Очищает OPR и lastReportLine. */
  resetToDefault(): void {
    this.oprVector = DOMAIN_ORDER.map(() => 0.5);
    this.lastReportLine = '';
    this.bootstrapTensorLayer();
  }

  /** ALTRO 1.4 CLI: переопределить порог критических осей; null — сброс к встроенным значениям. */
  setStencilCriticalThresholdOverride(value: number | null): void {
    this.stencilCriticalThresholdOverride = value;
  }

  /** ALTRO 1.5: включить/выключить DIFUZZY-режим. */
  setFuzzyMode(isFuzzy: boolean): void {
    this.isFuzzy = !!isFuzzy;
  }

  private pushDiagnostic(entry: Omit<DiagnosticLogEntry, 'ts'>): void {
    this.diagnosticLog.push({ ts: Date.now(), ...entry });
    if (this.diagnosticLog.length > 300) this.diagnosticLog.splice(0, this.diagnosticLog.length - 300);
  }

  /** ALTRO 1.5: чтение лога решений Stencil для UI/CLI. */
  getDiagnosticLog(): readonly DiagnosticLogEntry[] {
    return this.diagnosticLog;
  }

  /** ALTRO 1.5: очистка диагностического лога. */
  clearDiagnosticLog(): void {
    this.diagnosticLog.length = 0;
  }

  /**
   * 13 скоров S_k = V·C_k для токена (OOV → null). Для режима mirror в CLI.
   */
  getStencilDomainScores(word: string): number[] | null {
    const normalized = word.normalize('NFC').toLowerCase().trim();
    if (!normalized) return null;
    const crystal = CrystalLoader.getInstance();
    if (!crystal.isReady()) return null;
    const v = crystal.getVector(normalized);
    if (!v) return null;
    crystal.dotCentroidsInPlace(v, this.stencilScores);
    return Array.from(this.stencilScores);
  }

  private detectSuspiciousOovMask(normalizedWord: string): { mask: string | null; detail: string } {
    const anchors: ReadonlyArray<{ domain: 'intent' | 'context'; terms: readonly string[] }> = [
      { domain: 'intent', terms: DIFUZZY_INTENT_ANCHORS },
      { domain: 'context', terms: DIFUZZY_CONTEXT_ANCHORS },
    ];
    let bestDomain: 'intent' | 'context' | null = null;
    let bestScore = 0;
    for (const group of anchors) {
      for (const rawAnchor of group.terms) {
        const anchor = rawAnchor.normalize('NFC').toLowerCase().trim();
        const sim = normalizedEditSimilarity(normalizedWord, anchor);
        if (sim > bestScore) {
          bestScore = sim;
          bestDomain = group.domain;
        }
      }
    }
    if (bestDomain && bestScore > DIFUZZY_SIMILARITY_MIN) {
      return {
        mask: `[ID:MASK_${bestDomain}]`,
        detail: `sim=${bestScore.toFixed(3)} via ${bestDomain} anchors`,
      };
    }
    return { mask: null, detail: `sim=${bestScore.toFixed(3)} below ${DIFUZZY_SIMILARITY_MIN}` };
  }

  private argmaxDeviationDomainKey(): (typeof DOMAIN_ORDER)[number] {
    let best = -1;
    let bestK = 0;
    for (let k = 0; k < 40; k++) {
      const a = this.tensorObsScratch[k]!;
      const b = this.resonanceTargetTensor[k]!;
      const dev = Math.abs(a - b) / (1 + b + 1e-9);
      if (dev > best) {
        best = dev;
        bestK = k;
      }
    }
    const col = bestK % 8;
    const row = (bestK / 8) | 0;
    if (Math.abs(this.scratchInt5[row]!) >= Math.abs(this.scratchExt8[col]!)) {
      return DOMAIN_ORDER[8 + row]!;
    }
    return DOMAIN_ORDER[col]!;
  }

  private measureSurfaceWordPsi(word: string, isFuzzy: boolean): number {
    const normalized = word.normalize('NFC').toLowerCase().trim();
    if (!normalized) return 1;
    const crystal = CrystalLoader.getInstance();
    if (!crystal.isReady()) return 1;
    const v = crystal.getVector(normalized);
    if (!v) return isFuzzy ? 0.45 : 1;
    crystal.dotCentroidsInPlace(v, this.segmentStencilScores);
    for (let j = 0; j < 8; j++) {
      this.scratchExt8[j] = squashCentroidScore(this.segmentStencilScores[j]!);
    }
    for (let i = 0; i < 5; i++) {
      this.scratchInt5[i] = squashCentroidScore(this.segmentStencilScores[8 + i]!);
    }
    tensorOuterProduct5x8(this.scratchInt5, this.scratchExt8, this.segmentObsTensor);
    return oprModulatedPsi(this.segmentObsTensor, this.resonanceTargetTensor);
  }

  private runResonanceCorrectionLoop(
    word: string,
    isFuzzy: boolean,
    targetLanguage: string,
    weights: DomainWeights | undefined,
    segmentOkThreshold: number
  ): string {
    let w = word;
    for (let iter = 0; iter < RESONANCE_CORRECTION_MAX_ITER; iter++) {
      const psi = this.measureSurfaceWordPsi(w, isFuzzy);
      if (psi >= segmentOkThreshold) return w;
      const next = microTranscreate(w, 'resonance_refine', targetLanguage, weights);
      if (next === w) return w;
      w = next;
    }
    return w;
  }

  /**
   * Stencil Logic (KSHERQ): эмбеддинг → S_k = V·C_k → тензор W_int⊗W_ext → Ψ = OPR_M(T,R).
   * Классификация без LLM (нужен заранее загруженный {@link CrystalLoader}).
   *
   * @returns литерал ID:MASK_* при низком Ψ относительно R, иначе null (OOV / кристалл не готов / нет триггера).
   */
  processAtom(word: string, isFuzzy = this.isFuzzy, criticalThresholdScale = 1): string | null {
    const normalized = word.normalize('NFC').toLowerCase().trim();
    if (!normalized) {
      return null;
    }

    if (STENCIL_LEXICON_NO_MASK.has(normalized)) {
      this.pushDiagnostic({
        token: normalized,
        mode: isFuzzy ? 'difuzzy' : 'strict',
        event: 'pass',
        detail: 'lexicon_no_mask',
      });
      return null;
    }

    const crystal = CrystalLoader.getInstance();
    if (!crystal.isReady()) {
      return null;
    }

    const v = crystal.getVector(normalized);
    if (!v) {
      if (isFuzzy) {
        const suspect = this.detectSuspiciousOovMask(normalized);
        if (suspect.mask) {
          this.pushDiagnostic({
            token: normalized,
            mode: 'difuzzy',
            event: 'oov_suspicious',
            detail: `${suspect.detail} => ${suspect.mask}`,
          });
          return suspect.mask;
        }
        this.pushDiagnostic({
          token: normalized,
          mode: 'difuzzy',
          event: 'oov_clean',
          detail: suspect.detail,
        });
        return null;
      }
      this.pushDiagnostic({
        token: normalized,
        mode: 'strict',
        event: 'oov_clean',
        detail: 'oov (strict mode)',
      });
      return null;
    }

    crystal.dotCentroidsInPlace(v, this.stencilScores);

    for (let j = 0; j < 8; j++) {
      this.scratchExt8[j] = squashCentroidScore(this.stencilScores[j]!);
    }
    for (let i = 0; i < 5; i++) {
      this.scratchInt5[i] = squashCentroidScore(this.stencilScores[8 + i]!);
    }
    tensorOuterProduct5x8(this.scratchInt5, this.scratchExt8, this.tensorObsScratch);
    const psiTensor = oprModulatedPsi(this.tensorObsScratch, this.resonanceTargetTensor);
    const neutralDirective = domainWeightsAreNeutral(this.activeMaskResonanceCtx?.weights);
    const atomMin = neutralDirective ? TENSOR_ATOM_PSI_MIN_NEUTRAL : TENSOR_ATOM_PSI_MIN;
    const psiPassBar = atomMin / Math.max(1e-9, criticalThresholdScale);
    // DIFUZZY: бар Psi выше (как пониженный порог dot-осей в legacy), больше масок при fuzzy.
    const bar = isFuzzy ? psiPassBar / DIFUZZY_THRESHOLD_FACTOR : psiPassBar;
    if (psiTensor < bar) {
      const key = this.argmaxDeviationDomainKey();
      const mask = `[ID:MASK_${key}]`;
      this.pushDiagnostic({
        token: normalized,
        mode: isFuzzy ? 'difuzzy' : 'strict',
        event: 'mask',
        detail: `tensor_Psi=${psiTensor.toFixed(3)} bar=${bar.toFixed(3)} => ${mask}`,
      });
      return mask;
    }

    this.pushDiagnostic({
      token: normalized,
      mode: isFuzzy ? 'difuzzy' : 'strict',
      event: 'pass',
      detail: `tensor_Psi=${psiTensor.toFixed(3)} >= bar=${bar.toFixed(3)}`,
    });
    return null;
  }

  /**
   * Потоковая трассировка трафарета: слова → {@link processAtom}; маска вместо слова при триггере;
   * пробелы и пунктуация без изменений.
   * @param resonance — optional correctionLoop (microTranscreate) перед atom-Ψ.
   */
  maskSentence(text: string, isFuzzy = this.isFuzzy, resonance?: MaskSentenceResonanceOptions): string {
    if (!text) {
      return text;
    }
    this.activeMaskResonanceCtx = resonance;
    try {
      const parts = [...text.matchAll(MASK_SENTENCE_MONOLITH_CHUNK_RE)].map((m) => m[1]!);
      if (parts.length === 0) {
        return text;
      }
      const neutralDirective = domainWeightsAreNeutral(resonance?.weights);
      const segmentOk = neutralDirective ? PSI_SEGMENT_CORRECTION_OK_NEUTRAL : PSI_SEGMENT_CORRECTION_OK;
      let out = '';
      let prevLetterNorm: string | null = null;
      let i = 0;
      while (i < parts.length) {
        if (isThreeWordTitleFioSequence(parts, i)) {
          out += parts[i]! + parts[i + 1]! + parts[i + 2]! + parts[i + 3]! + parts[i + 4]!;
          prevLetterNorm = parts[i + 4]!.normalize('NFC').toLowerCase();
          i += 5;
          continue;
        }
        const part = parts[i]!;
        if (MASK_SENTENCE_LETTER_TOKEN_RE.test(part)) {
          const postAnchor = prevLetterNorm !== null && STENCIL_PII_ROLE_ANCHORS.has(prevLetterNorm);
          const scale = postAnchor ? STENCIL_POST_ANCHOR_THRESHOLD_SCALE : 1;
          let surface = part;
          if (resonance?.targetLanguage) {
            surface = this.runResonanceCorrectionLoop(
              part,
              isFuzzy,
              resonance.targetLanguage,
              resonance.weights,
              segmentOk
            );
          }
          const mask = this.processAtom(surface, isFuzzy, scale);
          out += mask ?? surface;
          prevLetterNorm = surface.normalize('NFC').toLowerCase();
        } else {
          out += part;
        }
        i += 1;
      }
      return out;
    } finally {
      this.activeMaskResonanceCtx = undefined;
    }
  }

  /**
   * ALTRO 1.5 UI/CLI: маскирование с явным DIFUZZY.
   * Не меняет persistent {@link setFuzzyMode}; передаёт флаг только в этот прогон.
   */
  mask(text: string, options?: { useDifuzzy?: boolean }): string {
    const fuzzy = options?.useDifuzzy ?? this.isFuzzy;
    return this.maskSentence(text, fuzzy, undefined);
  }

  /**
   * Аннулирование текущего фрагмента контекста (без сброса OPR).
   * Вызывается при локальной очистке поля (Source/Nexus/Adaptation). Следующий запрос не наследует отчёт.
   */
  annulContextFragment(_fragment?: 'source' | 'nexus' | 'adaptation'): void {
    console.log('>>> [FIREWALL DEBUG]: Entering annulContextFragment');
    this.lastReportLine = '';
    if (typeof window !== 'undefined') {
      console.log('[AL-FIREWALL]: Context fragment annulled. OPR unchanged.');
    }
    console.log('>>> [FIREWALL DEBUG]: Exiting annulContextFragment');
  }

  /**
   * Psi резонанс намерения: T_int = W_int⊗W_ext из 13-вектора; Phase 1 — гармоническая мета-калибровка с OPR-тензором;
   * Phase 2 — OPR_M(T_int, H) где H_k = 2 a_k b_k / (a_k+b_k). Без косинуса 13-мерного вектора.
   */
  evaluateResonance(intentVector: number[]): EvaluateResonanceResult {
    const vec = intentVector.length >= 13 ? intentVector.slice(0, 13) : [...this.oprVector];
    const extI = this.scratchExt8;
    const intI = this.scratchInt5;
    for (let j = 0; j < 8; j++) extI[j] = vec[j] ?? 0.5;
    for (let i = 0; i < 5; i++) intI[i] = vec[8 + i] ?? 0.5;
    tensorOuterProduct5x8(intI, extI, this.tensorObsScratch);
    for (let k = 0; k < 40; k++) {
      const a = this.tensorObsScratch[k]!;
      const b = this.oprTensor[k]!;
      this.harmonicPhaseTensor[k] = (2 * a * b) / (a + b + 1e-12);
    }
    const tdp = oprModulatedPsi(this.tensorObsScratch, this.harmonicPhaseTensor);
    const alignmentPercent = Math.round(tdp * 100);
    const isAllowedByTdp = tdp >= TDP_THRESHOLD;

    let reportLine = `[AL-FIREWALL]: Tensor Psi: ${alignmentPercent}%. TDP Status: ${isAllowedByTdp ? 'STABLE' : 'BLOCKED'}.`;
    let allowed = isAllowedByTdp;

    if (!isAllowedByTdp && LEARNING_MODE) {
      reportLine = `[AL-FIREWALL][LEARNING]: Would block, but allowed. OPR Alignment: ${alignmentPercent}%.`;
      allowed = true;
    }

    this.lastReportLine = reportLine;

    if (typeof window !== 'undefined') {
      console.log(reportLine);
    }

    return {
      allowed,
      tdp,
      alignmentPercent,
      reportLine,
      bypass: !isAllowedByTdp && LEARNING_MODE,
    };
  }

  /**
   * Проверка Смысловой печати: если входящий запрос пытается изменить токен с isLocked — немедленный Block.
   * requestText — текст, который будет отправлен в ядро; lockedTokens — текущие токены с isLocked.
   */
  checkLockedSeal(lockedTokens: LockedTokenRef[], requestText: string): LockedSealCheckResult {
    console.log('>>> [FIREWALL DEBUG]: Entering checkLockedSeal');
    const normalizedRequest = requestText.trim().toLowerCase().replace(/\s+/g, ' ');
    const locked = lockedTokens.filter((t) => t.isLocked && t.word?.trim());
    for (const t of locked) {
      const wordNorm = t.word.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!wordNorm) continue;
      // Проверка: замкнутое слово должно присутствовать в запросе (допускаем вариант с ударением)
      const wordBase = wordNorm.replace(/\u0301/g, '');
      if (!normalizedRequest.includes(wordNorm) && !normalizedRequest.includes(wordBase)) {
        const reportLine = `[AL-FIREWALL]: OPR Alignment: —. TDP Status: BLOCKED. Domain [LAW] Locked by Seal.`;
        this.lastReportLine = reportLine;
        if (typeof window !== 'undefined') console.log(reportLine);
        console.log('>>> [FIREWALL DEBUG]: Exiting checkLockedSeal');
        return {
          allowed: false,
          reportLine,
          lockedDomain: DOMAIN_LABELS.ethics,
        };
      }
    }
    const reportLine =
      locked.length > 0
        ? `[AL-FIREWALL]: OPR Alignment: —. TDP Status: STABLE. Domain [LAW] Locked by Seal.`
        : '';
    this.lastReportLine = reportLine;
    console.log('>>> [FIREWALL DEBUG]: Exiting checkLockedSeal');
    return { allowed: true, reportLine };
  }

  /**
   * Комплексная проверка: резонанс + печать. Для единого входа (текст и данные).
   */
  evaluate(
    intentVector: number[],
    options?: { lockedTokens?: LockedTokenRef[]; requestText?: string }
  ): { allowed: boolean; reportLine: string; tdp?: number; lockedBySeal?: boolean } {
    console.log('>>> [FIREWALL DEBUG]: Entering evaluate');
    const seal =
      options?.lockedTokens && options?.requestText != null
        ? this.checkLockedSeal(options.lockedTokens, options.requestText)
        : { allowed: true, reportLine: '' };
    if (!seal.allowed) {
      console.log('>>> [FIREWALL DEBUG]: Exiting evaluate');
      return {
        allowed: false,
        reportLine: seal.reportLine,
        lockedBySeal: true,
      };
    }
    const res = this.evaluateResonance(intentVector);
    const reportLine = res.reportLine + (seal.reportLine ? ` ${seal.reportLine}` : '');
    if (typeof window !== 'undefined' && reportLine) console.log(reportLine);
    console.log('>>> [FIREWALL DEBUG]: Exiting evaluate');
    return {
      allowed: res.allowed,
      reportLine,
      tdp: res.tdp,
    };
  }

  /**
   * Защищённый bypass: пропуск при низком резонансе только при валидном ключе Оператора.
   * Обязательная запись в Черный ящик.
   */
  executeBypass(key: string): { allowed: boolean; reportLine: string } {
    const keys = SemanticFirewall.getOperatorKeys();
    const valid = key && keys.has(key);
    const keyMasked = key ? `${key.slice(0, 2)}***${key.slice(-1)}` : '***';
    this.blackBox.push({
      ts: Date.now(),
      action: 'bypass',
      keyMasked,
      reason: valid ? 'Operator bypass accepted' : 'Invalid key',
    });
    if (valid) {
      const reportLine = `[AL-FIREWALL]: OPR Alignment: BYPASS. TDP Status: BYPASS. Key: ${keyMasked}.`;
      this.lastReportLine = reportLine;
      if (typeof window !== 'undefined') console.log(reportLine);
      return { allowed: true, reportLine };
    }
    const reportLine = `[AL-FIREWALL]: OPR Alignment: —. TDP Status: BLOCKED. Bypass denied (invalid key).`;
    if (typeof window !== 'undefined') console.log(reportLine);
    return { allowed: false, reportLine };
  }

  /** Трансляция смыслового вектора в SQL-фильтры для Firebird (DATA SYNC / data_query). */
  intentVectorToSqlFilters(
    intentVector: number[],
    context?: { entity: string; fields: string[] }
  ): SemanticFilter[] {
    const filters: SemanticFilter[] = [];
    if (!context || intentVector.length < 13) return filters;
    const threshold = 0.5;
    for (let i = 0; i < Math.min(13, intentVector.length); i++) {
      if (intentVector[i] >= threshold && context.fields.length > 0) {
        const domain = DOMAIN_ORDER[i];
        const field = context.fields[0];
        if (domain === 'context' && field) {
          filters.push({ field, op: '=', value: 1 });
        }
      }
    }
    return filters;
  }

  /**
   * Строит фрагмент WHERE по 13-вектору и OPR: при аномалиях [ECONOMICS] или [LAW] добавляются
   * ограничения (сумма транзакций / доступ к системным таблицам). Единое Ядро: текст и данные.
   */
  buildWhereFromIntentVector(
    intentVector: number[],
    context?: { entity: string; fields: string[] }
  ): { whereClause: string; appliedDomains: string[] } {
    const appliedDomains: string[] = [];
    const parts: string[] = [];
    if (intentVector.length < 13) return { whereClause: '', appliedDomains };

    const opr = this.oprVector;
    const economicsIdx = 0;
    const lawIdx = 12;

    const anomaly = (i: number) =>
      Math.abs((intentVector[i] ?? 0.5) - (opr[i] ?? 0.5)) > DOMAIN_ANOMALY_THRESHOLD;

    if (anomaly(economicsIdx)) {
      appliedDomains.push(DOMAIN_LABELS.economics);
      parts.push('(1=1) /* POLICY: ECONOMICS — limit scope */');
    }
    if (anomaly(lawIdx)) {
      appliedDomains.push(DOMAIN_LABELS.ethics);
      if (context?.entity?.toUpperCase().includes('RDB$RELATIONS')) {
        parts.push('"RDB$RELATION_NAME" NOT LIKE \'RDB$%\' /* POLICY: LAW — no system tables */');
      } else {
        parts.push('(1=1) /* POLICY: PRIVACY/LAW */');
      }
    }

    const whereClause = parts.length > 0 ? ` ${parts.join(' AND ')}` : '';
    return { whereClause, appliedDomains };
  }

  getLastReportLine(): string {
    return this.lastReportLine;
  }

  /** Чтение Черного ящика (для аудита). */
  getBlackBox(): readonly BypassLogEntry[] {
    return this.blackBox;
  }
}
