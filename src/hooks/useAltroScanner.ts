/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */

'use client';

import { useState, useCallback, useRef } from 'react';
import { flushSync } from 'react-dom';
import type { DomainWeights } from '@/lib/altroData';
import type { ScenarioType } from '@/lib/altroData';
import {
  AltroOrchestrator,
  buildLocalAuditLog,
  tokenizeText,
  type AltroCalibration,
  type TextToken,
  type GuardReport,
} from '@/lib/altro/engine';
import { AltroTokenManager } from '@/lib/altro/tokenManager';
import { hasStressMark } from '@/lib/altro/textUtils';
import { DomainEngine } from '@/archive/legacy_altro/DomainEngine';
import { runScanLogic } from '@/lib/altroLogic';
import { ALTRO_PRODUCT_STENCIL_ONLY } from '@/config/product';

export type PresetId = 'mirror' | 'transfigure' | 'slang' | null;

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

function mergeAuditLogs(
  local: Array<{ word: string; variants?: string[] }>,
  llm: Array<{ word: string; variants?: string[] }>
): Array<{ word: string; variants: string[] }> {
  const normalizeMeaning = (s: string) =>
    s.toLowerCase().trim().replace(/ё/g, 'е').replace(/[\u0301]/g, '');
  const byNorm = new Map<string, { word: string; variants: string[] }>();
  const addLocal = (e: { word: string; variants?: string[] }) => {
    const norm = e.word.toLowerCase().replace(/[\u0301]/g, '');
    const vars = e.variants ?? [];
    if (vars.length > 0 && !byNorm.has(norm)) {
      byNorm.set(norm, { word: e.word, variants: [...vars] });
    }
  };
  const addLlm = (e: { word: string; variants?: string[] }) => {
    const norm = e.word.toLowerCase().replace(/[\u0301]/g, '');
    const existing = byNorm.get(norm);
    const vars = e.variants ?? [];
    if (!existing) {
      if (vars.length > 0) byNorm.set(norm, { word: e.word, variants: [...vars] });
      return;
    }
    const existingNorm = new Set(existing.variants.map(normalizeMeaning));
    const toAdd = vars.filter((v) => !existingNorm.has(normalizeMeaning(v)));
    if (toAdd.length > 0) {
      byNorm.set(norm, { word: existing.word, variants: [...existing.variants, ...toAdd] });
    }
  };
  local.forEach(addLocal);
  llm.forEach(addLlm);
  return Array.from(byNorm.values());
}

export interface UseAltroScannerParams {
  altroOrchestrator: AltroOrchestrator;
  activePreset: PresetId;
  domainWeights: DomainWeights;
  domainWeightsRef: React.MutableRefObject<DomainWeights | null>;
  oprPrismValue: number;
  oprPrismValueRef: React.MutableRefObject<number>;
  mappedScenario: ScenarioType;
  outputLanguage: string;
  sourceLanguage: string;
  isAnalyzed: boolean;
  setIsAnalyzed: (v: boolean) => void;
  setSecurityBlocked: (v: boolean) => void;
  setIsEditing: (v: boolean) => void;
  setDisplayedAdaptation: React.Dispatch<React.SetStateAction<string>>;
  setAdaptationText: React.Dispatch<React.SetStateAction<string>>;
  setCalibratedText: React.Dispatch<React.SetStateAction<string>>;
  setTextTokens: React.Dispatch<React.SetStateAction<TextToken[]>>;
  setAuditLog: React.Dispatch<React.SetStateAction<Array<{ word: string; variants?: string[]; reason?: string; priority?: boolean }>>>;
  setResolvedVariants: React.Dispatch<React.SetStateAction<Map<number, string>>>;
  setSelectedScannedTokenId: React.Dispatch<React.SetStateAction<number | null>>;
  setALTRO_GOLDEN_STATE: React.Dispatch<React.SetStateAction<string>>;
  setActivePreset: React.Dispatch<React.SetStateAction<PresetId>>;
  setDisplayTokens: React.Dispatch<React.SetStateAction<TextToken[]>>;
  sourceText: string;
  displayedAdaptation: string;
  adaptationText: string;
  calibratedText: string;
  ALTRO_GOLDEN_STATE: string;
  displayTokens: TextToken[];
  resolvedVariants: Map<number, string>;
  nexusCommand: string;
  isCommitted: boolean;
  committedTokens: TextToken[];
  altroCalibration: AltroCalibration;
  inputText: string;
  sourceTextForInput: string;
  setLastGuardReport: React.Dispatch<React.SetStateAction<GuardReport | null>>;
}

