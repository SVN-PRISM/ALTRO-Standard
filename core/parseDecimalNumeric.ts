/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * Разбор числа с `.` или `,` как десятичным разделителем (в т.ч. EU: 1.234,56 / US: 1,234.56).
 */
export function parseDecimalNumericString(raw: string): number {
  const t = raw.trim().replace(/\s/g, '');
  if (!t) return NaN;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      return parseFloat(t.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(t.replace(/,/g, ''));
  }
  if (lastComma >= 0) {
    const segs = t.split(',');
    if (segs.length === 2 && segs[1].length > 0 && segs[1].length <= 2) {
      return parseFloat(`${segs[0].replace(/\./g, '')}.${segs[1]}`);
    }
    return parseFloat(t.replace(/,/g, ''));
  }
  return parseFloat(t.replace(/,/g, ''));
}
