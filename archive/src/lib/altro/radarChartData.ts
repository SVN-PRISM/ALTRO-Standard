/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
/**
 * Подготовка данных для Radar Chart (OPR и домены).
 * Поддерживает отрицательные значения резонанса (впадины) при коллизии Объект–Предикат.
 */

import type { DomainWeights } from '@/lib/altroData';

/** Диапазон внутреннего расчёта резонанса: [-100, 100]. Слайдер UI даёт только [0, 100]. */
export const OPR_RADAR_MIN = -100;
export const OPR_RADAR_MAX = 100;

/**
 * Возвращает значение OPR для отрисовки на графике.
 * Если SemanticFirewall/trust выявил коллизию О–П, effectiveResonance может быть отрицательным.
 * @param sliderValue — значение слайдера 0..100
 * @param effectiveResonance — итоговый резонанс после проверки (может быть в [-100, 100])
 */
export function prepareOprRadarValue(sliderValue: number, effectiveResonance?: number): number {
  if (effectiveResonance != null && !Number.isNaN(effectiveResonance)) {
    return Math.max(OPR_RADAR_MIN, Math.min(OPR_RADAR_MAX, effectiveResonance));
  }
  return Math.max(0, Math.min(100, sliderValue));
}

export interface RadarDataPoint {
  label: string;
  value: number;
  /** true если значение отрицательное (впадина резонанса) */
  isDip?: boolean;
}

export interface OprRadarSeries {
  opr: number;
  oprDip: boolean;
  domains?: Record<string, number>;
}

/**
 * Готовит серию для Radar Chart. Принимает отрицательные значения для визуализации впадин.
 */
export function prepareRadarSeries(
  oprSlider: number,
  domainWeights: DomainWeights,
  effectiveOpr?: number
): OprRadarSeries {
  const opr = prepareOprRadarValue(oprSlider, effectiveOpr);
  return {
    opr,
    oprDip: opr < 0,
    domains: {
      semantics: domainWeights.semantics * 100,
      context: domainWeights.context * 100,
      intent: domainWeights.intent * 100,
      imagery: domainWeights.imagery * 100,
      ethics: domainWeights.ethics * 100,
      economics: (domainWeights.economics + 1) * 50,
      politics: (domainWeights.politics + 1) * 50,
      society: (domainWeights.society + 1) * 50,
      history: (domainWeights.history + 1) * 50,
      culture: (domainWeights.culture + 1) * 50,
      aesthetics: (domainWeights.aesthetics + 1) * 50,
      technology: (domainWeights.technology + 1) * 50,
      spirituality: (domainWeights.spirituality + 1) * 50,
    },
  };
}
