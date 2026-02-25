/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// License: MIT | SERGEI NAZARIAN (SVN). ALTRO — инструмент для частного анализа.

/**
 * vectorEngine — Расчётная логика domainWeights и формирование семантического вектора.
 * SEMANTIC ORCHESTRATION: Домены — не добавление слов, а искривление семантического поля.
 * [STRESS] токены — неизменные константы. Вокруг них строится новый контекст.
 */

import type { DomainWeights } from '@/lib/altroData';

/** Минимальный тип калибровки для векторного движка (избегаем циклического импорта) */
export interface CalibrationForVectors {
  internal?: { semantics?: number; context?: number; intent?: number; imagery?: number; ethics?: number };
  external?: { economics?: number; politics?: number; society?: number; history?: number; culture?: number; aesthetics?: number; technology?: number; religion?: number };
}

/** Порог активации домена (0–100 для internal, 0–1 для external) */
const DOMAIN_ACTIVATION_THRESHOLD = 10;
const EXTERNAL_ACTIVATION_THRESHOLD = 0.1;

/**
 * SEMANTIC VECTORS — направления искривления семантического поля.
 * Не добавление слов, а смещение смысла.
 */
export const SEMANTIC_VECTORS = {
  /** Spirit (Духовность): смещение от материального к экзистенциальному */
  spirit: {
    axis: 'материальное → экзистенциальное',
    instruction: 'Для слов БЕЗ [STRESS] ищи более глубокие, архетипические смыслы. Сдвиг к сакральному, вечному, метафизическому.',
  },
  /** Imagery (Образность): смещение от описательного к метафорическому */
  imagery: {
    axis: 'описательное → метафорическое',
    instruction: 'Для слов БЕЗ [STRESS] заменяй буквальные описания на образы и метафоры. Сохраняй структуру предложения.',
  },
  /** Context: усиление связи между предложением и внешней средой */
  context: {
    axis: 'изолированное → связанное со средой',
    instruction: 'Усиливай связь фразы с внешним контекстом (история, культура, общество). Слова БЕЗ [STRESS] — точка привязки к среде.',
  },
} as const;

/** Проверка: есть ли активные веса доменов (слайдеры сдвинуты) */
export function hasActiveDomainWeights(calibration: CalibrationForVectors): boolean {
  const { internal = {}, external = {} } = calibration;
  for (const v of Object.values(internal)) {
    if (typeof v === 'number' && Math.abs(v) > DOMAIN_ACTIVATION_THRESHOLD) return true;
  }
  for (const v of Object.values(external)) {
    if (typeof v === 'number' && Math.abs(v) > EXTERNAL_ACTIVATION_THRESHOLD) return true;
  }
  return false;
}

/**
 * Формирует директиву векторного смещения для промпта.
 * ZERO-DIRECTIVE MODE: при пустой командной строке веса доменов ОБЯЗАНЫ работать.
 */
export function getSemanticDisplacementDirective(calibration: CalibrationForVectors): string {
  const { internal = {}, external = {} } = calibration;
  const spiritVal = ((external.religion ?? 0) + 1) / 2 * 100;
  const imageryVal = internal.imagery ?? 0;
  const contextVal = internal.context ?? 0;

  const parts: string[] = [];

  if (spiritVal > 0) {
    parts.push(`SPIRIT (${spiritVal.toFixed(0)}%): ${SEMANTIC_VECTORS.spirit.instruction}`);
  }
  if (imageryVal > 0) {
    parts.push(`IMAGERY (${imageryVal.toFixed(0)}%): ${SEMANTIC_VECTORS.imagery.instruction}`);
  }
  if (contextVal > 0) {
    parts.push(`CONTEXT (${contextVal.toFixed(0)}%): ${SEMANTIC_VECTORS.context.instruction}`);
  }

  if (parts.length === 0) return '';

  return `VECTOR DISPLACEMENT (искривление семантического поля, НЕ добавление слов):\n${parts.join('\n')}\n[STRESS] токены — неизменные константы. Вокруг них строится новый контекст. Результат: изоморфный (структура сохранена), семантически перекалиброванный.`;
}
import { DOMAIN_MATRIX, SCENARIO_UI_WEIGHTS, type ScenarioType, type ScenarioProfile } from '@/lib/altroData';
import { GOLDEN_DATASET } from '@/lib/altro/foundation';

