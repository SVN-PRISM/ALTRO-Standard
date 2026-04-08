/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil — Universal Unit Magnet */

import type { DomainWeights } from '@/lib/altroData';
import { parseDecimalNumericString } from '../parseDecimalNumeric';

const INTL_BY_LANG: Record<string, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  it: 'it-IT',
  hy: 'hy-AM',
};

function intlLocaleFromTarget(targetLanguage: string): string {
  const c = targetLanguage.trim().toLowerCase() || 'ru';
  const lang = c.split(/[-_]/)[0] ?? 'ru';
  if (INTL_BY_LANG[lang]) return INTL_BY_LANG[lang];
  if (/^[a-z]{2}-[A-Z]{2}$/.test(c)) return c;
  if (/^[a-z]{2}$/.test(c)) return `${c}-${c.toUpperCase()}`;
  return 'en-US';
}

/** Canonical IDs for physical units, IT/crypto, and common measure symbols. */
export type UnitId =
  | 'UNIT_MW'
  | 'UNIT_KW'
  | 'UNIT_KWH'
  | 'UNIT_V'
  | 'UNIT_A'
  | 'UNIT_GCAL'
  | 'UNIT_GB'
  | 'UNIT_TB'
  | 'UNIT_MBPS'
  | 'UNIT_TFLOPS'
  | 'UNIT_BTC'
  | 'UNIT_ETH'
  | 'UNIT_KG'
  | 'UNIT_TON'
  /** Длина: метры (строго m / м; не путать с миллионами при валюте). */
  | 'UNIT_LENGTH_M'
  | 'UNIT_KM'
  | 'UNIT_KMH'
  | 'UNIT_PHRASE_MILLIONS'
  | 'UNIT_PHRASE_BILLION_USD'
  | 'UNIT_PHRASE_MILLION_USD'
  | 'UNIT_PHRASE_BILLION_RUB'
  | 'UNIT_PHRASE_MILLION_RUB';

export interface UnitDefinition {
  id: UnitId;
  symbolEn: string;
  symbolRu: string;
  aliases: string[];
}

