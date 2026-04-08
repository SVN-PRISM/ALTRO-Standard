/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: IPA Phase 1 Server Action */

'use server';

/**
 * Server Action: IPA Phase 1 analysis.
 * Runs on server with maxDuration=900 (15 min). Bypasses client CORS, stable long runs.
 */

import { parseAnalysisResponse, buildPhase1Prompt } from '@/archive/legacy_altro/SemanticPackager';
import type { SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';

/** maxDuration=900 задаётся в app/layout.tsx для IPA Phase 1 */
const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const PHASE1_TIMEOUT_MS = 900_000; // 15 min

function extractJson(text: string): string {
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) return text;
  return text.slice(first, last + 1);
}

/** IPA Phase 1: аналитическая фаза. Вызов Ollama /api/generate с ограничениями на «размышления». */
export async function runIpaPhase1Action(
  text: string,
  model: string
): Promise<SemanticPacket | null> {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return null;

  const prompt = buildPhase1Prompt(trimmed);
  const estTokens = Math.ceil(prompt.length / 2.5);

  console.log('🔴 [PHASE1-PROMPT-DUMP]:', prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''));
  console.log('[IPA-SERVER-ACTION] Phase 1 uses ONLY buildPhase1Prompt — no CommonInstructions, no SecurityHeaders. | chars:', prompt.length, '| est.tokens:', estTokens);

  const payload = {
    model,
    prompt,
    stream: false,
    keep_alive: '15m',
    think: false,
    options: {
      temperature: 0,
      num_predict: 150,
      num_ctx: 2048,
    },
  };


  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PHASE1_TIMEOUT_MS);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      console.error('[IPA-SERVER-ACTION] Ollama error:', res.status, res.statusText);
      return null;
    }

    const rawBody = await res.text();
    const data = JSON.parse(rawBody || '{}') as { response?: string };
    const rawResponse = data?.response ?? '';

    const extractedJson = extractJson(rawResponse);
    const packet = parseAnalysisResponse(extractedJson);
    return packet ?? null;
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[IPA-SERVER-ACTION] Error:', err);
    return null;
  }
}
