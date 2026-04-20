/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import type { DomainWeights } from '@/lib/altroData';
import { ALTRO_DEBUG_MODE } from '@/lib/constants';
import type { DataVault } from './DataVault';
import {
  getMaskerUnitPatternSpecs,
  NUMERIC_MAGNET_BODY_SOURCE,
  resolveUnitIdFromCapture,
  resolveUnitMagnetDisambiguation,
} from './dictionaries/UnitRegistry';
import {
  blankRangesInText,
  collectFormulaMagnetSpans as collectFormulaMagnetSpansCore,
  FORMULA_BRACKET,
  FORMULA_LATEX_DISPLAY,
  FORMULA_LATEX_INLINE,
  FORMULA_PAREN,
  mergeSpansRaw,
  spanOverlaps,
  textPrefixHex,
} from './formulaMagnet';
import {
  getMicroTranscreateStats,
  microTranscreate,
  microTranscreateBatch,
  type MicroTranscreateContext,
  type MicroTranscreateSegment,
  resetMicroTranscreateSession,
} from './microTranscreate';
import {
  DATE_MONOLITH_SOURCE,
  isPersonFullNameCandidate,
  KPP_RU_STANDALONE_SOURCE,
  ORG_INN_KPP_MONOLITH_SOURCE,
  ORGANIZATION_ROLE_SOURCE,
  ORGANIZATION_ROLE_QUOTED_SOURCE,
  PERSON_FULL_NAME_GREEDY_SOURCE,
  REGISTRY_NUMBER_GREEDY_SOURCE,
} from './maskMonolithPatterns';

const FORMULA_LOGICAL = String.raw`(?:[a-zA-Z\d]+\s*[=≈≠><≥≤]\s*[a-zA-Z\d\s.%+\-]+)`;

/**
 * KPI Magnet: мост якорь→число — любые символы кроме цифр (пробелы, тире, en/em dash, пунктуация);
 * пересечение с unit решает merge по длине (напр. «1.2 MW» длиннее «1.2»).
 */
const KPI_LEXEMES = String.raw`(?:ROI|Margin|Коэффициент|Эффективность|Հզորություն)`;
/** Мост якорь→число: не-цифры (пробелы, дефисы/en–em dash, знаки препинания, буквы). */
const KPI_BRIDGE = String.raw`[^\d]{0,240}`;
const KPI_METRIC_BODY = String.raw`(?<=${KPI_LEXEMES}${KPI_BRIDGE})${NUMERIC_MAGNET_BODY_SOURCE}(?:\s*%)?`;

/**
 * generic_number: базовая граница ИЛИ десятичное после буквы (рус./лат. слово без пробела перед 1.85).
 */
const GENERIC_NUM_DECIMAL_AFTER_LETTER = String.raw`(?<=[\p{L}])(?=\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+))`;
const GENERIC_NUMBER_BODY = String.raw`(?:(?<![\p{L}\p{N}_\p{Sc}])|${GENERIC_NUM_DECIMAL_AFTER_LETTER})${NUMERIC_MAGNET_BODY_SOURCE}(?![\p{L}\p{N}_\p{Sc}])`;

/** Символы и коды валют: $ € £ ¥ ₽ USD EUR GBP RUB */
const CURRENCY_SYMBOLS = '(?:\\$|€|£|¥|₽|USD|EUR|GBP|RUB)';

/** Magnitude: без одиночного `m` (конфликт с метрами в Unit Magnet). */
const MAGNITUDE = '(?:billion|million|trillion|bn|bln|mn|mln|млрд|млн|трлн)';

/** Дробная часть: точка или запятой как десятичный разделитель (1.5 / 1,5). */
const DECIMAL_FRAC = '(?:[.,]\\d+)?';

/**
 * Остальные магниты — сканируют текст только после Formula-Magnet (двухфазно: формулы вычитаются из пересечений).
 * Display/inline LaTeX не входят в этот массив.
 */
