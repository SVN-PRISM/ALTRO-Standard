/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 Stencil */

/**
 * ALTRO 1: Фаза 2 — STENCIL Edition.
 * Task Geometry: [CONTEXT] / [NODES] / [PROTOCOL]. Метки {{IPA_N}} — архитектурные константы.
 */

import { resolveWeightsFromIntent } from '@core/IntentOrchestrator';
import type { ExecutiveWeights, LegislativeWeights } from '@/hooks/useAltroCore';
import type { DomainWeights } from '@/lib/altroData';
import { joinInjectedParts, RecordVaultStore, StreamInjector } from '@core/StreamInjector';
import {
  extractLongestRussianSpan,
  getOllamaContentDelta,
  shouldPolishRussianOutput,
  stripLeadingInstructionEcho,
  ThinkingStreamCleaner,
} from '@/lib/ollamaStreamSanitize';
import { buildAltroUniversalSystemPrompt2026 } from '@/lib/altroUniversalSystemPrompt';
import { parseStencilVaultFromResponseHeaders, stripLlmQuoteWrapping } from '@/lib/stencilOutputClean';

/** Placeholder if `NEXT_PUBLIC_DEFAULT_MODEL` is unset — requests must not use a hardcoded vendor model. */
export const MODEL_NOT_SET = 'model-not-set';

/** User-facing copy when the env var is missing (single source for STENCIL + engine). */
export const MODEL_NOT_SET_USER_MESSAGE =
  '[ALTRO] NEXT_PUBLIC_DEFAULT_MODEL is not set. Create `.env.local` in the project root (next to package.json), add NEXT_PUBLIC_DEFAULT_MODEL=<your-ollama-model-tag>, restart the dev server, and reload. You can copy from `.env.example` and replace the placeholder tag.';

export function resolveStencilDefaultModel(): string {
  const raw = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_DEFAULT_MODEL : undefined;
  const m = raw?.trim();
  return m && m.length > 0 ? m : MODEL_NOT_SET;
}

export type StencilPromptOptions = {
  /** Kept for API compatibility; universal prompt ignores matrix / fuzzy / lock flags. */
  fuzzy?: boolean;
  stencilLocked?: boolean;
  legislative?: LegislativeWeights;
  executive?: ExecutiveWeights;
  /** Директива для блока MATRIX CALIBRATION (клиентское зеркало; источник истины — сервер). */
  directive?: string;
  domainWeights?: DomainWeights;
};

/**
 * STENCIL system message — ALTRO UNIVERSAL SYSTEM PROMPT 2026 + опциональная калибровка матрицы.
 * Источник истины для Ollama — `/api/transcreate` после маскирования.
 */
export function buildStencilSystemPrompt(targetLangCode: string, _opts?: StencilPromptOptions): string {
  return buildAltroUniversalSystemPrompt2026(targetLangCode, {
    directive: _opts?.directive,
    weights: _opts?.domainWeights,
  });
}

/** @deprecated Используй buildStencilSystemPrompt(targetLang, opts). */
export const STENCIL_SYSTEM_PROMPT = buildStencilSystemPrompt('ru');

/**
 * Фаза 3 — Mechanical Re-Entry: подстановка значений vault (display на языке цели) вместо {{IPA_N}}.
 */
export function executeInjector(
  stencilResponse: string,
  ipaVault: Record<string, string>
): string {
  const keys = Object.keys(ipaVault).filter((k) => /^\{\{IPA_\d+\}\}$/.test(k));
  const expected = keys.length;

  const restoredIds = new Set<number>();
  /** Tolerates optional spaces; optional `: preview` legacy; tag may follow `"` or punctuation on same line. */
  const re = /\{\{\s*IPA_(\d+)(?:\s*:\s*[^}]*)?\s*\}\}/gi;
  const result = stencilResponse.replace(re, (full, idStr) => {
    const key = `{{IPA_${idStr}}}`;
    const val = ipaVault[key];
    if (val !== undefined) {
      restoredIds.add(parseInt(idStr, 10));
      return val;
    }
    return full;
  });

  if (typeof console !== 'undefined' && expected > 0) {
    console.log(
      `[PHASE 3] Injection Successful: ${restoredIds.size}/${expected} entities restored`
    );
  }

  return result;
}