export function useAltroScanner(params: UseAltroScannerParams) {
  const {
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
  sourceTextForInput,
  setLastGuardReport,
} = params;

  const [isScanningLocal, setIsScanningLocal] = useState(false);
  const [scanResultBuffer, setScanResultBuffer] = useState<string | null>(null);
  const llmRequestInFlightRef = useRef(false);
  const scanInProgressRef = useRef(false);

  const runScan = useCallback(
    async (seamless = false, transcreateOnly = false, textOverride?: string) => {
      if (ALTRO_PRODUCT_STENCIL_ONLY) {
        if (typeof window !== 'undefined') {
          console.warn(
            '[ALTRO STENCIL] Путь LIBRA (runScan / AltroOrchestrator) отключён. Запускайте обработку через «ТРАНСФИГУРАЦИЯ» (API /api/transcreate).'
          );
        }
        return;
      }
      if (scanInProgressRef.current) return;
      scanInProgressRef.current = true;
      setSecurityBlocked(false);

      const llmTargetLang = outputLanguage === 'auto' ? 'ru' : outputLanguage;

      const mode = activePreset || 'mirror';
      if (typeof window !== 'undefined') console.log('CURRENT_MODE:', mode, '| activePreset:', activePreset, '| transcreateOnly:', transcreateOnly);
      const textForTranscreation = (textOverride ?? calibratedText ?? displayedAdaptation ?? adaptationText ?? ALTRO_GOLDEN_STATE ?? '').trim() || inputText?.trim() || '';
      const needsLLM = (activePreset === 'transfigure' || transcreateOnly) && oprPrismValue !== 100 && textForTranscreation.length > 0;
      const mirrorRepeatScan = isAnalyzed && mode === 'mirror';

      if (!inputText?.trim()) {
        scanInProgressRef.current = false;
        return;
      }

      if (!transcreateOnly && (!isAnalyzed || mirrorRepeatScan)) {
        setIsScanningLocal(true);
        setIsEditing(false);
        const text = (mirrorRepeatScan && displayedAdaptation?.trim()) ? displayedAdaptation.trim() : inputText.trim();
        const localAudit = buildLocalAuditLog(text).filter((e) => (e.variants?.length ?? 0) > 0);
        setDisplayedAdaptation(text);
        setAdaptationText(text);
        setCalibratedText(text);
        setTextTokens(tokenizeText(text));
        setAuditLog(localAudit);
        setResolvedVariants(new Map());
        setSelectedScannedTokenId(null);
        let mergedAudit: Array<{ word: string; variants?: string[] }> = localAudit;
        setIsScanningLocal(false);
        if (!seamless || !text || oprPrismValue === 100) scanInProgressRef.current = false;
        setIsAnalyzed(true);
        if (seamless && text && oprPrismValue !== 100) {
          try {
            const tokensForCheck = displayTokens.length > 0 && displayTokens.map((t) => t.word).join('') === text ? displayTokens : AltroTokenManager.tokenize(text);
            if (hasUnresolvedHomonymsInTokens(tokensForCheck, mergedAudit, resolvedVariants)) {
              setIsScanningLocal(false);
              setIsScanningLocal(false);
              scanInProgressRef.current = false;
              return;
            }
          } catch (err) {
            if (typeof window !== 'undefined') console.error('ALTRO homonym check error:', err);
            setIsScanningLocal(false);
            setIsScanningLocal(false);
            scanInProgressRef.current = false;
            return;
          }
          if (activePreset !== 'mirror') setActivePreset('transfigure');
          flushSync(() => {
            setDisplayedAdaptation('');
            setAdaptationText('');
            setCalibratedText('');
          });
          if (llmRequestInFlightRef.current) return;
          llmRequestInFlightRef.current = true;
          setIsScanningLocal(true);
          const sessionId = `s${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          const tokensMatch = displayTokens.length > 0 && displayTokens.map((t) => t.word).join('') === text;
          const tokens = tokensMatch ? displayTokens : AltroTokenManager.tokenize(text);
          const dw = domainWeightsRef.current ?? domainWeights;
          const opr = oprPrismValueRef.current ?? oprPrismValue;
          const calibration: AltroCalibration = {
            internal: { semantics: dw.semantics * 100, context: dw.context * 100, intent: dw.intent * 100, imagery: dw.imagery * 100, ethics: dw.ethics * 100 },
            external: { economics: dw.economics, politics: dw.politics, society: dw.society, history: dw.history, culture: dw.culture, aesthetics: dw.aesthetics, technology: dw.technology, spirituality: dw.spirituality },
            opr: opr / 100,
            scenario: mappedScenario as AltroCalibration['scenario'],
          };
          try {
            const hasConfirmedMeanings = tokens.some((t) => {
              if (t.type !== 'word') return false;
              const res = DomainEngine.processWord(t.word, dw);
              return !!(res.meanings ?? res.adapted);
            });
            const resolvedVariantsHint =
              (resolvedVariants?.size ?? 0) > 0
                ? Array.from(resolvedVariants.entries())
                    .map(([tid, val]) => {
                      const token = tokens.find((t) => t.id === tid);
                      const word = token?.word ?? `token_${tid}`;
                      return `[${word}] = ${val}`;
                    })
                    .join('; ')
                : undefined;
            if (typeof window !== 'undefined') console.log(`Target Language set to: ${llmTargetLang.toUpperCase()} | OPR Intensity: ${opr}`);
            const llmResult = await altroOrchestrator.request({
              text,
              tokens,
              mode: 'transfigure',
              calibration,
              targetLanguage: llmTargetLang,
              sourceLanguage,
              directive: nexusCommand?.trim() || undefined,
              resolvedVariantsHint,
              domainEngineDirective: hasConfirmedMeanings
                ? 'Если слово имеет подтвержденный смысл в DomainEngine, используй его метафорику (Imagery/Sacred) для обогащения текста.'
                : undefined,
              isFinalAdaptation: true,
              sessionId,
              useIPA: true,
              timeoutMs: 360_000, // 6 min — client reserve to avoid 502 at 120s
              onPhaseChange: (phase) => {
                if (phase === 'analysis') setDisplayedAdaptation('Анализ семантики...');
                else if (phase === 'execution') setDisplayedAdaptation('');
              },
              onChunk: (chunk) => {
                setDisplayedAdaptation((p) => p + chunk);
                setAdaptationText((p) => p + chunk);
              },
            });
            setCalibratedText(llmResult);
            setDisplayedAdaptation(llmResult);
            setAdaptationText(llmResult);
            if (llmResult?.trim()) setALTRO_GOLDEN_STATE(llmResult);
            setDisplayTokens(AltroTokenManager.tokenize(llmResult));
            setLastGuardReport(altroOrchestrator.getLastGuardReport());
          } catch (err) {
            if (typeof window !== 'undefined') console.error('ALTRO LLM ERROR:', err);
            const is403 = err instanceof Error && err.message.includes('Security Policy Violation');
            if (is403) {
              setSecurityBlocked(true);
              setDisplayedAdaptation('Security Policy Violation');
              setAdaptationText('Security Policy Violation');
            } else {
              const is502 = err instanceof Error && (err.message.includes('502') || err.message.includes('Сбой связи') || err.message === AltroOrchestrator.ERROR_502_MESSAGE);
              if (is502) {
                setDisplayedAdaptation(AltroOrchestrator.ERROR_502_MESSAGE);
                setAdaptationText(AltroOrchestrator.ERROR_502_MESSAGE);
              } else {
                const fallback = runScanLogic({ inputText: sourceTextForInput, sourceText: sourceTextForInput, activePreset: 'transfigure', domainWeights, altroCalibration, isCommitted, committedTokens, ALTRO_GOLDEN_STATE: text, mappedScenario, nexusCommand, oprPrismValue, sanitizedText: text });
                if (fallback?.displayedAdaptation) {
                  setDisplayedAdaptation(fallback.displayedAdaptation);
                  setAdaptationText(fallback.adaptationText ?? fallback.displayedAdaptation);
                }
              }
            }
          } finally {
            llmRequestInFlightRef.current = false;
            setIsScanningLocal(false);
            setIsScanningLocal(false);
            scanInProgressRef.current = false;
          }
        }
        return;
      }

      if (needsLLM) {
        if (llmRequestInFlightRef.current) return;
        llmRequestInFlightRef.current = true;
        flushSync(() => {
          setDisplayedAdaptation('');
          setAdaptationText('');
          setCalibratedText('');
        });
        setIsScanningLocal(true);
        const sessionId = `s${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const dw = domainWeightsRef.current ?? domainWeights;
        const opr = oprPrismValueRef.current ?? oprPrismValue;
        const calibration: AltroCalibration = {
          internal: { semantics: dw.semantics * 100, context: dw.context * 100, intent: dw.intent * 100, imagery: dw.imagery * 100, ethics: dw.ethics * 100 },
          external: { economics: dw.economics, politics: dw.politics, society: dw.society, history: dw.history, culture: dw.culture, aesthetics: dw.aesthetics, technology: dw.technology, spirituality: dw.spirituality },
          opr: opr / 100,
          scenario: mappedScenario as AltroCalibration['scenario'],
        };
        try {
          const tokensMatch =
            displayTokens.length > 0 &&
            displayTokens.map((t) => t.word).join('') === textForTranscreation;
          const tokensToCheck = tokensMatch ? displayTokens : AltroTokenManager.tokenize(textForTranscreation);
          const tokensForRequest = tokensMatch ? displayTokens : AltroTokenManager.tokenize(textForTranscreation);
          const hasConfirmedMeanings = tokensToCheck.some((t) => {
            if (t.type !== 'word') return false;
            const res = DomainEngine.processWord(t.word, dw);
            return !!(res.meanings ?? res.adapted);
          });
          const resolvedVariantsHint =
            (resolvedVariants?.size ?? 0) > 0
              ? Array.from(resolvedVariants.entries())
                  .map(([tid, val]) => {
                    const token = tokensForRequest.find((t) => t.id === tid);
                    const word = token?.word ?? `token_${tid}`;
                    return `[${word}] = ${val}`;
                  })
                  .join('; ')
              : undefined;
          if (typeof window !== 'undefined') console.log(`Target Language set to: ${llmTargetLang.toUpperCase()} | OPR Intensity: ${opr}`);
          const llmResult = await altroOrchestrator.request({
            text: textForTranscreation,
            tokens: tokensMatch ? displayTokens : undefined,
            mode: 'transfigure',
            calibration,
            targetLanguage: llmTargetLang,
            sourceLanguage,
            directive: nexusCommand?.trim() || undefined,
            resolvedVariantsHint,
            domainEngineDirective: hasConfirmedMeanings
              ? 'Если слово имеет подтвержденный смысл в DomainEngine, используй его метафорику (Imagery/Sacred) для обогащения текста.'
              : undefined,
            isFinalAdaptation: true,
            sessionId,
            useIPA: true,
            timeoutMs: 360_000, // 6 min — client reserve to avoid 502 at 120s
            onPhaseChange: (phase) => {
              if (phase === 'analysis') setDisplayedAdaptation('Анализ семантики...');
              else if (phase === 'execution') setDisplayedAdaptation('');
            },
            onChunk: (chunk) => {
              setDisplayedAdaptation((prev) => prev + chunk);
              setAdaptationText((prev) => prev + chunk);
            },
          });
          setCalibratedText(llmResult);
          setDisplayedAdaptation(llmResult);
          setAdaptationText(llmResult);
          if (llmResult?.trim()) setALTRO_GOLDEN_STATE(llmResult);
          setLastGuardReport(altroOrchestrator.getLastGuardReport());
        } catch (err) {
          if (typeof window !== 'undefined') console.error('ALTRO LLM ERROR:', err);
          const is403 = err instanceof Error && err.message.includes('Security Policy Violation');
          if (is403) {
            setSecurityBlocked(true);
            setCalibratedText('Security Policy Violation');
            setDisplayedAdaptation('Security Policy Violation');
            setAdaptationText('Security Policy Violation');
          } else {
            const is502 = err instanceof Error && (err.message.includes('502') || err.message.includes('Сбой связи') || err.message === AltroOrchestrator.ERROR_502_MESSAGE);
            if (is502) {
              setCalibratedText(AltroOrchestrator.ERROR_502_MESSAGE);
              setDisplayedAdaptation(AltroOrchestrator.ERROR_502_MESSAGE);
              setAdaptationText(AltroOrchestrator.ERROR_502_MESSAGE);
            } else {
              const fallback = runScanLogic({
                inputText: sourceTextForInput,
                sourceText: sourceTextForInput,
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
          }
        } finally {
          llmRequestInFlightRef.current = false;
          setIsScanningLocal(false);
          scanInProgressRef.current = false;
        }
      } else {
        scanInProgressRef.current = false;
      }
    },
    [
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
      inputText,
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
      sourceTextForInput,
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
      setIsAnalyzed,
    ]
  );

  return { runScan, isScanning: isScanningLocal, scanResultBuffer, setScanResultBuffer, setIsScanning: setIsScanningLocal };
}
