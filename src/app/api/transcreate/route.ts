/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * API Route: /api/transcreate
 * Продукт: ALTRO STENCIL только. Прокси на Ollama `/api/chat` с SovereignController (маска {{IPA_N}}, vault).
 * Путь ALTRO LIBRA (AltroOrchestrator, Octave, AltroGuard, клиентский runScan) в этом деплое не используется.
 * Translation-First: vault — display на языке цели; finalize подставляет display.
 */

import { freemem } from 'node:os';
import { Agent } from 'undici';
import {
  formatIntentWeightsForLog,
  resolveWeightsFromIntent,
  stripAltroDirectivesFromText,
} from '@core/IntentOrchestrator';
import { maskUserContentWithPrepareStencil } from '@core/transcreateUserContentMask';
import { resolveTargetLanguageFromRequestBody } from '@core/stencilTargetLanguage';
import { SovereignController } from '@core/SovereignController';
import { buildDomainCalibrationStamp, generateSVNAuditLog } from '@core/svnAudit';
import type { DomainWeights } from '@/lib/altroData';
import { getOllamaModelFromContinueConfig } from '@/lib/continueConfig';
import { applyAltroUniversalSystemPromptToMessages, ALTRO_UNIVERSAL_SYSTEM_PROMPT_VERSION } from '@/lib/altroUniversalSystemPrompt';
import { ALTRO_STENCIL_VAULT_HEADER } from '@/lib/stencilOutputClean';
import {
  extractOllamaAssistantText,
  getOllamaContentDelta,
  sanitizeOllamaNdjsonLine,
  stripThinkingFromChatPayload,
} from '@/lib/ollamaStreamSanitize';

export const maxDuration = 300;

const OLLAMA_DISPATCHER = new Agent({ headersTimeout: 240_000, bodyTimeout: 240_000 }); // 4 min
export const dynamic = 'force-dynamic';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const SVN_NODE_ID = process.env.SVN_NODE_ID ?? 'ALTRO1_STENCIL_NODE';
const OLLAMA_TIMEOUT_MS: number = Number(process.env.OLLAMA_TIMEOUT_MS) || 600_000;
/** До первого ответа от Ollama (заголовки). 0 = отключить. 14b+ cold load в VRAM часто >60s — по умолчанию 3 мин. */
const OLLAMA_EMERGENCY_CONNECT_MS: number = Number(process.env.OLLAMA_EMERGENCY_MS ?? 180000);

/** Fallback: директива только внутри user.content (без top-level userIntent). */
function extractUserDirectiveFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return '';
  const tag = '[USER_DIRECTIVE]';
  for (const m of messages) {
    if (!m || typeof m !== 'object') continue;
    const msg = m as { role?: string; content?: string };
    if (msg.role !== 'user' || typeof msg.content !== 'string') continue;
    const i = msg.content.indexOf(tag);
    if (i < 0) continue;
    const after = msg.content.slice(i + tag.length).trim();
    const block = after.split(/\n\n/)[0]?.trim() ?? '';
    if (block) return block;
  }
  return '';
}

/**
 * Translation-First: маска {{IPA_N}} + vault display на targetLanguage.
 * Режим Mirror: `microTranscreate` без весов доменов (точное соответствие локали цели).
 */
function maskMessages(
  messages: Array<{ role: string; content?: string }>,
  controller: SovereignController,
  targetLanguage: string
): string[] {
  const maskedUserPayloads: string[] = [];
  for (const msg of messages) {
    /** Только user-текст: системный промпт не гоняем через Кристалл/Masker (ускорение, типично 75s→секунды). */
    if (msg.role !== 'user') continue;
    if (typeof msg.content === 'string' && msg.content.trim()) {
      /** Блок `[USER_DIRECTIVE]…\n\n` не маскируется (см. partitionUserDirectiveForMasking). */
      msg.content = maskUserContentWithPrepareStencil(msg.content, (body) =>
        controller.prepareStencil(body, targetLanguage, undefined)
      );
      if (msg.content.includes('{{IPA_')) {
        maskedUserPayloads.push(msg.content);
      }
    }
  }
  return maskedUserPayloads;
}

