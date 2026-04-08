/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: IPA Phase 1 — Semantic Packager */

/**
 * SemanticPackager — разделение запроса на Аналитическую и Исполнительную фазы.
 * IPA (Intent-Packet-Adaptation): сборка семантического пакета для контекста транскреации.
 */

import type { DomainWeights } from '@/lib/altroData';
import { EXTERNAL_DOMAIN_KEYS, INTERNAL_DOMAIN_KEYS } from '@/lib/altroData';
import { AltroTokenManager } from '@/lib/altro/tokenManager';

const DOMAIN_LABELS: Record<string, string> = {
  economics: 'Экономика',
  politics: 'Политика',
  society: 'Общество',
  history: 'История',
  culture: 'Культура',
  aesthetics: 'Эстетика',
  technology: 'Технологии',
  spirituality: 'Духовность',
  semantics: 'Семантика',
  context: 'Контекст',
  intent: 'Намерение',
  imagery: 'Образность',
  ethics: 'Этика',
};

export interface HomonymLock {
  word: string;
  variants: string[];
}

export interface SemanticPacket {
  intent_summary: string;
  domain_focus: [string, string, string];
  structural_anchors: string[];
  homonym_locks?: HomonymLock[];
}

/** Вычисляет 3 доминирующих домена по абсолютным весам. */
export function inferDomainFocusFromCalibration(calibration?: {
  external?: Record<string, number>;
}): [string, string, string] {
  if (!calibration?.external || typeof calibration.external !== 'object') {
    return ['semantics', 'context', 'intent'];
  }
  const ext = calibration.external;
  const keys = EXTERNAL_DOMAIN_KEYS ?? ['economics', 'politics', 'society', 'history', 'culture', 'aesthetics', 'technology', 'spirituality'];
  const scored = keys.map((k) => ({
    key: k,
    abs: Math.abs(ext[k as keyof typeof ext] ?? 0),
  }));
  scored.sort((a, b) => b.abs - a.abs);
  return [
    scored[0]?.key ?? 'semantics',
    scored[1]?.key ?? 'context',
    scored[2]?.key ?? 'intent',
  ];
}

function getTop3Domains(weights: DomainWeights): [string, string, string] {
  const allKeys = [...EXTERNAL_DOMAIN_KEYS, ...INTERNAL_DOMAIN_KEYS];
  const scored = allKeys.map((k) => ({
    key: k,
    abs: Math.abs((weights as Record<string, number>)[k] ?? 0),
  }));
  scored.sort((a, b) => b.abs - a.abs);
  const top3 = scored.slice(0, 3).map((s) => s.key);
  return [
    top3[0] ?? 'semantics',
    top3[1] ?? 'context',
    top3[2] ?? 'intent',
  ];
}

/** Извлекает ключевые слова/знаки для сохранения (слова с U+0301, locked, длинные термины). */
function extractStructuralAnchors(sourceText: string, lockedWords?: string[]): string[] {
  const anchors: string[] = [];
  if (lockedWords?.length) anchors.push(...lockedWords);

  const tokens = AltroTokenManager.tokenize(sourceText);
  for (const t of tokens) {
    if (t.type !== 'word') continue;
    const w = t.word;
    if (/\u0301/.test(w)) anchors.push(w);
    if (t.isLocked && w.length > 2) anchors.push(w);
    if (w.length >= 12 && /[А-Яа-яЁёA-Za-z]/.test(w)) anchors.push(w);
  }
  return [...new Set(anchors)].slice(0, 10);
}

/**
 * Формирует краткий JSON-пакет из sourceText и weights (локальный fallback).
 * Используется при откате IPA или для предзаполнения перед LLM-анализом.
 */
export function generatePacket(
  sourceText: string,
  weights: DomainWeights,
  lockedWords?: string[]
): SemanticPacket {
  const domain_focus = getTop3Domains(weights);
  const structural_anchors = extractStructuralAnchors(sourceText, lockedWords);
  const domainLabels = domain_focus.map((k) => DOMAIN_LABELS[k] ?? k).join(', ');
  const intent_summary = `Транскреация с фокусом на домены: ${domainLabels}. Сохранить структурные якоря.`;
  return { intent_summary, domain_focus, structural_anchors };
}

