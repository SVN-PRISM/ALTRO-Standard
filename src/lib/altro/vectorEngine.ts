/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN | ALTRO: Stencil stub */
/** vectorEngine — Stub. Полная логика в archive. */
import type { DomainWeights } from '@/lib/altroData';
import type { ScenarioType, ScenarioProfile } from '@/lib/altroData';

export interface CalibrationForVectors {
  internal?: { semantics?: number; context?: number; intent?: number; imagery?: number; ethics?: number };
  external?: Record<string, number>;
}

export const SEMANTIC_VECTORS = {} as const;

export function hasActiveDomainWeights(_calibration: CalibrationForVectors): boolean {
  return false;
}

export function getSemanticDisplacementDirective(_calibration: CalibrationForVectors): string {
  return '';
}

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

const NEUTRAL_WEIGHTS: CalculatedWeights = {
  semanticsWeight: 0, contextWeight: 0, intentWeight: 0, imageryWeight: 0, ethicsWeight: 0,
  geographyActive: false, transcreationActive: false, deconstruction: false,
};

export type InternalDomainVector = [number, number, number, number, number];
export type ExternalDomainVector = [number, number, number, number, number, number, number, number];

function roundStable(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Number.parseFloat(value.toFixed(12));
}

/**
 * Deterministic tensor multiplication (5 internal x 8 external).
 * No stochastic branches are allowed here.
 */
export function multiplyDomainTensorDeterministic(
  internal: InternalDomainVector,
  external: ExternalDomainVector
): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i < internal.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < external.length; j++) {
      row.push(roundStable(internal[i] * external[j]));
    }
    matrix.push(row);
  }
  return matrix;
}

export function calculateWeights(_weights: DomainWeights): CalculatedWeights {
  const internal: InternalDomainVector = [
    _weights.semantics,
    _weights.context,
    _weights.intent,
    _weights.imagery,
    _weights.ethics,
  ];
  const external: ExternalDomainVector = [
    _weights.economics,
    _weights.politics,
    _weights.society,
    _weights.history,
    _weights.culture,
    _weights.aesthetics,
    _weights.technology,
    _weights.spirituality,
  ];
  const tensor = multiplyDomainTensorDeterministic(internal, external);
  const aggregate = tensor.flat().reduce((acc, value) => acc + Math.abs(value), 0);
  if (aggregate <= 0) return { ...NEUTRAL_WEIGHTS };
  return {
    semanticsWeight: roundStable(Math.abs(internal[0])),
    contextWeight: roundStable(Math.abs(internal[1])),
    intentWeight: roundStable(Math.abs(internal[2])),
    imageryWeight: roundStable(Math.abs(internal[3])),
    ethicsWeight: roundStable(Math.abs(internal[4])),
    geographyActive: external.some((v) => Math.abs(v) > 0),
    transcreationActive: internal.some((v) => Math.abs(v) > 0),
    deconstruction: aggregate > 20,
  };
}

export function getActivePattern(_weights: DomainWeights): { id: string; name: string } | null {
  return null;
}

export function areWeightsInStandby(_weights: DomainWeights): boolean {
  return true;
}

export function applyScenarioCoefficients(weights: DomainWeights, _scenario: ScenarioType): DomainWeights {
  return weights;
}

export function calculateScenarioWeights(
  _profile: ScenarioProfile,
  userSliders: DomainWeights,
  _mixRatio?: number
): DomainWeights {
  return { ...userSliders };
}

export function applyOprModulation(weights: DomainWeights, _oprPrism: number): DomainWeights {
  return weights;
}