/**
 * Юрлицо: ООО/ИП/ЗАО/АО/ПАО + название в «ёлочках» или ASCII-кавычках.
 * Пример: ООО «Вектор-М».
 */
const ORGANIZATION_NAME_SOURCE = String.raw`(?:^|(?<![\p{L}\p{N}_]))(?:ООО|ИП|ЗАО|АО|ПАО)\s+(?:«[^»]+»|"[^"]+")(?![\p{L}\p{N}_])`;

export type MaskerSecondarySpec = {
  source: string;
  flags: string;
  type: string;
  patternName: string;
};

/** Реестр — отдельная фаза 2a-0: матчится и выжигается до остальных монолитов и до `generic_number`. */
export const PRIORITY_REGISTRY_MONOLITH_SPECS: ReadonlyArray<MaskerSecondarySpec> = [
  {
    source: REGISTRY_NUMBER_GREEDY_SOURCE,
    flags: 'gu',
    type: 'registry_number',
    patternName: 'registry_number',
  },
];

/** ФИО / ИНН-КПП / дата-словом — после выжигания реестра. */
export const PRIORITY_MONOLITHS_NON_REGISTRY: ReadonlyArray<MaskerSecondarySpec> = [
  {
    source: PERSON_FULL_NAME_GREEDY_SOURCE,
    flags: 'gu',
    type: 'person_full_name',
    patternName: 'person_full_name',
  },
  {
    source: ORG_INN_KPP_MONOLITH_SOURCE,
    flags: 'gu',
    type: 'org_tax_monolith',
    patternName: 'org_inn_kpp_monolith',
  },
  {
    source: DATE_MONOLITH_SOURCE,
    flags: 'gu',
    type: 'date_monolith',
    patternName: 'date_ru_monolith',
  },
];

/** Полный порядок монолитов (UI / логи): реестр первым. */
export const PRIORITY_MONOLITHS: ReadonlyArray<MaskerSecondarySpec> = [
  ...PRIORITY_REGISTRY_MONOLITH_SPECS,
  ...PRIORITY_MONOLITHS_NON_REGISTRY,
];

