/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Resonance Validation */

/**
 * ResonanceValidator — проверка сохранения structural_anchors в финальном выводе.
 * Сбор статистики «утечки смыслов» без блокировки ответа.
 */

import type { SemanticPacket } from './SemanticPackager';

export interface ResonanceValidationResult {
  score: number;
  lostMeanings: string[];
  anchorsChecked: number;
  anchorsPreserved: number;
}

const normalizeForMatch = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[\u0301]/g, '')
    .replace(/ё/g, 'е');

/** Проверяет наличие anchor в тексте (нормализованное совпадение по подстроке). */
function anchorPresentInText(anchor: string, text: string): boolean {
  if (!anchor?.trim()) return true;
  const normAnchor = normalizeForMatch(anchor);
  const normText = normalizeForMatch(text);
  if (!normAnchor) return true;
  return normText.includes(normAnchor);
}

/**
 * Валидирует сохранение structural_anchors из пакета в финальном выводе.
 * @param originalPacket — семантический пакет из Phase 1
 * @param finalOutput — финальный текст от LLM (Phase 2)
 * @returns score 0..1 (1 = все якоря сохранены), lostMeanings при score < 0.8
 */
export function validateResonance(
  originalPacket: SemanticPacket,
  finalOutput: string
): ResonanceValidationResult {
  const anchors = originalPacket.structural_anchors ?? [];
  const anchorsChecked = anchors.length;

  if (anchorsChecked === 0) {
    return { score: 1, lostMeanings: [], anchorsChecked: 0, anchorsPreserved: 0 };
  }

  const preserved: string[] = [];
  const lost: string[] = [];

  for (const anchor of anchors) {
    if (anchorPresentInText(anchor, finalOutput)) {
      preserved.push(anchor);
    } else {
      lost.push(anchor);
    }
  }

  const score = preserved.length / anchorsChecked;
  const lostMeanings = score < 0.8 ? lost : [];

  return {
    score,
    lostMeanings,
    anchorsChecked,
    anchorsPreserved: preserved.length,
  };
}
