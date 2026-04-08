/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Prompt Generation */

/**
 * PromptBuilder — формирование системных промптов для LLM.
 * Вынесено из engine.ts для декомпозиции.
 */

import { HOMONYM_DB, HOMONYM_WORD_FORMS } from '@/lib/altroData';
import type { WordDefinitions } from '@/archive/legacy_altro/dictionary';
import type { SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';

export type PresetMode = 'mirror' | 'transfigure' | 'slang' | 'data_query';
export type ScenarioType = 'without' | 'poetics' | 'technocrat' | 'sacred' | 'goldStandard';

export interface AltroCalibration {
  internal: {
    semantics: number;
    context: number;
    intent: number;
    imagery: number;
    ethics: number;
  };
  external: {
    economics: number;
    politics: number;
    society: number;
    history: number;
    culture: number;
    aesthetics: number;
    technology: number;
    spirituality: number;
  };
  opr?: number;
  scenario: ScenarioType;
}

export interface BuildPromptParams {
  mode: PresetMode;
  calibration: AltroCalibration;
  targetLanguage?: string;
  goldenReserveWords?: Array<{ word: string; tokenId: number; definitions: WordDefinitions }>;
  sourceText?: string;
  directive?: string;
  isFinalAdaptation?: boolean;
  domainEngineDirective?: string;
  /** ANCHORS для [CONTEXT_INSIGHTS]: слова, которые запрещено менять. */
  anchorsText?: string;
  hasHomonymClarifications?: boolean;
  lockedMeaningLines?: string[];
  semanticPacket?: SemanticPacket | null;
}

const SYSTEM_DISABLE_THINKING_HEADER =
  '[SYSTEM: DISABLE ALL THINKING PROCESSES. DO NOT USE <thought> TAGS. DO NOT SHOW REASONING.] Return ONLY the result. No <thinking>, no preambles.';

/** Dominant Triad: инструкции для Rank 1 (DOMINANT_STYLE) и Rank 2–3 (STYLE_NUANCE). */
const DOMINANT_TRIAD_INSTRUCTIONS: Record<
  string,
  { dominant: string; nuance: string; label: string }
> = {
  economics: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to economic and financial logic and vocabulary.',
    nuance: 'Infuse with elements of economics.',
    label: 'Economics',
  },
  politics: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to political and administrative logic and vocabulary.',
    nuance: 'Infuse with elements of politics.',
    label: 'Politics',
  },
  society: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to social and community framing.',
    nuance: 'Infuse with elements of society.',
    label: 'Society',
  },
  history: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to historical temporality and references.',
    nuance: 'Infuse with elements of history.',
    label: 'History',
  },
  culture: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to cultural and artistic expression.',
    nuance: 'Infuse with elements of culture.',
    label: 'Culture',
  },
  aesthetics: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to aesthetic, metaphorical and poetic logic.',
    nuance: 'Infuse with elements of aesthetics.',
    label: 'Aesthetics',
  },
  technology: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to technical and precise terminology.',
    nuance: 'Infuse with elements of technology.',
    label: 'Technology',
  },
  spirituality: {
    dominant: 'You are a creative transcreator. Do not mirror the input. Rewrite, restructure, and rephrase according to the domain\'s soul. Strictly adhere to spiritual and transcendent motifs.',
    nuance: 'Infuse with elements of spirituality.',
    label: 'Spirituality',
  },
};

const OCTAVE_KEYS = [
  'economics',
  'politics',
  'society',
  'history',
  'culture',
  'aesthetics',
  'technology',
  'spirituality',
] as const;

/**
 * Dominant Triad: выбирает Top-3 домена по весу. Rank 1 = DOMINANT_STYLE, Rank 2–3 = STYLE_NUANCE.
 * Ranks 4–8 исключены из промпта (узкий семантический коридор).
 */