/** Фаза 2b: всё после монолитов (те же правила, что раньше шли после ИНН/КПП в одном списке). */
export const MASKER_SECONDARY_REST_SPECS: ReadonlyArray<MaskerSecondarySpec> = [
  {
    source: KPP_RU_STANDALONE_SOURCE,
    flags: 'gu',
    type: 'kpp_code',
    patternName: 'kpp_ru',
  },
  {
    source: ORGANIZATION_ROLE_SOURCE,
    flags: 'gu',
    type: 'org_role',
    patternName: 'organization_role',
  },
  {
    source: ORGANIZATION_ROLE_QUOTED_SOURCE,
    flags: 'gu',
    type: 'organization_name',
    patternName: 'organization_role_quoted',
  },
  {
    source: ORGANIZATION_NAME_SOURCE,
    flags: 'giu',
    type: 'organization_name',
    patternName: 'organization_name',
  },
  { source: FORMULA_LOGICAL, flags: 'gi', type: 'formula', patternName: 'formula_logical' },
  { source: KPI_METRIC_BODY, flags: 'giu', type: 'kpi_metric', patternName: 'kpi_metric' },
  ...getMaskerUnitPatternSpecs(DECIMAL_FRAC).map((spec, i) => ({
    ...spec,
    patternName: `unit_${i}`,
  })),
  {
    source: `${CURRENCY_SYMBOLS}\\s*${NUMERIC_MAGNET_BODY_SOURCE}\\s*${MAGNITUDE}?`,
    flags: 'gi',
    type: 'money',
    patternName: 'money_sym',
  },
  {
    source: `${NUMERIC_MAGNET_BODY_SOURCE}\\s*${MAGNITUDE}`,
    flags: 'gi',
    type: 'money',
    patternName: 'money_mag',
  },
  { source: String.raw`\d+${DECIMAL_FRAC}%`, flags: 'g', type: 'percent', patternName: 'percent' },
  /** PII email before anchors/numbers: mask fully as immutable brick. */
  {
    source: String.raw`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`,
    flags: 'g',
    type: 'pii_email',
    patternName: 'pii_email',
  },
  /** Коды стандартов ISO9001 и т.п. — до generic_number, чтобы не откусывать только цифры. */
  {
    source: String.raw`\bISO\d+\b`,
    flags: 'gi',
    type: 'standard_code',
    patternName: 'iso_standard_code',
  },
  /**
   * snake_case / kebab-case идентификаторы (Neural_Link и т.д.): буква обязательна, чтобы не пересекаться с ISO-датами.
   * Базовая форма: `[a-zA-Z0-9]+(?:[_-][a-zA-Z0-9]+)+`.
   */
  {
    source: String.raw`[a-zA-Z0-9]*[a-zA-Z][a-zA-Z0-9]*(?:[_-][a-zA-Z0-9]+)+`,
    flags: 'g',
    type: 'semantic_anchor',
    patternName: 'semantic_anchor',
  },
  {
    source: String.raw`\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b`,
    flags: 'gi',
    type: 'date',
    patternName: 'date_en_full',
  },
  /** Month + day without year (mergeSpans prefers longer "Mar 28, 2024" when both match). */
  {
    source: String.raw`\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b`,
    flags: 'gi',
    type: 'date',
    patternName: 'date_en_md',
  },
  { source: String.raw`\d{2}\.\d{2}\.\d{4}`, flags: 'g', type: 'date', patternName: 'date_dmy' },
  { source: String.raw`\d{4}-\d{2}-\d{2}`, flags: 'g', type: 'date', patternName: 'date_iso' },
  { source: String.raw`\d{4}-\d{4}`, flags: 'g', type: 'daterange', patternName: 'daterange' },
  /**
   * Отдельные числа (без юнита/валюты): после money/unit/date/percent — merge отсекает пересечения.
   * Границы ослаблены для десятичных сразу после буквы (напр. «коэффициент1.85»); целые внутри слов по-прежнему нет.
   */
  {
    source: GENERIC_NUMBER_BODY,
    flags: 'giu',
    type: 'generic_number',
    patternName: 'generic_number',
  },
];

/** Полный порядок вторичной фазы: монолиты → остальное (единый источник для логов и UI). */
export const MASKER_SECONDARY_PATTERN_SPECS: ReadonlyArray<MaskerSecondarySpec> = [
  ...PRIORITY_MONOLITHS,
  ...MASKER_SECONDARY_REST_SPECS,
];

/** Полный список для логов (Formula-Magnet — только через collectFormulaMagnetSpansCore). */
const PATTERN_SPECS_FOR_LOG = [
  { type: 'formula_display', regexp: new RegExp(FORMULA_LATEX_DISPLAY, 'g').toString() },
  { type: 'formula_bracket', regexp: new RegExp(FORMULA_BRACKET, 'g').toString() },
  { type: 'formula_paren', regexp: new RegExp(FORMULA_PAREN, 'g').toString() },
  { type: 'formula_inline', regexp: new RegExp(FORMULA_LATEX_INLINE, 'g').toString() },
  ...MASKER_SECONDARY_PATTERN_SPECS.map((s) => ({
    type: s.patternName,
    regexp: new RegExp(s.source, s.flags).toString(),
  })),
];

/** Лимит итераций в `while (regex.exec)` — защита от бесконечного цикла при пустых совпадениях / багах RegExp. */
const MAX_REGEX_EXEC_ITER = 100;
const ORG_ROLE_KEYWORD_RE = /\b(Заказчик|Поставщик|заказчик|поставщик)\b/u;
const FORCED_ORG_ROLE_RE = new RegExp(ORGANIZATION_ROLE_SOURCE, 'gu');

interface RawSpan {
  start: number;
  end: number;
  text: string;
  type: string;
  /** Имя правила для MASKER ATTEMPT (secondary: unit_0, money_sym, …). */
  patternName?: string;
}

interface OriginalSegment {
  text: string;
  type: string;
  start: number;
  end: number;
}

