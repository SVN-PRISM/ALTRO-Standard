/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  INITIAL_DOMAIN_WEIGHTS,
  HOMONYM_WORD_FORMS,
  type DomainWeights,
} from '@/lib/altroData';
import {
  getActivePattern,
  areWeightsInStandby,
  calculateWeights,
  diffHighlight,
  escapeHtml,
  detectHomonymsInText,
  tokenizeText,
  type TextToken,
  type SemanticSuggestion,
} from '@/lib/altroEngine';
import {
  detectHomonymInstances,
  runCoreSanitation,
  runScanLogic,
  applyPresetLogic,
  applyHomonymVariantSelect as applyHomonymVariantSelectLogic,
} from '@/lib/altroLogic';
import { type ScenarioType } from '@/lib/altroData';
import {
  detectHomonyms as getHomonymWordsFromEngine,
  hasNoObviousErrors,
  AltroOrchestrator,
  type AltroCalibration,
} from '@/lib/altro/engine';
import type { InternalDomainKey, ExternalDomainKey } from '@/lib/altro/foundation';

export type PresetId = 'mirror' | 'bridge' | 'transfigure' | 'slang' | null;

export function useAltroPage() {
  const [activePreset, setActivePreset] = useState<PresetId>('mirror');
  const [isEditing, setIsEditing] = useState(true);
  const [isDark, setTheme] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard'>('without');
  const [archive, setArchive] = useState<Array<{ id: string; source: string; adaptation: string; timestamp: Date }>>([]);
  const [showArchive, setShowArchive] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [adaptationText, setAdaptationText] = useState('');
  const [displayedAdaptation, setDisplayedAdaptation] = useState('');
  const [cleanedText, setCleanedText] = useState<string | null>(null);
  const [isCleaningComplete, setIsCleaningComplete] = useState(false);
  const [scanResultBuffer, setScanResultBuffer] = useState<string | null>(null);
  const [ALTRO_GOLDEN_STATE, setALTRO_GOLDEN_STATE] = useState<string>('');
  const [calibratedText, setCalibratedText] = useState<string>('');
  const [semanticOkFlash, setSemanticOkFlash] = useState(false);
  const [domainWeights, setDomainWeights] = useState<DomainWeights>(INITIAL_DOMAIN_WEIGHTS);
  const [activePattern, setActivePattern] = useState<{ id: string; name: string } | null>(null);
  const [textTokens, setTextTokens] = useState<TextToken[]>([]);
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
  const [homonymReplaceHighlight, setHomonymReplaceHighlight] = useState<{ start: number; end: number } | null>(null);
  const [oprPrismValue, setOprPrismValue] = useState(0);
  const [nexusCommand, setNexusCommand] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [toolsModalMode, setToolsModalMode] = useState<'snapshot' | 'archive' | 'export' | null>(null);
  const [snapshots, setSnapshots] = useState<Array<{ id: string; domainWeights: DomainWeights; oprPrismValue: number; activePreset: PresetId; selectedScenario: string; timestamp: string }>>([]);
  const [language, setLanguage] = useState<'RU' | 'EN'>('RU');
  const sourceTextRef = useRef('');
  const llmRequestInFlightRef = useRef(false);
  const nexusCommandRef = useRef<HTMLTextAreaElement>(null);
  const homonymClarifyRef = useRef<HTMLDivElement>(null);
  const suspiciousSuggestionRef = useRef<HTMLDivElement>(null);

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
  const altroOrchestrator = useRef(new AltroOrchestrator()).current;

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
        religion: domainWeights.religion,
      },
      opr: oprPrismValue / 100,
      scenario: mappedScenario,
    }),
    [domainWeights, selectedScenario, oprPrismValue]
  );

  const handleSourceChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
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
    if (result.semanticOkFlash) setSemanticOkFlash(true);
    setTimeout(() => setSemanticOkFlash(false), 500);
    if (result.altroGoldenState) setALTRO_GOLDEN_STATE(result.altroGoldenState);
    setScanResultBuffer(result.correctedTextResult);
    return result.correctedTextResult;
  }, [validatedTokens, resolvedHomonyms, domainWeights.context]);

  const runScan = useCallback(async () => {
    let inputText: string;
    if (isCommitted && committedTokens.length > 0) {
      inputText = committedTokens.map((t) => t.word).join('');
    } else {
      inputText = sourceText;
    }
    if (!inputText?.trim()) return;

    const mode = activePreset || 'mirror';
    const textForTranscreation = (calibratedText ?? displayedAdaptation ?? adaptationText ?? ALTRO_GOLDEN_STATE ?? '').trim() || inputText?.trim() || '';
    const needsLLM = activePreset === 'transfigure' && oprPrismValue !== 100 && textForTranscreation.length > 0;
    const mirrorRepeatScan = isAnalyzed && mode === 'mirror';

    if (!isAnalyzed || mirrorRepeatScan) {
      setIsScanning(true);
      let sanitizedText: string;
      if (mode === 'mirror') {
        const preSanitized = _runCoreSanitation(inputText);
        try {
          sanitizedText = await altroOrchestrator.request({
            text: preSanitized,
            mode: 'mirror',
            isFinalAdaptation: true,
          });
        } catch (err) {
          if (typeof window !== 'undefined') console.error('ALTRO MIRROR LLM ERROR:', err);
          sanitizedText = altroOrchestrator.process(preSanitized, mode, undefined, nexusCommand);
        }
      } else {
        sanitizedText = altroOrchestrator.process(inputText, mode, _runCoreSanitation, nexusCommand);
      }
      setIsEditing(false);

      const scanResult = runScanLogic({
        inputText,
        sourceText,
        activePreset,
        domainWeights,
        altroCalibration,
        isCommitted,
        committedTokens,
        ALTRO_GOLDEN_STATE,
        mappedScenario,
        nexusCommand,
        oprPrismValue,
        sanitizedText,
        isScanPhase: true,
      });

      const scanOutput = scanResult.mode === 'mirror' && scanResult.mirrorText
        ? scanResult.mirrorText
        : (scanResult.mode === 'transfigure' && scanResult.displayedAdaptation)
          ? (scanResult.adaptationText ?? scanResult.displayedAdaptation)
          : sanitizedText?.trim() || inputText?.trim() || '';
      setCalibratedText(scanOutput);
      setAdaptationText(scanOutput);
      setDisplayedAdaptation(scanOutput);
      if (scanOutput?.trim()) setALTRO_GOLDEN_STATE(scanOutput);
      if (scanResult.activePattern !== undefined) setActivePattern(scanResult.activePattern ?? null);
      setIsAnalyzed(true);
      setIsScanning(false);
      return;
    }

    if (needsLLM) {
      if (llmRequestInFlightRef.current) return;
      llmRequestInFlightRef.current = true;
      setIsScanning(true);
      setDisplayedAdaptation('');
      setAdaptationText('');
      const sessionId = `s${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      try {
        const calibration: AltroCalibration = {
          ...altroCalibration,
          scenario: mappedScenario as AltroCalibration['scenario'],
        };
        const llmResult = await altroOrchestrator.request({
          text: textForTranscreation,
          mode: 'transfigure',
          calibration,
          directive: nexusCommand?.trim() || undefined,
          isFinalAdaptation: true,
          sessionId,
          onChunk: (chunk) => {
            setDisplayedAdaptation((prev) => prev + chunk);
            setAdaptationText((prev) => prev + chunk);
          },
        });
        setCalibratedText(llmResult);
        setDisplayedAdaptation(llmResult);
        setAdaptationText(llmResult);
        if (llmResult?.trim()) setALTRO_GOLDEN_STATE(llmResult);
      } catch (err) {
        if (typeof window !== 'undefined') console.error('ALTRO LLM ERROR:', err);
        const is502 = err instanceof Error && (err.message.includes('502') || err.message.includes('Сбой связи') || err.message === AltroOrchestrator.ERROR_502_MESSAGE);
        if (is502) {
          setCalibratedText(AltroOrchestrator.ERROR_502_MESSAGE);
          setDisplayedAdaptation(AltroOrchestrator.ERROR_502_MESSAGE);
          setAdaptationText(AltroOrchestrator.ERROR_502_MESSAGE);
        } else {
          const fallback = runScanLogic({
            inputText,
            sourceText,
            activePreset,
            domainWeights,
            altroCalibration,
            isCommitted,
            committedTokens,
            ALTRO_GOLDEN_STATE,
            mappedScenario,
            nexusCommand,
            oprPrismValue,
            sanitizedText: textForTranscreation,
          });
          if (fallback.mode === 'transfigure' && fallback.displayedAdaptation) {
            const fb = fallback.adaptationText ?? fallback.displayedAdaptation;
            setCalibratedText(fb);
            setDisplayedAdaptation(fallback.displayedAdaptation);
            setAdaptationText(fb);
          }
        }
      } finally {
        llmRequestInFlightRef.current = false;
        setIsScanning(false);
      }
    }
  }, [activePreset, sourceText, domainWeights, altroCalibration, isCommitted, committedTokens, resolvedHomonyms, ALTRO_GOLDEN_STATE, calibratedText, displayedAdaptation, adaptationText, _runCoreSanitation, altroOrchestrator, mappedScenario, nexusCommand, oprPrismValue, isAnalyzed]);

  const applyPreset = useCallback((preset: 'mirror' | 'bridge' | 'transfigure' | 'slang') => {
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

  const clearAll = useCallback(() => {
    setIsEditing(true);
    setIsAnalyzed(false);
    setSourceText('');
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
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
  }, []);

  const clearSource = useCallback(() => {
    setSourceText('');
    sourceTextRef.current = '';
    setTextTokens([]);
    setHomonymInstances([]);
    setHomonymRegistry(new Map());
    setResolvedHomonyms(new Map());
    setSemanticSuggestions([]);
    setCommittedTokens([]);
    setIsCommitted(false);
    setScanResultBuffer(null);
    setALTRO_GOLDEN_STATE('');
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setIsEditing(true);
  }, []);

  const clearAdaptation = useCallback(() => {
    setCalibratedText('');
    setAdaptationText('');
    setDisplayedAdaptation('');
    setALTRO_GOLDEN_STATE('');
  }, []);

  const handleSave = useCallback(() => {
    const text = (displayedAdaptation || '').trim();
    const entry = { id: `arch_${Date.now()}`, source: sourceText, adaptation: text, timestamp: new Date().toISOString() };
    const stored = typeof window !== 'undefined' ? localStorage.getItem('altro_archive') : null;
    const arr: Array<{ id: string; source: string; adaptation: string; timestamp: string }> = stored ? JSON.parse(stored) : [];
    arr.unshift(entry);
    const sliced = arr.slice(0, 100);
    if (typeof window !== 'undefined') localStorage.setItem('altro_archive', JSON.stringify(sliced));
    setArchive(sliced.map((e) => ({ ...e, timestamp: new Date(e.timestamp) })));
  }, [displayedAdaptation, sourceText]);

  const createSnapshot = useCallback(() => {
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
  }, [domainWeights, oprPrismValue, activePreset, selectedScenario, snapshots]);

  const applySnapshot = useCallback((snap: typeof snapshots[0]) => {
    setDomainWeights({ ...snap.domainWeights });
    setOprPrismValue(snap.oprPrismValue);
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
    () => textTokens.filter((t) => t.isHomonym && !homonymRegistry.get(t.id)?.resolved && !t.resolvedAccent),
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
      const stored = localStorage.getItem('altro_archive');
      if (stored) {
        try {
          const arr = JSON.parse(stored);
          const items = Array.isArray(arr) ? arr : [];
          setArchive(items.map((e: { id: string; source: string; adaptation: string; timestamp: string }) => ({ ...e, timestamp: new Date(e.timestamp) })));
        } catch {
          setArchive([]);
        }
      }
    }
  }, []);

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

  const semanticStatus = useMemo(() => {
    const adaptTrim = displayedAdaptation?.trim() ?? '';
    const sourceTrim = sourceText?.trim() ?? '';
    const noObvious = hasNoObviousErrors(adaptTrim || sourceTrim);
    const misspelledCount = textTokens.filter((t) => t.isMisspelled).length;
    return {
      isOK: noObvious && unresolvedHomonyms.length === 0 && misspelledCount === 0 && semanticSuggestions.length === 0,
      unresolvedCount: unresolvedHomonyms.length,
      misspelledCount,
      suggestionsCount: semanticSuggestions.length,
      noObviousErrors: noObvious,
    };
  }, [displayedAdaptation, sourceText, textTokens, unresolvedHomonyms, semanticSuggestions]);

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

  const adaptationDisplayHtml = useMemo(() => {
    const text = displayedAdaptation || '';
    const escaped = escapeHtml(text);
    if (!homonymReplaceHighlight || homonymReplaceHighlight.start >= text.length || homonymReplaceHighlight.end > text.length) {
      return escaped;
    }
    const before = escapeHtml(text.slice(0, homonymReplaceHighlight.start));
    const highlight = escapeHtml(text.slice(homonymReplaceHighlight.start, homonymReplaceHighlight.end));
    const after = escapeHtml(text.slice(homonymReplaceHighlight.end));
    return `${before}<span class="accent-flash">${highlight}</span>${after}`;
  }, [displayedAdaptation, homonymReplaceHighlight]);

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
    archive,
    setArchive,
    showArchive,
    setShowArchive,
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
    semanticOkFlash,
    domainWeights,
    setDomainWeights,
    activePattern,
    setActivePattern,
    textTokens,
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
    semanticOkFlash,
    adaptationFlash,
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
    language,
    setLanguage,
    committedTokens,
    isCommitted,
    nexusCommandRef,
    homonymClarifyRef,
    suspiciousSuggestionRef,
    handleSourceChange,
    handleNexusResize,
    runScan,
    applyPreset,
    clearAll,
    clearSource,
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
    semanticStatus,
    hasAdaptationChangesReady,
    adaptationDisplayHtml,
    sourceHighlightHtml,
    getActivePattern: () => getActivePattern(domainWeights),
    areWeightsInStandby: () => areWeightsInStandby(domainWeights),
    startEditing: () => setIsEditing(true),
  };
}
