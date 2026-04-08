/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Glass Engine */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { RefreshCcw } from 'lucide-react';
import {
  buildStencilForDisplay,
  buildStencilForDisplayWithSemantic,
  type StencilDisplayResult,
} from '@core/StencilDisplayHelper';
import { DataVault } from '@core/DataVault';
import { ToolsModal } from '@/components/ToolsModal';
import { FileGateway, IPA_SOURCE_DOC_KEY } from '@/components/FileGateway';
import { useAltroPage } from '@/hooks/useAltroPage';
import { useAltroCore } from '@/hooks/useAltroCore';
import { useStencilFlow } from '@/hooks/useStencilFlow';
import { ArchiveModal } from '@/components/altro/ArchiveModal';
import { ExportModal } from '@/components/altro/ExportModal';
import { InputTerminal, StencilMonitor } from '@/components/glass';
import { INITIAL_DOMAIN_WEIGHTS } from '@/lib/altroData';
import { CrystalLoader } from '@/lib/altro/CrystalLoader';
import { SemanticFirewall } from '@/security/SemanticFirewall';

const GLASS_THEME = {
  dark: { bg: '#1A1A1B', text: '#e5e7eb', border: '#333', muted: '#6b7280', mutedText: '#9ca3af' },
  light: { bg: '#F5F5F5', text: '#1A1A1B', border: '#d1d5db', muted: '#6b7280', mutedText: '#4b5563' },
};

