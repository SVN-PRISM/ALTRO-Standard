/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import { INITIAL_DOMAIN_WEIGHTS, type DomainWeights } from '@/lib/altroData';
import { ALTRO_DEBUG_MODE } from '@/lib/constants';
import { transliterateCyrillicToLatinPcgn } from './cyrillicTransliterate';
import { isValidInlineFormulaBody } from './formulaMagnet';
import { localizeUnit, NUMERIC_MAGNET_BODY_SOURCE, resolveUnitIdFromCapture } from './dictionaries/UnitRegistry';
import { parseDecimalNumericString } from './parseDecimalNumeric';

export { parseDecimalNumericString } from './parseDecimalNumeric';

export interface MicroTranscreateContext {
  linkedGenericNumberRaw?: string;
}

export interface MicroTranscreateSegment {
  value: string;
  type: string;
  context?: MicroTranscreateContext;
}

export interface MicroTranscreateStats {
  hits: number;
  misses: number;
  totalTime: number;
  batchCount: number;
}

const MICRO_TRANSCREATE_SESSION_CACHE = new Map<string, string>();
const MICRO_TRANSCREATE_CACHE_LIMIT = 4_096;
const NAMED_ENTITY_BATCH_TYPES = new Set(['org_role', 'organization_name', 'person_full_name']);
const MICRO_TRANSCREATE_STATS: MicroTranscreateStats = {
  hits: 0,
  misses: 0,
  totalTime: 0,
  batchCount: 0,
};

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

export function resetMicroTranscreateSession(): void {
  MICRO_TRANSCREATE_SESSION_CACHE.clear();
  MICRO_TRANSCREATE_STATS.hits = 0;
  MICRO_TRANSCREATE_STATS.misses = 0;
  MICRO_TRANSCREATE_STATS.totalTime = 0;
  MICRO_TRANSCREATE_STATS.batchCount = 0;
}

export function getMicroTranscreateStats(): MicroTranscreateStats {
  return { ...MICRO_TRANSCREATE_STATS };
}

/** Все оси домена 0 — нет активной директивы (KSHERQ relaxation в SemanticFirewall). */
export function domainWeightsAreNeutral(weights?: DomainWeights): boolean {
  if (!weights) return true;
  return (Object.keys(INITIAL_DOMAIN_WEIGHTS) as (keyof DomainWeights)[]).every((k) => (weights[k] ?? 0) === 0);
}

/**
 * Micro-transcreation: dates, numbers, money, percent → target locale surface form.
 * Language-agnostic: driven by BCP-47–style codes (e.g. ru → ru-RU).
 * Optional `weights` — контекст IntentOrchestrator / доменов для тонкой настройки Intl.
 */

const LOCALE_BY_LANG: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  hy: 'hy-AM',
};

const CURRENCY_TOKEN =
  '(?:\\$|€|£|¥|₽|USD|EUR|GBP|RUB|JPY)';

const MAG_WORD =
  '(?:billion|million|trillion|bn|bln|mn|mln|млрд|млн|трлн)';

export function resolveLocaleTag(targetLanguage: string): string {
  const c = targetLanguage.trim().toLowerCase() || 'ru';
  if (LOCALE_BY_LANG[c]) return LOCALE_BY_LANG[c];
  if (/^[a-z]{2}-[A-Z]{2}$/.test(c)) return c;
  if (/^[a-z]{2}$/.test(c)) return `${c}-${c.toUpperCase()}`;
  return 'ru-RU';
}

/** PCGN только внутри сегмента (без глобального trim/squash всей строки). */
function transliterateSegmentPcgn(s: string): string {
  const t = transliterateCyrillicToLatinPcgn(s);
  return t.replace(/\s+/g, ' ').trim();
}

