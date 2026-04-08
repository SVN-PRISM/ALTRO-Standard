/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 — STENCIL flow (sterile) */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExecutiveWeights, LegislativeWeights } from '@/hooks/useAltroCore';
import { runStencilTransfigure, type StencilTransfigureParams } from '@/lib/stencilTransfigure';

/** First-chunk watchdog: показать сообщение о ожидании ресурса LLM. */
const LLM_FIRST_CHUNK_MS = 5000;

/** Input channel: manual textarea today; file + metadata reserved for Phase Next. */
export type StencilContent = {
  text: string;
  type: 'manual' | 'file';
  metadata?: unknown;
};

export type UseStencilFlowArgs = {
  /** Live source line — synced into `content` when type is manual. */
  sourceText: string;
  /** Matrix 5+8 from `useAltroCore` (Sovereign / Executive). */
  legislative: LegislativeWeights;
  executive: ExecutiveWeights;
};

/**
 * Sterile STENCIL pipeline: content envelope + streaming via `runStencilTransfigure`.
 * При переданном `ipaVault` поток проходит через `@core/StreamInjector` — {{IPA_N}} подменяются
 * на значения vault в реальном времени до вывода в СМЫСЛОВОЙ ШЛЮЗ (onChunk).
 * Sequential semaphore: `isBusy` держит UI-рейки ([DIFUZZY] / [STENCIL LOCK]) до завершения стрима.
 *
 * Audit: «Пустой» Mirror при долгом thinking был из‑за фильтра, отбрасывавшего целые NDJSON-строки,
 * если в `message` был ключ `thinking`, даже при наличии `content`. Санитизация теперь в
 * `ollamaStreamSanitize` + прокси; здесь `wrappedOnChunk` снимает Waiting только при первом `\S` в тексте.
 */
export function useStencilFlow(args: UseStencilFlowArgs) {
  const streamAbortRef = useRef<AbortController | null>(null);

  const [content, setContent] = useState<StencilContent>({
    text: args.sourceText,
    type: 'manual',
  });
  /** Семафор: активен стрим transcreate — кнопки режима STENCIL должны быть disabled. */
  const [isBusy, setIsBusy] = useState(false);
  /** Первый чанк от API ещё не пришёл в течение LLM_FIRST_CHUNK_MS. */
  const [waitingForLlmResource, setWaitingForLlmResource] = useState(false);

  useEffect(() => {
    setContent((prev) =>
      prev.type === 'manual' ? { ...prev, text: args.sourceText } : prev
    );
  }, [args.sourceText]);

  /** RESET / danger: AbortController.abort() — физически рвёт `fetch('/api/transcreate')` (см. runStencilTransfigure `signal`). */
  const abortStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
  }, []);

  const runStencilStream = useCallback(
    async (
      params: Pick<
        StencilTransfigureParams,
        | 'targetLanguage'
        | 'ipaVault'
        | 'userIntent'
        | 'fuzzy'
        | 'stencilLocked'
        | 'onChunk'
        | 'onComplete'
        | 'onError'
      > & { sourceTextOverride?: string }
    ): Promise<string> => {
      const raw =
        (params.sourceTextOverride ?? content.text ?? args.sourceText)?.trim() ?? '';
      if (!raw) return '';

      streamAbortRef.current?.abort();
      const ac = new AbortController();
      streamAbortRef.current = ac;

      setIsBusy(true);
      let firstChunkSeen = false;
      let waitTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (!firstChunkSeen) setWaitingForLlmResource(true);
      }, LLM_FIRST_CHUNK_MS);

      const clearResourceWait = () => {
        if (waitTimer != null) {
          clearTimeout(waitTimer);
          waitTimer = null;
        }
        setWaitingForLlmResource(false);
      };

      const wrappedOnChunk = (chunk: string) => {
        /** «Первый чанк» для снятия Waiting = первый фрагмент с хотя бы одним непробельным символом. */
        const hasRealContent = /\S/.test(chunk);
        if (!firstChunkSeen) {
          if (!hasRealContent) return;
          firstChunkSeen = true;
          clearResourceWait();
        }
        params.onChunk?.(chunk);
      };

      try {
        return await runStencilTransfigure({
          sourceText: raw,
          targetLanguage: params.targetLanguage,
          userIntent: params.userIntent,
          ipaVault: params.ipaVault,
          fuzzy: params.fuzzy,
          stencilLocked: params.stencilLocked,
          legislative: args.legislative,
          executive: args.executive,
          signal: ac.signal,
          onChunk: wrappedOnChunk,
          onComplete: (text) => {
            clearResourceWait();
            params.onComplete?.(text);
          },
          onError: (e) => {
            clearResourceWait();
            params.onError?.(e);
          },
        });
      } catch (e) {
        clearResourceWait();
        throw e;
      } finally {
        if (streamAbortRef.current === ac) streamAbortRef.current = null;
        clearResourceWait();
        setIsBusy(false);
      }
    },
    [content.text, args.sourceText, args.legislative, args.executive]
  );

  /** Future: attach file text + name/size without polluting manual channel. */
  const setContentFromFile = useCallback((text: string, metadata?: unknown) => {
    setContent({ text, type: 'file', metadata });
  }, []);

  return {
    content,
    setContent,
    setContentFromFile,
    runStencilStream,
    abortStreaming,
    /** Семафор стрима — true ⇒ показывать «LLM OCCUPIED», блокировать переключатели режима. */
    isBusy,
    /** Синоним для подписи в UI. */
    llmOccupied: isBusy,
    waitingForLlmResource,
  };
}