export default function Test() {
  const [isMounted, setIsMounted] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [hoveredIPAId, setHoveredIPAId] = useState<number | null>(null);
  /** DataGuardSwitch: false = DIFUZZY (normal), true = STENCIL LOCK (ALTRO 1) */
  const [stencilLock, setStencilLock] = useState(false);
  const [isCliVisible, setIsCliVisible] = useState(false);
  const [diagnosticLogText, setDiagnosticLogText] = useState('');
  const [outputJustReceived, setOutputJustReceived] = useState(false);
  const wasScanningRef = useRef(false);
  const sourceDocVaultRef = useRef(new DataVault());
  const [sourceDocStatus, setSourceDocStatus] = useState<string | null>(null);

  const state = useAltroPage();
  const {
    isDark,
    setTheme,
    applyPreset,
    toolsModalMode,
    setToolsModalMode,
    sourceText,
    setSourceText,
    setDisplayedAdaptation,
    setAdaptationText,
    sourceTextRef,
    displayedAdaptation,
    handleSourceChange,
    setIsScanning,
    isScanning,
    domainWeights,
    setDomainWeights,
    oprPrismValue,
    setOprPrismValue,
    setNexusCommand,
    commandIntent,
    setCommandIntent,
    outputLanguage,
    setOutputLanguage,
    clearAll,
  } = state;

  const ipaCore = useAltroCore(sourceText ?? '');
  const { resetStencilCore } = ipaCore;

  const {
    runStencilStream,
    abortStreaming,
    isBusy: stencilBusy,
    waitingForLlmResource,
  } = useStencilFlow({
    sourceText: sourceText ?? '',
    legislative: ipaCore.legislativeWeights,
    executive: ipaCore.executiveWeights,
  });

  const [stencilDisplay, setStencilDisplay] = useState<StencilDisplayResult>({
    maskedText: '',
    ipaToEntity: [],
  });

  const syncDiagnosticLogFromFirewall = useCallback(() => {
    const entries = SemanticFirewall.getInstance().getDiagnosticLog();
    const lines = entries.map((e) => {
      const at = new Date(e.ts).toLocaleTimeString();
      return `${at} [${e.mode.toUpperCase()}] ${e.token} :: ${e.event} :: ${e.detail}`;
    });
    setDiagnosticLogText(lines.join('\n'));
  }, []);

  const handleFullReset = useCallback(() => {
    abortStreaming();
    setStencilLock(false);
    setIsCliVisible(false);
    SemanticFirewall.getInstance().clearDiagnosticLog();
    setDiagnosticLogText('');
    resetStencilCore();
    clearAll();
    sourceDocVaultRef.current.removeNamed(IPA_SOURCE_DOC_KEY);
    setSourceDocStatus(null);
    setHoveredIPAId(null);
  }, [abortStreaming, resetStencilCore, clearAll]);

  /** STENCIL-only: DIFUZZY = fuzzy mask, STENCIL LOCK = strict; без пути LIBRA (runScan). */
  const handleTransfigure = () => {
    applyPreset('transfigure');
    const src = (sourceText ?? '').trim();
    /** Единая строка директивы: ядро (CommandBar) + зеркало useAltroPage — иначе userIntent в /api/transcreate уходил пустым при рассинхроне. */
    const line = (ipaCore.commandIntent.trim() || commandIntent.trim());
    /** Атомарный I→P→A; тот же ActionPayload, что дал бы executeAction после capture (без гонки state). */
    const payload = ipaCore.runIpaPhase1(src, line, src);
    const mergedVault: Record<string, string> = { ...payload.capturedData.store };
    const sourceDoc = sourceDocVaultRef.current.get(IPA_SOURCE_DOC_KEY);
    if (sourceDoc !== undefined) mergedVault[IPA_SOURCE_DOC_KEY] = sourceDoc;
    setCommandIntent(line);
    const resolvedTarget =
      outputLanguage === 'auto'
        ? (typeof payload.targetLanguage === 'string' && payload.targetLanguage.trim()
            ? payload.targetLanguage.trim().toLowerCase()
            : 'ru')
        : outputLanguage;
    void (async () => {
      setIsScanning(true);
      flushSync(() => {
        setDisplayedAdaptation('');
        setAdaptationText('');
      });
      try {
        const finalText = await runStencilStream({
          targetLanguage: resolvedTarget,
          ipaVault: mergedVault,
          userIntent: line,
          fuzzy: !stencilLock,
          stencilLocked: stencilLock,
          onChunk: (chunk) => {
            setDisplayedAdaptation((p) => p + chunk);
            setAdaptationText((p) => p + chunk);
          },
        });
        flushSync(() => {
          setDisplayedAdaptation(finalText);
          setAdaptationText(finalText);
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setAdaptationText('');
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        setDisplayedAdaptation(
          msg.includes('502') || msg.includes('Сбой связи')
            ? '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]'
            : msg
        );
        setAdaptationText('');
      } finally {
        setIsScanning(false);
      }
    })();
  };

  /** Монитор + CLI log: один проход — plain-сегменты → SemanticFirewall.mask (как в логе). */
  useEffect(() => {
    const raw = sourceText ?? '';
    const useDifuzzy = !stencilLock;
    const fw = SemanticFirewall.getInstance();
    let cancelled = false;

    void (async () => {
      if (!raw.trim()) {
        fw.clearDiagnosticLog();
        if (!cancelled) {
          setStencilDisplay({ maskedText: '', ipaToEntity: [] });
          setDiagnosticLogText('');
        }
        return;
      }
      const cl = CrystalLoader.getInstance();
      if (!cl.isReady()) {
        try {
          await cl.load('/data/altro_crystal.bin');
        } catch {
          if (!cancelled) {
            setStencilDisplay(buildStencilForDisplay(raw));
            setDiagnosticLogText('');
          }
          return;
        }
      }
      if (cancelled) return;
      fw.clearDiagnosticLog();
      const display = buildStencilForDisplayWithSemantic(raw, (plain) =>
        fw.mask(plain, { useDifuzzy })
      );
      if (!cancelled) {
        setStencilDisplay(display);
        syncDiagnosticLogFromFirewall();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sourceText, stencilLock, syncDiagnosticLogFromFirewall]);

  useEffect(() => {
    if (!isCliVisible) return;
    syncDiagnosticLogFromFirewall();
    const timer = window.setInterval(syncDiagnosticLogFromFirewall, 300);
    return () => window.clearInterval(timer);
  }, [isCliVisible, syncDiagnosticLogFromFirewall]);

  useEffect(() => {
    const wasScanning = wasScanningRef.current;
    wasScanningRef.current = isScanning;
    if (wasScanning && !isScanning && (displayedAdaptation || '').trim()) {
      setOutputJustReceived(true);
      const t = setTimeout(() => setOutputJustReceived(false), 500);
      return () => clearTimeout(t);
    }
  }, [isScanning, displayedAdaptation]);

  // SSR Fix: PanelGroup только после монтирования — предотвращает конфликт гидратации
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Theme Fix: применяем .light к корню для глобальных стилей (модалки и т.д.)
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.remove('light');
    else root.classList.add('light');
    return () => root.classList.remove('light');
  }, [isDark]);

  const theme = GLASS_THEME[isDark ? 'dark' : 'light'];
  const headerBg = isDark ? '#1A1A1B' : '#eeeeee';
  const headerBorder = isDark ? '#333' : '#d1d5db';

  const panelBorder = isDark ? '#333' : '#D1D1D1';

  return (
    <div
      className="h-screen max-h-screen font-mono flex flex-col overflow-hidden"
      style={{
        background: theme.bg,
        color: theme.text,
        border: `1px solid ${panelBorder}`,
      }}
    >
      <header
        className="flex-shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: `1px solid ${headerBorder}`, background: headerBg }}
      >
        <div>
          <h1 className="text-lg font-bold tracking-tight">
            <span style={{ color: '#60a5fa' }}>ALTRO 1</span>
            <span style={{ color: theme.muted, marginLeft: 6 }}>STENCIL ENGINE</span>
          </h1>
          <div className="text-[8px] mt-0.5" style={{ color: theme.muted }}>
            BY SVN / POWERED BY FIREBIRD SYNC
          </div>
          <div
            className="text-[8px] mt-1 font-mono flex flex-wrap items-center gap-x-2 gap-y-0.5"
            style={{ color: theme.muted }}
            aria-live="polite"
          >
            <span style={{ color: theme.mutedText }}>SYSTEM STATUS:</span>
            {stencilBusy ? (
              <span style={{ color: '#f59e0b', fontWeight: 600 }}>LLM OCCUPIED</span>
            ) : (
              <span style={{ color: '#22c55e' }}>READY</span>
            )}
            {waitingForLlmResource && (
              <span style={{ color: '#eab308' }}>Waiting for LLM Resource...</span>
            )}
          </div>
          {/* Cold start: connect timeout allows ~45s; if the first run errors, retry once after the model loads into VRAM. */}
          <div className="text-[8px] mt-0.5 max-w-xl" style={{ color: theme.mutedText }}>
            Warm-up: after idle, the first request may wait while Ollama loads the model into VRAM (~45s). Retry if you see a
            connection error.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="flex rounded overflow-hidden border"
            style={{ borderColor: headerBorder }}
          >
            <button
              type="button"
              disabled={stencilBusy}
              onClick={() => setStencilLock(false)}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: !stencilLock ? 'rgba(96,165,250,0.2)' : isDark ? '#111' : '#e5e7eb',
                color: !stencilLock ? '#60a5fa' : theme.muted,
                borderRight: `1px solid ${headerBorder}`,
              }}
            >
              [DIFUZZY]
            </button>
            <button
              type="button"
              disabled={stencilBusy}
              onClick={() => setStencilLock(true)}
              className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: stencilLock ? 'rgba(34,197,94,0.2)' : isDark ? '#111' : '#e5e7eb',
                color: stencilLock ? '#22c55e' : theme.muted,
              }}
            >
              [STENCIL LOCK]
            </button>
          </div>

          <button
            type="button"
            onClick={handleFullReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded border text-[10px] font-mono uppercase tracking-wider transition-colors"
            style={{
              borderColor: headerBorder,
              color: theme.mutedText,
              background: isDark ? '#111' : '#e5e7eb',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ef4444';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.background = isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = headerBorder;
              e.currentTarget.style.color = theme.mutedText as string;
              e.currentTarget.style.background = isDark ? '#111' : '#e5e7eb';
            }}
            title="Danger Zone: полный сброс захвата, IPA, директивы и вывода"
            aria-label="Full reset"
          >
            <RefreshCcw className="w-3.5 h-3.5" strokeWidth={2} />
            RESET
          </button>

          <button
            type="button"
            onClick={() => setIsCliVisible((v) => !v)}
            className="text-[10px] px-2 py-1 rounded border font-mono uppercase"
            style={{
              borderColor: isCliVisible ? '#22d3ee' : headerBorder,
              color: isCliVisible ? '#22d3ee' : theme.mutedText,
              background: isCliVisible ? (isDark ? 'rgba(34,211,238,0.12)' : 'rgba(34,211,238,0.08)') : 'transparent',
            }}
            title="Показать/скрыть CLI-диагностику Stencil Firewall"
          >
            [CLI]
          </button>

          <button
            type="button"
            onClick={() => setIsArchiveOpen(true)}
            className="text-[10px] px-2 py-1 rounded border font-mono uppercase"
            style={{ borderColor: headerBorder, color: theme.mutedText }}
          >
            АРХИВ
          </button>
          <button
            type="button"
            onClick={() => setToolsModalMode('export')}
            className="text-[10px] px-2 py-1 rounded border font-mono uppercase"
            style={{ borderColor: headerBorder, color: theme.mutedText }}
          >
            ЭКСПОРТ
          </button>

          <button
            type="button"
            onClick={handleTransfigure}
            disabled={isScanning}
            className="text-[11px] px-4 py-2 rounded border font-mono uppercase tracking-wider transition-colors"
            style={{
              borderColor: isScanning ? '#22c55e' : stencilLock ? '#22c55e' : headerBorder,
              background: isScanning ? 'rgba(34,197,94,0.2)' : stencilLock ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: isScanning ? '#22c55e' : stencilLock ? '#22c55e' : theme.mutedText,
            }}
          >
            {isScanning ? '…' : 'ТРАНСФИГУРАЦИЯ'}
          </button>

          <button
            type="button"
            onClick={() => setTheme(!isDark)}
            className="w-8 h-8 rounded flex items-center justify-center border transition-colors"
            style={{ borderColor: headerBorder, background: isDark ? '#111' : '#e5e7eb' }}
            title={isDark ? 'Светлая тема' : 'Тёмная тема'}
            aria-label="Toggle theme"
          >
            {isDark ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Resizable Panels: рендер после isMounted для избежания SSR/hydration конфликта */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        style={{ borderTop: `1px solid ${headerBorder}` }}
      >
        {!isMounted ? (
          <div className="flex-1 min-h-0" style={{ background: theme.bg }} />
        ) : (
          <Group
            orientation="horizontal"
            id="glass-panels"
            className="h-full gap-1 flex-1 min-h-0"
            defaultLayout={{ input: 28, stencil: 72 }}
          >
            <Panel id="input" minSize="15" maxSize="55" defaultSize="28">
              <div
                className="h-full flex flex-col min-w-0 overflow-hidden"
                style={{
                  borderTop: `1px solid ${panelBorder}`,
                  borderBottom: `1px solid ${panelBorder}`,
                  borderLeft: `1px solid ${panelBorder}`,
                }}
              >
                <FileGateway
                  isDark={isDark}
                  disabled={stencilBusy}
                  statusLine={sourceDocStatus}
                  onFileTextLoaded={(text, _name) => {
                    sourceDocVaultRef.current.setNamed(IPA_SOURCE_DOC_KEY, text);
                    setSourceText(text);
                    sourceTextRef.current = text;
                    setSourceDocStatus(`Source Document Loaded (${text.length} characters)`);
                  }}
                />
                <div className="flex-1 min-h-0 min-w-0 flex flex-col">
                  <InputTerminal
                    isDark={isDark}
                    sourceText={sourceText}
                    onSourceChange={(v) =>
                      handleSourceChange({ target: { value: v } } as React.ChangeEvent<HTMLTextAreaElement>)
                    }
                    hoveredIPAId={hoveredIPAId}
                    readOnly={stencilLock}
                    captureSourceLanguage={ipaCore.captureSourceLanguage}
                    onCaptureSourceLanguageChange={ipaCore.setCaptureSourceLanguage}
                  />
                </div>
              </div>
            </Panel>
            <Separator id="grip-1" className="glass-resizer" />
            <Panel id="stencil" minSize="25" maxSize="85" defaultSize="72">
              <div
                className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
                style={{
                  borderTop: `1px solid ${panelBorder}`,
                  borderBottom: `1px solid ${panelBorder}`,
                  borderRight: `1px solid ${panelBorder}`,
                }}
              >
                <StencilMonitor
                  isDark={isDark}
                  maskedText={stencilDisplay.maskedText}
                  ipaToEntity={stencilDisplay.ipaToEntity}
                  onHoverIPA={setHoveredIPAId}
                  sourceTextForCapture={sourceText ?? ''}
                  onSyncCommandIntent={setCommandIntent}
                  stencilResolvedTarget={ipaCore.effectiveStencilTarget}
                  stencilOutputText={displayedAdaptation || ''}
                  stencilOutputAssembling={isScanning}
                  stencilOutputJustReceived={outputJustReceived}
                  outputLanguage={outputLanguage}
                  onOutputLanguageChange={setOutputLanguage}
                  outputResolvedHint={ipaCore.effectiveStencilTarget}
                  ipa={{
                    commandIntent: ipaCore.commandIntent,
                    setCommandIntent: ipaCore.setCommandIntent,
                    targetLanguage: ipaCore.targetLanguage,
                    captureSourceLanguage: ipaCore.captureSourceLanguage,
                    setCaptureSourceLanguage: ipaCore.setCaptureSourceLanguage,
                    stencilLanguageMode: ipaCore.stencilLanguageMode,
                    setStencilLanguageMode: ipaCore.setStencilLanguageMode,
                    runIpaPhase1: ipaCore.runIpaPhase1,
                    executeAction: ipaCore.executeAction,
                  }}
                />
                {isCliVisible && (
                  <div
                    className="flex-shrink-0 border-t"
                    style={{
                      borderColor: panelBorder,
                      background: isDark ? '#05070a' : '#0f172a',
                    }}
                  >
                    <div
                      className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider"
                      style={{ color: '#22d3ee', borderBottom: `1px solid ${isDark ? '#11303a' : '#1e3a8a'}` }}
                    >
                      Stencil CLI Diagnostic Log
                    </div>
                    <textarea
                      readOnly
                      value={diagnosticLogText || '[NO DIAGNOSTIC EVENTS YET]'}
                      className="w-full resize-none border-0 p-3 text-[11px] leading-relaxed font-mono focus:outline-none"
                      style={{
                        height: 150,
                        background: 'transparent',
                        color: '#86efac',
                      }}
                    />
                  </div>
                )}
              </div>
            </Panel>
          </Group>
        )}
      </div>

      {/* Footer: flex-shrink-0 — жестко прижат к низу, не перекрывается панелями */}
      <footer
        className="flex-shrink-0 grid grid-cols-3 items-center gap-2 px-4 py-1.5 text-[10px] font-mono shrink-0"
        style={{
          background: '#2d2d2d',
          color: '#a0a0a0',
          borderTop: `1px solid ${panelBorder}`,
        }}
      >
        <span>© 2026 SERGEI NAZARIAN (SVN) | ALTRO STENCIL</span>
        <span className="text-center">Semantic Orchestration Layer (Standard 2026)</span>
        <span className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => setIsLegalOpen(true)}
            className="underline cursor-pointer hover:text-[#d1d5db] transition-colors text-left"
          >
            License: MIT | Private & Sovereign Use Only
          </button>
          <span className="flex items-center gap-1 whitespace-nowrap" style={{ color: '#22c55e' }}>
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" title="Firebird connected" />
            FIREBIRD: CONNECTED
          </span>
        </span>
      </footer>

      {/* Legal Insight — полный текст лицензионного манифеста */}
      <ToolsModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
        title="Legal Insight"
        isDark={isDark}
      >
        <div className="px-4 py-3 text-[11px] leading-relaxed" style={{ color: isDark ? '#e5e7eb' : '#1A1A1B' }}>
          <p>
            Лицензионный манифест ALTRO: Данное ПО является инструментом Semantic Orchestration Layer.
            Автор и правообладатель: SERGEI NAZARIAN (SVN).
            Предназначено для защиты смыслового суверенитета пользователя.
          </p>
        </div>
      </ToolsModal>

      {/* Modal: Export */}
      <ToolsModal
        isOpen={toolsModalMode === 'export'}
        onClose={() => setToolsModalMode(null)}
        title="Экспорт"
        isDark={isDark}
      >
        <ExportModal
          isDark={isDark}
          currentResult={(displayedAdaptation || sourceText || '').trim()}
          onClose={() => setToolsModalMode(null)}
        />
      </ToolsModal>

      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        isDark={isDark}
        onSelectRecord={(record) => {
          setSourceText(record.source);
          sourceTextRef.current = record.source;
          setDisplayedAdaptation(record.result);
          setAdaptationText(record.result);
          const radar = record.radar ?? {};
          const migratedRadar = { ...radar, spirituality: radar.spirituality ?? (radar as Record<string, number>).religion ?? 0 };
          if ('religion' in migratedRadar) delete (migratedRadar as Record<string, number>).religion;
          setDomainWeights({ ...INITIAL_DOMAIN_WEIGHTS, ...migratedRadar });
          setOprPrismValue(Math.max(0, Math.min(100, record.resonance ?? 0)));
          setNexusCommand(record.nexusCommand ?? '');
          setIsArchiveOpen(false);
        }}
      />
    </div>
  );
}