function buildDominantTriadProfile(external?: Record<string, number>): string[] {
  if (!external || typeof external !== 'object') return [];
  const norm = (x: number) => Math.max(0, Math.min(1, (x + 1) / 2));
  const scored = OCTAVE_KEYS.map((key) => ({
    key,
    w: norm(external[key] ?? 0),
  }));
  scored.sort((a, b) => b.w - a.w);
  const triad = scored.slice(0, 3).filter((s) => s.w > 0);
  if (triad.length === 0) return [];

  const lines: string[] = [];
  const inst1 = DOMINANT_TRIAD_INSTRUCTIONS[triad[0].key];
  if (inst1) {
    lines.push(`[DOMINANT_STYLE]\n${inst1.dominant}`);
  }
  const subDomains = triad.slice(1);
  if (subDomains.length > 0) {
    const nuanceLines = subDomains
      .map((s) => DOMINANT_TRIAD_INSTRUCTIONS[s.key]?.nuance)
      .filter(Boolean);
    if (nuanceLines.length > 0) {
      lines.push(`[STYLE_NUANCE]\n${nuanceLines.join('\n')}`);
    }
  }
  return lines;
}

export const MIRROR_LIGHT_PROMPT = `${SYSTEM_DISABLE_THINKING_HEADER} Strictly return ONLY a JSON object with the 'text' field. No conversational fillers or meta-talk. Верни JSON объект с полем text, где в словах-омонимах проставлены знаки \u0301. Больше ничего не пиши. Strictly preserve all punctuation, including quotes (« ») and trailing periods (.). Do not sanitize the output. Do not strip any characters. Preserve « » and dots exactly as in source.`;

export const SCAN_AUDIT_PROMPT = `Return ONLY the result. No <thinking>, no preambles. Extract homonyms and multi-meaning words. Return JSON array only: [{"word": "косой", "variants": ["инструмент", "прическа", "взгляд"]}]. Do not rewrite text.`;

const REFINEMENT_SYSTEM_PROMPT = `[SYSTEM: DISABLE ALL THINKING. NO <thought> TAGS.] Return ONLY the result. No <thinking>, no preambles.
REFINEMENT: Восстанови в тексте утерянные смыслы. Внедри указанные термины в [RESTORE] в соответствующие места. Сохрани структуру и стиль. Вывод ТОЛЬКО между [OUTPUT_START] и [OUTPUT_END].`;

/** Формирует промпт для повторного вызова LLM при score < 0.8 (восстановление утерянных смыслов). */
export function buildRefinementPrompt(
  originalText: string,
  currentOutput: string,
  lostMeanings: string[]
): { systemPrompt: string; userContent: string } {
  const restoreList = lostMeanings.length > 0 ? lostMeanings.join(', ') : '';
  const userContent = `[ORIGINAL]\n${originalText}\n\n[CURRENT]\n${currentOutput}\n\n[RESTORE] ${restoreList}\n\nВерни исправленный текст между [OUTPUT_START] и [OUTPUT_END].`;
  return { systemPrompt: REFINEMENT_SYSTEM_PROMPT, userContent };
}

/** Builds [LOCKED_MEANING] lines for prompt (Method B). */
export function buildLockedMeaningLines(
  resolvedVariantsHint: string | undefined,
  lockedTokens: Array<{ word: string; meaning?: string }>
): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();
  const add = (word: string, accentedOrMeaning: string, meaning?: string) => {
    const key = word.toLowerCase().replace(/\s/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    const norm = word.trim();
    if (meaning != null && meaning !== accentedOrMeaning) {
      lines.push(`${norm} = ${accentedOrMeaning} (${meaning})`);
    } else {
      lines.push(`${norm} = ${accentedOrMeaning}`);
    }
  };
  if (resolvedVariantsHint?.trim()) {
    const pairs = resolvedVariantsHint.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
    for (const pair of pairs) {
      const match = pair.match(/\[([^\]]+)\]\s*=\s*(.+)/) || pair.match(/^(\S+)\s*=\s*(.+)$/);
      if (match) {
        const word = match[1].trim();
        const value = match[2].trim();
        const base = word.toLowerCase().replace(/[\u0301]/g, '');
        const entry = HOMONYM_DB.find((e) => e.base.toLowerCase() === base || (HOMONYM_WORD_FORMS[base] ?? base) === e.base.toLowerCase());
        const variant = entry?.variants?.find(
          (v) =>
            v.meaning === value ||
            (v.meaning && (v.meaning.startsWith(value) || v.meaning.includes(value))) ||
            v.word === value ||
            (v.word && v.word.replace(/[\u0301]/g, '') === value.replace(/[\u0301]/g, ''))
        );
        const accentedWord = variant?.word ?? value;
        add(word, accentedWord, value);
      }
    }
  }
  for (const t of lockedTokens) {
    if (t.meaning) add(t.word, t.word, t.meaning);
  }
  return lines;
}