const DEFINITIONS: UnitDefinition[] = [
  {
    id: 'UNIT_MW',
    symbolEn: 'MW',
    symbolRu: 'МВт',
    aliases: ['megawatt', 'megawatts', 'мегаватт', 'мегаватта', 'мвт', 'МВт', 'MW', 'mW'],
  },
  {
    id: 'UNIT_KW',
    symbolEn: 'kW',
    symbolRu: 'кВт',
    aliases: ['kilowatt', 'kilowatts', 'киловатт', 'киловатта', 'квт', 'кВт', 'kW', 'KW'],
  },
  {
    id: 'UNIT_KWH',
    symbolEn: 'kWh',
    symbolRu: 'кВт·ч',
    aliases: [
      'kwh',
      'KWh',
      'kilowatt-hour',
      'kilowatt-hours',
      'киловатт-час',
      'киловатт-часа',
      'квт·ч',
      'кВт·ч',
      'кВтч',
    ],
  },
  {
    id: 'UNIT_V',
    symbolEn: 'V',
    symbolRu: 'В',
    aliases: ['volt', 'volts', 'вольт', 'вольта'],
  },
  {
    id: 'UNIT_A',
    symbolEn: 'A',
    symbolRu: 'А',
    aliases: ['ampere', 'amperes', 'ампер', 'ампера'],
  },
  {
    id: 'UNIT_GCAL',
    symbolEn: 'Gcal',
    symbolRu: 'Гкал',
    aliases: ['gcal', 'Gcal', 'GCal', 'гкал', 'Гкал', 'gigacalorie', 'гигакалория', 'гигакалории'],
  },
  {
    id: 'UNIT_GB',
    symbolEn: 'GB',
    symbolRu: 'ГБ',
    aliases: ['gigabyte', 'gigabytes', 'гигабайт', 'гигабайта', 'гб', 'ГБ', 'gb', 'GB'],
  },
  {
    id: 'UNIT_TB',
    symbolEn: 'TB',
    symbolRu: 'ТБ',
    aliases: ['terabyte', 'terabytes', 'терабайт', 'терабайта', 'тб', 'ТБ', 'tb', 'TB'],
  },
  {
    id: 'UNIT_MBPS',
    symbolEn: 'Mbps',
    symbolRu: 'Мбит/с',
    aliases: ['mbps', 'Mbps', 'Mbit/s', 'мбит/с', 'Мбит/с', 'мегабит в секунду'],
  },
  {
    id: 'UNIT_TFLOPS',
    symbolEn: 'TFLOPS',
    symbolRu: 'Тфлопс',
    aliases: ['tflops', 'Tflops', 'TFLOPS', 'тфлопс', 'Тфлопс', 'teraflops', 'терафлопс'],
  },
  {
    id: 'UNIT_BTC',
    symbolEn: 'BTC',
    symbolRu: 'BTC',
    aliases: ['btc', 'BTC', 'bitcoin', 'биткоин', 'биткоина'],
  },
  {
    id: 'UNIT_ETH',
    symbolEn: 'ETH',
    symbolRu: 'ETH',
    aliases: ['eth', 'ETH', 'ethereum', 'ether', 'эфир', 'эфира'],
  },
  {
    id: 'UNIT_KG',
    symbolEn: 'kg',
    symbolRu: 'кг',
    aliases: ['kilogram', 'kilograms', 'килограмм', 'килограмма', 'kg', 'кг'],
  },
  {
    id: 'UNIT_TON',
    symbolEn: 't',
    symbolRu: 'т',
    aliases: ['ton', 'tons', 'tonne', 'tonnes', 'metric ton', 'тонн', 'тонна', 'тонны'],
  },
  {
    id: 'UNIT_LENGTH_M',
    symbolEn: 'm',
    symbolRu: 'м',
    aliases: ['meter', 'meters', 'metre', 'metres', 'метр', 'метра', 'метров'],
  },
  {
    id: 'UNIT_KM',
    symbolEn: 'km',
    symbolRu: 'км',
    aliases: ['kilometer', 'kilometers', 'kilometre', 'kilometres', 'километр', 'километра', 'км', 'KM', 'km'],
  },
  {
    id: 'UNIT_KMH',
    symbolEn: 'km/h',
    symbolRu: 'км/ч',
    aliases: ['km/h', 'kmh', 'км/ч', 'км в час', 'kph', 'KPH'],
  },
];

/** EN и RU — отдельные паттерны (без смешения языков в одной группе). */
const PHRASE_SPECS: Array<{
  id: UnitId;
  re: RegExp;
  currency: 'USD' | 'RUB';
  magnitude: number;
}> = [
  {
    id: 'UNIT_PHRASE_BILLION_USD',
    re: /^(\d+(?:[.,]\d+)?)\s+billion\s+dollars?$/i,
    currency: 'USD',
    magnitude: 1e9,
  },
  {
    id: 'UNIT_PHRASE_BILLION_USD',
    re: /^(\d+(?:[.,]\d+)?)\s+миллиард(?:а|ов)?\s+долларов$/u,
    currency: 'USD',
    magnitude: 1e9,
  },
  {
    id: 'UNIT_PHRASE_MILLION_USD',
    re: /^(\d+(?:[.,]\d+)?)\s+million\s+dollars?$/i,
    currency: 'USD',
    magnitude: 1e6,
  },
  {
    id: 'UNIT_PHRASE_MILLION_USD',
    re: /^(\d+(?:[.,]\d+)?)\s+миллион(?:а|ов)?\s+долларов$/u,
    currency: 'USD',
    magnitude: 1e6,
  },
  {
    id: 'UNIT_PHRASE_BILLION_RUB',
    re: /^(\d+(?:[.,]\d+)?)\s+миллиард(?:а|ов)?\s+рубл(?:ей|я|ь)$/u,
    currency: 'RUB',
    magnitude: 1e9,
  },
  {
    id: 'UNIT_PHRASE_MILLION_RUB',
    re: /^(\d+(?:[.,]\d+)?)\s+миллион(?:а|ов)?\s+рубл(?:ей|я|ь)$/u,
    currency: 'RUB',
    magnitude: 1e6,
  },
];