/** Подставляет content обратно в структуру ответа. */
function injectContent(data: unknown, content: string): unknown {
  const copy = JSON.parse(JSON.stringify(data));
  if (copy?.message && typeof copy.message === 'object') {
    copy.message.content = content;
  }
  return copy;
}

/**
 * NDJSON: strip `message.thinking` but keep `message.content` (Qwen may send both in one line).
 * Thinking-only lines are skipped; `{ "done": true }` passes through.
 */
function createOllamaContentOnlyStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let buffer = '';
  let rawLogged = false;
  let sanitizedHeadLogged = false;
  /** Накопленный сырой текст ассистента из NDJSON (до подстановки vault / Unmasker на клиенте). */
  let accumulatedRawAssistant = '';
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const debugStream = process.env.ALTRO_DEBUG_STREAM === '1';

  return source.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (debugStream && !rawLogged && chunk.byteLength > 0) {
          rawLogged = true;
          const peek = new TextDecoder().decode(chunk.slice(0, Math.min(chunk.byteLength, 1024)));
          console.log('[RAW CHUNK first bytes]', peek.replace(/\n/g, '\\n'));
        }
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const delta = getOllamaContentDelta(line.replace(/\r$/, ''));
          if (delta) accumulatedRawAssistant += delta;
          const out = sanitizeOllamaNdjsonLine(line);
          if (out) {
            if (!sanitizedHeadLogged) {
              sanitizedHeadLogged = true;
              const extracted = getOllamaContentDelta(line.replace(/\r$/, ''));
              const preview = (extracted ?? '').slice(0, 80);
              console.log('>>> SANITIZED OUTPUT START:', preview);
            }
            controller.enqueue(encoder.encode(out));
          }
        }
      },
      flush(controller) {
        if (buffer.trim()) {
          const delta = getOllamaContentDelta(buffer.replace(/\r$/, ''));
          if (delta) accumulatedRawAssistant += delta;
          const out = sanitizeOllamaNdjsonLine(buffer);
          if (out) {
            if (!sanitizedHeadLogged) {
              sanitizedHeadLogged = true;
              const extracted = getOllamaContentDelta(buffer.replace(/\r$/, ''));
              const preview = (extracted ?? '').slice(0, 80);
              console.log('>>> SANITIZED OUTPUT START:', preview);
            }
            controller.enqueue(encoder.encode(out));
          }
        }
        console.log('[ALTRO][Stage:pre-unmask] Stream assembled length:', accumulatedRawAssistant.length);
      },
    })
  );
}