/** Результат расчёта весов 5 доменов */
export interface CalculatedWeights {
  semanticsWeight: number;
  contextWeight: number;
  intentWeight: number;
  imageryWeight: number;
  ethicsWeight: number;
  geographyActive: boolean;
  transcreationActive: boolean;
  deconstruction: boolean;
}

const externalToInternal: Record<string, ('semantics' | 'context' | 'intent' | 'imagery' | 'ethics')[]> = {
  history: ['semantics', 'context'],
  aesthetics: ['imagery', 'ethics'],
  culture: ['imagery', 'context'],
  religion: ['ethics', 'intent'],
  society: ['context', 'semantics'],
  politics: ['intent', 'semantics'],
  economics: ['semantics'],
  technology: ['context'],
};

function getWeight(
  domainName: 'semantics' | 'context' | 'intent' | 'imagery' | 'ethics',
  weights: DomainWeights
): number {
  let totalWeight = weights[domainName];

  for (const [externalKey, internalDomains] of Object.entries(externalToInternal)) {
    if (internalDomains.includes(domainName)) {
      const externalWeight = weights[externalKey as keyof DomainWeights] as number;
      const normalizedExternal = (externalWeight + 1) / 2;
      totalWeight += normalizedExternal * 0.5;
    }
  }

  return totalWeight;
}

/** Расчёт весов 5 внутренних доменов из 13 слайдеров */
export function calculateWeights(weights: DomainWeights): CalculatedWeights {
  const normalizedHistory = (weights.history + 1) / 2;
  const historyValue = weights.history;

  const semanticsWeight = getWeight('semantics', weights);
  const contextWeight = getWeight('context', weights);
  const intentWeight = getWeight('intent', weights);
  const imageryWeight = getWeight('imagery', weights);
  const ethicsWeight = getWeight('ethics', weights);

  const geographyActive = (normalizedHistory + weights.semantics) > 0.6;
  const transcreationActive = normalizedHistory > 0.5 || weights.semantics > 0.5;

  return {
    semanticsWeight,
    contextWeight,
    intentWeight,
    imageryWeight,
    ethicsWeight,
    geographyActive,
    transcreationActive,
    deconstruction: historyValue <= -0.99,
  };
}

/** Определение активного паттерна из Золотого Набора */
export function getActivePattern(weights: DomainWeights): { id: string; name: string } | null {
  const normalizedHistory = (weights.history + 1) / 2;

  for (const sample of GOLDEN_DATASET) {
    const sampleWeights = sample.domainWeights;
    let matchScore = 0;
    let totalWeight = 0;

    if (sampleWeights.history !== undefined && normalizedHistory > 0.8) {
      matchScore += normalizedHistory;
      totalWeight += 1;
    }
    if (sampleWeights.ethics !== undefined && weights.ethics > 0.7) {
      matchScore += weights.ethics;
      totalWeight += 1;
    }
    if (sampleWeights.intent !== undefined && weights.intent > 0.7) {
      matchScore += weights.intent;
      totalWeight += 1;
    }
    if (sampleWeights.aesthetics !== undefined && weights.aesthetics > 0.7) {
      matchScore += weights.aesthetics;
      totalWeight += 1;
    }

    if (matchScore > 0 && matchScore / totalWeight > 0.7) {
      const patternNames: Record<string, string> = {
        family_roots_manifesto: 'Манифест о семейных корнях',
        poem_to_fate: 'Стихотворение к Судьбе',
        hamlet_monologue: 'Монолог Гамлета',
        pelevin_slang: 'Сленг Пелевина',
      };
      return {
        id: sample.id,
        name: patternNames[sample.id] || sample.id,
      };
    }
  }

  return null;
}

