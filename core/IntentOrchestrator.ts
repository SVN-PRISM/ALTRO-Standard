/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import { INITIAL_DOMAIN_WEIGHTS, type DomainWeights } from '@/lib/altroData';

/** Все ключи доменов (порядок как в DomainWeights). */
const DOMAIN_KEYS = [
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
] as const satisfies readonly (keyof DomainWeights)[];

function isDomainKey(s: string): s is keyof DomainWeights {
  return (DOMAIN_KEYS as readonly string[]).includes(s);
}

/** Содержимое блока `[ALTRO: ...]` (без внешних скобок). */
const ALTRO_BLOCK_RE = /\[ALTRO:\s*([^\]]*)\]/i;

/** Все блоки `[ALTRO: …]` в строке (для merge). */
const ALTRO_BLOCK_G_RE = /\[ALTRO:\s*([^\]]*)\]/gi;

/**
 * Склеивает несколько `[ALTRO: …]` в один блок (пары через запятую).
 * Если блоков нет — возвращает исходную строку.
 */
export function mergeAllAltroBlocks(text: string): string {
  const inners: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(ALTRO_BLOCK_G_RE.source, ALTRO_BLOCK_G_RE.flags);
  while ((m = re.exec(text)) !== null) {
    const inner = (m[1] ?? '').trim();
    if (inner) inners.push(inner);
  }
  if (inners.length === 0) return text;
  return `[ALTRO: ${inners.join(', ')}]`;
}

/** Удаляет все `[ALTRO: …]` из текста (для legacy keyword без содержимого директивы). */
export function stripAllAltroBlocksFromText(text: string): string {
  return text.replace(/\[ALTRO:\s*[^\]]*\]/gi, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Удаляет блоки `[ALTRO: …]` из текста и возвращает список внутренностей (для resolveWeights).
 */
export function stripAltroDirectivesFromText(text: string): { text: string; strippedInners: string[] } {
  const strippedInners: string[] = [];
  const cleaned = text.replace(/\[ALTRO:\s*([^\]]*)\]/gi, (_, inner: string) => {
    const t = String(inner).trim();
    if (t) strippedInners.push(t);
    return ' ';
  });
  return { text: cleaned.replace(/\s+/g, ' ').trim(), strippedInners };
}

/**
 * Профили: при совпадении любого ключевого слова — задаётся набор весов (0..1).
 * Несколько профилей могут суммироваться через max по каждому ключу.
 * RU + EN — отдельные ключи, без смешения в одной группе.
 */
const INTENT_PROFILES: ReadonlyArray<{
  keywords: readonly string[];
  weights: Partial<DomainWeights>;
}> = [
  {
    keywords: [
      'инженер',
      'инженерный',
      'технич',
      'технический',
      'отчет',
      'отчёт',
      'сухой',
      'dry',
      'engineering',
      'technical',
      'report',
      'spec',
      'blueprint',
    ],
    weights: { technology: 1, context: 0.8 },
  },
  {
    keywords: [
      'инвест',
      'расход',
      'деньги',
      'финанс',
      'бюджет',
      'invest',
      'expense',
      'money',
      'finance',
      'budget',
      'cost',
      'revenue',
    ],
    weights: { economics: 1, intent: 0.7 },
  },
  {
    keywords: ['финансы', 'риск', 'risk', 'market', 'рынок', 'акци'],
    weights: { economics: 0.9 },
  },
  {
    keywords: ['закон', 'договор', 'право', 'law', 'contract', 'legal', 'court'],
    weights: { politics: 1 },
  },
  {
    keywords: ['душа', 'смысл', 'обитель', 'soul', 'meaning', 'sacred', 'духов'],
    weights: { spirituality: 1, ethics: 0.6 },
  },
  {
    keywords: ['истор', 'history', 'прошл', 'past', 'heritage'],
    weights: { history: 0.9, culture: 0.5 },
  },
  {
    keywords: ['культур', 'culture', 'tradition', 'традиц', 'искусств', 'art'],
    weights: { culture: 1, aesthetics: 0.7 },
  },
  {
    keywords: ['обществ', 'society', 'social', 'люди', 'people'],
    weights: { society: 0.9 },
  },
  {
    keywords: ['эстетик', 'aesthetic', 'beauty', 'красот', 'стиль', 'style'],
    weights: { aesthetics: 1 },
  },
  {
    keywords: ['семант', 'semantic', 'meaning', 'значен', 'смысл текста'],
    weights: { semantics: 0.9 },
  },
  {
    keywords: ['образ', 'imagery', 'метафор', 'metaphor', 'поэтич', 'poetic'],
    weights: { imagery: 0.9 },
  },
  {
    keywords: ['этик', 'ethics', 'морал', 'moral', 'нравств'],
    weights: { ethics: 1 },
  },
];