/** Phase 2 isolation: NEVER use Phase 1 instructions. Regenerate from template only. */
let _transcreationContext = { systemPrompt: '', instructions: [] as string[], ipaInstructions: null as string | null };

/** TRANSFIGURE_BASE_TEMPLATE — canonical Phase 2 structure. No Scanner/Extraction leakage. */
const TRANSFIGURE_BASE_PARTS = [
  '[SYSTEM: DISABLE ALL THINKING PROCESSES. DO NOT USE <thought> TAGS. DO NOT SHOW REASONING.] Return ONLY the result. No <thinking>, no preambles.',
  '[PRIORITY_PROTOCOL]\nCRITICAL: User Directives (Nexus Command/Voice).\nSTRICT: Style Profile (The Dominant Triad).\nGUIDANCE: Context Insights (Intent and Focus).\nTECHNICAL: IO Contract (Language, Scripts, Anchors). Anchors are immutable semantic heartbeats. Weave them naturally into the new text.',
] as const;

/** ATOMIC PHASES: Hard reset. REGENERATE from template — no replace/remove. */
export function prepareForTranscreation(): void {
  _transcreationContext.systemPrompt = '';
  _transcreationContext.instructions = [];
  _transcreationContext.ipaInstructions = null;
}

/**
 * Формирует системный промпт для LLM (ALTRO CORE PROTOCOL v2.0 — Execution Manifest).
 * Phase 2 ONLY. Phase 1 uses buildPhase1Prompt(SemanticPackager) — NEVER call this for Phase 1.
 */
