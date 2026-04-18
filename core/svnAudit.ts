/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import { createHash } from 'node:crypto';
import type { DomainWeights } from '@/lib/altroData';

const SVN_STANDARD_STATUS = '100%_STENCIL';

function formatWeight(value: number): string {
  if (!Number.isFinite(value)) return '0.000000';
  return value.toFixed(6);
}

export function buildDomainCalibrationStamp(weights: DomainWeights): string {
  const ordered: Array<[keyof DomainWeights, number]> = [
    ['semantics', weights.semantics],
    ['context', weights.context],
    ['intent', weights.intent],
    ['imagery', weights.imagery],
    ['ethics', weights.ethics],
    ['economics', weights.economics],
    ['politics', weights.politics],
    ['society', weights.society],
    ['history', weights.history],
    ['culture', weights.culture],
    ['aesthetics', weights.aesthetics],
    ['technology', weights.technology],
    ['spirituality', weights.spirituality],
  ];
  return ordered.map(([k, v]) => `${k}:${formatWeight(v)}`).join(';');
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function generateSVNAuditLog(params: {
  nodeId: string;
  maskedInput: string;
  domainCalibrationStamp: string;
}): string {
  const inputSha = sha256Hex(params.maskedInput);
  return `[${params.nodeId}] | [${inputSha}] | [${params.domainCalibrationStamp}] | [SECURITY_STATUS: ${SVN_STANDARD_STATUS}]`;
}
