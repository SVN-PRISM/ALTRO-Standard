/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * Пайплайн UI: textarea → `buildStencilForDisplay` (Sieve: $$ → $ → сущности по тем же RegExp, что Masker фаза 2) → `buildStencilFromEntities`.
 * Реестр матчится по **исходному** `sourceText` (как в `Masker.mask`), без «ослепления» blank формул; затем выжигание, прочие монолиты, `MASKER_SECONDARY_REST_SPECS`.
 */
import { type EntityMatch, type EntityType } from './EntityScanner';
import { blankRangesInText, spanOverlaps, textPrefixHex } from './formulaMagnet';
import {
  MASKER_SECONDARY_REST_SPECS,
  PRIORITY_MONOLITHS_NON_REGISTRY,
  PRIORITY_REGISTRY_MONOLITH_SPECS,
} from './MaskerClient';

export interface StencilDisplayResult {
  maskedText: string;
  ipaToEntity: Array<{ ipaId: number; start: number; end: number; type: string }>;
}

const MAX_REGEX_EXEC = 10000;

function maskerSecondaryTypeToEntityType(maskerType: string): EntityType {
  if (maskerType === 'formula') return 'formula_paren';
  if (maskerType === 'money') return 'money';
  if (maskerType === 'percent') return 'percent';
  if (maskerType === 'date_monolith') return 'date';
  if (maskerType === 'date' || maskerType === 'daterange') return maskerType;
  if (maskerType === 'unit' || maskerType.startsWith('unit_')) return 'number';
  if (
    maskerType === 'registry_number' ||
    maskerType === 'org_tax_monolith' ||
    maskerType === 'person_full_name' ||
    maskerType === 'inn' ||
    maskerType === 'kpp_code' ||
    maskerType === 'organization_name'
  )
    return 'id_tag';
  return 'number';
}

function entityPriorityMerge(t: EntityType): number {
  if (
    t === 'formula_display' ||
    t === 'formula_inline' ||
    t === 'formula_bracket' ||
    t === 'formula_paren'
  )
    return 100;
  if (t === 'money') return 40;
  if (t === 'percent') return 35;
  /** Реестр / реквизиты / ФИО — выше сырых чисел при конфликте длины. */
  if (t === 'id_tag') return 38;
  if (t === 'date' || t === 'daterange') return 30;
  if (t === 'timeref') return 25;
  return 10;
}

/** Слияние пересечений: длина, затем приоритет (как Masker / EntityScanner). */
function mergeEntityMatches(spans: EntityMatch[]): EntityMatch[] {
  const byLength = [...spans].sort((a, b) => {
    const la = a.end - a.start;
    const lb = b.end - b.start;
    if (lb !== la) return lb - la;
    return entityPriorityMerge(b.type) - entityPriorityMerge(a.type);
  });
  const selected: EntityMatch[] = [];
  for (const s of byLength) {
    const overlaps = selected.some((x) => !(s.end <= x.start || s.start >= x.end));
    if (!overlaps) selected.push(s);
  }
  selected.sort((a, b) => a.start - b.start);
  return selected;
}

/**
 * Строит трафарет из уже посчитанных сущностей (массив `EntityMatch`).
 */
export function buildStencilFromEntities(sourceText: string, entities: EntityMatch[]): StencilDisplayResult {
  if (entities.length === 0) {
    return { maskedText: sourceText, ipaToEntity: [] };
  }

  const sorted = [...entities]
    .filter((e) => e.end > e.start)
    .sort((a, b) => {
      const byStart = a.start - b.start;
      if (byStart !== 0) return byStart;
      return b.end - b.start - (a.end - a.start);
    });

  let result = '';
  let pos = 0;
  const ipaToEntity: Array<{ ipaId: number; start: number; end: number; type: string }> = [];
  let ipaId = 0;

  for (const e of sorted) {
    if (e.start < pos) {
      if (typeof window !== 'undefined') {
        console.warn('[Stencil] buildStencilFromEntities: skip overlapping/out-of-order span', {
          type: e.type,
          start: e.start,
          end: e.end,
          pos,
        });
      }
      continue;
    }
    result += sourceText.slice(pos, e.start);
    ipaId += 1;
    result += `{{IPA_${ipaId}}}`;
    ipaToEntity.push({ ipaId, start: e.start, end: e.end, type: e.type });
    if (typeof window !== 'undefined') {
      console.log(
        '[DEBUG INDEXES] Block:',
        ipaId,
        'Type:',
        e.type,
        'Start:',
        e.start,
        'End:',
        e.end,
        'Value:',
        sourceText.slice(e.start, e.end)
      );
    }
    pos = e.end;
  }
  result += sourceText.slice(pos);

  return { maskedText: result, ipaToEntity };
}