const FAST_PATH_TYPES = new Set(['generic_number', 'date_monolith']);

function patternMatchesSomewhere(patternSource: string, flags: string, text: string): boolean {
  try {
    return new RegExp(patternSource, flags).test(text);
  } catch {
    return false;
  }
}

/**
 * Метки в ответе модели: `{{IPA_N}}` (промпт — голые) или редкий хвост `{{IPA_N: …}}`.
 */
export const IPA_LABEL_REGEX = /\{\{\s*IPA_(\d+)(?:\s*:\s*[^}]*)?\s*\}\}/g;

/**
 * Литералы семантического слоя (SemanticFirewall после Кристалла) — до RegExp-Маскера должны стать {{IPA_N}},
 * иначе finalize / StreamInjector не подставят display.
 */
const SEMANTIC_MASK_LITERAL_SRC = String.raw`\[ID:MASK_[a-z_]+\]`;

/**
 * Masker — Трафарет: извлекает сегменты, micro-transcreate в целевой язык,
 * в vault кладётся display (цель) + source (оригинал); в тексте — только {{IPA_N}}.
 * Один проход по тексту после слияния пересечений: без цепочки .replace по паттернам.
 */
export class Masker {
  constructor(private vault: DataVault) {}

  /** Семантические литералы `[ID:MASK_*]` как span-узлы, чтобы нумерация IPA шла строго слева направо. */
  private collectSemanticMaskSpans(text: string): RawSpan[] {
    const spans: RawSpan[] = [];
    if (!text.includes('[ID:MASK_')) return spans;
    const re = new RegExp(SEMANTIC_MASK_LITERAL_SRC, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const full = m[0];
      if (full.length === 0) {
        if (re.lastIndex === m.index) re.lastIndex++;
        continue;
      }
      const dom = full.match(/\[ID:MASK_([a-z_]+)\]/i)?.[1] ?? 'unknown';
      spans.push({
        start: m.index,
        end: m.index + full.length,
        text: full,
        type: `semantic_mask_${dom}`,
        patternName: 'semantic_mask_literal',
      });
    }
    return spans;
  }

  /**
   * Formula-Magnet — делегирует в `formulaMagnet.ts` (тот же алгоритм, что UI EntityScanner).
   */
  private collectFormulaMagnetSpans(text: string): RawSpan[] {
    return collectFormulaMagnetSpansCore(text) as RawSpan[];
  }

  /** Реестр по **исходному** тексту (до blank формул); индексы совпадают с `originalText` / `scanText`. */
  private collectRegistrySpansOnly(originalText: string): RawSpan[] {
    const spans: RawSpan[] = [];
    for (const spec of PRIORITY_REGISTRY_MONOLITH_SPECS) {
      const re = new RegExp(spec.source, spec.flags);
      let m: RegExpExecArray | null;
      let execIter = 0;
      while ((m = re.exec(originalText)) !== null) {
        if (++execIter > MAX_REGEX_EXEC_ITER) {
          if (ALTRO_DEBUG_MODE) {
            console.log('[ALTRO][Masker] registry regex exec exceeded safety limit', {
              maxIterations: MAX_REGEX_EXEC_ITER,
            });
          }
          break;
        }
        const full = m[0];
        if (full.length === 0) {
          if (re.lastIndex === m.index) re.lastIndex++;
          continue;
        }
        spans.push({
          start: m.index,
          end: m.index + full.length,
          text: originalText.slice(m.index, m.index + full.length),
          type: spec.type,
          patternName: spec.patternName,
        });
      }
    }
    return spans;
  }

