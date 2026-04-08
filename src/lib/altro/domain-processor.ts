/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN | ALTRO: Stencil stub */
/** domain-processor — Stub. Полная логика в archive. */
import type { DomainCalibration } from './types/altro';
export type { DomainCalibration } from './types/altro';

export const DOMAIN_THRESHOLD = 0.1;
export const DOMAIN_PENETRATION_THRESHOLD = 0.5;
export const DOMAIN_THESAURUS: Record<string, string[]> = {};
export const DOMAIN_ROOTS: Record<string, { ru: string[]; en: string[]; hy: string[] }> = {};
export const DOMAIN_TERMS_MULTILANG: Record<string, Record<string, string[]>> = {};

export function getDomainTermsForCheck(_domainKey: string, _targetLang?: string): string[] {
  return [];
}

export function findDomainForWord(_word: string): string | undefined {
  return undefined;
}

export function getActiveDomainsList(_calibration: DomainCalibration): string[] {
  return [];
}