/**
 * Извлечение сущностей для трафарета (формулы, затем те же вторичные паттерны, что Masker).
 */
function computeStencilEntities(sourceText: string): EntityMatch[] {
  const detectedBlocks: EntityMatch[] = [];
  let workingText = sourceText;

  // Phase 1 — display formulas (mask first so inline $ does not steal from $$ regions)
  const reDisplay = /\$\$(.*?)\$\$/gs;
  let m: RegExpExecArray | null;
  let execIter = 0;
  while ((m = reDisplay.exec(workingText)) !== null) {
    if (++execIter > MAX_REGEX_EXEC) {
      console.error('[Stencil] Phase 1: exec cap');
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reDisplay.lastIndex === m.index) reDisplay.lastIndex++;
      continue;
    }
    const start = m.index;
    const end = start + full.length;
    detectedBlocks.push({ start, end, type: 'formula_display', text: sourceText.slice(start, end) });
    if (typeof window !== 'undefined') {
      console.log('[DEBUG INDEXES] Layer 1 (display_formula)', { start, end, slice: sourceText.slice(start, end) });
    }
    workingText =
      workingText.slice(0, start) + ' '.repeat(end - start) + workingText.slice(end);
    reDisplay.lastIndex = 0;
  }

  // Phase 2 — inline formulas (does not cross newlines: no .)
  const reInline = /\$(.*?)\$/g;
  execIter = 0;
  while ((m = reInline.exec(workingText)) !== null) {
    if (++execIter > MAX_REGEX_EXEC) {
      console.error('[Stencil] Phase 2: exec cap');
      break;
    }
    const full = m[0];
    if (full.length === 0) {
      if (reInline.lastIndex === m.index) reInline.lastIndex++;
      continue;
    }
    const start = m.index;
    const end = start + full.length;
    detectedBlocks.push({ start, end, type: 'formula_inline', text: sourceText.slice(start, end) });
    if (typeof window !== 'undefined') {
      console.log('[DEBUG INDEXES] Layer 2 (inline_formula)', { start, end, slice: sourceText.slice(start, end) });
    }
    workingText =
      workingText.slice(0, start) + ' '.repeat(end - start) + workingText.slice(end);
    reInline.lastIndex = 0;
  }

  // Phase 3 — как Masker: сначала только реестр, вырезание, затем остальные монолиты, вырезание, затем вторичные паттерны.
  const collectMaskerSpecs = (
    text: string,
    specs: ReadonlyArray<{ source: string; flags: string; type: string; patternName: string }>
  ): EntityMatch[] => {
    const raw: EntityMatch[] = [];
    for (const spec of specs) {
      const re = new RegExp(spec.source, spec.flags);
      execIter = 0;
      while ((m = re.exec(text)) !== null) {
        if (++execIter > MAX_REGEX_EXEC) break;
        const start = m.index;
        const end = m.index + m[0].length;
        if (/^\s+$/.test(m[0])) continue;
        raw.push({
          start,
          end,
          type: maskerSecondaryTypeToEntityType(spec.type),
          text: sourceText.slice(start, end),
        });
      }
    }
    return raw;
  };

  const phase3RegistryRaw = collectMaskerSpecs(sourceText, PRIORITY_REGISTRY_MONOLITH_SPECS).filter(
    (e) =>
      !detectedBlocks.some(
        (f) =>
          (f.type === 'formula_display' || f.type === 'formula_inline') && spanOverlaps(e, f)
      )
  );
  const phase3RegistryMerged = mergeEntityMatches(phase3RegistryRaw);
  const workingAfterRegistry = blankRangesInText(
    workingText,
    phase3RegistryMerged.map((e) => ({ start: e.start, end: e.end }))
  );
  const phase3OtherMonoRaw = collectMaskerSpecs(workingAfterRegistry, PRIORITY_MONOLITHS_NON_REGISTRY);
  const phase3MonolithRaw = [...phase3RegistryRaw, ...phase3OtherMonoRaw];
  const phase3MonolithMerged = mergeEntityMatches(phase3MonolithRaw);
  const workingAfterMonolith = blankRangesInText(
    workingText,
    phase3MonolithMerged.map((e) => ({ start: e.start, end: e.end }))
  );
  const phase3RestRaw = collectMaskerSpecs(workingAfterMonolith, MASKER_SECONDARY_REST_SPECS);
  const phase3Raw = [...phase3MonolithRaw, ...phase3RestRaw];
  const phase3Merged = mergeEntityMatches(phase3Raw);
  for (const e of phase3Merged) {
    if (typeof window !== 'undefined') {
      console.log('[DEBUG INDEXES] Layer 3 (standard)', {
        type: e.type,
        start: e.start,
        end: e.end,
        slice: sourceText.slice(e.start, e.end),
      });
    }
  }
  detectedBlocks.push(...phase3Merged);

  const merged = mergeEntityMatches(detectedBlocks);

  type PartitionSegment =
    | { start: number; end: number; type: 'plain_text' }
    | { start: number; end: number; type: EntityType; text: string };

  const sorted = [...merged].sort((a, b) => a.start - b.start);
  const partition: PartitionSegment[] = [];
  let cursor = 0;
  for (const e of sorted) {
    if (e.start > cursor) {
      partition.push({ start: cursor, end: e.start, type: 'plain_text' });
    }
    if (e.start < cursor) {
      if (typeof window !== 'undefined') {
        console.warn('[Stencil] Reconciliation: overlap after merge', e);
      }
      continue;
    }
    partition.push({ start: e.start, end: e.end, type: e.type, text: e.text });
    cursor = e.end;
  }
  if (cursor < sourceText.length) {
    partition.push({ start: cursor, end: sourceText.length, type: 'plain_text' });
  }

  const totalLen = partition.reduce((s, p) => s + (p.end - p.start), 0);
  if (typeof window !== 'undefined') {
    console.log('[DEBUG INDEXES] Reconciliation (water)', {
      segments: partition.length,
      totalLen,
      sourceLen: sourceText.length,
      plainTextRuns: partition.filter((p) => p.type === 'plain_text').length,
    });
  }
  if (totalLen !== sourceText.length) {
    console.warn('[Stencil] Partition length mismatch', { totalLen, sourceLen: sourceText.length });
  }

  const entitiesForMask: EntityMatch[] = partition.filter(
    (p): p is EntityMatch => p.type !== 'plain_text'
  );

  return entitiesForMask;
}