  /**
   * Фаза 2: прочие магниты по тексту с «выжженными» зонами Formula-Magnet (тот же индекс, что у оригинала).
   * `registryFromRaw` — совпадения реестра с **полного** текста (до blank формул); не собираются повторно по `scanText`.
   */
  private collectSecondarySpans(
    scanText: string,
    originalText: string,
    registryFromRaw: RawSpan[]
  ): RawSpan[] {
    const collectFrom = (text: string, specs: ReadonlyArray<MaskerSecondarySpec>): RawSpan[] => {
      const spans: RawSpan[] = [];
      for (const spec of specs) {
        const re = new RegExp(spec.source, spec.flags);
        let m: RegExpExecArray | null;
        let execIter = 0;

        while ((m = re.exec(text)) !== null) {
          if (++execIter > MAX_REGEX_EXEC_ITER) {
            if (ALTRO_DEBUG_MODE) {
              console.log('[ALTRO][Masker] regex exec exceeded safety limit', {
                maxIterations: MAX_REGEX_EXEC_ITER,
                patternName: spec.patternName,
              });
            }
            break;
          }
          const full = m[0];
          if (full.length === 0) {
            if (re.lastIndex === m.index) re.lastIndex++;
            continue;
          }
          if (spec.type === 'org_tax_monolith' && ORG_ROLE_KEYWORD_RE.test(full)) {
            if (ALTRO_DEBUG_MODE) {
              console.log('[MASKER] Skip org_tax_monolith with role keyword:', full);
            }
            continue;
          }
          if (spec.type === 'person_full_name' && !isPersonFullNameCandidate(full)) {
            continue;
          }
          spans.push({
            start: m.index,
            end: m.index + full.length,
            text: originalText.slice(m.index, m.index + full.length),
            type: spec.type,
            patternName: spec.patternName,
          });
        }
      }
      return spans;
    };

    const registryMerged = this.mergeSpans(registryFromRaw);
    const scanAfterRegistry = blankRangesInText(
      scanText,
      registryMerged.map((s) => ({ start: s.start, end: s.end }))
    );
    const otherMonolithSpans = collectFrom(scanAfterRegistry, PRIORITY_MONOLITHS_NON_REGISTRY);
    const monolithSpans = [...registryFromRaw, ...otherMonolithSpans];
    const monolithMerged = this.mergeSpans(monolithSpans);
    /** Зоны монолитов → пробелы той же длины: `generic_number` / даты фазы 2b не видят символы внутри реестра/ФИО/ИНН/даты-словом. */
    const scanAfterMonolith = blankRangesInText(
      scanText,
      monolithMerged.map((s) => ({ start: s.start, end: s.end }))
    );
    const restSpans = collectFrom(scanAfterMonolith, MASKER_SECONDARY_REST_SPECS);
    return [...monolithSpans, ...restSpans];
  }

  private mergeSpans(spans: RawSpan[]): RawSpan[] {
    return mergeSpansRaw(spans as Parameters<typeof mergeSpansRaw>[0]) as RawSpan[];
  }

  /** Жёсткий приоритет ролей: роли всегда маскируются первыми как `org_role`. */
  private collectForcedOrgRoleSpans(originalText: string): RawSpan[] {
    const spans: RawSpan[] = [];
    let m: RegExpExecArray | null;
    let execIter = 0;
    FORCED_ORG_ROLE_RE.lastIndex = 0;
    while ((m = FORCED_ORG_ROLE_RE.exec(originalText)) !== null) {
      if (++execIter > MAX_REGEX_EXEC_ITER) {
        if (ALTRO_DEBUG_MODE) {
          console.log('[ALTRO][Masker] forced org_role regex exec exceeded safety limit', {
            maxIterations: MAX_REGEX_EXEC_ITER,
          });
        }
        break;
      }
      const full = m[0];
      if (full.length === 0) {
        if (FORCED_ORG_ROLE_RE.lastIndex === m.index) FORCED_ORG_ROLE_RE.lastIndex++;
        continue;
      }
      spans.push({
        start: m.index,
        end: m.index + full.length,
        text: originalText.slice(m.index, m.index + full.length),
        type: 'org_role',
        patternName: 'organization_role_forced',
      });
    }
    return spans;
  }