/** Заказчик/Поставщик + зеркало EN: роль + юр. префикс (АО→JSC …) + кавычки с PCGN. */
function mirrorOrganizationRoleAndNameEn(v: string): string {
  const norm = v.normalize('NFC').trim();
  const roleHead = /^(Заказчик|Поставщик|заказчик|поставщик)/u.exec(norm);
  if (!roleHead) {
    return transliterateCyrillicToLatinPcgn(norm);
  }
  const roleEn = /^заказчик$/iu.test(roleHead[1]) ? 'Customer' : 'Supplier';
  let tail = norm.slice(roleHead[0].length);
  const sep = tail.match(/^\s*(?:\p{Pd}+|:)\s*/u);
  if (!sep) {
    return transliterateCyrillicToLatinPcgn(norm);
  }
  tail = tail.slice(sep[0].length).trimStart();
  tail = translateRuLegalEntityPrefix(tail);
  tail = transliterateQuotedCyrillicInPlace(tail);
  /** Единый em dash как в канцелярском зеркале. */
  return `${roleEn} \u2014 ${tail}`.replace(/\s+/g, ' ').trim();
}

function mirrorRoleFragmentInsideMonolithEn(v: string): string {
  const roleFragmentRe = /((?:Заказчик|Поставщик|заказчик|поставщик)\s*(?:\p{Pd}+|:)\s*[^\n;|]+)/u;
  const m = roleFragmentRe.exec(v);
  if (!m) return v;
  const mirrored = mirrorOrganizationRoleAndNameEn(m[1]);
  return v.slice(0, m.index) + mirrored + v.slice(m.index + m[1].length);
}

function translateRuLegalEntityPrefix(s: string): string {
  const pairs: Array<[RegExp, string]> = [
    [/^(АО)\s+/iu, 'JSC '],
    [/^(ООО)\s+/iu, 'LLC '],
    [/^(ЗАО)\s+/iu, 'JSC '],
    [/^(ПАО)\s+/iu, 'PJSC '],
    [/^(ИП)\s+/iu, 'IE '],
  ];
  for (const [re, en] of pairs) {
    if (re.test(s)) return s.replace(re, en);
  }
  return s;
}

/** «…» или "…" — кириллица внутри через PCGN; «ёлочки» → ASCII-кавычки. */
function transliterateQuotedCyrillicInPlace(s: string): string {
  return s
    .replace(/"([^"]*)"/gu, (_, inner: string) => `"${transliterateSegmentPcgn(inner)}"`)
    .replace(/«([^»]*)»/gu, (_, inner: string) => `"${transliterateSegmentPcgn(inner)}"`);
}

