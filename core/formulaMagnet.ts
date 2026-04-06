/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil — Formula-Magnet №0 (shared Masker + UI) */

/** Соответствие ALTRO_CORE «Доказательство Назаряна»: без \b и ^ в ограничителях; *? допускает пустое тело ($$$$). */
export const FORMULA_LATEX_DISPLAY = String.raw`\$\$(?:[\s\S]*?)\$\$`;
export const FORMULA_LATEX_INLINE = String.raw`\$(?:[\s\S]+?)\$`;
export const FORMULA_BRACKET = '\\[' + '(?:[\\s\\S]+?)' + '\\]';
export const FORMULA_PAREN = '\\(' + '(?:[\\s\\S]+?)' + '\\)';

const MAX_REGEX_EXEC_ITER = 100;

export interface FormulaRawSpan {
  start: number;
  end: number;
  text: string;
  type: string;
  patternName?: string;
}

/** Визуальные «операторы» без опасного диапазона `[+…=]` в старых классах символов. */
const MATHISH_VISUAL = /[-+=^]|\u2013|\u2014|\u2212|\u00D7|\u00F7|≈|≠|≤|≥/u;

export function isLikelyMathInlineBody(inner: string): boolean {
  const t = inner.trim();
  if (t.length === 0) return false;
  return /\s/.test(t) || MATHISH_VISUAL.test(t);
}

/**
 * Сумма/цена `$1,200,000` без операторов не считается formula_inline (отдаётся money).
 * Включены ASCII и типичные тире/минус из редакторов (– — −) и × ÷.
 */
const INLINE_MATH_OP = /[=+\-*/\u2013\u2014\u2212\u00D7\u00F7≈≠≤≥]/u;

/** BOM / zero-width — не должны ломать «первая значимая не цифра». */
function normalizeInlineInner(inner: string): string {
  return inner.replace(/^\uFEFF+|[\u200B-\u200D\uFEFF]/gu, '').trim();
}

/**
 * Inline `$…$`: (а) после trim первая значимая не цифра — тело похоже на математику;
 * (б) первая значимая — цифра — только если во всём теле есть математический оператор.
 */
/** Семантическая маска Stencil (SemanticFirewall + Кристалл) — не путать с LaTeX `[…]`. */
export function isSemanticStencilMaskBracket(text: string): boolean {
  return /^\[ID:MASK_[a-z_]+\]$/i.test(text.trim());
}

export function isValidInlineFormulaBody(inner: string): boolean {
  const body = normalizeInlineInner(inner);
  if (body.length === 0) return false;
  const firstSig = /\S/u.exec(body);
  const first = firstSig ? firstSig[0] : '';
  if (!first) return false;
  if (/\p{Nd}/u.test(first)) {
    return INLINE_MATH_OP.test(body);
  }
  return isLikelyMathInlineBody(body);
}

export function blankRangesInText(text: string, ranges: Array<{ start: number; end: number }>): string {
  let out = text;
  for (const r of [...ranges].sort((a, b) => b.start - a.start)) {
    const n = r.end - r.start;
    if (n <= 0) continue;
    out = out.slice(0, r.start) + ' '.repeat(n) + out.slice(r.end);
  }
  return out;
}

export function spanOverlaps(
  a: { start: number; end: number },
  b: { start: number; end: number }
): boolean {
  return !(a.end <= b.start || a.start >= b.end);
}

export function mergeSpansRaw(spans: FormulaRawSpan[]): FormulaRawSpan[] {
  const priority = (t: string): number => {
    if (t === 'formula_display') return 100;
    if (t === 'formula_bracket') return 99;
    if (t === 'formula_paren') return 98;
    if (t === 'formula_inline') return 90;
    if (t === 'formula') return 80;
    return 0;
  };
  const byLength = [...spans].sort((a, b) => {
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (lb !== la) return lb - la;
    return priority(b.type) - priority(a.type);
  });
  const selected: FormulaRawSpan[] = [];

  for (const s of byLength) {
    const overlaps = selected.some((x) => !(s.end <= x.start || s.start >= x.end));
    if (!overlaps) selected.push(s);
  }

  selected.sort((a, b) => a.start - b.start);
  return selected;
}