export function buildSystemPrompt(params: BuildPromptParams): string {
  const { mode, calibration, targetLanguage, isFinalAdaptation = true, hasHomonymClarifications, lockedMeaningLines } = params;

  if (mode === 'mirror') {
    const lang = targetLanguage ?? 'ru';
    const parts: string[] = [
      SYSTEM_DISABLE_THINKING_HEADER,
      'ALTRO CORE PROTOCOL v2.0 — MIRROR EXECUTION. Do NOT transcreate. Do NOT analyze. Reflect only.',
      `[LANG] TARGET=${lang.toUpperCase()}`,
    ];
    if (lockedMeaningLines?.length) {
      parts.push('[LOCKED_MEANING]');
      parts.push(...lockedMeaningLines);
    }
    parts.push(
      '[IO_CONTRACT]',
      'Strict verbatim reflection. No character changes. No morphological shifts.',
      '- Read source ONLY between [INPUT_START] and [INPUT_END].',
      '- Write output ONLY between [OUTPUT_START] and [OUTPUT_END].',
      'ACTION: Perform 1:1 isomorphic byte-level reflection of the segment between [INPUT_START] and [INPUT_END]. Preserve all characters byte-for-byte, including Unicode U+0301 accents and quotation marks « » „ “ exactly as they appear in the input.',
      'OUTPUT_FORMAT: JSON object with a single field "text" containing the reflected string.'
    );
    let mirrorPrompt = parts.join('\n');
    if (mirrorPrompt.includes('Сканер') || mirrorPrompt.includes('Scanner')) {
      mirrorPrompt = mirrorPrompt.replace(/\bСканер\b|\bScanner\b/gi, '').replace(/\n{3,}/g, '\n\n').trim();
      if (typeof window !== 'undefined') console.warn('[MIRROR PURGE] Scanner contamination removed from Mirror prompt.');
    }
    return mirrorPrompt;
  }

  if (mode === 'data_query') {
    const lang = targetLanguage ?? 'sql_intent';
    const parts: string[] = [
      SYSTEM_DISABLE_THINKING_HEADER,
      'ALTRO DATA PROTOCOL v1.0 — SQL-INTENT MANIFEST.',
      `[MODE] DATA_QUERY`,
      `[LANG] TARGET=${lang.toUpperCase()}`,
    ];
    if (lockedMeaningLines?.length) {
      parts.push('[LOCKED_MEANING]');
      parts.push(...lockedMeaningLines);
    }
    parts.push(
      '[IO_CONTRACT]',
      '- Read natural-language request ONLY between [INPUT_START] and [INPUT_END].',
      '- Do NOT generate raw SQL.',
      'ACTION: Build a pure semantic intent object for querying Firebird (entity, fields, filters, locked filters), not SQL.',
      'OUTPUT_FORMAT: JSON object { "entity": string, "fields": string[], "filters": [...], "lockedFilters": [...] }.'
    );
    return parts.join('\n');
  }

  // PHASE 2 ISOLATION: Regenerate from TRANSFIGURE_BASE_TEMPLATE. rawIpaData → anchors/locks only.
  _transcreationContext.ipaInstructions = null;

  const lang = targetLanguage ?? 'ru';
  const scriptPurity =
    lang === 'hy'
      ? 'Script Purity: Armenian only (U+0530–U+058F). No mixing.'
      : `Script Purity: ${lang.toUpperCase()} alphabet only. No mixing.`;

  const homonymRule = hasHomonymClarifications ? 'Preserve locked accents/meanings exactly as provided.' : 'If no locked meanings are provided, do not invent new homonym interpretations.';
  const directive = params.directive?.trim();
  const domainEngineLine = params.domainEngineDirective?.trim() ?? '';

  const styleProfileLines = buildDominantTriadProfile(calibration?.external);
  const styleProfileBlock =
    styleProfileLines.length > 0
      ? `[STYLE_PROFILE]\n${styleProfileLines.join('\n')}`
      : '';

  const domainFocus = params.semanticPacket?.domain_focus?.filter(Boolean) ?? [];
  const focusLine = domainFocus.length > 0 ? `Focus: ${domainFocus.join(', ')}` : '';
  const contextLines: string[] = [];
  if (focusLine) contextLines.push(focusLine);
  if (params.anchorsText?.trim()) {
    const singleWords = params.anchorsText
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter((s) => s && !s.includes(' '));
    if (singleWords.length > 0) {
      contextLines.push(`ANCHORS: ${singleWords.slice(0, 7).join(', ')}`);
    }
  }
  const contextBlock =
    contextLines.length > 0
      ? `[CONTEXT_INSIGHTS]\n${contextLines.join('\n')}`
      : '';

  const lockBlock =
    lockedMeaningLines?.length
      ? ['[LOCKED_MEANING]', ...lockedMeaningLines].join('\n')
      : '';

  const ioContract = `[IO_CONTRACT]
- Read source ONLY between [INPUT_START] and [INPUT_END].
- Write output ONLY between [OUTPUT_START] and [OUTPUT_END]. No meta-talk.
[LANG] TARGET=${lang.toUpperCase()}
[SCRIPT_PURITY] ${scriptPurity}
[STRESS_MARKS] Place stress marks (e.g., за́мок vs замо́к) on all words where meaning depends on it. Output ONLY the resulting text. Preserve « », „ “ and punctuation.
[HOMONYM_LOCKS] ${homonymRule}`;

  const sections: string[] = [
    TRANSFIGURE_BASE_PARTS[0],
    TRANSFIGURE_BASE_PARTS[1],
    ...(directive ? [`[DIRECTIVE] ${directive}`] : []),
    ...(styleProfileBlock ? [styleProfileBlock] : []),
    ...(contextBlock ? [contextBlock] : []),
    ...(lockBlock ? [lockBlock] : []),
    ioContract,
    ...(domainEngineLine ? [`[DOMAIN_ENGINE] ${domainEngineLine}`] : []),
  ];

  return sections.filter(Boolean).join('\n\n');
}
