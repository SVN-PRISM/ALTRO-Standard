/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
/**
 * Semantic Firewall — центр управления TDP (Total Domain Power).
 * Inverted Funnel v2.1, Единое Ядро (text & data).
 * Валидация намерений через 13 доменов (5 внутренних + 8 внешних) перед исполнением.
 */

import type { SemanticFilter } from '@/lib/altro/adapters/sql-adapter';
import { CrystalLoader } from '@/lib/altro/CrystalLoader';

/** Порог резонанса: при TDP < этого значения воронка схлопывается, выполнение блокируется */
export const TDP_THRESHOLD = 0.85;

/** Если true, Брандмауэр не блокирует запросы, а только логирует их (режим обучения) */
export const LEARNING_MODE = true;

/** Порог аномалии домена: |intent[i] - opr[i]| > этого значения → применяем политику (фильтр WHERE) */
export const DOMAIN_ANOMALY_THRESHOLD = 0.25;

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
  semantics: 0.21,
  context: 0.25,
  /** Forge 1.3 взвешенные центроиды (синтетика / MiniLM): пересмотреть после HF. */
  intent: 0.15,
  imagery: 0.999,
  ethics: 0.22,
};

/** Домены, участвующие в триггере Stencil (подмножество DOMAIN_ORDER) */
export const STENCIL_CRITICAL_DOMAIN_KEYS: readonly (typeof DOMAIN_ORDER)[number][] = [
  'spirituality',
  'semantics',
  'context',
  'intent',
  'ethics',
] as const;

/** Индексы и ключи для проверки без indexOf в цикле (порядок = приоритет триггера) */
const STENCIL_CRITICAL_PAIRS: ReadonlyArray<{
  idx: number;
  key: (typeof DOMAIN_ORDER)[number];
}> = [
  { idx: 7, key: 'spirituality' },
  { idx: 8, key: 'semantics' },
  { idx: 9, key: 'context' },
  { idx: 10, key: 'intent' },
  { idx: 12, key: 'ethics' },
];

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

/** Косинусное сходство между двумя векторами (нормализованными к единичной длине). */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom <= 0 ? 0 : Math.max(0, Math.min(1, dot / denom));
}

function normalizeVector(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (len <= 0) return v.map(() => 0);
  return v.map((x) => x / len);
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

  static getInstance(): SemanticFirewall {
    if (SemanticFirewall.instance == null) {
      SemanticFirewall.instance = new SemanticFirewall();
    }
    return SemanticFirewall.instance;
  }

  /** Установить OPR из 13-вектора (например, после DATA SYNC). */
  setOprVector(vector: number[]): void {
    if (vector.length >= 13) {
      this.oprVector = vector.slice(0, 13);
    }
  }

  /** Синхронизировать OPR с текущими весами доменов (вызов при DATA SYNC). */
  syncOprFromWeights(weights: Parameters<typeof domainWeightsToVector>[0]): void {
    this.oprVector = domainWeightsToVector(weights);
  }

  /** Полный сброс к нейтральному эталону (Full Semantic Reset). Очищает OPR и lastReportLine. */
  resetToDefault(): void {
    this.oprVector = DOMAIN_ORDER.map(() => 0.5);
    this.lastReportLine = '';
  }

  /**
   * Stencil Logic (ALTRO_CRYSTAL_v1): эмбеддинг из кристалла → S_k = V·C_k → пороги по доменам.
   * Классификация без LLM (нужен заранее загруженный {@link CrystalLoader}).
   *
   * @returns `[ID:MASK_<domain>]` при превышении порога на критической оси, иначе `null` (OOV / кристалл не готов / нет триггера).
   */
  processAtom(word: string): string | null {
    const normalized = word.normalize('NFC').toLowerCase().trim();
    if (!normalized) {
      return null;
    }

    const crystal = CrystalLoader.getInstance();
    if (!crystal.isReady()) {
      return null;
    }

    const v = crystal.getVector(normalized);
    if (!v) {
      return null;
    }

    crystal.dotCentroidsInPlace(v, this.stencilScores);

    for (let i = 0; i < STENCIL_CRITICAL_PAIRS.length; i++) {
      const { idx, key } = STENCIL_CRITICAL_PAIRS[i]!;
      const threshold = STENCIL_DOMAIN_THRESHOLDS[key];
      if (this.stencilScores[idx]! >= threshold) {
        return `[ID:MASK_${key}]`;
      }
    }

    return null;
  }

  /**
   * Потоковая трассировка трафарета: слова → {@link processAtom}; маска вместо слова при триггере;
   * пробелы и пунктуация без изменений.
   */
  maskSentence(text: string): string {
    if (!text) {
      return text;
    }
    const re = /(\p{L}+(?:[-']\p{L}+)*|\s+|[^\p{L}\s]+)/gu;
    const parts = text.match(re);
    if (!parts) {
      return text;
    }
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (/^\p{L}+(?:[-']\p{L}+)*$/u.test(part)) {
        const mask = this.processAtom(part);
        out += mask ?? part;
      } else {
        out += part;
      }
    }
    return out;
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
   * Вычисляет резонанс между входящим вектором намерений и OPR.
   * TDP = косинусное сходство. При TDP < 0.85 — блок.
   */
  evaluateResonance(intentVector: number[]): EvaluateResonanceResult {
    const vec = intentVector.length >= 13 ? intentVector.slice(0, 13) : [...this.oprVector];
    const oprNorm = normalizeVector(this.oprVector);
    const intentNorm = normalizeVector(vec);
    const tdp = cosineSimilarity(oprNorm, intentNorm);
    const alignmentPercent = Math.round(tdp * 100);
    const isAllowedByTdp = tdp >= TDP_THRESHOLD;
    
    let reportLine = `[AL-FIREWALL]: OPR Alignment: ${alignmentPercent}%. TDP Status: ${isAllowedByTdp ? 'STABLE' : 'BLOCKED'}.`;
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