function mergeMax(base: DomainWeights, patch: Partial<DomainWeights>): void {
  for (const k of Object.keys(patch) as (keyof DomainWeights)[]) {
    const v = patch[k];
    if (typeof v === 'number' && !Number.isNaN(v)) {
      base[k] = Math.max(base[k], Math.min(1, Math.max(-1, v)));
    }
  }
}

function parseWeightLevel(raw: string): number {
  const v = raw.trim().toLowerCase();
  if (v === 'high') return 2.0;
  if (v === 'medium') return 1.0;
  if (v === 'low') return 0.5;
  return 1.0;
}

/** Финальный множитель для всей матрицы после заполнения пар. */
function applyMatrixMultiplier(w: DomainWeights, mult: number): void {
  if (mult === 1 || !Number.isFinite(mult)) return;
  for (const k of DOMAIN_KEYS) {
    w[k] = Math.max(-1, Math.min(1, w[k] * mult));
  }
}

/**
 * Парсит `key=value` внутри блока [ALTRO: ...] (сегменты через запятую).
 * — `intent=<domain>`: домен из DOMAIN_KEYS → вес 1.0
 * — `weight=high|medium|low`: множитель всей матрицы
 * — `<domain>=<number>`: явное число для оси
 */
function applyAltroKeyValuePairs(
  inner: string,
  out: DomainWeights
): { matrixMult: number; hadWeightKey: boolean } {
  let matrixMult = 1.0;
  let hadWeightKey = false;
  const segments = inner
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const seg of segments) {
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const key = seg.slice(0, eq).trim().toLowerCase();
    const value = seg.slice(eq + 1).trim();
    if (!key || !value) continue;

    if (key === 'weight') {
      matrixMult = parseWeightLevel(value);
      hadWeightKey = true;
      continue;
    }

    if (key === 'intent') {
      const name = value.toLowerCase();
      if (isDomainKey(name)) {
        out[name] = 1.0;
      }
      continue;
    }

    if (isDomainKey(key)) {
      const n = parseFloat(value.replace(',', '.'));
      if (!Number.isNaN(n)) {
        out[key] = Math.max(-1, Math.min(1, n));
      }
    }
  }

  return { matrixMult, hadWeightKey };
}

function resolveWeightsFromLegacy(haystack: string): DomainWeights {
  const out: DomainWeights = { ...INITIAL_DOMAIN_WEIGHTS };
  if (!haystack) return out;

  for (const profile of INTENT_PROFILES) {
    if (profile.keywords.some((kw) => haystack.includes(kw))) {
      mergeMax(out, profile.weights);
    }
  }

  return out;
}

/**
 * Автоматическое определение доменных весов по тексту намерения (command line / [USER_DIRECTIVE]).
 * Структурированная директива `[ALTRO: key=value, ...]` имеет приоритет; иначе — INTENT_PROFILES (keyword).
 */
export function resolveWeightsFromIntent(intent: string): DomainWeights {
  const trimmed = intent.trim();
  if (!trimmed) {
    return { ...INITIAL_DOMAIN_WEIGHTS };
  }

  const haystackForLegacy = stripAllAltroBlocksFromText(trimmed).toLowerCase().replace(/\s+/g, ' ').trim();
  const mergedForStructured = mergeAllAltroBlocks(trimmed);

  const altroMatch = mergedForStructured.match(ALTRO_BLOCK_RE);
  if (!altroMatch) {
    return resolveWeightsFromLegacy(haystackForLegacy);
  }

  const inner = (altroMatch[1] ?? '').trim();
  const out: DomainWeights = { ...INITIAL_DOMAIN_WEIGHTS };

  if (!inner) {
    return resolveWeightsFromLegacy(haystackForLegacy);
  }

  const { matrixMult, hadWeightKey } = applyAltroKeyValuePairs(inner, out);
  applyMatrixMultiplier(out, matrixMult);

  const anyStructured = DOMAIN_KEYS.some((k) => out[k] !== 0);
  if (!anyStructured) {
    const legacy = resolveWeightsFromLegacy(haystackForLegacy);
    if (hadWeightKey) {
      applyMatrixMultiplier(legacy, matrixMult);
    }
    return legacy;
  }

  return out;
}

/** Компактный объект для логов: ненулевые оси, шкала −1..1 (после clamp), до 4 знаков — без «×100». */
export function formatIntentWeightsForLog(w: DomainWeights): Record<string, number> {
  const o: Record<string, number> = {};
  for (const [k, v] of Object.entries(w) as [keyof DomainWeights, number][]) {
    if (v !== 0) o[String(k)] = Math.round(v * 10000) / 10000;
  }
  console.log('[ALTRO][Orchestrator] Applied Weights from Directive:', JSON.stringify(o));
  return o;
}