/**
 * Как {@link buildStencilFromEntities}, но «вода» между сущностями прогоняется через `maskPlain`
 * (SemanticFirewall: [ID:MASK_*]), чтобы монитор совпадал с диагностическим логом.
 */
function buildStencilFromEntitiesWithSemanticPlain(
  sourceText: string,
  entities: EntityMatch[],
  maskPlain: (plain: string) => string
): StencilDisplayResult {
  if (entities.length === 0) {
    return { maskedText: maskPlain(sourceText), ipaToEntity: [] };
  }

  const sorted = [...entities]
    .filter((e) => e.end > e.start)
    .sort((a, b) => {
      const byStart = a.start - b.start;
      if (byStart !== 0) return byStart;
      return b.end - b.start - (a.end - a.start);
    });

  let result = '';
  let pos = 0;
  const ipaToEntity: Array<{ ipaId: number; start: number; end: number; type: string }> = [];
  let ipaId = 0;

  for (const e of sorted) {
    if (e.start < pos) {
      if (typeof window !== 'undefined') {
        console.warn('[Stencil] buildStencilFromEntitiesWithSemanticPlain: skip overlapping/out-of-order span', {
          type: e.type,
          start: e.start,
          end: e.end,
          pos,
        });
      }
      continue;
    }
    result += maskPlain(sourceText.slice(pos, e.start));
    ipaId += 1;
    result += `{{IPA_${ipaId}}}`;
    ipaToEntity.push({ ipaId, start: e.start, end: e.end, type: e.type });
    pos = e.end;
  }
  result += maskPlain(sourceText.slice(pos));

  return { maskedText: result, ipaToEntity };
}

/**
 * Семантический слой поверх сущностей: только plain_text сегменты → maskPlain (DIFUZZY / STENCIL LOCK).
 * @deprecated Для UI-монитора предпочтительно `SovereignController.prepareStencil` (единый пайплайн с Masker).
 */
export function buildStencilForDisplayWithSemantic(
  sourceText: string,
  maskPlain: (plain: string) => string
): StencilDisplayResult {
  const entities = computeStencilEntities(sourceText);
  return buildStencilFromEntitiesWithSemanticPlain(sourceText, entities, maskPlain);
}

/**
 * Layered extraction (Sieve): display $$ → inline $ → стандартные сущности (Masker secondary specs).
 * Реконсиляция: сортировка по start, «вода» plain_text между блоками, контроль длины.
 */
export function buildStencilForDisplay(sourceText: string): StencilDisplayResult {
  if (typeof window !== 'undefined') {
    console.log('[PIPELINE CHECK] Raw length received:', sourceText.length);
    console.log('[Stencil UI] ORIGINAL_TEXT_HEX:', textPrefixHex(sourceText, 100), '| length=', sourceText.length);
  }

  const entitiesForMask = computeStencilEntities(sourceText);
  return buildStencilFromEntities(sourceText, entitiesForMask);
}