export interface StencilTransfigureParams {
  sourceText: string;
  targetLanguage?: string;
  userIntent?: string;
  ipaVault?: Record<string, string>;
  onChunk?: (chunk: string) => void;
  /** Каждый фрагмент тела ответа fetch (UTF-8), до разбора NDJSON — для отладки «живости» стрима. */
  onRawStreamData?: (decodedUtf8: string) => void;
  /** Abort in-flight /api/transcreate (Reset button). */
  signal?: AbortSignal;
  onComplete?: (fullText: string) => void;
  onError?: (err: Error) => void;
  /** UI: [DIFUZZY] — мягкий режим (temperature/options). */
  fuzzy?: boolean;
  /** UI: [STENCIL LOCK] — усилить PROTOCOL для {{IPA_N}}. */
  stencilLocked?: boolean;
  legislative?: LegislativeWeights;
  executive?: ExecutiveWeights;
}

/**
 * Минимальный запрос к /api/transcreate.
 * API маскирует user content через SovereignController, прокидывает стрим с инжектом.
 */
export async function runStencilTransfigure(params: StencilTransfigureParams): Promise<string> {
  const {
    sourceText,
    targetLanguage = 'ru',
    ipaVault,
    onChunk,
    onRawStreamData,
    signal,
    onComplete,
    onError,
    fuzzy = true,
    stencilLocked = false,
    legislative,
    executive,
  } = params;

  const model = resolveStencilDefaultModel();
  if (model === MODEL_NOT_SET) {
    const err = new Error(MODEL_NOT_SET_USER_MESSAGE);
    onError?.(err);
    throw err;
  }

  const resolvedCode = targetLanguage.trim().toLowerCase() || 'ru';
  const intentLine = params.userIntent?.trim() ?? '';
  const domainWeightsFromIntent = intentLine ? resolveWeightsFromIntent(intentLine) : undefined;
  const systemContent = buildStencilSystemPrompt(resolvedCode, {
    fuzzy,
    stencilLocked,
    legislative,
    executive,
    directive: intentLine,
    domainWeights: domainWeightsFromIntent,
  });

  const userLines = [sourceText.trim()];
  if (params.userIntent?.trim()) {
    userLines.push(`[USER_DIRECTIVE] ${params.userIntent.trim()}`);
  }

  const messages = [
    { role: 'system' as const, content: systemContent },
    { role: 'user' as const, content: userLines.join('\n\n') },
  ];

  const temp = fuzzy ? 0.82 : 0.42;
  const topP = fuzzy ? 0.94 : 0.82;

  const body: Record<string, unknown> = {
    model,
    messages,
    stream: true,
    options: { temperature: temp, top_p: topP, num_predict: 2048 },
    _altroStencil: { fuzzy, stencilLocked, targetLanguage: resolvedCode },
    /** Всегда передаём поле — иначе прокси не видит директиву и IntentOrchestrator получает пустую строку (веса = 0). */
    userIntent: typeof params.userIntent === 'string' ? params.userIntent.trim() : '',
  };

  let accumulated = '';
  const mirrorClean = new ThinkingStreamCleaner(resolvedCode);

  /** Prefer server header (Translation-First display); fallback = client capture vault (often English). */
  let injectVault: Record<string, string> = { ...(ipaVault ?? {}) };
  let streamInjector: StreamInjector | null = null;

  const emitContentDelta = (raw: string) => {
    if (raw === '') return;
    if (streamInjector) {
      const parts = streamInjector.process(raw);
      const injected = joinInjectedParts(parts);
      accumulated += injected;
      if (injected.length > 0) onChunk?.(injected);
    } else {
      accumulated += raw;
      onChunk?.(raw);
    }
  };

  const isAbort = (e: unknown) =>
    e instanceof Error && e.name === 'AbortError';

  try {
    const res = await fetch('/api/transcreate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error((errData as { error?: string }).error ?? `HTTP ${res.status}`);
    }

    const serverDisplayVault = parseStencilVaultFromResponseHeaders(res.headers);
    if (serverDisplayVault && Object.keys(serverDisplayVault).length > 0) {
      injectVault = serverDisplayVault;
    }

    streamInjector =
      Object.keys(injectVault).length > 0
        ? new StreamInjector(new RecordVaultStore(injectVault))
        : null;

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const netChunk = decoder.decode(value, { stream: true });
      onRawStreamData?.(netChunk);
      buffer += netChunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.length === 0) continue;
        const delta = getOllamaContentDelta(line);
        if (delta === null || delta === undefined) continue;
        const cleaned = mirrorClean.push(delta);
        if (cleaned) emitContentDelta(cleaned);
      }
    }

    if (buffer.length > 0) {
      const tailDelta = getOllamaContentDelta(buffer);
      if (tailDelta !== null && tailDelta !== undefined) {
        const cleaned = mirrorClean.push(tailDelta);
        if (cleaned) emitContentDelta(cleaned);
      }
    }

    const mirrorFlush = mirrorClean.flush();
    if (mirrorFlush) emitContentDelta(mirrorFlush);

    if (streamInjector) {
      const tail = streamInjector.flush();
      if (tail) {
        accumulated += tail;
        onChunk?.(tail);
      }
    }

    const vaultKeys = Object.keys(injectVault).length;
    const stripped = stripLlmQuoteWrapping(accumulated.replace(/^\uFEFF/, ''));
    const hasPlaceholders = /\{\{\s*IPA_\d+(?:\s*:\s*[^}]*)?\s*\}\}/i.test(stripped);
    let finalText =
      vaultKeys > 0 && hasPlaceholders ? executeInjector(stripped, injectVault) : stripped;

    if (resolvedCode === 'ru' && !/\{\{\s*IPA_\d+(?:\s*:\s*[^}]*)?\s*\}\}/i.test(finalText)) {
      let t = stripLeadingInstructionEcho(finalText, resolvedCode);
      if (shouldPolishRussianOutput(t)) {
        const span = extractLongestRussianSpan(t);
        if (span.length >= 6) t = span;
      }
      finalText = t;
    }

    onComplete?.(finalText);
    return finalText;
  } catch (err) {
    if (isAbort(err)) {
      const mirrorFlush = mirrorClean.flush();
      if (mirrorFlush) emitContentDelta(mirrorFlush);
      if (streamInjector) {
        const tail = streamInjector.flush();
        if (tail) {
          accumulated += tail;
          onChunk?.(tail);
        }
      }
      const vaultKeys = Object.keys(injectVault).length;
      const strippedAbort = stripLlmQuoteWrapping(accumulated.replace(/^\uFEFF/, ''));
      const hasPlaceholders = /\{\{\s*IPA_\d+(?:\s*:\s*[^}]*)?\s*\}\}/i.test(strippedAbort);
      let partial =
        vaultKeys > 0 && hasPlaceholders
          ? executeInjector(strippedAbort, injectVault)
          : strippedAbort;
      if (resolvedCode === 'ru' && !/\{\{\s*IPA_\d+(?:\s*:\s*[^}]*)?\s*\}\}/i.test(partial)) {
        let t = stripLeadingInstructionEcho(partial, resolvedCode);
        if (shouldPolishRussianOutput(t)) {
          const span = extractLongestRussianSpan(t);
          if (span.length >= 6) t = span;
        }
        partial = t;
      }
      onComplete?.(partial);
      return partial;
    }
    const e = err instanceof Error ? err : new Error(String(err));
    onError?.(e);
    throw e;
  }
}
