/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * ALTRO Core Standard 2026 — Процессорные модули (Internal) и логика трансформации.
 * INT_CORE (ДНК смысла), INT_TRANS (Адаптация), INT_RESON (Частота отклика),
 * INT_MIRCL (Точка Чуда), INT_FLOW (Языковой поток / Омонимы).
 */

import type { AltroDomain } from './config';
import type { ValidationResult } from '@/core/validation';

/** INT_CORE — ДНК смысла: базовая мера сходства текстов (0..1). */
export function intCoreTextSimilarity(source: string, adaptation: string): number {
  if (source === adaptation) return 1.0;
  if (!source.trim() || !adaptation.trim()) return 0.0;
  const longer = source.length >= adaptation.length ? source : adaptation;
  const shorter = source.length < adaptation.length ? source : adaptation;
  const longerLower = longer.toLowerCase();
  const shorterLower = shorter.toLowerCase();
  let matches = 0;
  for (let i = 0; i < shorterLower.length; i++) {
    if (longerLower.includes(shorterLower[i])) matches++;
  }
  const base = matches / Math.max(longer.length, shorter.length, 1);
  if (longerLower.includes(shorterLower) || shorterLower.includes(longerLower)) return Math.max(base, 0.7);
  return base;
}

/** INT_TRANS — Адаптация: вклад текста в уровень трансформации (0–50%). */
export function intTransTextPart(
  sourceTrim: string,
  adaptTrim: string,
  validationPassed: boolean,
  contextConfirmed: boolean
): number {
  if (sourceTrim === adaptTrim) return 0;
  if (!validationPassed && !contextConfirmed) return 0;
  const similarity = intCoreTextSimilarity(sourceTrim, adaptTrim);
  if (contextConfirmed && !validationPassed) return 25;
  return 25 + (1 - similarity) * 25;
}

/** INT_RESON — Частота отклика: дельта между слайдерами источника и адаптации (0–50%). */
export function intResonSliderPart(
  sourceDomains: AltroDomain[],
  adaptationDomains: AltroDomain[]
): number {
  if (sourceDomains.length === 0 || sourceDomains.length !== adaptationDomains.length) return 0;
  const avgDelta =
    sourceDomains.reduce(
      (acc, s, i) => acc + Math.abs(s.weight - (adaptationDomains[i]?.weight ?? 0)),
      0
    ) / sourceDomains.length;
  return Math.min(50, (avgDelta / 2) * 50);
}

/** INT_MIRCL — Точка Чуда: идентичные тексты = нулевая трансформация. */
export function intMirclIsZeroChange(sourceTrim: string, adaptTrim: string): boolean {
  return sourceTrim === adaptTrim;
}

/**
 * INT_FLOW — Языковой поток / Омонимы (маркер SVN).
 * Если в Источнике есть омоним с ', а в Адаптации ударение потеряно или смещено —
 * статус НЕ ПРОЙДЕН, уровень трансформации 0%.
 */
export function intFlowHomonymStrict(validation: ValidationResult | null): boolean {
  return validation != null && validation.status === 'FAILED';
}

/**
 * Уровень трансформации: дельта слайдеров + изменения в тексте.
 * При строгой ошибке омонима (INT_FLOW) возвращает 0.
 */
export function computeTransformationLevel(
  sourceText: string,
  adaptationText: string,
  sourceDomains: AltroDomain[],
  adaptationDomains: AltroDomain[],
  validation: ValidationResult | null,
  contextConfirmed: boolean
): number {
  const adaptEmpty = !adaptationText.trim();
  if (adaptEmpty) return 0;
  if (intFlowHomonymStrict(validation) && !contextConfirmed) return 0;

  const sourceTrim = sourceText.trim();
  const adaptTrim = adaptationText.trim();

  const textPart = intTransTextPart(
    sourceTrim,
    adaptTrim,
    validation?.status === 'PASSED',
    contextConfirmed
  );
  const sliderPart = intResonSliderPart(sourceDomains, adaptationDomains);

  return Math.min(100, Math.round(textPart + sliderPart));
}
