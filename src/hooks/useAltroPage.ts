/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  INITIAL_DOMAIN_WEIGHTS,
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  type DomainWeights,
} from '@/lib/altroData';
import {
  detectHomonymInstances,
  runCoreSanitation,
  runScanLogic,
  applyPresetLogic,
  applyHomonymVariantSelect as applyHomonymVariantSelectLogic,
  buildAccentedWordWithCharCode,
} from '@/lib/altroLogic';
import { type ScenarioType } from '@/lib/altroData';
import {
  resetOrchestrationContext,
  getActivePattern,
  areWeightsInStandby,
  calculateWeights,
  diffHighlight,
  escapeHtml,
  detectHomonymsInText,
  tokenizeText,
  type TextToken,
  type SemanticSuggestion,
  detectHomonyms as getHomonymWordsFromEngine,
  hasNoObviousErrors,
  AltroOrchestrator,
  buildLocalAuditLog,
  type AltroCalibration,
  type GuardReport,
} from '@/lib/altro/engine';
import type { DomainCalibration } from '@/lib/altro/domain-processor';
import { AltroTokenManager } from '@/lib/altro/tokenManager';
import { hasStressMark } from '@/lib/altro/textUtils';
import { CommandProcessor } from '@/lib/altro/CommandProcessor';
import { SemanticFirewall } from '@/security/SemanticFirewall';
import { resetTrustLayer } from '@/lib/altro/trust-layer';
import { DomainEngine } from '@/archive/legacy_altro/DomainEngine';
import type { InternalDomainKey, ExternalDomainKey } from '@/lib/altro/foundation';
import { VoiceService } from '@/lib/altro/voiceService';
import type { SourceLanguageForVoice } from '@/lib/altro/voiceService';
import { useNexus } from './useNexus';
import { useResonance } from './useResonance';
import { useAltroScanner } from './useAltroScanner';
import { addVaultRecord, addArchiveRecord, addChronosRecord } from '@/lib/db';
import { useAltroSync } from './useAltroSync';
import { ALTRO_PRODUCT_STENCIL_ONLY } from '@/config/product';

/** Токен с флагом подтверждения (DomainEngine Sacred/Imagery или выбор ударения) */
export type ProcessedToken = TextToken & { isConfirmed?: boolean };

/** Проверка: есть ли неразрешённые омонимы среди токенов с учётом resolvedVariants. */
function hasUnresolvedHomonymsInTokens(
  tokens: TextToken[],
  auditLog: Array<{ word: string; variants?: string[] }>,
  resolvedVariants: Map<number, string>
): boolean {
  const normalize = (w: string) => w.toLowerCase().replace(/[\u0301]/g, '');
  for (const t of tokens) {
    if (t.type !== 'word') continue;
    if (hasStressMark(t.word)) continue;
    if (resolvedVariants.has(t.id)) continue;
    const norm = normalize(t.word);
    const entry = auditLog.find((e) => normalize(e.word) === norm);
    if (entry && (entry.variants?.length ?? 0) > 0) return true;
  }
  return false;
}

export type PresetId = 'mirror' | 'transfigure' | 'slang' | null;

/** Поддерживаемые выходные языки (Фаза 3 / Смысловой Шлюз). `auto` — следовать цели трафарета (IPA). */
export type OutputLanguage = 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy' | 'es';
export const OUTPUT_LANGUAGES: OutputLanguage[] = ['auto', 'ru', 'en', 'de', 'fr', 'it', 'hy', 'es'];

/** Язык источника: Auto = автоопределение, иначе фиксированный. */
export type SourceLanguage = 'auto' | OutputLanguage;

