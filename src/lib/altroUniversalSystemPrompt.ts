/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 */

import { GOLDEN_ANCHORS } from '@core/manifests/golden_standard';
import { domainWeightsAreNeutral } from '@core/microTranscreate';
import type { DomainWeights } from '@/lib/altroData';

/** Version tag for logs and manifest alignment. */
export const ALTRO_UNIVERSAL_SYSTEM_PROMPT_VERSION = '2026-v1.4-MOD';

/** Runtime mode for `[COMMAND_INTERFACE]` (executor supplies exactly one). */
export type AltroCommandInterfaceDirective = 'ANALYZE' | 'TRANSFIGURE' | 'VALIDATE';

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

/** Однострочное ядро: роль без «воды». */
export function getKernel(cmd: AltroCommandInterfaceDirective): string {
  return `ALTRO 1 executor — active mode \`${cmd}\`; follow only the MODE pack and NORM below.`;
}

/** Взаимоисключающие паки режимов (никаких инструкций чужого режима). */
export function getModePack(cmd: AltroCommandInterfaceDirective, targetLabel: string): string {
  if (cmd === 'VALIDATE') {
    return [
      '=== MODE: VALIDATE ===',
      'Audit [DATA_SKELETON] and {{IPA_N}} for consistency with the DIRECTIVE; do not rewrite for style or fluency.',
      'Verdict only: structural isomorphism (slot count, order, labels); flag contradictions; do not invent missing bricks.',
    ].join('\n');
  }
  if (cmd === 'ANALYZE') {
    return [
      '=== MODE: ANALYZE ===',
      'Report structure, slots, and obligations implied by [DATA_SKELETON] and [IPA_NODES]; no full rewrite unless the DIRECTIVE explicitly requests it.',
    ].join('\n');
  }
  return [
    '=== MODE: TRANSFIGURE ===',
    `Target [TARGET]: **${targetLabel}**.`,
    'Transcreate natural prose around {{IPA_N}}; preserve slot count, order, and identity.',
    'OPR: adapt grammar and government in [TARGET] around slots only; drop source prepositions that are redundant in [TARGET].',
  ].join('\n');
}

/** Конституция (один абзац) + 4 сжатых буллита HAV / OPR / SV / Slots. */
export function getCoreNorms(): string {
  const constitution =
    'NORM (binding): External knowledge must not contradict [DATA_SKELETON] or [IPA_NODES]. Never guess slot contents. {{IPA_N}} sequence is immutable (count, order, labels). [TARGET] grammar may wrap slots only.';
  const checklist = [
    '• HAV: If world knowledge conflicts with the skeleton, defer to the skeleton and slots.',
    '• OPR: Case, gender, and government in [TARGET] must fit each {{IPA_N}}; units/currencies stay grammatical in situ.',
    '• SV (Sovereignty): Point-of-truth intact — no add, omit, or reorder of {{IPA_NODES}}.',
    '• Slots: Treat {{IPA_N}} as pre-localized bricks in [TARGET]; do not expose or reinterpret raw foreign literals.',
  ];
  return ['=== NORM + CHECKLIST ===', constitution, ...checklist].join('\n');
}

/** ~50% fewer checklist lines than {@link getCoreNorms}; EN folds OPR into one block. */
export function getCoreNormsLean(targetLangCode: string): string {
  const isEn =
    targetLangCode.trim().toLowerCase() === 'en' || targetLangCode.trim().toLowerCase().startsWith('en-');
  const block = isEn
    ? 'NORM: skeleton/{{IPA_N}} binding; no guessed slots; fixed order. EN: grammar around blocks; drop redundant Russian prepositions.'
    : 'NORM: skeleton/{{IPA_N}} binding; fixed slot order. [TARGET] grammar around blocks; bricks opaque.';
  return ['=== NORM + CHECKLIST (compact) ===', block].join('\n');
}

