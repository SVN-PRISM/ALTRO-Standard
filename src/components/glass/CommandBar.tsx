/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO 1 — Bridge: Command Unit (ядро снаружи) */

'use client';

import { useCallback, type KeyboardEvent } from 'react';
import type { ActionPayload, IpaCoreBridge } from '@/hooks/useAltroCore';

const PANEL = {
  dark: { text: '#e5e7eb', muted: '#4b5563', border: '#333' },
  light: { text: '#1A1A1B', muted: '#6b7280', border: '#d1d5db' },
};

export interface CommandBarProps {
  isDark?: boolean;
  /** Единый экземпляр useAltroCore с page (не вызывать хук здесь) */
  ipa: IpaCoreBridge;
  /** I — сырой текст из Терминала Захвата */
  sourceTextCapture: string;
  /** Синхронизация директивы в useAltroPage (transcreate userIntent) */
  onSyncCommandIntent?: (intent: string) => void;
}

/**
 * Command Unit: Enter → runIpaPhase1 (IPA) + лог ActionPayload.
 */
export function CommandBar({ isDark = true, ipa, sourceTextCapture, onSyncCommandIntent }: CommandBarProps) {
  const t = PANEL[isDark ? 'dark' : 'light'];
  const { commandIntent, setCommandIntent, runIpaPhase1 } = ipa;

  const logIpaPayload = useCallback((payload: ActionPayload) => {
    console.log('[IPA] ActionPayload (ALTRO 1 — STENCIL Edition)', {
      intent: payload.intent.commandIntent,
      domainWeights: payload.intent.domainWeights,
      legislativeWeights: payload.intent.legislative,
      executiveWeights: payload.intent.executive,
      integritySnapshot: payload.integrity,
      stencilText: payload.stencilText,
      capturedData: payload.capturedData,
      targetLanguage: payload.targetLanguage,
      captureMeta: payload.capture.meta,
    });
  }, []);

  const handleSend = useCallback(() => {
    const line = commandIntent.trim();
    const source = sourceTextCapture ?? '';
    console.log('[IPA-TRIGGER] Attempting Phase 1...');
    const payload = runIpaPhase1(source, line, source);
    logIpaPayload(payload);
    onSyncCommandIntent?.(line);
  }, [commandIntent, sourceTextCapture, runIpaPhase1, logIpaPayload, onSyncCommandIntent]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      e.stopPropagation();
      handleSend();
    },
    [handleSend]
  );

  return (
    <div className="flex-shrink-0 px-2 pt-2 pb-2" style={{ borderBottom: `1px solid ${t.border}` }}>
      <input
        type="text"
        value={commandIntent}
        onChange={(e) => {
          const v = e.target.value;
          setCommandIntent(v);
          onSyncCommandIntent?.(v);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Директива оркестрации… (Enter — IPA / ActionPayload)"
        className="bg-transparent border-b text-[11px] p-2 w-full outline-none font-mono transition-[border-color,box-shadow] duration-200"
        style={{
          color: t.text,
          borderColor: t.border,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#007AFF';
          e.target.style.boxShadow = '0 1px 0 0 #007AFF';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = t.border;
          e.target.style.boxShadow = 'none';
        }}
        spellCheck={false}
        autoComplete="off"
      />
    </div>
  );
}