/** Не трогает запятые/точки в суммах; только переводы строк, скобки-метки, эмодзи-щит, схлопывание пробелов. */
function sanitizeForTagDisplay(s: string): string {
  return s
    .replace(/\r?\n/g, ' ')
    .replace(/\{\{/g, '«')
    .replace(/\}\}/g, '»')
    .replace(/\}/g, '')
    .replace(/\u{1F6E1}\uFE0F?/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

const RU_GENITIVE_MONTH_TO_UTC: Readonly<Record<string, number>> = {
  января: 0,
  февраля: 1,
  марта: 2,
  апреля: 3,
  мая: 4,
  июня: 5,
  июля: 6,
  августа: 7,
  сентября: 8,
  октября: 9,
  ноября: 10,
  декабря: 11,
};

/** «15 января 2026» → UTC midnight (как ISO/DMY в parseDateLike). */
function parseRussianGenitiveDate(raw: string): Date | null {
  const v = raw.trim();
  const m =
    /^(\d{1,2})\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+(\d{4})$/iu.exec(
      v
    );
  if (!m) return null;
  const month = RU_GENITIVE_MONTH_TO_UTC[m[2].toLowerCase()];
  if (month === undefined) return null;
  const day = +m[1];
  const year = +m[3];
  const d = new Date(Date.UTC(year, month, day));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateLike(raw: string): Date | null {
  const v = raw.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (iso) {
    const d = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);
  if (dmy) {
    const d = new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const enMonth =
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i.exec(v);
  if (enMonth) {
    const tryStr = `${enMonth[1]} ${enMonth[2]}, ${enMonth[3]}`;
    const d = new Date(tryStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const enMonthNoYear =
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\b/i.exec(v);
  if (enMonthNoYear) {
    const y = new Date().getUTCFullYear();
    const tryStr = `${enMonthNoYear[1]} ${enMonthNoYear[2]}, ${y}`;
    const d = new Date(tryStr);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const t = Date.parse(v);
  if (!Number.isNaN(t)) return new Date(t);
  return null;
}

function formatDate(d: Date, locale: string, weights?: DomainWeights): string {
  try {
    const opts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    };
    if (weights && weights.spirituality >= 0.5) {
      opts.weekday = 'long';
    }
    return new Intl.DateTimeFormat(locale, opts).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function localizeDateRange(raw: string, locale: string): string {
  const v = raw.trim();
  const yr = /^(\d{4})\s*-\s*(\d{4})$/.exec(v);
  if (yr) {
    try {
      return new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(new Date(+yr[1], 0, 1))
        + '–'
        + new Intl.DateTimeFormat(locale, { year: 'numeric' }).format(new Date(+yr[2], 0, 1));
    } catch {
      return v;
    }
  }
  const d = parseDateLike(v);
  return d ? formatDate(d, locale) : v;
}

function currencyCodeFromToken(t: string): string | undefined {
  const u = t.toUpperCase();
  const map: Record<string, string> = {
    $: 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₽': 'RUB',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    RUB: 'RUB',
    JPY: 'JPY',
  };
  return map[t] ?? map[u];
}

function localizeMoney(raw: string, locale: string, weights?: DomainWeights): string {
  const v = raw.trim();
  /** Та же «жадная» числовая часть, что в Masker — иначе группа обрывается на первой запятой ($850). */
  const symNum = new RegExp(`^(${CURRENCY_TOKEN})\\s*(${NUMERIC_MAGNET_BODY_SOURCE})`, 'i').exec(v);
  if (symNum) {
    const code = currencyCodeFromToken(symNum[1]);
    const num = parseDecimalNumericString(symNum[2]);
    if (code && !Number.isNaN(num)) {
      try {
        const curOpts: Intl.NumberFormatOptions = { style: 'currency', currency: code };
        if (weights && weights.economics >= 0.5) {
          curOpts.minimumFractionDigits = 0;
          curOpts.maximumFractionDigits = 2;
        }
        return new Intl.NumberFormat(locale, curOpts).format(num);
      } catch {
        /* fallthrough */
      }
    }
  }
  const numSym = new RegExp(`^(${NUMERIC_MAGNET_BODY_SOURCE})\\s*(${CURRENCY_TOKEN})\\s*$`, 'i').exec(v);
  if (numSym) {
    const num = parseDecimalNumericString(numSym[1]);
    const code = currencyCodeFromToken(numSym[2]);
    if (code && !Number.isNaN(num)) {
      try {
        const curOpts: Intl.NumberFormatOptions = { style: 'currency', currency: code };
        if (weights && weights.economics >= 0.5) {
          curOpts.minimumFractionDigits = 0;
          curOpts.maximumFractionDigits = 2;
        }
        return new Intl.NumberFormat(locale, curOpts).format(num);
      } catch {
        /* fallthrough */
      }
    }
  }
  const mag = new RegExp(`^(${NUMERIC_MAGNET_BODY_SOURCE})\\s*${MAG_WORD}`, 'i').exec(v);
  if (mag) {
    const num = parseDecimalNumericString(mag[1]);
    if (!Number.isNaN(num)) {
      try {
        return new Intl.NumberFormat(locale, { notation: 'compact', compactDisplay: 'short' }).format(num);
      } catch {
        return v;
      }
    }
  }
  return v;
}

function localizePercent(raw: string, locale: string, weights?: DomainWeights): string {
  const m = /^([\d.,]+(?:[.,][\d]+)?)\s*%$/.exec(raw.trim());
  if (!m) return raw;
  const num = parseDecimalNumericString(m[1]);
  if (Number.isNaN(num)) return raw;
  try {
    const maxFrac = weights && weights.politics >= 0.5 ? 4 : 6;
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: maxFrac }).format(
      num / 100
    );
  } catch {
    return raw;
  }
}

/** Число как отдельная сущность (Masker `generic_number`): группы разрядов по локали цели. */
/**
 * Формулы / LaTeX / логические строки — универсальны; display = исходная строка из Vault (OPR).
 */
export function localizeFormula(raw: string): string {
  return raw.trim();
}

/**
 * Единая точка Intl для армянской локали (hy / hy-AM): разделители и группы по стандарту hy-AM.
 */
export function localizeArmenian(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat('hy-AM', {
      ...options,
    }).format(value);
  } catch {
    return String(value);
  }
}

/** KPI Magnet: по умолчанию 2 знака после запятой; проценты — с той же точностью. */
function localizeKpiMetric(raw: string, locale: string): string {
  const v = raw.trim();
  const pct = /^([\d.,]+(?:[.,][\d]+)?)\s*%$/.exec(v);
  const useHy = locale === 'hy-AM' || locale.startsWith('hy');
  const fmtLocale = useHy ? 'hy-AM' : locale;
  if (pct) {
    const num = parseDecimalNumericString(pct[1]);
    if (!Number.isNaN(num)) {
      try {
        const s = useHy
          ? localizeArmenian(num / 100, {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : new Intl.NumberFormat(fmtLocale, {
              style: 'percent',
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(num / 100);
        return s;
      } catch {
        return raw;
      }
    }
  }
  const num = parseDecimalNumericString(v);
  if (Number.isNaN(num)) return raw;
  try {
    return useHy
      ? localizeArmenian(num, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : new Intl.NumberFormat(fmtLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  } catch {
    return raw;
  }
}

function localizeGenericNumber(raw: string, locale: string): string {
  const v = raw.trim();
  const num = parseDecimalNumericString(v);
  if (Number.isNaN(num)) return raw;
  const useHy = locale === 'hy-AM' || locale.startsWith('hy');
  try {
    if (useHy) {
      return localizeArmenian(num, { maximumFractionDigits: 20 });
    }
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(num);
  } catch {
    return raw;
  }
}

function localizePlainNumber(raw: string, locale: string): string {
  const v = raw.trim();
  const m = /^[\d.,]+(?:\.[\d]+)?$/.exec(v);
  if (!m) return raw;
  const num = parseFloat(v.replace(/,/g, ''));
  if (Number.isNaN(num)) return raw;
  try {
    return new Intl.NumberFormat(locale).format(num);
  } catch {
    return raw;
  }
}

function hasCyrillicText(raw: string): boolean {
  return /[А-Яа-яЁё]/u.test(raw);
}

function smallNumberToWordsEn(n: number): string {
  const ones = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  ];
  const teens = [
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  ];
  const tens = [
    '', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  ];
  if (n < 10) return ones[n]!;
  if (n < 20) return teens[n - 10]!;
  if (n < 100) {
    const t = Math.floor(n / 10);
    const o = n % 10;
    return o === 0 ? tens[t]! : `${tens[t]} ${ones[o]}`;
  }
  const h = Math.floor(n / 100);
  const rem = n % 100;
  return rem === 0 ? `${ones[h]} hundred` : `${ones[h]} hundred ${smallNumberToWordsEn(rem)}`;
}

function integerToWordsEn(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'zero';
  const sign = n < 0 ? 'minus ' : '';
  let rest = Math.abs(Math.trunc(n));
  const scales: Array<{ value: number; label: string }> = [
    { value: 1_000_000_000_000, label: 'trillion' },
    { value: 1_000_000_000, label: 'billion' },
    { value: 1_000_000, label: 'million' },
    { value: 1_000, label: 'thousand' },
  ];
  const parts: string[] = [];
  for (const scale of scales) {
    if (rest >= scale.value) {
      const chunk = Math.floor(rest / scale.value);
      parts.push(`${smallNumberToWordsEn(chunk)} ${scale.label}`);
      rest %= scale.value;
    }
  }
  if (rest > 0) {
    parts.push(smallNumberToWordsEn(rest));
  }
  return sign + parts.join(' ');
}

function localizeFormulaParen(
  raw: string,
  targetLanguage: string,
  context?: MicroTranscreateContext
): string {
  const trimmed = raw.trim();
  if (!/^\([\s\S]*\)$/.test(trimmed)) return localizeFormula(raw);
  const lang = targetLanguage.trim().toLowerCase();
  if (!(lang === 'en' || lang.startsWith('en-'))) return localizeFormula(raw);
  if (!hasCyrillicText(trimmed)) return localizeFormula(raw);
  const linked = context?.linkedGenericNumberRaw?.trim();
  if (!linked) return localizeFormula(raw);
  const numeric = parseDecimalNumericString(linked);
  if (!Number.isFinite(numeric)) return localizeFormula(raw);
  const words = integerToWordsEn(numeric);
  if (!words) return localizeFormula(raw);
  return `(${words})`;
}

/**
 * When Masker type is missing (e.g. legacy vault) or `unknown`, infer date/money/percent
 * so Double OPR still localizes bricks instead of echoing English.
 */
export function inferEntityTypeFromValue(
  raw: string
):
  | 'date'
  | 'daterange'
  | 'percent'
  | 'money'
  | 'unit'
  | 'generic_number'
  | 'registry_number'
  | 'formula'
  | 'kpi_metric'
  | 'unknown' {
  const v = raw.trim();
  if (!v) return 'unknown';
  if (/^\$\$(?:[\s\S]*?)\$\$$/.test(v)) return 'formula';
  if (/^\\\[(?:[\s\S]+?)\\\]$/.test(v)) return 'formula';
  if (/^\\\((?:[\s\S]+?)\\\)$/.test(v)) return 'formula';
  /** Раньше money: `$1+2$` — формула; `$1,200,000$` — невалидное тело → ниже money. */
  if (/^\$(?:[\s\S]+?)\$$/.test(v) && !/^\$\$/.test(v)) {
    const inner = v.slice(1, -1);
    if (isValidInlineFormulaBody(inner)) return 'formula';
  }
  if (/(?:[a-zA-Z\d]+\s*[=≈≠><≥≤]\s*[a-zA-Z\d\s.%+\-]+)/i.test(v) && /[=≈≠><≥≤]/.test(v)) return 'formula';
  if (parseRussianGenitiveDate(v)) return 'date';
  if (parseDateLike(v)) return 'date';
  if (/^\d{4}\s*-\s*\d{4}$/.test(v)) return 'daterange';
  if (/^[\d.,]+\s*%$/.test(v)) return 'percent';
  if (resolveUnitIdFromCapture(v) !== null) return 'unit';
  if (
    new RegExp(`^${CURRENCY_TOKEN}\\s*[\\d.,]+`, 'i').test(v) ||
    new RegExp(`^[\\d.,]+(?:\\.[\\d]+)?\\s*${CURRENCY_TOKEN}`, 'i').test(v)
  ) {
    return 'money';
  }
  if (new RegExp(`^[\\d.,]+(?:\\.[\\d]+)?\\s*${MAG_WORD}`, 'i').test(v)) return 'money';
  if (new RegExp(`^${NUMERIC_MAGNET_BODY_SOURCE}$`, 'u').test(v)) return 'generic_number';
  /** № / U+2116 / No. + идентификатор со слешем — см. Masker `REGISTRY_NUMBER_SOURCE`. */
  if (/^(?:\u2116|№|No\.?)\s*\S+$/u.test(v)) {
    return 'registry_number';
  }
  return 'unknown';
}

function resolveEffectiveType(
  declared: string | undefined,
  value: string
):
  | 'date'
  | 'daterange'
  | 'percent'
  | 'money'
  | 'unit'
  | 'generic_number'
  | 'formula'
  | 'formula_display'
  | 'formula_bracket'
  | 'formula_paren'
  | 'formula_inline'
  | 'kpi_metric'
  | 'id_tag'
  | 'standard_code'
  | 'pii_email'
  | 'semantic_anchor'
  | 'registry_number'
  | 'date_monolith'
  | 'person_full_name'
  | 'org_role'
  | 'inn'
  | 'kpp_code'
  | 'organization_name'
  | 'org_tax_monolith'
  | 'resonance_refine'
  | 'unknown' {
  if (
    declared === 'date' ||
    declared === 'daterange' ||
    declared === 'percent' ||
    declared === 'money' ||
    declared === 'unit' ||
    declared === 'generic_number' ||
    declared === 'formula' ||
    declared === 'formula_display' ||
    declared === 'formula_bracket' ||
    declared === 'formula_paren' ||
    declared === 'formula_inline' ||
    declared === 'kpi_metric' ||
    declared === 'id_tag' ||
    declared === 'standard_code' ||
    declared === 'pii_email' ||
    declared === 'semantic_anchor' ||
    declared === 'registry_number' ||
    declared === 'date_monolith' ||
    declared === 'person_full_name' ||
    declared === 'org_role' ||
    declared === 'inn' ||
    declared === 'kpp_code' ||
    declared === 'organization_name' ||
    declared === 'org_tax_monolith' ||
    declared === 'resonance_refine'
  ) {
    return declared;
  }
  return inferEntityTypeFromValue(value);
}

/**
 * Best-effort micro-transcreation by entity type and target language code (e.g. `ru`, `de`).
 */
export function microTranscreate(
  value: string,
  type: string,
  targetLanguage: string,
  weights?: DomainWeights,
  context?: MicroTranscreateContext
): string {
  const cacheKey = buildMicroTranscreateCacheKey(value, type, targetLanguage, context);
  const fromCache = MICRO_TRANSCREATE_SESSION_CACHE.get(cacheKey);
  if (fromCache !== undefined) {
    MICRO_TRANSCREATE_STATS.hits += 1;
    return fromCache;
  }
  MICRO_TRANSCREATE_STATS.misses += 1;
  const startedAt = nowMs();
  const computed = microTranscreateNoCache(value, type, targetLanguage, weights, context);
  MICRO_TRANSCREATE_STATS.totalTime += nowMs() - startedAt;
  rememberMicroTranscreateCache(cacheKey, computed);
  return computed;
}

function buildMicroTranscreateCacheKey(
  value: string,
  type: string,
  targetLanguage: string,
  context?: MicroTranscreateContext
): string {
  const normalizedValue = value.trim();
  const normalizedType = type.trim().toLowerCase() || 'unknown';
  const normalizedTarget = targetLanguage.trim().toLowerCase() || 'ru';
  /**
   * formula_paren зависит от связанного числа — добавляем контекст, чтобы не смешивать разные «прописи».
   */
  const linked = context?.linkedGenericNumberRaw?.trim() ?? '';
  return `${normalizedType}|||${normalizedTarget}|||${normalizedValue}|||${linked}`;
}

function rememberMicroTranscreateCache(key: string, value: string): void {
  if (MICRO_TRANSCREATE_SESSION_CACHE.size >= MICRO_TRANSCREATE_CACHE_LIMIT) {
    const oldest = MICRO_TRANSCREATE_SESSION_CACHE.keys().next().value as string | undefined;
    if (oldest !== undefined) {
      MICRO_TRANSCREATE_SESSION_CACHE.delete(oldest);
    }
  }
  MICRO_TRANSCREATE_SESSION_CACHE.set(key, value);
}

function microTranscreateNoCache(
  value: string,
  type: string,
  targetLanguage: string,
  weights?: DomainWeights,
  context?: MicroTranscreateContext
): string {
  const locale = resolveLocaleTag(targetLanguage);
  const v = value.trim();
  if (!v) return v;

  const effectiveType = resolveEffectiveType(type, v);
  if (ALTRO_DEBUG_MODE) {
    console.log('[ALTRO][microTranscreate] input', { value: v, type, effectiveType, targetLanguage });
  }

  switch (effectiveType) {
    case 'date': {
      const d = parseDateLike(v) ?? parseRussianGenitiveDate(v);
      return d
        ? sanitizeForTagDisplay(formatDate(d, locale, weights))
        : sanitizeForTagDisplay(v);
    }
    case 'date_monolith': {
      const d = parseRussianGenitiveDate(v) ?? parseDateLike(v);
      return d
        ? sanitizeForTagDisplay(formatDate(d, locale, weights))
        : sanitizeForTagDisplay(v);
    }
    case 'daterange':
      return sanitizeForTagDisplay(localizeDateRange(v, locale));
    case 'percent':
      return sanitizeForTagDisplay(localizePercent(v, locale, weights));
    case 'money':
      return sanitizeForTagDisplay(localizeMoney(v, locale, weights));
    case 'unit':
      return sanitizeForTagDisplay(localizeUnit(v, targetLanguage, weights));
    case 'generic_number':
      return sanitizeForTagDisplay(localizeGenericNumber(v, locale));
    case 'formula':
    case 'formula_display':
    case 'formula_bracket':
    case 'formula_inline':
      return sanitizeForTagDisplay(localizeFormula(v));
    case 'formula_paren':
      return sanitizeForTagDisplay(localizeFormulaParen(v, targetLanguage, context));
    case 'kpi_metric':
      return sanitizeForTagDisplay(localizeKpiMetric(v, locale));
    case 'id_tag':
      return sanitizeForTagDisplay(v);
    case 'standard_code':
      return sanitizeForTagDisplay(v);
    case 'pii_email':
      return sanitizeForTagDisplay(v);
    case 'semantic_anchor':
      return sanitizeForTagDisplay(v);
    case 'registry_number':
      return sanitizeForTagDisplay(v);
    case 'person_full_name': {
      const lang = targetLanguage.trim().toLowerCase();
      if (lang === 'en' || lang.startsWith('en-')) {
        const mirrored = transliterateCyrillicToLatinPcgn(v);
        if (ALTRO_DEBUG_MODE) {
          console.log('[ALTRO][microTranscreate] person_full_name', { source: v, mirrored });
        }
        return sanitizeForTagDisplay(mirrored);
      }
      return sanitizeForTagDisplay(v);
    }
    case 'org_role': {
      const normalized = v.trim();
      if (/^заказчик$/iu.test(normalized)) return 'Customer';
      if (/^поставщик$/iu.test(normalized)) return 'Supplier';
      return sanitizeForTagDisplay(normalized);
    }
    case 'organization_name': {
      const lang = targetLanguage.trim().toLowerCase();
      if (lang === 'en' || lang.startsWith('en-')) {
        const trimmed = v.trim();
        /** Граница через `(?=\p{Pd}+|:)` вместо `\b`: после кириллицы `\b` в JS ненадёжен (ASCII `\w`). */
        const isRoleLine = /(Заказчик|Поставщик|закасчик|поставщик)\s*(?=\p{Pd}+|:)/iu.test(trimmed);
        const mirrored = isRoleLine
          ? mirrorOrganizationRoleAndNameEn(trimmed)
          : transliterateCyrillicToLatinPcgn(trimmed);
        if (ALTRO_DEBUG_MODE) {
          console.log('[ALTRO][microTranscreate] organization_name', { source: v, mirrored, isRoleLine });
        }
        return sanitizeForTagDisplay(mirrored);
      }
      return sanitizeForTagDisplay(v);
    }
    case 'inn':
    case 'kpp_code':
      return sanitizeForTagDisplay(v);
    case 'org_tax_monolith': {
      const lang = targetLanguage.trim().toLowerCase();
      if (lang === 'en' || lang.startsWith('en-')) {
        const hasRoleKeyword = /(Заказчик|Поставщик|заказчик|поставщик)/u.test(v);
        if (hasRoleKeyword) {
          const mirroredMonolith = mirrorRoleFragmentInsideMonolithEn(v);
          if (ALTRO_DEBUG_MODE) {
            console.log('[ALTRO][microTranscreate] org_tax_monolith', { source: v, mirroredMonolith });
          }
          return sanitizeForTagDisplay(mirroredMonolith);
        }
      }
      return sanitizeForTagDisplay(v);
    }
    case 'resonance_refine': {
      /** Детерминированная микро-нормализация сегмента для итераций Ψ (без LLM). */
      const n = v.normalize('NFC').replace(/\u00AD/g, '').replace(/\uFEFF/g, '');
      return sanitizeForTagDisplay(n);
    }
    default:
      return sanitizeForTagDisplay(localizePlainNumber(v, locale));
  }
}

/**
 * Batch entry-point: ускоряет поток за счёт:
 * 1) dedupe через session cache;
 * 2) групповой обработки named-entity сегментов (org/person roles/names).
 */
export function microTranscreateBatch(
  segments: MicroTranscreateSegment[],
  targetLanguage: string,
  weights?: DomainWeights
): string[] {
  if (segments.length === 0) return [];
  const out = new Array<string>(segments.length);
  const namedEntityWork: Array<{ index: number; key: string; segment: MicroTranscreateSegment }> = [];
  const directWork: Array<{ index: number; key: string; segment: MicroTranscreateSegment }> = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const key = buildMicroTranscreateCacheKey(segment.value, segment.type, targetLanguage, segment.context);
    const fromCache = MICRO_TRANSCREATE_SESSION_CACHE.get(key);
    if (fromCache !== undefined) {
      MICRO_TRANSCREATE_STATS.hits += 1;
      out[i] = fromCache;
      continue;
    }
    if (NAMED_ENTITY_BATCH_TYPES.has(segment.type)) {
      namedEntityWork.push({ index: i, key, segment });
    } else {
      directWork.push({ index: i, key, segment });
    }
  }

  for (const item of directWork) {
    MICRO_TRANSCREATE_STATS.misses += 1;
    const startedAt = nowMs();
    const computed = microTranscreateNoCache(
      item.segment.value,
      item.segment.type,
      targetLanguage,
      weights,
      item.segment.context
    );
    MICRO_TRANSCREATE_STATS.totalTime += nowMs() - startedAt;
    out[item.index] = computed;
    rememberMicroTranscreateCache(item.key, computed);
  }

  if (namedEntityWork.length > 0) {
    MICRO_TRANSCREATE_STATS.batchCount += 1;
    MICRO_TRANSCREATE_STATS.misses += namedEntityWork.length;
    const startedAt = nowMs();
    const computedBatch = runNamedEntityBatch(namedEntityWork.map((x) => x.segment), targetLanguage, weights);
    MICRO_TRANSCREATE_STATS.totalTime += nowMs() - startedAt;
    for (let i = 0; i < namedEntityWork.length; i++) {
      const item = namedEntityWork[i]!;
      const computed = computedBatch[i] ?? microTranscreateNoCache(
        item.segment.value,
        item.segment.type,
        targetLanguage,
        weights,
        item.segment.context
      );
      out[item.index] = computed;
      rememberMicroTranscreateCache(item.key, computed);
    }
  }

  return out;
}

function runNamedEntityBatch(
  segments: MicroTranscreateSegment[],
  targetLanguage: string,
  weights?: DomainWeights
): string[] {
  if (ALTRO_DEBUG_MODE) {
    console.log('[ALTRO][microTranscreateBatch] named-entity batch', {
      segmentCount: segments.length,
      targetLanguage,
      segmentTypes: segments.map((s) => s.type),
    });
  }
  /**
   * В текущем ядре это локальный трансмутатор.
   * Точка централизована под будущий single-request LLM transport.
   */
  return segments.map((segment) =>
    microTranscreateNoCache(segment.value, segment.type, targetLanguage, weights, segment.context)
  );
}