function getModePackLean(
  cmd: AltroCommandInterfaceDirective,
  targetLabel: string,
  targetLangCode: string
): string {
  const isEn =
    targetLangCode.trim().toLowerCase() === 'en' || targetLangCode.trim().toLowerCase().startsWith('en-');
  if (cmd === 'VALIDATE') {
    return `ALTRO 1 \`${cmd}\` (lean) — audit skeleton vs {{IPA_N}} vs DIRECTIVE; structural verdict only.`;
  }
  if (cmd === 'ANALYZE') {
    return `ALTRO 1 \`${cmd}\` (lean) — report structure/slots; rewrite only if DIRECTIVE demands.`;
  }
  if (isEn) {
    return `ALTRO 1 \`${cmd}\` (lean) — [TARGET]=**${targetLabel}**; keep {{IPA_N}} order/count; natural English; remove redundant Russian prepositions around blocks.`;
  }
  return `ALTRO 1 \`${cmd}\` (lean) — [TARGET]=**${targetLabel}**; keep {{IPA_N}} order/count; natural prose; drop redundant source prepositions in [TARGET].`;
}

function getIoAndOutputLean(cmd: AltroCommandInterfaceDirective, targetLabel: string): string {
  return `IO/OUTPUT: User carries [DATA_SKELETON]; [TARGET]=**${targetLabel}**; {{IPA_N}} immutable. No preamble, no fences unless code, no CoT — follow \`${cmd}\` NORM above.`;
}

/** One line — replaces multi-line domain matrix blocks for neutral runs. */
function getMatrixNeutralOneLiner(directive: string | undefined): string {
  const d = directive?.trim();
  if (d) {
    const short = d.length > 72 ? `${d.slice(0, 72)}…` : d;
    return `## MATRIX (neutral): no domain emphasis — "${short}"`;
  }
  return '## MATRIX (neutral): no domain emphasis was inferred (neutral matrix). Professional tone.';
}

function getEstablishedCriteriaLean(): string {
  return [
    '=== ESTABLISHED (compact) ===',
    `Anchors: ${GOLDEN_ANCHORS.join(', ')}.`,
    '• Isomorphism: slot count/order/labels; obligations unchanged.',
    '• No extra register/jurisdiction/ethics beyond skeleton.',
  ].join('\n');
}

/** ESTABLISHED: 8 якорей + 5 рубрик по одной строке — только VALIDATE. */
export function getEstablishedCriteria(): string {
  const distilled: Record<'semantics' | 'context' | 'intent' | 'imagery' | 'ethics', string> = {
    semantics:
      'Semantics: preserve truth-conditions and slot denotation; reject synonym drift that changes obligations.',
    context: 'Context: no register, setting, or jurisdiction not entailed by the skeleton.',
    intent: 'Intent: speech act (command/report/obligation/permission) must match the skeleton; no hidden persuasion.',
    imagery: 'Imagery: no added metaphor or sensory layer that obscures or reorders {{IPA_N}}.',
    ethics:
      'Ethics/Sacred: zero undeclared moral stance; Sovereign License–safe; sacred tone only if the input encodes it.',
  };
  const keys = ['semantics', 'context', 'intent', 'imagery', 'ethics'] as const;
  const rubricLines = keys.map((k) => `• ${distilled[k]}`);
  return [
    '=== ESTABLISHED (Golden) ===',
    `Anchors (8-word metrology): ${GOLDEN_ANCHORS.join(', ')}.`,
    ...rubricLines,
  ].join('\n');
}

/** Сжатая калибровка матрицы (совместимость с integrity-check фразами). */
export function getMatrixCalibrationSnippet(
  directive: string | undefined,
  weights: DomainWeights | undefined
): string | undefined {
  const d = directive?.trim() ?? '';
  if (!weights) return undefined;
  const active = (Object.entries(weights) as [keyof DomainWeights, number][])
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, v]) => `${String(k)} (${Math.round(v * 100)}%)`);
  if (!d) {
    if (active.length === 0) return undefined;
    return [
      '## MATRIX CALIBRATION (Intent Orchestrator)',
      'No explicit directive string was attached; inferred domain emphasis still applies where present.',
      `High-priority domains — adjust register and tone accordingly: ${active.join(', ')}.`,
    ].join('\n');
  }
  if (active.length === 0) {
    return [
      '## MATRIX CALIBRATION (Intent Orchestrator)',
      `Based on the directive "${d}", no domain emphasis was inferred (neutral matrix). Use a clear, professional tone.`,
    ].join('\n');
  }
  return [
    '## MATRIX CALIBRATION (Intent Orchestrator)',
    `Based on the directive "${d}", the semantic matrix has been calibrated.`,
    `High-priority domains — adjust your linguistic tone accordingly: ${active.join(', ')}.`,
  ].join('\n');
}

