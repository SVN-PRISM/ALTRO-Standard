/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

import { INITIAL_DOMAIN_WEIGHTS, SCENARIO_UI_WEIGHTS, type DomainWeights } from '@/lib/altroData';

export type PresetId = 'mirror' | 'transfigure' | 'slang' | null;

export interface CommandResult {
  success: boolean;
  weights?: DomainWeights;
  selectedScenario?: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
  oprPrismValue?: number;
  activePreset?: PresetId;
  activePattern?: { id: string; name: string } | null;
  message: string;
}

export interface CommandWeights {
  domainWeights: DomainWeights;
  selectedScenario?: 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
  oprPrismValue?: number;
}

/**
 * CommandProcessor — парсинг команд (строки, начинающиеся с /).
 * Поддерживаемые команды: /mode:spirit, /mode:tech, /mode:social, /reset.
 */
export class CommandProcessor {
  static process(input: string, currentWeights: CommandWeights): CommandResult {
    const t = (input || '').trim();
    if (!t) {
      return { success: false, message: '' };
    }

    if (/^\/reset$/i.test(t)) {
      return {
        success: true,
        weights: { ...INITIAL_DOMAIN_WEIGHTS },
        selectedScenario: 'without',
        oprPrismValue: 0,
        activePreset: 'transfigure',
        activePattern: null,
        message: 'Сброс: веса и OPR обнулены.',
      };
    }

    const oprMatch = t.match(/^\/opr:(\d+)$/i);
    if (oprMatch) {
      const oprPrismValue = Math.max(0, Math.min(100, parseInt(oprMatch[1], 10)));
      return {
        success: true,
        oprPrismValue,
        activePreset: 'transfigure',
        message: `OPR: ${oprPrismValue}%`,
      };
    }

    const modeMatch = t.match(/^\/mode:(\w+)$/i);
    if (modeMatch) {
      const name = modeMatch[1].toLowerCase();
      const modes: Record<string, () => CommandResult> = {
        spirit: () => ({
          success: true,
          weights: { ...INITIAL_DOMAIN_WEIGHTS, spirituality: 1, ethics: 1 },
          selectedScenario: 'without',
          activePreset: 'transfigure',
          message: 'Режим Spirit: религия + этика.',
        }),
        tech: () => ({
          success: true,
          weights: { ...INITIAL_DOMAIN_WEIGHTS, technology: 1 },
          selectedScenario: 'without',
          activePreset: 'transfigure',
          message: 'Режим Tech: технологии.',
        }),
        social: () => ({
          success: true,
          weights: { ...INITIAL_DOMAIN_WEIGHTS, society: 1 },
          selectedScenario: 'without',
          activePreset: 'transfigure',
          message: 'Режим Social: общество.',
        }),
        economy: () => ({
          success: true,
          weights: { ...INITIAL_DOMAIN_WEIGHTS, economics: 1 },
          selectedScenario: 'without',
          activePreset: 'transfigure',
          message: 'Режим Economy: экономика.',
        }),
        sacred: () => ({
          success: true,
          weights: { ...SCENARIO_UI_WEIGHTS.sacred },
          selectedScenario: 'sacred',
          activePreset: 'transfigure',
          message: 'Режим Sacred: сакральный сценарий.',
        }),
      };
      const fn = modes[name];
      if (fn) {
        return fn();
      }
    }

    return { success: false, message: '' };
  }
}