export function useAltroPage() {
  const {
    domainWeights,
    setDomainWeights,
    oprPrismValue,
    setOprPrismValue,
    isAnalyzed,
    setIsAnalyzed,
  } = useResonance();

  const runScanRef = useRef<((seamless?: boolean, transcreateOnly?: boolean, textOverride?: string) => void) | null>(null);
  const clearAllRef = useRef<(() => void) | null>(null);
  const isScanningRef = useRef(false);

  const domainWeightsRef = useRef(domainWeights);
  const oprPrismValueRef = useRef(oprPrismValue);
  domainWeightsRef.current = domainWeights;
  oprPrismValueRef.current = oprPrismValue;

  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('auto');

  /** Command Unit: директива из Монитора Трафарета → stencilTransfigure.userIntent */
  const [commandIntent, setCommandIntent] = useState('');

  useEffect(() => {
    console.log('[CORE]: System Calibrated with Hidden 8-Domain Matrix. Command Unit Active.');
  }, []);

  const {
    sourceText,
    setSourceText,
    sourceTextRef,
    nexusCommand,
    setNexusCommand,
    isListening,
    toggleVoiceListening,
    activeFile,
    setActiveFile,
    handleFileUpload,
    nexusFlash,
    setNexusFlash,
    dispatchSmartCommand,
    clearSourceInput,
  } = useNexus({
    sourceLanguage,
    isScanningRef,
    onRunScan: (seamless) => {
      if (ALTRO_PRODUCT_STENCIL_ONLY) return;
      runScanRef.current?.(seamless);
    },
    onClearAll: () => clearAllRef.current?.(),
    onSetOprPrismValue: setOprPrismValue,
  });

  /** ALTRO 1: дефолт transfigure, mirror деактивирован */
  const [activePreset, setActivePreset] = useState<PresetId>('transfigure');
  const [isEditing, setIsEditing] = useState(true);
  const [isDark, setTheme] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard'>('without');
  const [adaptationText, setAdaptationText] = useState('');
  const [displayedAdaptation, setDisplayedAdaptation] = useState('');
  const [cleanedText, setCleanedText] = useState<string | null>(null);
  const [isCleaningComplete, setIsCleaningComplete] = useState(false);
  const [ALTRO_GOLDEN_STATE, setALTRO_GOLDEN_STATE] = useState<string>('');
  const [calibratedText, setCalibratedText] = useState<string>('');
  const [activePattern, setActivePattern] = useState<{ id: string; name: string } | null>(null);
  const [textTokens, setTextTokens] = useState<TextToken[]>([]);
  const [displayTokens, setDisplayTokens] = useState<TextToken[]>([]);
  const [auditLog, setAuditLog] = useState<Array<{ word: string; variants?: string[]; reason?: string; priority?: boolean }>>([]);
  const [selectedScannedTokenId, setSelectedScannedTokenId] = useState<number | null>(null);
  const [resolvedVariants, setResolvedVariants] = useState<Map<number, string>>(new Map());
  const [committedTokens, setCommittedTokens] = useState<TextToken[]>([]);
  const [isCommitted, setIsCommitted] = useState(false);
  const [homonymRegistry, setHomonymRegistry] = useState<Map<number, { resolved: boolean; variant?: string }>>(new Map());
  const [homonymInstances, setHomonymInstances] = useState<Array<{ id: string; word: string; position: number; baseWord: string }>>([]);
  const [resolvedHomonyms, setResolvedHomonyms] = useState<Map<string, string>>(new Map());
  const [semanticSuggestions, setSemanticSuggestions] = useState<SemanticSuggestion[]>([]);
  const [validatedTokens, setValidatedTokens] = useState<Set<number>>(new Set());
  const [selectedTokenId, setSelectedTokenId] = useState<number | null>(null);
  const [showHomonymClarify, setShowHomonymClarify] = useState(false);
  const [selectedSuspiciousTokenId, setSelectedSuspiciousTokenId] = useState<number | null>(null);
  const [showSuspiciousSuggestion, setShowSuspiciousSuggestion] = useState(false);
  const [adaptationFlash, setAdaptationFlash] = useState(false);
  const [semanticResetFlash, setSemanticResetFlash] = useState(false);
  const [homonymReplaceHighlight, setHomonymReplaceHighlight] = useState<{ start: number; end: number } | null>(null);
  const [toolsModalMode, setToolsModalMode] = useState<'snapshot' | 'archive' | 'export' | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; domainWeights: DomainWeights; oprPrismValue: number; activePreset: PresetId; selectedScenario: string; timestamp: string }>>([]);
  /** Выходной язык (Target). По умолчанию 'ru'. */
  const [outputLanguage, setOutputLanguage] = useState<OutputLanguage>('auto');
  const nexusCommandRef = useRef<HTMLTextAreaElement>(null);
  const homonymClarifyRef = useRef<HTMLDivElement>(null);
  const suspiciousSuggestionRef = useRef<HTMLDivElement>(null);
  const [securityBlocked, setSecurityBlocked] = useState(false);
  const [lastGuardReport, setLastGuardReport] = useState<GuardReport | null>(null);
  const altroOrchestrator = useRef(new AltroOrchestrator()).current;

  const { isSyncing, syncDatabase } = useAltroSync({
    domainWeightsRef,
    altroOrchestrator,
    setDomainWeights,
  });

  const NEXUS_MAX_HEIGHT = 200;
  const NEXUS_MIN_HEIGHT = 28;
  const adjustNexusHeight = useCallback(() => {
    const el = nexusCommandRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(NEXUS_MAX_HEIGHT, Math.max(NEXUS_MIN_HEIGHT, el.scrollHeight))}px`;
  }, []);

  const handleNexusResize = useCallback((e: React.FormEvent<HTMLTextAreaElement>, defer = false) => {
    const target = e?.currentTarget;
    if (!target) return;
    const run = () => {
      target.style.height = '0px';
      target.style.height = `${Math.min(NEXUS_MAX_HEIGHT, Math.max(NEXUS_MIN_HEIGHT, target.scrollHeight))}px`;
    };
    if (defer) requestAnimationFrame(run);
    else run();
  }, []);

  // ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
  // Command Dominance: /mode:, /opr:, /reset. Returns true if command, false if plain text.
  const processCommand = useCallback((text: string): boolean => {
    const result = CommandProcessor.process(text, {
      domainWeights,
      selectedScenario,
      oprPrismValue,
    });
    if (!result.success) return false;
    if (result.weights != null) setDomainWeights(result.weights);
    if (result.selectedScenario != null) setSelectedScenario(result.selectedScenario);
    if (result.oprPrismValue != null) setOprPrismValue(result.oprPrismValue);
    if (result.activePreset != null)
      setActivePreset(result.activePreset ?? 'mirror');
    if (result.activePattern !== undefined) setActivePattern(result.activePattern ?? null);
    return true;
  }, [domainWeights, selectedScenario, oprPrismValue]);

  const mappedScenario: ScenarioType = selectedScenario === 'poetry' ? 'poetics' : selectedScenario === 'technocrat' ? 'technocrat' : selectedScenario === 'sacred' ? 'sacred' : selectedScenario === 'goldStandard' ? 'goldStandard' : 'without';

  const altroCalibration = useMemo(
    () => ({
      internal: {
        semantics: domainWeights.semantics * 100,
        context: domainWeights.context * 100,
        intent: domainWeights.intent * 100,
        imagery: domainWeights.imagery * 100,
        ethics: domainWeights.ethics * 100,
      },
      external: {
        economics: domainWeights.economics,
        politics: domainWeights.politics,
        society: domainWeights.society,
        history: domainWeights.history,
        culture: domainWeights.culture,
        aesthetics: domainWeights.aesthetics,
        technology: domainWeights.technology,
        spirituality: domainWeights.spirituality,
      },
      opr: oprPrismValue / 100,
      scenario: mappedScenario,
    }),
    [domainWeights, selectedScenario, oprPrismValue]
  );

  const inputText = isCommitted && committedTokens.length > 0 ? committedTokens.map((t) => t.word).join('') : sourceText;

  const {
    runScan,
    isScanning,
    scanResultBuffer,
    setScanResultBuffer,
    setIsScanning,
  } = useAltroScanner({
    altroOrchestrator,
    activePreset,
    domainWeights,
    domainWeightsRef,
    oprPrismValue,
    oprPrismValueRef,
    mappedScenario,
    outputLanguage,
    sourceLanguage,
    isAnalyzed,
    setIsAnalyzed,
    setSecurityBlocked,
    setIsEditing,
    setDisplayedAdaptation,
    setAdaptationText,
    setCalibratedText,
    setTextTokens,
    setAuditLog,
    setResolvedVariants,
    setSelectedScannedTokenId,
    setALTRO_GOLDEN_STATE,
    setActivePreset,
    setDisplayTokens,
    sourceText,
    displayedAdaptation,
    adaptationText,
    calibratedText,
    ALTRO_GOLDEN_STATE,
    displayTokens,
    resolvedVariants,
    nexusCommand,
    isCommitted,
    committedTokens,
    altroCalibration,
    inputText,
    sourceTextForInput: sourceText,
    setLastGuardReport,
  });

  useEffect(() => {
    runScanRef.current = runScan;
  }, [runScan]);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    /** Полный текст из textarea; нет validate/sanitize/format/slice до setSourceText (см. [STATE AUDIT] в useNexus). */
    const cleanText = e.target.value;
    sourceTextRef.current = cleanText;
    setSourceText(cleanText);
    setIsAnalyzed(false);
    setIsCommitted(false);
    setCommittedTokens([]);
    setScanResultBuffer(null);
    setALTRO_GOLDEN_STATE('');
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setTextTokens(tokenizeText(cleanText));
    setHomonymInstances(detectHomonymInstances(cleanText));
  }, []);

  const _runCoreSanitation = useCallback((inputText: string): string => {
    const result = runCoreSanitation({
      inputText,
      validatedTokens,
      resolvedHomonyms,
      contextWeight: domainWeights.context,
    });
    setSemanticSuggestions(result.semanticSuggestions);
    setHomonymRegistry(result.homonymRegistry);
    setHomonymInstances(result.homonymInstances);
    setResolvedHomonyms(result.resolvedHomonyms);
    setTextTokens(result.textTokens);
    setCleanedText(result.correctedTextResult);
    setIsCleaningComplete(result.isCleaningComplete);
    if (result.altroGoldenState) setALTRO_GOLDEN_STATE(result.altroGoldenState);
    setScanResultBuffer(result.correctedTextResult);
    return result.correctedTextResult;
  }, [validatedTokens, resolvedHomonyms, domainWeights.context]);

  const handleEnterKey = useCallback((text: string, onCommandSuccess?: () => void) => {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (trimmed.startsWith('/')) {
      if (processCommand(trimmed)) {
        onCommandSuccess?.();
      }
      return;
    }
    
    if (dispatchSmartCommand(trimmed)) {
      onCommandSuccess?.();
      setNexusFlash(true);
      setTimeout(() => setNexusFlash(false), 800);
      return;
    }

    if (!ALTRO_PRODUCT_STENCIL_ONLY) {
      runScan(true);
    }
  }, [processCommand, dispatchSmartCommand, runScan, setNexusFlash]);

  const applyPreset = useCallback((preset: 'mirror' | 'transfigure' | 'slang') => {
    setActivePreset(preset);
    if (preset === 'mirror') {
      setDomainWeights(INITIAL_DOMAIN_WEIGHTS);
      setActivePattern(null);
      setSelectedScenario('without');
    }
    if (!isAnalyzed) return;
    const textToUse = ALTRO_GOLDEN_STATE?.trim() || (isCommitted && committedTokens.length > 0 ? committedTokens.map((t) => t.word).join('') : sourceText);
    if (preset === 'mirror' && textToUse) {
      setCalibratedText(textToUse);
      setDisplayedAdaptation(textToUse);
      setAdaptationText(textToUse);
    } else if (textToUse && preset !== 'mirror') {
      const result = applyPresetLogic({ preset, textToUse, domainWeights, mappedScenario, nexusCommand, oprPrismValue });
      if (result) {
        setCalibratedText(result.adaptationText);
        setDisplayedAdaptation(result.displayedAdaptation);
        setAdaptationText(result.adaptationText);
      }
    }
  }, [sourceText, domainWeights, committedTokens, isCommitted, ALTRO_GOLDEN_STATE, mappedScenario, nexusCommand, oprPrismValue, isAnalyzed]);

  useEffect(() => {
    if (activePreset !== 'mirror') return;
    const tokensText = displayTokens.map((t) => t.word).join('');
    if (displayedAdaptation === tokensText) return;
    setDisplayTokens(AltroTokenManager.tokenize(displayedAdaptation));
  }, [displayedAdaptation, activePreset, displayTokens]);

  const handleMirrorTokenClick = useCallback((tokenId: number) => {
    setDisplayTokens((prev) => {
      const next = AltroTokenManager.toggleLock(prev, tokenId);
      const text = next.map((t) => t.word).join('');
      setDisplayedAdaptation(text);
      setAdaptationText(text);
      return next;
    });
  }, []);

  const handleScannedTokenClick = useCallback((tokenId: number) => {
    setSelectedScannedTokenId((prev) => (prev === tokenId ? null : tokenId));
  }, []);

  const applyVariantSelection = useCallback(
    (tokenId: number, variant: string, tokens: TextToken[], text: string) => {
      const token = tokens.find((t) => t.id === tokenId);
      if (!token) return { updatedTokens: tokens, rebuiltText: text };
      let wordToApply = variant;
      if (!/[\u0301]/.test(variant)) {
        const base = token.word.toLowerCase().replace(/[\u0301]/g, '');
        const baseWord = HOMONYM_WORD_FORMS[base] ?? base;
        const entry = HOMONYM_DB.find((e) => e.base.toLowerCase() === baseWord);
        const match = entry?.variants.find((v) => v.meaning === variant);
        if (match) wordToApply = match.word;
      }
      const hasStress = /[\u0301]/.test(wordToApply);
      const newWord = hasStress ? buildAccentedWordWithCharCode(token.word, wordToApply) : token.word;
      const updatedTokens = tokens.map((t) =>
        t.id === tokenId ? { ...t, word: newWord, isLocked: true, meaning: variant } : t
      );
      const rebuiltText = updatedTokens.map((t) => t.word).join('');
      return { updatedTokens, rebuiltText };
    },
    []
  );

  const handleVariantSelect = useCallback(
    (tokenId: number, variant: string) => {
      setDisplayTokens((prev) => {
        const text = prev.map((t) => t.word).join('');
        const { updatedTokens, rebuiltText } = applyVariantSelection(tokenId, variant, prev, text);
        const newResolved = new Map(resolvedVariants).set(tokenId, variant);
        setResolvedVariants(newResolved);
        setDisplayedAdaptation(rebuiltText);
        setAdaptationText(rebuiltText);
        setCalibratedText(rebuiltText);
        if (rebuiltText) setALTRO_GOLDEN_STATE(rebuiltText);
        setSelectedScannedTokenId(null);
        if (activePreset === 'mirror') return updatedTokens;
        const allResolved = !hasUnresolvedHomonymsInTokens(updatedTokens, auditLog, newResolved);
        if (allResolved) {
          setActivePreset('transfigure');
          if (!ALTRO_PRODUCT_STENCIL_ONLY) {
            setTimeout(() => runScan(false, true, rebuiltText), 0);
          }
        }
        return updatedTokens;
      });
    },
    [applyVariantSelection, runScan, auditLog, resolvedVariants, activePreset]
  );

  const normalizeForAuditMatch = useCallback((w: string) =>
    w.toLowerCase().replace(/[\u0301]/g, ''), []);

  /** Deep Reset: полная очистка чата, domainWeights→OPR, Firewall, TrustLayer. Без артефактов. */
  const clearAll = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
      window.sessionStorage.clear();
    }
    SemanticFirewall.getInstance().resetToDefault();
    SemanticFirewall.getInstance().annulContextFragment('source');
    SemanticFirewall.getInstance().annulContextFragment('nexus');
    SemanticFirewall.getInstance().annulContextFragment('adaptation');
    resetTrustLayer();
    resetOrchestrationContext();
    setIsScanning(false);
    setIsEditing(true);
    setIsAnalyzed(false);
    setSourceText('');
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setDisplayTokens([]);
    setAuditLog([]);
    setResolvedVariants(new Map());
    setSelectedScannedTokenId(null);
    setTextTokens([]);
    setCommittedTokens([]);
    setIsCommitted(false);
    setHomonymRegistry(new Map());
    setHomonymInstances([]);
    setSemanticSuggestions([]);
    setResolvedHomonyms(new Map());
    setScanResultBuffer(null);
    setALTRO_GOLDEN_STATE('');
    sourceTextRef.current = '';
    setSelectedTokenId(null);
    setShowHomonymClarify(false);
    setSelectedSuspiciousTokenId(null);
    setShowSuspiciousSuggestion(false);
    setValidatedTokens(new Set());
    setHomonymReplaceHighlight(null);
    setNexusCommand('');
    setDomainWeights(INITIAL_DOMAIN_WEIGHTS);
    setOprPrismValue(0);
    setActivePreset('transfigure');
    setSelectedScenario('without');
    setActivePattern(null);
    setSecurityBlocked(false);
    setSnapshots([]);
    setOutputLanguage('auto');
    setSourceLanguage('auto');
    setCommandIntent('');
    setLastGuardReport(null);
    setSemanticResetFlash(true);
    if (typeof window !== 'undefined') {
      console.log('[ALTRO FULL SEMANTIC RESET] Cleared: chat/source/adaptation, tokens, audit, suggestions, localStorage/sessionStorage, domainWeights→OPR, activePreset→transfigure, oprPrismValue→0, scenario→without, snapshots, securityBlocked, languages. Firewall OPR reset to neutral.');
    }
    window.setTimeout(() => setSemanticResetFlash(false), 1500);
  }, [setIsScanning]);

  useEffect(() => {
    clearAllRef.current = clearAll;
  }, [clearAll]);

  /** ALTRO Standard: Очистка Source через крестик — сброс текста, токенов, метрик, адаптации + сигнал Firewall. */
  const clearSource = useCallback(() => {
    setSourceText('');
    sourceTextRef.current = '';
    setTextTokens([]);
    setDisplayTokens([]);
    setHomonymInstances([]);
    setHomonymRegistry(new Map());
    setResolvedHomonyms(new Map());
    setResolvedVariants(new Map());
    setSemanticSuggestions([]);
    setCommittedTokens([]);
    setIsCommitted(false);
    setValidatedTokens(new Set());
    setScanResultBuffer(null);
    setAuditLog([]);
    setSelectedScannedTokenId(null);
    setALTRO_GOLDEN_STATE('');
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setHomonymReplaceHighlight(null);
    setIsEditing(true);
    setIsAnalyzed(false);
    SemanticFirewall.getInstance().annulContextFragment('source');
    if (typeof window !== 'undefined') {
      console.log('[ALTRO LOCAL CLEAR] Source: field, tokens, audit, adaptation zeroed. Firewall context fragment annulled.');
    }
  }, []);

  /** Очистка поля Nexus/Command — обнуление ввода и сигнал Firewall (OPR не сбрасывается). */
  const clearNexus = useCallback(() => {
    setNexusCommand('');
    SemanticFirewall.getInstance().annulContextFragment('nexus');
    if (typeof window !== 'undefined') {
      console.log('[ALTRO LOCAL CLEAR] Nexus/Command: field zeroed. Firewall context fragment annulled.');
    }
  }, []);


  /** Очистка блока Адаптация — обнуление вывода и метрик + сигнал Firewall. */
  const clearAdaptation = useCallback(() => {
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setDisplayTokens([]);
    setAuditLog([]);
    setResolvedVariants(new Map());
    setSelectedScannedTokenId(null);
    setALTRO_GOLDEN_STATE('');
    setLastGuardReport(null);
    SemanticFirewall.getInstance().annulContextFragment('adaptation');
    if (typeof window !== 'undefined') {
      console.log('[ALTRO LOCAL CLEAR] Adaptation: output and metrics zeroed. Firewall context fragment annulled.');
    }
  }, []);

  const handleSave = useCallback(async () => {
    const text = (displayedAdaptation || '').trim();
    if (!text && !sourceText) return;
    try {
      await addVaultRecord({
        type: activePreset ?? 'mirror',
        resonance: oprPrismValue,
        source: sourceText,
        result: text,
        radar: { ...domainWeights },
        nexusCommand: nexusCommand ?? '',
        model:
          typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_MODEL?.trim()
            ? process.env.NEXT_PUBLIC_DEFAULT_MODEL.trim()
            : 'Local LLM',
        timestamp: Date.now(),
      });
      await addArchiveRecord({ source: sourceText, result: text, timestamp: Date.now() });
    } catch (err) {
      console.error('Failed to save to Vault', err);
    }
  }, [displayedAdaptation, sourceText, activePreset, oprPrismValue, domainWeights, nexusCommand]);

  const createSnapshot = useCallback(async () => {
    const snap = {
      id: `snap_${Date.now()}`,
      domainWeights: { ...domainWeights },
      oprPrismValue,
      activePreset,
      selectedScenario,
      timestamp: new Date().toISOString(),
    };
    const next = [snap, ...snapshots].slice(0, 50);
    setSnapshots(next);
    if (typeof window !== 'undefined') localStorage.setItem('altro_snapshots', JSON.stringify(next));
    const text = (displayedAdaptation || '').trim();
    if ((text || sourceText) && typeof window !== 'undefined') {
      try {
        await addVaultRecord({
          type: activePreset ?? 'mirror',
          resonance: oprPrismValue,
          source: sourceText,
          result: text,
          radar: { ...domainWeights },
          nexusCommand: nexusCommand ?? '',
          model:
            typeof process !== 'undefined' && process.env.NEXT_PUBLIC_DEFAULT_MODEL?.trim()
              ? process.env.NEXT_PUBLIC_DEFAULT_MODEL.trim()
              : 'Local LLM',
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error('Failed to save snapshot to Vault', err);
      }
    }
  }, [domainWeights, oprPrismValue, activePreset, selectedScenario, snapshots, displayedAdaptation, sourceText, nexusCommand]);

  const applySnapshot = useCallback((snap: typeof snapshots[0]) => {
    setDomainWeights({ ...snap.domainWeights });
    setOprPrismValue(Math.max(0, Math.min(100, snap.oprPrismValue)));
    setActivePreset(snap.activePreset);
    setSelectedScenario(snap.selectedScenario as typeof selectedScenario);
  }, []);

  const deleteSnapshot = useCallback((id: string) => {
    const next = snapshots.filter((s) => s.id !== id);
    setSnapshots(next);
    if (typeof window !== 'undefined') localStorage.setItem('altro_snapshots', JSON.stringify(next));
  }, [snapshots]);

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const handleInternalDomainChange = useCallback((key: InternalDomainKey, value: number) => {
    if (activePreset === 'mirror') return;
    setDomainWeights((prev) => ({ ...prev, [key]: value }));
  }, [activePreset]);

  const handleExternalDomainChange = useCallback((key: ExternalDomainKey, value: number) => {
    if (activePreset === 'mirror') return;
    setDomainWeights((prev) => ({ ...prev, [key]: value }));
  }, [activePreset]);

  const handleSourceHomographClick = useCallback((tokenId: number) => {
    setSelectedTokenId(tokenId);
    setShowHomonymClarify(true);
  }, []);

  const handleHomonymVariantSelect = useCallback((tokenId: number, variantWord: string) => {
    const result = applyHomonymVariantSelectLogic({
      tokenId,
      variantWord,
      textTokens,
      displayedAdaptation: displayedAdaptation || '',
    });
    flushSync(() => {
      setHomonymRegistry((prev) => {
        const next = new Map(prev);
        for (const [k, v] of result.homonymRegistryUpdate) next.set(k, v);
        return next;
      });
      setTextTokens(result.textTokensUpdate);
      setCalibratedText(result.rebuiltText);
      setDisplayedAdaptation(result.rebuiltText);
      setAdaptationText(result.rebuiltText);
      setALTRO_GOLDEN_STATE(result.rebuiltText);
      if (result.homonymReplaceHighlight) setHomonymReplaceHighlight(result.homonymReplaceHighlight);
    });
    if (result.closePopup) {
      setShowHomonymClarify(false);
      setSelectedTokenId(null);
    }
  }, [textTokens, displayedAdaptation]);

  const unresolvedHomonyms = useMemo(
    () => (textTokens ?? []).filter((t) => t?.isHomonym && !homonymRegistry.get(t.id)?.resolved && !t.resolvedAccent),
    [textTokens, homonymRegistry]
  );

  const handleClarifyHomonym = useCallback(() => {
    const words = getHomonymWordsFromEngine(sourceText || displayedAdaptation || '');
    if (words.length > 0 && unresolvedHomonyms.length > 0) {
      const first = unresolvedHomonyms[0];
      setSelectedTokenId(first.id);
      setShowHomonymClarify(true);
    }
  }, [sourceText, displayedAdaptation, unresolvedHomonyms]);

  const handleSuspiciousSuggestionSelect = useCallback((phrase: string, suggestion: string) => {
    const replacer = (prev: string) => (prev ? prev.replace(phrase, suggestion) : prev);
    setCalibratedText(replacer);
    setDisplayedAdaptation(replacer);
    setAdaptationText(replacer);
    setALTRO_GOLDEN_STATE((prev) => (prev ? prev.replace(phrase, suggestion) : prev));
    setSemanticSuggestions((s) => s.filter((x) => !(x.phrase === phrase && x.suggestion === suggestion)));
    setShowSuspiciousSuggestion(false);
    setSelectedSuspiciousTokenId(null);
  }, [displayedAdaptation]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('altro_snapshots');
      if (stored) {
        try {
          const arr = JSON.parse(stored);
          setSnapshots(Array.isArray(arr) ? arr : []);
        } catch {
          setSnapshots([]);
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showHomonymClarify && homonymClarifyRef.current && !homonymClarifyRef.current.contains(e.target as Node)) {
        setShowHomonymClarify(false);
      }
      if (showSuspiciousSuggestion && suspiciousSuggestionRef.current && !suspiciousSuggestionRef.current.contains(e.target as Node)) {
        const target = e.target as HTMLElement;
        if (!target.closest?.('[data-token-id]')) setShowSuspiciousSuggestion(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHomonymClarify, showSuspiciousSuggestion]);

  useEffect(() => {
    requestAnimationFrame(() => adjustNexusHeight());
  }, [nexusCommand, adjustNexusHeight]);

  useEffect(() => {
    if (!homonymReplaceHighlight) return;
    const t = setTimeout(() => setHomonymReplaceHighlight(null), 600);
    return () => clearTimeout(t);
  }, [homonymReplaceHighlight]);

  const homonymScan = useMemo(
    () => ({ has_homonyms: getHomonymWordsFromEngine(displayedAdaptation || sourceText || '').length > 0, words: getHomonymWordsFromEngine(displayedAdaptation || sourceText || '') }),
    [displayedAdaptation, sourceText]
  );

  const hasAdaptationChangesReady = useMemo(() => {
    const adapt = (displayedAdaptation ?? '').trim();
    const src = (sourceText ?? '').trim();
    if (!adapt || !src) return !!adapt;
    return adapt !== src;
  }, [displayedAdaptation, sourceText]);

  const suspiciousTokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const s of semanticSuggestions) {
      if (s.lowConfidence) for (const id of s.tokenIds) ids.add(id);
    }
    return ids;
  }, [semanticSuggestions]);

  const pendingAdjustments = useMemo(() => {
    const selections = resolvedVariants;
    const hasUnresolved = displayTokens.length > 0 && auditLog.length > 0
      ? hasUnresolvedHomonymsInTokens(displayTokens, auditLog, resolvedVariants)
      : false;
    return { selections, hasUnresolved };
  }, [displayTokens, auditLog, resolvedVariants]);

  const processedDisplayTokens = useMemo((): ProcessedToken[] => {
    const mirrorNoGolden = activePreset === 'mirror';
    return displayTokens.map((t) => {
      const isResolvedVariant = resolvedVariants.has(t.id);
      const deResult = t.type === 'word' ? DomainEngine.processWord(t.word, domainWeights) : null;
      const isDomainTransformed = deResult?.adapted != null && (deResult.lens === 'sacred' || deResult.lens === 'imagery');
      const isConfirmed = mirrorNoGolden ? false : (isResolvedVariant || !!isDomainTransformed);
      return { ...t, isConfirmed };
    });
  }, [displayTokens, domainWeights, resolvedVariants, activePreset]);

  // CORE STANDARD: Tokens in Adaptation field are read-only to prevent cyclic ambiguity.
  const adaptationDisplayHtml = useMemo(() => {
    const text = displayedAdaptation || '';
    const tokens = displayTokens.length > 0 ? displayTokens : AltroTokenManager.tokenize(text);
    const mirrorNoGolden = activePreset === 'mirror';
    const confirmedIds = mirrorNoGolden
      ? new Set<number>()
      : new Set(
          tokens
            .map((t) => {
              const isResolved = resolvedVariants.has(t.id);
              const deResult = t.type === 'word' ? DomainEngine.processWord(t.word, domainWeights) : null;
              const isDomain = deResult?.adapted != null && (deResult.lens === 'sacred' || deResult.lens === 'imagery');
              return (isResolved || isDomain) ? t.id : null;
            })
            .filter((id): id is number => id != null)
        );
    let html = '';
    for (const t of tokens) {
      const escaped = escapeHtml(t.word);
      const isConfirmed = confirmedIds.has(t.id);
      html += isConfirmed
        ? `<span class="golden-frame" style="border:1px solid gold;box-shadow:0 0 5px gold;border-radius:4px;padding:0 2px;display:inline">${escaped}</span>`
        : escaped;
    }
    if (html) return html;
    if (!homonymReplaceHighlight || homonymReplaceHighlight.start >= text.length || homonymReplaceHighlight.end > text.length) {
      return escapeHtml(text);
    }
    const before = escapeHtml(text.slice(0, homonymReplaceHighlight.start));
    const highlight = escapeHtml(text.slice(homonymReplaceHighlight.start, homonymReplaceHighlight.end));
    const after = escapeHtml(text.slice(homonymReplaceHighlight.end));
    return `${before}<span class="accent-flash">${highlight}</span>${after}`;
  }, [displayedAdaptation, displayTokens, domainWeights, resolvedVariants, homonymReplaceHighlight, activePreset]);

  const sourceHighlightHtml = useMemo(() => {
    if (!sourceText) return '';
    const tokens = tokenizeText(sourceText);
    let html = '';
    let pos = 0;
    const countMap = new Map<string, number>();
    for (const token of tokens) {
      const suspicious = suspiciousTokenIds.has(token.id);
      if (token.isHomonym && !homonymRegistry.get(token.id)?.resolved) {
        const form = token.word.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
        const baseWord = HOMONYM_WORD_FORMS[form] ?? form;
        const count = countMap.get(baseWord) ?? 0;
        countMap.set(baseWord, count + 1);
        const cls = ['homonym-highlight', suspicious ? 'suspicious-suggestion' : ''].filter(Boolean).join(' ');
        html += `<span data-homonym-id="homonym_${baseWord}_${count}_${pos}" data-token-id="${token.id}" data-homonym="${token.word.replace(/"/g, '&quot;')}" class="${cls}">${escapeHtml(token.word)}[=]</span>`;
      } else if (suspicious) {
        html += `<span data-token-id="${token.id}" class="suspicious-suggestion">${escapeHtml(token.word)}</span>`;
      } else {
        html += escapeHtml(token.word);
      }
      pos += token.word.length;
    }
    return html;
  }, [sourceText, homonymRegistry, suspiciousTokenIds]);

  return {
    activePreset,
    setActivePreset,
    isEditing,
    setIsEditing,
    isDark,
    setTheme,
    selectedScenario,
    setSelectedScenario,
    sourceText,
    setSourceText,
    sourceTextRef,
    adaptationText,
    setAdaptationText,
    displayedAdaptation,
    setDisplayedAdaptation,
    cleanedText,
    isCleaningComplete,
    scanResultBuffer,
    ALTRO_GOLDEN_STATE,
    setALTRO_GOLDEN_STATE,
    calibratedText,
    setCalibratedText,
    domainWeights,
    setDomainWeights,
    activePattern,
    setActivePattern,
    textTokens,
    displayTokens,
    processedDisplayTokens,
    pendingAdjustments,
    handleMirrorTokenClick,
    handleScannedTokenClick,
    handleVariantSelect,
    auditLog,
    normalizeForAuditMatch,
    selectedScannedTokenId,
    resolvedVariants,
    homonymRegistry,
    homonymInstances,
    resolvedHomonyms,
    semanticSuggestions,
    validatedTokens,
    selectedTokenId,
    setSelectedTokenId,
    showHomonymClarify,
    setShowHomonymClarify,
    selectedSuspiciousTokenId,
    setSelectedSuspiciousTokenId,
    showSuspiciousSuggestion,
    setShowSuspiciousSuggestion,
    adaptationFlash,
    semanticResetFlash,
    homonymReplaceHighlight,
    oprPrismValue,
    setOprPrismValue,
    nexusCommand,
    setNexusCommand,
    isScanning,
    isAnalyzed,
    toolsModalMode,
    setToolsModalMode,
    snapshots,
    outputLanguage,
    setOutputLanguage,
    sourceLanguage,
    setSourceLanguage,
    committedTokens,
    isCommitted,
    nexusCommandRef,
    homonymClarifyRef,
    suspiciousSuggestionRef,
    handleSourceChange,
    handleNexusResize,
    runScan,
    setIsScanning,
    applyPreset,
    clearAll,
    clearSourceInput,
    clearSource,
    clearNexus,
    clearAdaptation,
    handleSave,
    createSnapshot,
    applySnapshot,
    deleteSnapshot,
    formatTimestamp,
    handleInternalDomainChange,
    handleExternalDomainChange,
    handleSourceHomographClick,
    handleHomonymVariantSelect,
    handleClarifyHomonym,
    handleSuspiciousSuggestionSelect,
    unresolvedHomonyms,
    homonymScan,
    hasAdaptationChangesReady,
    adaptationDisplayHtml,
    sourceHighlightHtml,
    getActivePattern: () => getActivePattern(domainWeights),
    areWeightsInStandby: () => areWeightsInStandby(domainWeights),
    startEditing: () => setIsEditing(true),
    processCommand,
    handleEnterKey,
    isSyncing,
    syncDatabase,
    isListening,
    toggleVoiceListening,
    activeFile,
    handleFileUpload,
    nexusFlash,
    securityBlocked,
    lastGuardReport,
    commandIntent,
    setCommandIntent,
  };
}