function getDirectiveBlock(directive: string | undefined): string {
  const body = directive?.trim() ? directive.trim() : '(none attached)';
  return ['=== DIRECTIVE (AUTHORITATIVE) ===', body].join('\n');
}

function getIoLine(targetLabel: string): string {
  return `IO: User message carries [DATA_SKELETON]; [TARGET] = **${targetLabel}**; {{IPA_N}} = immutable localized bricks.`;
}

function getOutputContract(cmd: AltroCommandInterfaceDirective): string {
  return [
    '=== OUTPUT CONTRACT ===',
    'No preamble; no markdown fences unless the task asks for code; do not wrap the entire answer in quotation marks; no chain-of-thought.',
    `Execute the DIRECTIVE provided above using the specific NORM and CHECKLIST of this mode (\`${cmd}\`).`,
  ].join('\n');
}

export type UniversalPromptIntentOpts = {
  /** Сырой текст директивы (command line / [USER_DIRECTIVE]). */
  directive?: string;
  /** 13-доменная матрица из IntentOrchestrator. */
  weights?: DomainWeights;
  /** Ровно одна директива для режима; по умолчанию TRANSFIGURE. */
  commandInterface?: AltroCommandInterfaceDirective;
};

/**
 * Lean system prompt when the intent matrix is neutral (all domain weights 0).
 * Drops long MATRIX domain lists, halves NORM/CHECKLIST, tightens MODE/IO/OUTPUT (~60% fewer chars vs full stack).
 */
export function getLeanPrompt(targetLangCode: string, intent?: UniversalPromptIntentOpts): string {
  const cmd: AltroCommandInterfaceDirective = intent?.commandInterface ?? 'TRANSFIGURE';
  const target = targetLabelBilingual(targetLangCode);
  const sections = [
    getDirectiveBlock(intent?.directive),
    getModePackLean(cmd, target, targetLangCode),
    getMatrixNeutralOneLiner(intent?.directive),
    getCoreNormsLean(targetLangCode),
    cmd === 'VALIDATE' ? getEstablishedCriteriaLean() : '',
    getIoAndOutputLean(cmd, target),
  ];
  return sections.filter(Boolean).join('\n\n');
}

/**
 * ALTRO Universal System Prompt — модульная сборка (kernel → directive → mode → calibration → norms → established? → IO → contract).
 */
export function buildAltroUniversalSystemPrompt2026(
  targetLangCode: string,
  intent?: UniversalPromptIntentOpts
): string {
  const weightsDefined = intent?.weights !== undefined;
  if (weightsDefined && domainWeightsAreNeutral(intent.weights)) {
    return getLeanPrompt(targetLangCode, intent);
  }

  const cmd: AltroCommandInterfaceDirective = intent?.commandInterface ?? 'TRANSFIGURE';
  const target = targetLabelBilingual(targetLangCode);
  const calibration = getMatrixCalibrationSnippet(intent?.directive, intent?.weights);

  const sections = [
    getKernel(cmd),
    getDirectiveBlock(intent?.directive),
    getModePack(cmd, target),
    calibration,
    getCoreNorms(),
    cmd === 'VALIDATE' ? getEstablishedCriteria() : '',
    getIoLine(target),
    getOutputContract(cmd),
  ];

  return sections.filter(Boolean).join('\n\n');
}

/** Server-side: replace or insert the universal system message so the executor receives v1.4+ with optional matrix. */
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
