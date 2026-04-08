/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 */

import type { DomainWeights } from '@/lib/altroData';

/** Version tag for logs and manifest alignment. */
export const ALTRO_UNIVERSAL_SYSTEM_PROMPT_VERSION = '2026-v1.2';

/**
 * Bilingual [TARGET] label for the universal prompt (e.g. Russian (русский)).
 */
export function targetLabelBilingual(targetLangCode: string): string {
  const c = targetLangCode.trim().toLowerCase() || 'ru';
  const map: Record<string, string> = {
    ru: 'Russian (русский)',
    en: 'English (английский)',
    it: 'Italian (italiano)',
    fr: 'French (français)',
    de: 'German (Deutsch)',
    es: 'Spanish (español)',
    hy: 'Armenian (հայերեն)',
  };
  return map[c] ?? `${c.toUpperCase()} (${c})`;
}

function buildMatrixCalibrationLines(directive: string | undefined, weights: DomainWeights | undefined): string[] {
  const d = directive?.trim() ?? '';
  if (!weights) return [];
  const active = (Object.entries(weights) as [keyof DomainWeights, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${String(k)} (${Math.round(v * 100)}%)`);
  if (!d) {
    if (active.length === 0) return [];
    return [
      '',
      '# MATRIX CALIBRATION (Intent Orchestrator):',
      'No explicit directive string was attached; inferred domain emphasis still applies where present.',
      `High-priority domains — adjust register and tone accordingly: ${active.join(', ')}.`,
    ];
  }
  if (active.length === 0) {
    return [
      '',
      '# MATRIX CALIBRATION (Intent Orchestrator):',
      `Based on the directive "${d}", no domain emphasis was inferred (neutral matrix). Use a clear, professional tone.`,
    ];
  }
  return [
    '',
    '# MATRIX CALIBRATION (Intent Orchestrator):',
    `Based on the directive "${d}", the semantic matrix has been calibrated.`,
    `High-priority domains — adjust your linguistic tone accordingly: ${active.join(', ')}.`,
  ];
}

export type UniversalPromptIntentOpts = {
  /** Сырой текст директивы (command line / [USER_DIRECTIVE]). */
  directive?: string;
  /** 13-доменная матрица из IntentOrchestrator. */
  weights?: DomainWeights;
};

/**
 * ALTRO UNIVERSAL SYSTEM PROMPT 2026 — Semantic Orchestration Layer.
 * References [SRC], [TARGET], {{IPA_N}} / IPA_NODES per ALTRO_CORE.md §1.
 */
export function buildAltroUniversalSystemPrompt2026(
  targetLangCode: string,
  intent?: UniversalPromptIntentOpts
): string {
  const target = targetLabelBilingual(targetLangCode);
  const calibration = buildMatrixCalibrationLines(intent?.directive, intent?.weights);

  return [
    '# ROLE: ALTRO SEMANTIC ORCHESTRATOR (Layer 1)',
    'You are the linguistic core of the ALTRO 1 System. Your mission is Transcreation: preserving semantic sovereignty while ensuring natural resonance in the target language.',
    '',
    '# INPUT STRUCTURE:',
    '- [SRC]: Source text segment.',
    `- [TARGET]: Destination language for this request — **${target}**.`,
    '- [IPA_NODES]: Abstract markers {{IPA_N}} representing pre-localized, immutable data "bricks".',
    ...calibration,
    '',
    '# CORE OPERATIONAL DIRECTIVES (MANIFESTO §1):',
    '1. DATA BIFURCATION: Never attempt to guess the content of {{IPA_N}}. Treat them as sacred grammatical objects already adapted to [TARGET].',
    '2. ADAPTIVE GRAMMAR (OPR): Do not translate word-for-word. Rebuild the sentence structure of [TARGET] so it naturally flows around the {{IPA_N}} markers.',
    '   - Adjust cases (падежи), genders, and prepositions to match the requirement of {{IPA_N}}.',
    '   - If a source preposition (e.g., English "on") is grammatically redundant in [TARGET], REMOVE IT.',
    '   - Labels {{IPA_N}} may contain physical units or currencies (energy, IT, measure, crypto). You must construct the sentence so that each label fits grammatically — including case agreement (падежное согласование) with the surrounding context in [TARGET].',
    '3. SEMANTIC SOVEREIGNTY: Ensure the "Point of Truth" remains intact. Do not add, omit, or modify the sequence of {{IPA_NODES}}.',
    '',
    '# OUTPUT CONSTRAINTS (ZERO-FOOTPRINT):',
    '- Respond ONLY with the transcreated text.',
    '- NO introductory phrases ("Here is the translation...").',
    '- NO markdown code blocks (unless the prompt specifically asks for code).',
    '- NO quotation marks wrapping the entire response.',
    '- NO internal monologue or explanations.',
    '',
    '# EXECUTION:',
    'Transcreate [SRC] into [TARGET] now.',
  ].join('\n');
}

/** Server-side: replace or insert the universal system message so Ollama always sees v1.2+ with optional matrix. */
export function applyAltroUniversalSystemPromptToMessages(
  messages: Array<{ role: string; content?: string }>,
  targetLangCode: string,
  intent?: UniversalPromptIntentOpts
): void {
  const universal = buildAltroUniversalSystemPrompt2026(targetLangCode, intent);
  const idx = messages.findIndex((m) => m.role === 'system');
  if (idx >= 0) {
    messages[idx] = { ...messages[idx], role: 'system', content: universal };
  } else {
    messages.unshift({ role: 'system', content: universal });
  }
}
