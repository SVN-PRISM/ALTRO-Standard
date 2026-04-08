/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * DomainEngine — трансформация текста через 5 линз (Semantic, Context, Intent, Imagery, Sacred).
 * Сверяется с Golden Reserve из dictionary.ts (содержит КОШКА, ДОРОГА, ДОМ и др.).
 */

import { getGoldenReserveEntry } from '@/archive/legacy_altro/dictionary';
import type { DomainWeights } from '@/lib/altroData';

/** Веса для 5 линз: semantics, context, intent, imagery, ethics (Sacred) */
export interface LensWeights {
  semantics?: number;
  context?: number;
  intent?: number;
  imagery?: number;
  ethics?: number;
}

/** Полный объект смыслов из Golden Reserve */
export interface WordMeanings {
  semantic?: string;
  context?: string;
  intent?: string;
  imagery?: string;
  sacred?: string;
}

/** Результат обработки слова */
export interface ProcessWordResult {
  adapted: string | null;
  lens: 'semantic' | 'context' | 'intent' | 'imagery' | 'sacred' | null;
  /** Полный объект смыслов, когда слово найдено в Golden Reserve */
  meanings?: WordMeanings;
}

const SACRED_IMAGERY_THRESHOLD = 0.7;

/**
 * DomainEngine — класс трансформации текста через доменные линзы.
 */
export class DomainEngine {
  /**
   * Анализирует слово через 5 линз (Semantic, Context, Intent, Imagery, Sacred),
   * сверяясь с атрибутами из Golden Reserve.
   * Если слово найдено в Резерве и вес Sacred или Imagery > 0.7, возвращает адаптированное значение.
   */
  static processWord(word: string, weights: DomainWeights | LensWeights): ProcessWordResult {
    const entry = getGoldenReserveEntry(word);
    if (!entry?.definitions) {
      return { adapted: null, lens: null };
    }

    const defs = entry.definitions;
    const meanings: WordMeanings = { ...defs };
    const imageryWeight = (weights as Record<string, number>).imagery ?? 0;
    const sacredWeight = (weights as Record<string, number>).ethics ?? 0;

    if (imageryWeight > SACRED_IMAGERY_THRESHOLD && defs.imagery) {
      return { adapted: extractAdaptedPhrase(defs.imagery), lens: 'imagery', meanings };
    }
    if (sacredWeight > SACRED_IMAGERY_THRESHOLD && defs.sacred) {
      return { adapted: extractAdaptedPhrase(defs.sacred), lens: 'sacred', meanings };
    }

    const semanticsWeight = (weights as Record<string, number>).semantics ?? 0;
    const contextWeight = (weights as Record<string, number>).context ?? 0;
    const intentWeight = (weights as Record<string, number>).intent ?? 0;

    if (semanticsWeight > 0.5 && defs.semantic) {
      return { adapted: extractAdaptedPhrase(defs.semantic), lens: 'semantic', meanings };
    }
    if (contextWeight > 0.5 && defs.context) {
      return { adapted: extractAdaptedPhrase(defs.context), lens: 'context', meanings };
    }
    if (intentWeight > 0.5 && defs.intent) {
      return { adapted: extractAdaptedPhrase(defs.intent), lens: 'intent', meanings };
    }

    return { adapted: null, lens: null, meanings };
  }
}

/** Извлекает первую фразу (до точки или запятой) для адаптированного значения */
function extractAdaptedPhrase(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.,;]+/);
  return match ? match[0].trim() : trimmed;
}