const CURRENCY_SYMBOL_ONE = /^(\$|€|£|¥|₽)/;
const CURRENCY_TO_ISO: Record<string, 'USD' | 'EUR' | 'GBP' | 'RUB'> = {
  $: 'USD',
  '€': 'EUR',
  '£': 'GBP',
  '₽': 'RUB',
};

const CURRENCY_DISPLAY: Record<'USD' | 'EUR' | 'GBP' | 'RUB', { ru: string; en: string }> = {
  USD: { ru: '$', en: '$' },
  EUR: { ru: '€', en: '€' },
  GBP: { ru: '£', en: '£' },
  RUB: { ru: '₽', en: '₽' },
};

/** $100m / €5m / ₽10m — только с символом валюты; смысл = миллионы. */
export function parseCurrencyMillionCapture(
  raw: string
): { n: number; currency: 'USD' | 'EUR' | 'GBP' | 'RUB' } | null {
  const v = raw.trim();
  const m = /^(?:(\$|€|£|¥|₽))\s*(\d+(?:[.,]\d+)?)\s*[mM]\b/.exec(v);
  if (!m) return null;
  const sym = m[1];
  const n = parseDecimalNumericString(m[2]);
  if (Number.isNaN(n)) return null;
  const currency = CURRENCY_TO_ISO[sym];
  if (!currency) return null;
  return { n, currency };
}

