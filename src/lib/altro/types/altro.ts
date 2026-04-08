/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * types/altro — Общие типы и константы. Устраняет циклические зависимости.
 */

/** Калибровка для расчёта активных доменов (совместима с AltroCalibration) */
export interface DomainCalibration {
  internal?: { semantics: number; context: number; intent: number; imagery: number; ethics: number };
  external?: { economics: number; politics: number; society: number; history: number; culture: number; aesthetics: number; technology: number; spirituality: number };
}

/** Веса 8 Цивилизационных Доменов (Октава ALTRO). Совместимо с Матрицей Владельца. */
export interface CivilizationalWeights {
  economics: number;
  politics: number;
  society: number;
  history: number;
  culture: number;
  aesthetics: number;
  technology: number;
  spirituality: number;
}

/** Результат верификации резонанса */
export interface ResonanceVerificationResult {
  verified: boolean;
  confidence?: number;
  score: number;
  reason?: string;
  /** Автоопределённые домены (при отсутствии ipaPacket / активной калибровки). 0.0–1.0. */
  domains?: CivilizationalWeights;
}

/** Параметры верификации резонанса */
export interface VerifyResonanceParams {
  inputText: string;
  outputText: string;
  calibration?: DomainCalibration;
  targetLanguage?: string;
  oprValue?: number;
  /** Режим пресета (mirror | transfigure | slang) для специальных правил проверки */
  mode?: 'mirror' | 'transfigure' | 'slang' | null;
}
