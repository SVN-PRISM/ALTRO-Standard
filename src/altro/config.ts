/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * ALTRO Core Standard 2026 — Каноническая таблица доменов (External).
 * Веса доменов и названия для 8 слайдеров полигона.
 */

export type DomainStatus = 'active' | 'inactive' | 'pending';

export interface AltroDomain {
  name: string;
  weight: number; // -1.0 to +1.0 (0 = neutral) — положение слайдера
  status: DomainStatus;
}

export interface CanonicalDomainSpec {
  name: string;
  canonicalWeight: number; // эталонный вес (0.5–1.0) для расчётов
}

/** Каноническая таблица доменов (External): 8 слайдеров по Генетическому Коду SVN. */
export const CANONICAL_DOMAIN_TABLE: CanonicalDomainSpec[] = [
  { name: 'EXT_SACRED', canonicalWeight: 1.0 },
  { name: 'EXT_CULT', canonicalWeight: 0.9 },
  { name: 'EXT_ETHIC', canonicalWeight: 0.85 },
  { name: 'EXT_HUMAN', canonicalWeight: 0.8 },
  { name: 'EXT_TECH', canonicalWeight: 0.75 },
  { name: 'EXT_KNOW', canonicalWeight: 0.7 },
  { name: 'EXT_SOCIO', canonicalWeight: 0.6 },
  { name: 'EXT_ECON', canonicalWeight: 0.5 },
];

/** Начальное состояние доменов для полигона: все слайдеры в нейтрали (0). */
export function getInitialDomains(): AltroDomain[] {
  return CANONICAL_DOMAIN_TABLE.map((spec) => ({
    name: spec.name,
    weight: 0,
    status: 'active' as DomainStatus,
  }));
}

/** Алиас для совместимости с существующим импортом ALTRO_DOMAINS. */
export const ALTRO_DOMAINS: AltroDomain[] = getInitialDomains();