/** Проверка, находятся ли веса доменов в режиме ожидания */
export function areWeightsInStandby(weights: DomainWeights): boolean {
  const normalizedHistory = (weights.history + 1) / 2;
  const normalizedPolitics = (weights.politics + 1) / 2;
  const normalizedSociety = (weights.society + 1) / 2;
  const normalizedEconomics = (weights.economics + 1) / 2;
  const normalizedCulture = (weights.culture + 1) / 2;
  const normalizedAesthetics = (weights.aesthetics + 1) / 2;
  const normalizedTechnology = (weights.technology + 1) / 2;
  const normalizedReligion = (weights.religion + 1) / 2;

  const externalWeights = [
    normalizedHistory, normalizedPolitics, normalizedSociety, normalizedEconomics,
    normalizedCulture, normalizedAesthetics, normalizedTechnology, normalizedReligion,
  ];
  const internalWeights = [
    weights.semantics, weights.context, weights.intent, weights.imagery, weights.ethics,
  ];

  const allWeights = [...externalWeights, ...internalWeights];
  const maxWeight = Math.max(...allWeights.map(Math.abs));

  return maxWeight < 0.3;
}

/** Применение коэффициентов сценария к весам доменов */
export function applyScenarioCoefficients(weights: DomainWeights, scenario: ScenarioType): DomainWeights {
  if (scenario === 'without') {
    return weights;
  }
  if (scenario === 'goldStandard') {
    return { ...SCENARIO_UI_WEIGHTS.goldStandard };
  }

  const scenarioWeights = DOMAIN_MATRIX[scenario];
  const result: DomainWeights = { ...weights };

  result.economics = (scenarioWeights.economics * 2 - 1) * 0.5 + weights.economics * 0.5;
  result.politics = (scenarioWeights.politics * 2 - 1) * 0.5 + weights.politics * 0.5;
  result.society = (scenarioWeights.society * 2 - 1) * 0.5 + weights.society * 0.5;
  result.history = (scenarioWeights.history * 2 - 1) * 0.5 + weights.history * 0.5;
  result.culture = (scenarioWeights.culture * 2 - 1) * 0.5 + weights.culture * 0.5;
  result.aesthetics = (scenarioWeights.aesthetics * 2 - 1) * 0.5 + weights.aesthetics * 0.5;
  result.technology = (scenarioWeights.technology * 2 - 1) * 0.5 + weights.technology * 0.5;
  result.religion = (scenarioWeights.religion * 2 - 1) * 0.5 + weights.religion * 0.5;

  return result;
}

/** Смешивает базовые веса из профиля сценария с текущими слайдерами пользователя */
export function calculateScenarioWeights(
  profile: ScenarioProfile,
  userSliders: DomainWeights,
  mixRatio: number = 0.5
): DomainWeights {
  const result: DomainWeights = { ...userSliders };

  result.economics = (profile.economics * 2 - 1) * (1 - mixRatio) + userSliders.economics * mixRatio;
  result.politics = (profile.politics * 2 - 1) * (1 - mixRatio) + userSliders.politics * mixRatio;
  result.society = (profile.society * 2 - 1) * (1 - mixRatio) + userSliders.society * mixRatio;
  result.history = (profile.history * 2 - 1) * (1 - mixRatio) + userSliders.history * mixRatio;
  result.culture = (profile.culture * 2 - 1) * (1 - mixRatio) + userSliders.culture * mixRatio;
  result.aesthetics = (profile.aesthetics * 2 - 1) * (1 - mixRatio) + userSliders.aesthetics * mixRatio;
  result.technology = (profile.technology * 2 - 1) * (1 - mixRatio) + userSliders.technology * mixRatio;
  result.religion = (profile.religion * 2 - 1) * (1 - mixRatio) + userSliders.religion * mixRatio;

  return result;
}

const EXTERNAL_KEYS = ['economics', 'politics', 'society', 'history', 'culture', 'aesthetics', 'technology', 'religion'] as const;

/** OPR-модуляция: Effective_Influence_i = D_i * O */
export function applyOprModulation(weights: DomainWeights, oprPrism: number): DomainWeights {
  if (oprPrism === 0) return weights;
  const result = { ...weights };
  for (const key of EXTERNAL_KEYS) {
    result[key] = weights[key] * oprPrism;
  }
  return result;
}