/**
 * Оборачивает пакет и исходный текст в теги [IPA_DATA_START] / [IPA_DATA_END].
 * Текстовый формат: Intent: [summary] | Focus: [domains]. Anchors — только в [CONTEXT_INSIGHTS].
 */
export function wrapPrompt(packet: SemanticPacket, sourceText: string): string {
  const intent = packet.intent_summary?.trim() ?? '';
  const focus =
    packet.domain_focus?.length > 0
      ? packet.domain_focus.filter(Boolean).join(', ')
      : '';
  const parts: string[] = [];
  if (intent) parts.push(`Intent: ${intent}`);
  if (focus) parts.push(`Focus: ${focus}`);
  const header = parts.length > 0 ? parts.join(' | ') + '\n\n' : '';
  return `[IPA_DATA_START]\n${header}${sourceText}\n[IPA_DATA_END]`;
}

/** Парсит сырой ответ Phase 1 (Mirror Extraction). Schema: { structural_anchors, homonym_locks }. */
export function parseAnalysisResponse(rawContent: string): SemanticPacket | null {
  const trimmed = rawContent?.trim();
  if (!trimmed) return null;
  let extracted = trimmed;
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) extracted = jsonMatch[0];
  try {
    const parsed = JSON.parse(extracted) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as Record<string, unknown>;

    const anchors = Array.isArray(p.structural_anchors)
      ? (p.structural_anchors as string[]).filter((x) => typeof x === 'string')
      : Array.isArray(p.anchors)
        ? (p.anchors as string[]).filter((x) => typeof x === 'string')
        : [];

    const homonymLocksRaw = Array.isArray(p.homonym_locks)
      ? (p.homonym_locks as Array<{ word?: string; variants?: string[] }>)
      : [];
    const homonym_locks: HomonymLock[] = homonymLocksRaw
      .filter((h) => typeof h?.word === 'string')
      .map((h) => ({
        word: String(h.word),
        variants: Array.isArray(h.variants) ? h.variants.filter((v) => typeof v === 'string') : [],
      }));

    return {
      intent_summary: '', // Kernel infers from calibration
      domain_focus: ['semantics', 'context', 'intent'] as [string, string, string], // Kernel infers from calibration
      structural_anchors: anchors.slice(0, 10),
      homonym_locks: homonym_locks.length > 0 ? homonym_locks : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Phase 1: Nano-Extractor — ~150 tokens target. ISOLATED.
 * HARD-CHECK: NO STYLE_PROFILE, NO DOMINANT_STYLE, NO Historical Temporality.
 * This string is the ONLY instruction sent to Phase 1; buildPhase1Prompt appends [SOURCE] only.
 */
export const IPA_ANALYSIS_SYSTEM_PROMPT = `[ROLE] Verbatim Extractor.
[TASK] Output JSON only.
[STRICT_RULES]
1. structural_anchors: List of key nouns/verbs. ONLY literal words from [SOURCE].
2. homonym_locks: Only words with multiple meanings + variants.
3. NO synonyms. NO morphing. NO preambles. NO thinking.
[OUTPUT] {"structural_anchors":["word1","word2"],"homonym_locks":[{"word":"x","variants":["a","b"]}]}`;

/**
 * Phase 1 prompt — ONLY IPA_ANALYSIS_SYSTEM_PROMPT + [SOURCE].
 * Полный SOURCE без искусственного лимита (старый cap 300 символов ломал длинные захваты).
 * Ограничение контекста — на стороне Ollama (`num_ctx` в ipaPhase1 / клиенте).
 */
export function buildPhase1Prompt(sourceText: string): string {
  const raw = sourceText?.trim() ?? '';
  return IPA_ANALYSIS_SYSTEM_PROMPT + '\n[SOURCE]:\n' + raw;
}