  /**
   * Обрабатывает текст: совпадения собираются, сливаются по длине,
   * затем одним проходом подставляются временные блоки __ALTRO_IPA_BLOCK_*__ и финальные {{IPA_N}}.
   * @param targetLanguage — обязательный код цели (например `ru`) для Translation-First в vault.
   * @param weights — контекст доменов (IntentOrchestrator) для microTranscreate / будущих правил маскирования.
   */
  mask(text: string, targetLanguage: string, weights?: DomainWeights): string {
    resetMicroTranscreateSession();
    const maskStartedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();
    const forcedOrgRoleRaw = this.collectForcedOrgRoleSpans(text);
    const forcedOrgRoleMerged = this.mergeSpans(forcedOrgRoleRaw);

    if (ALTRO_DEBUG_MODE) {
      console.log('[ALTRO][Masker] mask begin', {
        sourceLength: text.length,
        sourcePrefixHex: textPrefixHex(text, 100),
        matchAttempt: {
          formula_display: patternMatchesSomewhere(FORMULA_LATEX_DISPLAY, 'g', text),
          formula_bracket: patternMatchesSomewhere(FORMULA_BRACKET, 'g', text),
          formula_paren: patternMatchesSomewhere(FORMULA_PAREN, 'g', text),
          formula_inline: patternMatchesSomewhere(FORMULA_LATEX_INLINE, 'g', text),
        },
      });
    }

    const formulaRaw = this.collectFormulaMagnetSpans(text);
    const formulaMerged = this.mergeSpans(formulaRaw).filter(
      (s) => !forcedOrgRoleMerged.some((r) => spanOverlaps(s, r))
    );
    if (ALTRO_DEBUG_MODE) {
      for (const s of formulaRaw) {
        console.log(`MASKER ATTEMPT: [${s.patternName ?? s.type}] matched length=${s.text.length}`);
      }
    }

    const registryFromRaw = this.collectRegistrySpansOnly(text).filter(
      (s) => !formulaMerged.some((f) => spanOverlaps(s, f)) && !forcedOrgRoleMerged.some((r) => spanOverlaps(s, r))
    );

    const blankedForSecondary = blankRangesInText(
      text,
      formulaMerged.map((s) => ({ start: s.start, end: s.end }))
    );
    const secondaryRaw = this.collectSecondarySpans(blankedForSecondary, text, registryFromRaw);
    if (ALTRO_DEBUG_MODE) {
      for (const s of secondaryRaw) {
        console.log(`MASKER ATTEMPT: [${s.patternName ?? s.type}] matched length=${s.text.length}`);
      }
    }

    const secondaryFiltered = secondaryRaw.filter(
      (s) =>
        !formulaMerged.some((f) => spanOverlaps(s, f))
        && !forcedOrgRoleMerged.some((r) => spanOverlaps(s, r))
    );

    const semanticRaw = this.collectSemanticMaskSpans(text);
    const semanticFiltered = semanticRaw.filter(
      (s) =>
        !formulaMerged.some((f) => spanOverlaps(s, f))
        && !forcedOrgRoleMerged.some((r) => spanOverlaps(s, r))
    );

    const raw = [...forcedOrgRoleRaw, ...formulaRaw, ...secondaryRaw, ...semanticRaw];
    const merged = this.mergeSpans([...forcedOrgRoleMerged, ...formulaMerged, ...secondaryFiltered, ...semanticFiltered]);

    if (ALTRO_DEBUG_MODE) {
      console.log('[ALTRO][Masker] regex specs', PATTERN_SPECS_FOR_LOG);
    }

    const originals: OriginalSegment[] = [];
    let out = '';
    let pos = 0;

    for (const s of merged) {
      out += text.slice(pos, s.start);
      const idx = originals.length;
      const token = `__ALTRO_IPA_BLOCK_${String(idx).padStart(6, '0')}__`;
      originals.push({ text: s.text.trim(), type: s.type, start: s.start, end: s.end });
      out += token;
      pos = s.end;
    }
    out += text.slice(pos);

    const contexts: Array<MicroTranscreateContext | undefined> = new Array(originals.length);
    let linkedGenericNumberRaw: string | undefined;
    let linkedGenericNumberEnd = -1;
    for (let i = 0; i < originals.length; i++) {
      const current = originals[i]!;
      if (current.type === 'formula_paren' && linkedGenericNumberRaw && linkedGenericNumberEnd >= 0) {
        const bridge = text.slice(linkedGenericNumberEnd, current.start);
        const hasOnlyBridgeChars = /^[\s\u00A0,.;:–—-]*$/u.test(bridge);
        if (hasOnlyBridgeChars) {
          contexts[i] = { linkedGenericNumberRaw };
        }
      }
      if (current.type === 'generic_number') {
        linkedGenericNumberRaw = current.text;
        linkedGenericNumberEnd = current.end;
      } else if (current.type !== 'formula_paren') {
        linkedGenericNumberRaw = undefined;
        linkedGenericNumberEnd = -1;
      }
    }

    const batchedCandidates: MicroTranscreateSegment[] = [];
    const batchedIndexMap: number[] = [];
    for (let i = 0; i < originals.length; i++) {
      const seg = originals[i]!;
      if (seg.type.startsWith('semantic_mask_')) continue;
      if (FAST_PATH_TYPES.has(seg.type)) continue;
      batchedCandidates.push({
        value: seg.text,
        type: seg.type,
        context: contexts[i],
      });
      batchedIndexMap.push(i);
    }
    const batchedDisplays = microTranscreateBatch(batchedCandidates, targetLanguage, weights);
    const batchedDisplayByIndex = new Map<number, string>();
    for (let i = 0; i < batchedIndexMap.length; i++) {
      batchedDisplayByIndex.set(batchedIndexMap[i]!, batchedDisplays[i]!);
    }

    let finalOut = out;
    for (let i = 0; i < originals.length; i++) {
      const token = `__ALTRO_IPA_BLOCK_${String(i).padStart(6, '0')}__`;
      const source = originals[i].text;
      const detectedType = originals[i].type;
      const context = contexts[i];
      if (detectedType === 'unit') {
        const uid = resolveUnitIdFromCapture(source);
        const dis = resolveUnitMagnetDisambiguation(source, uid);
        if (ALTRO_DEBUG_MODE) {
          console.log(
            `[ALTRO][Stage:Unit-Magnet] Captured Unit length=${source.length} -> ID: ${uid ?? 'unknown'}${dis ? ` — ${dis}` : ''}`
          );
        }
      }
      const display = detectedType.startsWith('semantic_mask_')
        ? source
        : FAST_PATH_TYPES.has(detectedType)
          ? microTranscreate(source, detectedType, targetLanguage, weights, context)
          : (batchedDisplayByIndex.get(i)
            ?? microTranscreate(source, detectedType, targetLanguage, weights, context));
      if (ALTRO_DEBUG_MODE) {
        console.log('[ALTRO_AUDIT][Masker] microTranscreate', {
          index: i,
          originalSegment: source,
          detectedType,
          targetLanguage,
          weightsContext: weights,
          microTranscreateResult: display,
        });
      }
      /** Vault хранит только результат microTranscreate(display); логи — только в console, не в IPA_NODE. */
      const key = this.vault.push(display, detectedType, source);
      if (!finalOut.includes(token)) continue;
      finalOut = finalOut.split(token).join(key);
    }

    if (ALTRO_DEBUG_MODE) {
      const stats = getMicroTranscreateStats();
      const elapsedMs = (
        (typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now()) - maskStartedAt
      );
      const totalRequests = stats.hits + stats.misses;
      const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
      console.table([{
        processingTimeMs: Number(elapsedMs.toFixed(2)),
        cacheHitRatePercent: Number(hitRate.toFixed(2)),
        batchPackages: stats.batchCount,
      }]);
      console.log('[ALTRO_TRANSFIGURE_COMPLETE]', {
        sourceLength: text.length,
        rawMatches: raw.length,
        mergedMatches: merged.length,
        maskedBlocks: originals.length,
        outputLength: finalOut.length,
        microTranscreateStats: stats,
      });
    }

    return finalOut;
  }
}
