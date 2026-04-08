/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Stencil stub */
/** Минимальная конфигурация доменов. Полная таблица в archive. */

export type DomainStatus = 'active' | 'inactive' | 'pending';

export interface AltroDomain {
  name: string;
  weight: number;
  status: DomainStatus;
}

export interface CanonicalDomainSpec {
  name: string;
  canonicalWeight: number;
}

export const CANONICAL_DOMAIN_TABLE: CanonicalDomainSpec[] = [];

export function getInitialDomains(): AltroDomain[] {
  return [];
}

export const ALTRO_DOMAINS: AltroDomain[] = [];
