/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Chronos/DB Logging */

/**
 * ChronosService — логирование в Chronos (IndexedDB).
 * Вынесено из engine.ts для декомпозиции.
 */

import { countWords } from './textUtils';
import type { SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';

export type PresetMode = 'mirror' | 'transfigure' | 'slang' | 'data_query';

export interface ChronosLogParams {
  mode: PresetMode;
  text?: string;
  calibration?: {
    internal?: Record<string, number>;
    opr?: number;
  };
}

/** Логирует результат транскреации (L2_TRANS_CREATION, mirror, slang, data_query). */
export function logToChronos(
  params: ChronosLogParams,
  result: string,
  model: string,
  startTime: number
): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const generationTimeMs = Date.now() - startTime;
    const tokenCount = countWords(result);
    const chronosType = params.mode === 'transfigure' ? 'L2_TRANS_CREATION' : params.mode;
    addChronosRecord({
      type: chronosType,
      resonance: params.calibration?.opr ? params.calibration.opr * 100 : 0,
      source: params.text || '',
      result,
      radar: params.calibration?.internal || {},
      model,
      timestamp: Date.now(),
      generationTimeMs,
      tokenCount,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log to Chronos', e);
  }
}

/** Логирует фазу IPA анализа. */
export function logIpaAnalysisToChronos(params: ChronosLogParams, packet: SemanticPacket): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const result = JSON.stringify(packet, null, 2);
    addChronosRecord({
      type: 'IPA_ANALYSIS_PHASE',
      resonance: params.calibration?.opr ? params.calibration.opr * 100 : 0,
      source: params.text || '',
      result,
      radar: params.calibration?.internal || {},
      model: 'IPA',
      timestamp: Date.now(),
      generationTimeMs: 0,
      tokenCount: 0,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log IPA analysis to Chronos', e);
  }
}

/** Логирует результат валидации резонанса с дельтой после refinement (initial_score, final_score). */
export function logResonanceValidationWithRefinement(
  params: ChronosLogParams,
  initialValidation: { score: number; lostMeanings: string[]; anchorsChecked: number; anchorsPreserved: number },
  finalValidation: { score: number; lostMeanings: string[]; anchorsChecked: number; anchorsPreserved: number }
): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const result = JSON.stringify(
      {
        initial_score: initialValidation.score,
        final_score: finalValidation.score,
        delta: finalValidation.score - initialValidation.score,
        initial_lostMeanings: initialValidation.lostMeanings,
        final_lostMeanings: finalValidation.lostMeanings,
        anchorsChecked: initialValidation.anchorsChecked,
        anchorsPreserved: finalValidation.anchorsPreserved,
      },
      null,
      2
    );
    addChronosRecord({
      type: 'RESONANCE_VALIDATION_REFINED',
      resonance: finalValidation.score * 100,
      source: params.text || '',
      result,
      radar: params.calibration?.internal || {},
      model: 'ResonanceValidator+Refinement',
      timestamp: Date.now(),
      generationTimeMs: 0,
      tokenCount: 0,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log resonance validation with refinement to Chronos', e);
  }
}

/** Логирует результат валидации резонанса (утечка смыслов). */
export function logResonanceValidationToChronos(
  params: ChronosLogParams,
  validation: { score: number; lostMeanings: string[]; anchorsChecked: number; anchorsPreserved: number }
): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const result = JSON.stringify(
      {
        score: validation.score,
        lostMeanings: validation.lostMeanings,
        anchorsChecked: validation.anchorsChecked,
        anchorsPreserved: validation.anchorsPreserved,
      },
      null,
      2
    );
    addChronosRecord({
      type: 'RESONANCE_VALIDATION',
      resonance: validation.score * 100,
      source: params.text || '',
      result,
      radar: params.calibration?.internal || {},
      model: 'ResonanceValidator',
      timestamp: Date.now(),
      generationTimeMs: 0,
      tokenCount: 0,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log resonance validation to Chronos', e);
  }
}

/** Логирует событие исцеления AltroGuard (Refinement). */
export function logGuardHealingToChronos(
  sourceText: string,
  report: {
    finalText: string;
    initialScore: number;
    finalScore: number;
    lostMeanings: string[];
    timestamp: string;
  }
): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const result = JSON.stringify(
      {
        initial_score: report.initialScore,
        final_score: report.finalScore,
        delta: report.finalScore - report.initialScore,
        lostMeanings: report.lostMeanings,
        timestamp: report.timestamp,
      },
      null,
      2
    );
    addChronosRecord({
      type: 'ALTRO_GUARD_HEALING',
      resonance: report.finalScore * 100,
      source: sourceText,
      result,
      radar: {},
      model: 'AltroGuard',
      timestamp: Date.now(),
      generationTimeMs: 0,
      tokenCount: 0,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log AltroGuard healing to Chronos', e);
  }
}

/** Логирует блокировку безопасности. */
export function logSecurityBlockToChronos(
  params: ChronosLogParams,
  code: string,
  reason: string
): void {
  if (typeof window === 'undefined') return;
  try {
    const { addChronosRecord } = require('@/lib/db');
    const result = `Security Block: ${code} - ${reason}`;
    addChronosRecord({
      type: 'security_block',
      resonance: params.calibration?.opr ? params.calibration.opr * 100 : 0,
      source: params.text || '',
      result,
      radar: params.calibration?.internal || {},
      model: 'N/A',
      timestamp: Date.now(),
      generationTimeMs: 0,
      tokenCount: 0,
    }).catch(console.error);
  } catch (e) {
    console.error('Failed to log security block to Chronos', e);
  }
}