export async function POST(request: Request) {
  let longTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let emergencyId: ReturnType<typeof setTimeout> | null = null;
  try {
    console.log('[MEM] Free memory:', freemem());
    console.log('>>> [transcreate] Step 1: parsing request body');
    const body = await request.json();
    const bodyRec = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    /** Явный запрет LIBRA-режима для внешних клиентов (STENCIL-only контейнер). */
    if (bodyRec?.altroProduct === 'libra' || bodyRec?.mode === 'libra') {
      return Response.json(
        { error: '[ALTRO STENCIL] Режим LIBRA отключён в этой сборке. Используйте STENCIL-тело запроса (messages + _altroStencil при необходимости).' },
        { status: 400 }
      );
    }
    /** Read before stripping `_altroStencil` (targetLanguage for Translation-First mask). */
    const stencilTargetLang =
      body && typeof body === 'object'
        ? resolveTargetLanguageFromRequestBody(body as Record<string, unknown>)
        : 'ru';

    const bodyObj = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
    let userIntentRaw = '';
    if (bodyObj && typeof bodyObj.userIntent === 'string') {
      userIntentRaw = bodyObj.userIntent.trim();
    }
    if (!userIntentRaw && bodyObj?.messages) {
      userIntentRaw = extractUserDirectiveFromMessages(bodyObj.messages);
    }

    /**
     * SDK: сначала сырой user.content → stripAltroDirectivesFromText (до Кристалла/Masker),
     * чтобы `[ALTRO: …]` и веса не попали в трафарет и не порождали лишние {{IPA_*}}.
     */
    const altroInnersFromMessages: string[] = [];
    if (Array.isArray(bodyObj?.messages)) {
      for (const m of bodyObj.messages as Array<{ role?: string; content?: string }>) {
        if (m?.role !== 'user' || typeof m.content !== 'string' || !m.content.trim()) continue;
        const { text, strippedInners } = stripAltroDirectivesFromText(m.content);
        altroInnersFromMessages.push(...strippedInners);
        m.content = text;
      }
    }

    const intentParts = [
      userIntentRaw.trim(),
      ...altroInnersFromMessages.map((inner) => `[ALTRO:${inner}]`),
    ].filter(Boolean);
    const intentWeights = resolveWeightsFromIntent(intentParts.join('\n'));
    console.log(
      `[ALTRO][Intent-Orchestrator] Directive detected: '${userIntentRaw.slice(0, 240)}' -> Calculated Matrix:`,
      formatIntentWeightsForLog(intentWeights)
    );
    if (process.env.ALTRO_AUDIT_STENCIL === '1') {
      console.log('[ALTRO_AUDIT][transcreate] IntentOrchestrator', {
        userIntentLen: userIntentRaw.length,
        intentWeights,
      });
    }

    if (body?._altroDebug) delete body._altroDebug;
    if (body && typeof body === 'object' && '_altroStencil' in body) {
      delete (body as Record<string, unknown>)._altroStencil;
    }
    if (body && typeof body === 'object' && 'userIntent' in body) {
      delete (body as Record<string, unknown>).userIntent;
    }

    const continueModel = getOllamaModelFromContinueConfig();
    if (continueModel && body && typeof body === 'object') {
      const prev = (body as Record<string, unknown>).model;
      (body as Record<string, unknown>).model = continueModel;
      console.log('>>> [transcreate] Model from .continue/config.yaml:', continueModel, '(was:', prev, ')');
    } else if (!continueModel) {
      console.log('>>> [transcreate] No .continue/config.yaml model override; using client body.model');
    }

    console.log(
      '>>> [transcreate] Label Pre-localization (Mirror): даты/деньги/%/Universal Unit Magnet → microTranscreate на целевой язык без весов доменов; затем основная транскреация (Ollama)'
    );
    const stencilController = new SovereignController();
    const messages = body?.messages;
    if (Array.isArray(messages)) {
      if (process.env.ALTRO_AUDIT_STENCIL === '1') {
        console.log('[ALTRO_AUDIT][transcreate] stencilTargetLang before maskMessages', {
          stencilTargetLang,
          isRu: stencilTargetLang === 'ru',
        });
      }
      const maskedUserPayloads = maskMessages(messages, stencilController, stencilTargetLang);
      const calibrationStamp = buildDomainCalibrationStamp(intentWeights);
      for (const maskedInput of maskedUserPayloads) {
        console.log(
          generateSVNAuditLog({
            nodeId: SVN_NODE_ID,
            maskedInput,
            domainCalibrationStamp: calibrationStamp,
          })
        );
      }
      for (const m of messages as Array<{ role: string; content?: string }>) {
        if (m.role !== 'user' || typeof m.content !== 'string') continue;
        console.log('[SDK_EXIT_GATEWAY] user message masked for LLM:', m.content.includes('{{IPA_'));
      }
      console.log(
        '[ALTRO][Stage:label-pre-localization] Завершено: все захваченные метки предварительно локализованы (Mirror, без весов доменов); далее — основная транскреация (Ollama).'
      );
      applyAltroUniversalSystemPromptToMessages(
        messages as Array<{ role: string; content?: string }>,
        stencilTargetLang,
        { directive: userIntentRaw, weights: intentWeights }
      );
      for (const m of messages as Array<{ role: string; content?: string }>) {
        if (m.role === 'system' && typeof m.content === 'string') {
          console.log(
            `>>> [ALTRO UNIVERSAL ${ALTRO_UNIVERSAL_SYSTEM_PROMPT_VERSION}] FINAL SYSTEM PROMPT (полный текст, уходит в Ollama):\n`,
            m.content
          );
          console.log(
            '[ALTRO][Stage:system-prompt] Веса доменов (intentWeights → microTranscreate / контекст маскирования):',
            JSON.stringify(intentWeights, null, 2)
          );
          break;
        }
      }
    }

    if (body && typeof body === 'object') {
      const b = body as Record<string, unknown>;
      const prev = b.options;
      const base =
        typeof prev === 'object' && prev !== null && !Array.isArray(prev)
          ? { ...(prev as Record<string, unknown>) }
          : {};
      const requested = typeof base.num_predict === 'number' ? base.num_predict : 2048;
      /** Thinking models can burn the whole budget before `content`; keep a sane floor. */
      b.options = { ...base, num_predict: Math.max(requested, 2048) };
    }

    const abortController = new AbortController();
    /** Client closed the tab / Reset aborted fetch — stop upstream Ollama generation. */
    if (request.signal.aborted) {
      abortController.abort();
    } else {
      request.signal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
    if (OLLAMA_EMERGENCY_CONNECT_MS > 0) {
      emergencyId = setTimeout(() => {
        abortController.abort();
      }, OLLAMA_EMERGENCY_CONNECT_MS);
    }

    longTimeoutId = setTimeout(() => {
      abortController.abort();
    }, OLLAMA_TIMEOUT_MS);

    console.log('>>> [transcreate] Step 3: Calling Ollama...', `${OLLAMA_BASE}/api/chat`);
    if (Array.isArray(messages) && messages[0]) {
      console.warn('>>> [PROMPT]:', JSON.stringify(messages[0], null, 2));
    }

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: abortController.signal,
      // @ts-expect-error undici dispatcher
      dispatcher: OLLAMA_DISPATCHER,
    });

    if (emergencyId != null) {
      clearTimeout(emergencyId);
      emergencyId = null;
    }
    if (longTimeoutId != null) {
      clearTimeout(longTimeoutId);
      longTimeoutId = null;
    }

    if (!response.ok) {
      return Response.json(
        { error: '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]' },
        { status: 502 }
      );
    }

    if (body.stream === true && response.body) {
      const filtered = createOllamaContentOnlyStream(response.body);
      /** Translation-First display map for client StreamInjector / executeInjector (must match server mask). */
      const vaultB64 = Buffer.from(stencilController.getVault().toPublicJSON(), 'utf8').toString('base64');
      return new Response(filtered, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          [ALTRO_STENCIL_VAULT_HEADER]: vaultB64,
        },
      });
    }

    const data = await response.json();
    stripThinkingFromChatPayload(data);
    const rawContent = extractOllamaAssistantText(data);
    console.log('[ALTRO][Stage:pre-unmask] Non-stream content length:', rawContent.length);
    const finalizedContent = stencilController.finalize(rawContent);
    const result = injectContent(data, finalizedContent);
    return Response.json(result);
  } catch (err) {
    if (longTimeoutId != null) clearTimeout(longTimeoutId);
    if (emergencyId != null) clearTimeout(emergencyId);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    if (isAbort) {
      console.warn('[TIMEOUT] Ollama took too long. Check if model is still loading into VRAM.');
    } else {
      console.error('ALTRO transcreate proxy error:', err);
    }
    return Response.json(
      { error: '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]' },
      { status: 502 }
    );
  }
}
