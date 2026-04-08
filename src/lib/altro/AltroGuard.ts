/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: AltroGuard — Иммунный контур */

import type { SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';
import { buildRefinementPrompt } from '@/archive/legacy_altro/PromptBuilder';
import { logGuardHealingToChronos } from './ChronosService';
import type { ResonanceValidationResult } from '@/archive/legacy_altro/ResonanceValidator';

/** Валидатор резонанса (ResonanceValidator) — интерфейс для инъекции. */
export interface ResonanceValidatorLike {
  verifyResonance(packet: SemanticPacket, output: string): ResonanceValidationResult;
}

/** Статус прохождения через AltroGuard */
export type GuardStatus = 'CLEAN' | 'HEALED' | 'BREACH';

/** Сертификат Соответствия — результат прохождения через AltroGuard */
export interface GuardReport {
  finalText: string;      // Итоговый текст (исцеленный или исходный)
  initialScore: number;   // Балл до коррекции
  finalScore: number;     // Балл после коррекции
  isHealed: boolean;      // Было ли вмешательство (Refinement)
  iterations: number;     // Кол-во попыток (0 или 1 в текущей версии)
  lostMeanings: string[]; // Список утерянных смыслов (если остались)
  timestamp: string;      // Время валидации
  status: GuardStatus;    // CLEAN | HEALED | BREACH
}

/** Данные для FIREWALL MONITOR */
export interface GuardMonitorData {
  score: number;
  status: GuardStatus;
  lostMeanings: string[];
}

/** Извлечение полезного payload между [OUTPUT_START] и [OUTPUT_END]. */
function extractOutputPayload(rawContent: string | undefined | null, fallback: string): string {
  const trimmed = rawContent?.trim();
  if (!trimmed) return fallback;
  const startTag = '[OUTPUT_START]';
  const endTag = '[OUTPUT_END]';
  const startIdx = trimmed.indexOf(startTag);
  if (startIdx === -1) {
    return trimmed || fallback;
  }
  const contentStart = startIdx + startTag.length;
  const endIdx = trimmed.indexOf(endTag, contentStart);
  const slice = endIdx !== -1 ? trimmed.slice(contentStart, endIdx) : trimmed.slice(contentStart);
  const inner = slice.trim();
  return inner || fallback;
}

export class AltroGuard {
  constructor(
    private apiUrl: string,
    private validator: ResonanceValidatorLike,
    private model: string
  ) {}

  /**
   * Фиксирует событие исцеления в Chronos.
   */
  private logToChronos(originalText: string, report: GuardReport): void {
    logGuardHealingToChronos(originalText, {
      finalText: report.finalText,
      initialScore: report.initialScore,
      finalScore: report.finalScore,
      lostMeanings: report.lostMeanings,
      timestamp: report.timestamp,
    });
  }

  /**
   * Повторный вызов LLM для восстановления утерянных смыслов (score < 0.8).
   */
  private async runRefinementRequest(
    originalText: string,
    currentOutput: string,
    lostMeanings: string[]
  ): Promise<string | null> {
    if (lostMeanings.length === 0) return currentOutput;
    const { systemPrompt, userContent } = buildRefinementPrompt(originalText, currentOutput, lostMeanings);
    const payload = {
      model: this.model,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ],
      stream: false,
    };
    try {
      const res = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;
      const rawBody = await res.text();
      const data = JSON.parse(rawBody || '{}') as { message?: { content?: string } };
      const content = data?.message?.content ?? '';
      return extractOutputPayload(content, currentOutput) || currentOutput;
    } catch {
      return null;
    }
  }

  /**
   * Главный метод 'Верификации и Исцеления'
   */
  async verifyAndHeal(
    originalText: string,
    transfiguredText: string,
    packet: SemanticPacket
  ): Promise<GuardReport> {
    const timestamp = new Date().toISOString();

    // Этап 1: Первичная проверка
    const initialResult = this.validator.verifyResonance(packet, transfiguredText);

    let finalResult: ResonanceValidationResult;
    let healedText: string;
    let isHealed = false;

    // Этап 2: Принятие решения
    if (initialResult.score < 0.8) {
      if (typeof window !== 'undefined') {
        console.log(`[AltroGuard] Score ${initialResult.score} ниже порога 0.8. Запуск исцеления...`);
      }
      healedText = (await this.runRefinementRequest(
        originalText,
        transfiguredText,
        initialResult.lostMeanings
      )) ?? transfiguredText;
      finalResult = this.validator.verifyResonance(packet, healedText);
      isHealed = true;
    } else {
      if (typeof window !== 'undefined') {
        console.log(`[AltroGuard] Score ${initialResult.score} в норме. Исцеление не требуется.`);
      }
      finalResult = initialResult;
      healedText = transfiguredText;
    }

    const status: GuardStatus =
      initialResult.score >= 0.8 ? 'CLEAN' : finalResult.score >= 0.8 ? 'HEALED' : 'BREACH';

    const report: GuardReport = {
      finalText: healedText,
      initialScore: initialResult.score,
      finalScore: finalResult.score,
      isHealed,
      iterations: isHealed ? 1 : 0,
      lostMeanings: finalResult.lostMeanings,
      timestamp,
      status,
    };

    if (isHealed) {
      this.logToChronos(originalText, report);
    }

    return report;
  }

  /**
   * Возвращает статистику для FIREWALL MONITOR (score, status, lostMeanings).
   */
  static getMonitorData(report: GuardReport): GuardMonitorData {
    return {
      score: report.finalScore,
      status: report.status,
      lostMeanings: report.lostMeanings,
    };
  }
}
