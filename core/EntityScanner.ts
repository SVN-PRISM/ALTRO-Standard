/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import { collectFormulaMagnetSpans, blankRangesInText, spanOverlaps } from './formulaMagnet';
import { getMegawattMagnetPatternSource, NUMERIC_MAGNET_BODY_SOURCE } from './dictionaries/UnitRegistry';

/** Типы сущностей для подсветки и IPA — подтипы Formula-Magnet №0 (как Masker patternName). */
export type EntityType =
  | 'formula_display'
  | 'formula_inline'
  | 'formula_bracket'
  | 'formula_paren'
  | 'money'
  | 'percent'
  | 'date'
  | 'daterange'
  | 'timeref'
  | 'number'
  | 'id_tag';

export interface EntityMatch {
  start: number;
  end: number;
  type: EntityType;
  text: string;
}

const CURRENCY_SYMBOLS = '(?:\\$|€|£|¥|₽|USD|EUR|GBP|RUB)';
const MAGNITUDE = '(?:billion|million|trillion|bn|bln|m|mn|mln|млрд|млн|трлн)';

/** Кварталы, FY/CY + Q, порядковые даты (англ.), квартал по-русски */
const TIME_REF_PATTERNS: Array<{ regex: RegExp; type: EntityType }> = [
  { regex: /\b(?:FY|CY)\s*20\d{2}\s*[-–]\s*Q[1-4]\b/gi, type: 'timeref' },
  { regex: /\bQ[1-4]\s*(?:20\d{2}|FY\s*20\d{2})?\b/gi, type: 'timeref' },
  { regex: /\bQ[1-4]\b/gi, type: 'timeref' },
  { regex: /\b[Кк]в\.?\s*[1-4](?:\s*20\d{2})?\b/g, type: 'timeref' },
  {
    regex: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:st|nd|rd|th),?\s+\d{4}\b/gi,
    type: 'timeref',
  },
  { regex: /\b\d{1,2}(?:st|nd|rd|th)\s+(?:of\s+)?(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\b/gi, type: 'timeref' },
  { regex: /\b(?:1st|2nd|3rd|\d{1,2}th)\b/gi, type: 'timeref' },
];

/**
 * Отдельно стоящие числа (450, 2027, 10.5, 1,000,000 с запятыми).
 * Запускается после денег/процентов/дат/timeref — пересечения отрезаются merge.
 */
const GENERIC_NUMBER_PATTERN: { regex: RegExp; type: EntityType } = {
  regex: /(?<![\d.])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![\d.])/g,
  type: 'number',
};

/** Совпадает с Masker money — полные суммы с запятой как разделителем тысяч ($850,000). */
const MONEY_NUMERIC = NUMERIC_MAGNET_BODY_SOURCE;

const PATTERNS: Array<{ regex: RegExp; type: EntityType }> = [
  { regex: new RegExp(`${CURRENCY_SYMBOLS}\\s*${MONEY_NUMERIC}\\s*${MAGNITUDE}?`, 'gi'), type: 'money' },
  { regex: new RegExp(`${MONEY_NUMERIC}\\s*${MAGNITUDE}`, 'gi'), type: 'money' },
  { regex: /\d+(?:\.\d+)?%/g, type: 'percent' },
  { regex: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi, type: 'date' },
  { regex: /\d{2}\.\d{2}\.\d{4}/g, type: 'date' },
  { regex: /\d{4}-\d{2}-\d{2}/g, type: 'date' },
  { regex: /\d{4}-\d{4}/g, type: 'daterange' },
  ...TIME_REF_PATTERNS,
  /** До GENERIC_NUMBER: иначе «1.2» перехватывается числом и теряется MW (подсветка в OutputHub). */
  { regex: new RegExp(getMegawattMagnetPatternSource(''), 'giu'), type: 'number' },
  GENERIC_NUMBER_PATTERN,
];

function entityPriority(t: EntityType): number {
  if (
    t === 'formula_display' ||
    t === 'formula_inline' ||
    t === 'formula_bracket' ||
    t === 'formula_paren'
  )
    return 100;
  if (t === 'money') return 40;
  if (t === 'percent') return 35;
  if (t === 'id_tag') return 33;
  if (t === 'date' || t === 'daterange') return 30;
  if (t === 'timeref') return 25;
  return 10;
}

/** Слияние как в Masker: длина, затем приоритет (формула выше чисел внутри неё). */
function mergeEntityMatches(spans: EntityMatch[]): EntityMatch[] {
  const byLength = [...spans].sort((a, b) => {
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (lb !== la) return lb - la;
    return entityPriority(b.type) - entityPriority(a.type);
  });
  const selected: EntityMatch[] = [];
  for (const s of byLength) {
    const overlaps = selected.some((x) => !(s.end <= x.start || s.start >= x.end));
    if (!overlaps) selected.push(s);
  }
  selected.sort((a, b) => a.start - b.start);
  return selected;
}

function collectMatches(text: string): EntityMatch[] {
  const formulaSpans = collectFormulaMagnetSpans(text);
  const formulaEntities: EntityMatch[] = formulaSpans.map((s) => ({
    start: s.start,
    end: s.end,
    type: s.type as EntityType,
    text: text.slice(s.start, s.end),
  }));

  const blanked = blankRangesInText(
    text,
    formulaEntities.map((e) => ({ start: e.start, end: e.end }))
  );

  const other: EntityMatch[] = [];
  for (const { regex, type } of PATTERNS) {
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(blanked)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const candidate: EntityMatch = {
        start,
        end,
        type,
        text: text.slice(start, end),
      };
      /** Sovereign Formula Rule: KPI/числа/деньги не могут «откусывать» формулу (как Masker.secondaryFiltered). */
      if (formulaEntities.some((f) => spanOverlaps(candidate, f))) continue;
      other.push(candidate);
    }
  }

  return mergeEntityMatches([...formulaEntities, ...other]);
}

/** Находит все сущности в тексте. Formula-Magnet №0 совпадает с core/Masker.ts (см. ALTRO_CORE). */
export function scanEntities(text: string): EntityMatch[] {
  return collectMatches(text);
}