/**
 * Тот же захват, что Masker.collectFormulaMagnetSpans — для UI (EntityScanner) и сервера.
 */
export function collectFormulaMagnetSpans(text: string): FormulaRawSpan[] {
  let spans: FormulaRawSpan[] = [];
  let m: RegExpExecArray | null;
  let execIter = 0;

  const reDisp = new RegExp(FORMULA_LATEX_DISPLAY, 'g');
  while ((m = reDisp.exec(text)) !== null) {
    if (++execIter > MAX_REGEX_EXEC_ITER) {
      console.error('[formulaMagnet] Safety: formula_display exec exceeded', MAX_REGEX_EXEC_ITER);
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reDisp.lastIndex === m.index) reDisp.lastIndex++;
      continue;
    }
    spans.push({
      start: m.index,
      end: m.index + full.length,
      text: full,
      type: 'formula_display',
      patternName: 'formula_display',
    });
  }
  spans = mergeSpansRaw(spans);
  let blanked = blankRangesInText(
    text,
    spans.map((s) => ({ start: s.start, end: s.end }))
  );

  execIter = 0;
  const reBracket = new RegExp(FORMULA_BRACKET, 'g');
  while ((m = reBracket.exec(blanked)) !== null) {
    if (++execIter > MAX_REGEX_EXEC_ITER) {
      console.error('[formulaMagnet] Safety: formula_bracket exec exceeded', MAX_REGEX_EXEC_ITER);
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reBracket.lastIndex === m.index) reBracket.lastIndex++;
      continue;
    }
    const captured = text.slice(m.index, m.index + full.length);
    if (isSemanticStencilMaskBracket(captured)) {
      continue;
    }
    spans.push({
      start: m.index,
      end: m.index + full.length,
      text: captured,
      type: 'formula_bracket',
      patternName: 'formula_bracket',
    });
  }
  spans = mergeSpansRaw(spans);
  blanked = blankRangesInText(
    text,
    spans.map((s) => ({ start: s.start, end: s.end }))
  );

  execIter = 0;
  const reParen = new RegExp(FORMULA_PAREN, 'g');
  while ((m = reParen.exec(blanked)) !== null) {
    if (++execIter > MAX_REGEX_EXEC_ITER) {
      console.error('[formulaMagnet] Safety: formula_paren exec exceeded', MAX_REGEX_EXEC_ITER);
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reParen.lastIndex === m.index) reParen.lastIndex++;
      continue;
    }
    spans.push({
      start: m.index,
      end: m.index + full.length,
      text: text.slice(m.index, m.index + full.length),
      type: 'formula_paren',
      patternName: 'formula_paren',
    });
  }
  spans = mergeSpansRaw(spans);
  blanked = blankRangesInText(
    text,
    spans.map((s) => ({ start: s.start, end: s.end }))
  );

  execIter = 0;
  const reIn = new RegExp(FORMULA_LATEX_INLINE, 'g');
  while ((m = reIn.exec(blanked)) !== null) {
    if (++execIter > MAX_REGEX_EXEC_ITER) {
      console.error('[formulaMagnet] Safety: formula_inline exec exceeded', MAX_REGEX_EXEC_ITER);
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reIn.lastIndex === m.index) reIn.lastIndex++;
      continue;
    }
    const inner = full.slice(1, -1);
    if (!isValidInlineFormulaBody(inner)) continue;
    spans.push({
      start: m.index,
      end: m.index + full.length,
      text: text.slice(m.index, m.index + full.length),
      type: 'formula_inline',
      patternName: 'formula_inline',
    });
  }
  return mergeSpansRaw(spans);
}

/** Первые `maxChars` кодовых точек в hex (0x24 = ASCII `$`; U+FF04 = полноширинный доллар). */
export function textPrefixHex(text: string, maxChars: number): string {
  const parts: string[] = [];
  let n = 0;
  for (const ch of text) {
    if (n >= maxChars) break;
    const cp = ch.codePointAt(0) ?? 0;
    parts.push(cp.toString(16).padStart(2, '0'));
    n++;
  }
  return parts.join(' ') || '(empty)';
}