/** До 2 знаков после запятой без раздувания до «полных нулей». */
function roundCoefficient(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatCoefficientDisplay(n: number, intlLoc: string): string {
  const r = roundCoefficient(n);
  return new Intl.NumberFormat(intlLoc, { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(r);
}

/**
 * $5m / €3m — компактно: RU «1,2 млн $», EN «$1.2 mln» (не полная сумма в цифрах).
 */
function formatCurrencyMillions(
  p: { n: number; currency: 'USD' | 'EUR' | 'GBP' | 'RUB' },
  intlLoc: string,
  lang: string
): string {
  const sym = CURRENCY_DISPLAY[p.currency][lang === 'ru' ? 'ru' : 'en'];
  const numStr = formatCoefficientDisplay(p.n, intlLoc);
  if (lang === 'ru') {
    return `${numStr} млн ${sym}`;
  }
  return `${sym}${numStr} mln`;
}

/**
 * «1.2 million dollars» / «1,2 миллиона долларов» — золотой компакт (млн/млрд, не 1 200 000,00).
 */
function formatCompactPhraseFromMatch(
  phrase: { n: number; currency: 'USD' | 'RUB'; magnitude: number },
  intlLoc: string,
  lang: string
): string {
  const n = roundCoefficient(phrase.n);
  const curKey = phrase.currency === 'USD' ? 'USD' : 'RUB';
  const sym = CURRENCY_DISPLAY[curKey][lang === 'ru' ? 'ru' : 'en'];
  const numStr = formatCoefficientDisplay(n, intlLoc);
  const isBillion = phrase.magnitude >= 1e9;
  if (lang === 'ru') {
    const scale = isBillion ? 'млрд' : 'млн';
    return `${numStr} ${scale} ${sym}`;
  }
  const scale = isBillion ? 'bln' : 'mln';
  return `${sym}${numStr} ${scale}`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Число с разделителями тысяч (запятая / точка / пробел) и опциональной дробной частью.
 * Пример: $850,000, 1.234.567,89 — целиком, без обрыва на первой запятой.
 */
export const NUMERIC_MAGNET_BODY_SOURCE = String.raw`\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?`;

let _cachedUnitAlternation: string | null = null;

/** Короткие символы MW/мВт не в общей альтернативе — отдельный паттерн, иначе возможен «разрыв» M/W. */
const UNIT_MW_SHORT_ALIASES_SKIP = new Set(['mw', 'мвт']);

export function getUnitMagnetAlternationSource(): string {
  if (_cachedUnitAlternation) return _cachedUnitAlternation;
  const seen = new Set<string>();
  const all: string[] = [];
  for (const d of DEFINITIONS) {
    for (const a of d.aliases) {
      const t = a.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (d.id === 'UNIT_MW' && UNIT_MW_SHORT_ALIASES_SKIP.has(key)) continue;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(t);
      }
    }
  }
  all.sort((a, b) => b.length - a.length);
  _cachedUnitAlternation = all.map(escapeRegex).join('|');
  return _cachedUnitAlternation;
}

/**
 * Отдельный захват числа + MW / мегаватт целиком (до общего token-magnet).
 * Число — «жадное» (тысячи + дробь); хвост MW с (?!) чтобы W не уходила в общий список юнитов.
 */
export function getMegawattMagnetPatternSource(_decimalFrac: string): string {
  return `(${NUMERIC_MAGNET_BODY_SOURCE})(?:\\s*)(?:MW|mW|МВт|мВт|мегаватт(?:а|ов)?|megawatts?|megawatt)(?![a-zA-Zа-яА-ЯёЁ])`;
}

function splitNumberAndRest(raw: string): { numStr: string; rest: string } | null {
  const m = new RegExp(`^(${NUMERIC_MAGNET_BODY_SOURCE})\\s*(.*)$`, 'i').exec(raw.trim());
  if (!m) return null;
  return { numStr: m[1], rest: m[2].trim() };
}

function matchPhrase(raw: string): { id: UnitId; n: number; currency: 'USD' | 'RUB'; magnitude: number } | null {
  const v = raw.trim();
  for (const p of PHRASE_SPECS) {
    const m = p.re.exec(v);
    if (!m) continue;
    const n = parseDecimalNumericString(m[1]);
    if (Number.isNaN(n)) continue;
    return { id: p.id, n, currency: p.currency, magnitude: p.magnitude };
  }
  return null;
}

/**
 * Лог для Masker: пояснение разрешения конфликта m (метры vs миллионы при валюте).
 */
export function resolveUnitMagnetDisambiguation(raw: string, id: UnitId | null): string | undefined {
  if (!id) return undefined;
  if (!/[mM]|м/.test(raw)) return undefined;
  if (id === 'UNIT_LENGTH_M') return "Disambiguated 'm': mapped to METERS";
  if (id === 'UNIT_PHRASE_MILLIONS') return "Disambiguated 'm': mapped to MILLIONS (currency suffix)";
  return undefined;
}

/**
 * Resolve captured magnet text to a UnitId (phrases first, then longest alias on tail).
 */
export function resolveUnitIdFromCapture(raw: string): UnitId | null {
  const trimmed = raw.trim();
  const ph = matchPhrase(trimmed);
  if (ph) return ph.id;
  if (parseCurrencyMillionCapture(trimmed)) return 'UNIT_PHRASE_MILLIONS';

  const split = splitNumberAndRest(trimmed);
  if (split && split.rest) {
    const tail = split.rest.trim();
    if (tail.length === 1 && 'mMмМ'.includes(tail)) {
      if (!CURRENCY_SYMBOL_ONE.test(trimmed)) {
        return 'UNIT_LENGTH_M';
      }
    }
  }

  if (!split || !split.rest) return null;
  const tail = split.rest.trim();
  const lower = tail.toLowerCase();
  let best: { id: UnitId; len: number } | null = null;
  for (const d of DEFINITIONS) {
    for (const a of d.aliases) {
      const al = a.trim();
      if (!al) continue;
      const all = al.toLowerCase();
      if (tail === al || lower === all || lower.endsWith(all)) {
        if (!best || all.length > best.len) best = { id: d.id, len: all.length };
      }
    }
  }
  return best?.id ?? null;
}

function goldenSymbol(id: UnitId, lang: string): string {
  const d = DEFINITIONS.find((x) => x.id === id);
  if (d) return lang === 'ru' ? d.symbolRu : d.symbolEn;
  if (id === 'UNIT_PHRASE_MILLIONS') return '';
  const ph = PHRASE_SPECS.find((p) => p.id === id);
  if (ph) return ph.currency === 'USD' ? 'USD' : '₽';
  return '';
}

/**
 * Golden Standard surface form (Mirror: precise technical translation via UnitRegistry).
 */
export function localizeUnit(raw: string, targetLanguage: string, _weights?: DomainWeights): string {
  void _weights;
  const v = raw.trim();
  if (!v) return v;
  const intlLoc = intlLocaleFromTarget(targetLanguage);
  const lang = targetLanguage.trim().toLowerCase().split(/[-_]/)[0] ?? 'ru';

  const phrase = matchPhrase(v);
  if (phrase) {
    return formatCompactPhraseFromMatch(phrase, intlLoc, lang);
  }

  const cm = parseCurrencyMillionCapture(v);
  if (cm) {
    return formatCurrencyMillions(cm, intlLoc, lang);
  }

  const id = resolveUnitIdFromCapture(v);
  if (!id) return v;

  if (id === 'UNIT_PHRASE_MILLIONS') {
    const cm2 = parseCurrencyMillionCapture(v);
    if (cm2) return formatCurrencyMillions(cm2, intlLoc, lang);
    return v;
  }

  const split = splitNumberAndRest(v);
  if (!split) return v;
  const n = parseDecimalNumericString(split.numStr);
  if (Number.isNaN(n)) return v;

  const sym = goldenSymbol(id, lang);
  if (!sym) return v;

  try {
    const numFmt = new Intl.NumberFormat(intlLoc, { maximumFractionDigits: 8 });
    const numPart = numFmt.format(n).trim();
    const sep =
      id === 'UNIT_MW'
        ? '\u00a0'
        : id === 'UNIT_BTC' || id === 'UNIT_ETH' || id === 'UNIT_KMH' || id === 'UNIT_MBPS' || id === 'UNIT_LENGTH_M'
          ? ' '
          : '\u00a0';
    return `${numPart}${sep}${sym}`.trim();
  } catch {
    return `${split.numStr} ${sym}`;
  }
}

export function listUnitDefinitions(): readonly UnitDefinition[] {
  return DEFINITIONS;
}

/**
 * RegExp specs for Masker: phrase magnets first (greedy), then [number][space?][unit].
 * @param decimalFrac — same as Masker `DECIMAL_FRAC`, e.g. `(?:[.,]\\d+)?`
 */
export function getMaskerUnitPatternSpecs(decimalFrac: string): Array<{ source: string; flags: string; type: string }> {
  const phraseSources = [
    `\\d+${decimalFrac}\\s+billion\\s+dollars?`,
    `\\d+${decimalFrac}\\s+million\\s+dollars?`,
    `\\d+${decimalFrac}\\s+миллиард(?:а|ов)?\\s+долларов`,
    `\\d+${decimalFrac}\\s+миллион(?:а|ов)?\\s+долларов`,
    `\\d+${decimalFrac}\\s+миллиард(?:а|ов)?\\s+рубл(?:ей|я|ь)`,
    `\\d+${decimalFrac}\\s+миллион(?:а|ов)?\\s+рубл(?:ей|я|ь)`,
  ];
  const phrases = phraseSources.map((source) => ({ source, flags: 'giu', type: 'unit' }));
  /** Валюта + m/M — миллионы; выше приоритет, чем «число + m» (метры). */
  const currencyMillions = {
    source: `(?:\\$|€|£|¥|₽)\\s*(\\d+${decimalFrac})\\s*[mM]\\b`,
    flags: 'giu',
    type: 'unit',
  };
  /** Расстояние: число + пробел + m / м (без символа валюты в начале захвата). */
  const distanceMeters = {
    source: `(\\d+${decimalFrac})\\s+([mм])\\b`,
    flags: 'giu',
    type: 'unit',
  };
  const megawattMagnet = {
    source: getMegawattMagnetPatternSource(decimalFrac),
    flags: 'giu',
    type: 'unit',
  };
  const alt = getUnitMagnetAlternationSource();
  const tokenMagnet = {
    source: `(\\d+${decimalFrac})(?:\\s*)(${alt})`,
    flags: 'giu',
    type: 'unit',
  };
  /** MW сразу после фраз — до валюты «млн» и до общего списка юнитов (иначе W отваливается). */
  return [...phrases, megawattMagnet, currencyMillions, distanceMeters, tokenMagnet];
}
