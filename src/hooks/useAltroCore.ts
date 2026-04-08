/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 — Ядро координат 5+8 (Source of Truth: ALTRO_CORE.md) */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveWeightsFromIntent } from '@core/IntentOrchestrator';
import { scanEntities, type EntityMatch } from '@core/EntityScanner';
import { buildStencilFromEntities } from '@core/StencilDisplayHelper';
import type { DomainWeights } from '@/lib/altroData';

// ——— Legislative Core (5) — строго по финальной матрице ———

export type LegislativeKey = 'Semantic' | 'Context' | 'Intent' | 'Imagery' | 'Ethical';

export const LEGISLATIVE_CORE_5: readonly {
  id: LegislativeKey;
  label: string;
}[] = [
  { id: 'Semantic', label: 'Semantic' },
  { id: 'Context', label: 'Context' },
  { id: 'Intent', label: 'Intent' },
  { id: 'Imagery', label: 'Imagery' },
  { id: 'Ethical', label: 'Ethical' },
] as const;

export type LegislativeWeights = Record<LegislativeKey, number>;

function neutralLegislative(): LegislativeWeights {
  return {
    Semantic: 0.5,
    Context: 0.5,
    Intent: 0.5,
    Imagery: 0.5,
    Ethical: 0.5,
  };
}

// ——— Executive Shell (8) — порядок фиксирован ———

export type ExecutiveKey = 'Basis' | 'Power' | 'Society' | 'Time' | 'Code' | 'Form' | 'Tech' | 'Spirit';

export const EXECUTIVE_SHELL_8: readonly {
  key: ExecutiveKey;
  nameRu: string;
  scope: string;
}[] = [
  { key: 'Basis', nameRu: 'ЭКОНОМИКА', scope: 'Ресурсы, выгода, прагматика.' },
  { key: 'Power', nameRu: 'ПОЛИТИКА', scope: 'Власть, иерархия, закон.' },
  { key: 'Society', nameRu: 'ОБЩЕСТВО', scope: 'Связи, люди, нормы.' },
  { key: 'Time', nameRu: 'ИСТОРИЯ', scope: 'Память, опыт, корни.' },
  { key: 'Code', nameRu: 'КУЛЬТУРА', scope: 'Традиция, идентичность, язык.' },
  { key: 'Form', nameRu: 'ЭСТЕТИКА', scope: 'Красота, стиль, гармония.' },
  { key: 'Tech', nameRu: 'ТЕХНОЛОГИИ', scope: 'Инструмент, прогресс, алгоритм.' },
  { key: 'Spirit', nameRu: 'ДУХОВНОСТЬ', scope: 'Высший смысл, этика абсолюта.' },
] as const;

export type ExecutiveWeights = Record<ExecutiveKey, number>;

function neutralExecutive(): ExecutiveWeights {
  return {
    Basis: 0.5,
    Power: 0.5,
    Society: 0.5,
    Time: 0.5,
    Code: 0.5,
    Form: 0.5,
    Tech: 0.5,
    Spirit: 0.5,
  };
}

// ——— IPA ———

export interface CapturedPayload {
  kind: 'text' | 'structured';
  raw: string;
  meta?: Record<string, unknown>;
  capturedAt: number;
}

/**
 * Снимок клиентского захвата (EntityScanner): `store` = исходные сегменты (часто латиница).
 * Для STENCIL после `/api/transcreate` зеркало должно использовать **display** с сервера
 * (`X-Altro-Stencil-Vault` → `runStencilTransfigure` → StreamInjector), а не этот store.
 */
export interface CapturedVaultSnapshot {
  store: Record<string, string>;
  typeMap: Record<string, string>;
}

export interface ProcessedIntent {
  commandIntent: string;
  legislative: LegislativeWeights;
  executive: ExecutiveWeights;
  /** 13-доменная матрица ALTRO (IntentOrchestrator), синхронна с /api/transcreate. */
  domainWeights: DomainWeights;
  processedAt: number;
}

export interface ActionPayload {
  capture: CapturedPayload;
  intent: ProcessedIntent;
  integrity: IntegritySnapshot;
  /** Трафарет с метками {{IPA_N}} (лингвистическая нейтральность — маска, не перевод) */
  stencilText: string;
  /** Исходные значения по меткам {{IPA_N}} (как в DataVault) */
  capturedData: CapturedVaultSnapshot;
  /** Целевой язык выдачи (RU, EN, …) */
  targetLanguage: string;
}

/** Мост для CommandBar / page: один экземпляр ядра на экран */
export interface IpaCoreBridge {
  commandIntent: string;
  setCommandIntent: (s: string) => void;
  /** Текущий целевой язык выдачи (RU / EN / …), в т.ч. после авто-Lang */
  targetLanguage: string;
  /** Язык захвата: AUTO или фикс. код (для авто-цели трафарета) */
  captureSourceLanguage: string;
  setCaptureSourceLanguage: (s: string) => void;
  /** Режим трафарета: AUTO — resolveStencilTargetLanguage; иначе фиксированный код */
  stencilLanguageMode: string;
  setStencilLanguageMode: (s: string) => void;
  runIpaPhase1: (sourceRaw: string, commandLine: string, adaptedTextForIntegrity: string) => ActionPayload;
  executeAction: (adaptedText: string, sourceOverride?: string) => ActionPayload | null;
}

export interface IntegritySnapshot {
  stressMarksPreserved: boolean;
  homonymMarkersValid: boolean;
  notes: string[];
}

const COMBINING_ACUTE = '\u0301';

/** Integrity Protocol (OPR): базовый фильтр целостности — ударения и маркировка омонимов */

export const integrityProtocol = {
  /** Сохраняет комбинирующие знаки ударения в строке (не удаляет U+0301). */
  preserveStressMarks(text: string): string {
    return text.normalize('NFC');
  },

  /** Сравнение «без ударения» для поиска совпадения леммы. */
  stripCombiningForCompare(text: string): string {
    return text.replace(/\u0301/g, '').toLowerCase();
  },

  /** Маркер омонима: фиксация выбранного варианта как часть протокола целостности. */
  formatHomonymLock(word: string, chosenVariant: string): string {
    const w = word.trim();
    const v = chosenVariant.trim();
    return `[HOMONYM_LOCK: "${w}" → "${v}"]`;
  },

  /** Проверка: количество ударений (комбинирующих острых) не уменьшилось. */
  validateStressIntegrity(source: string, adapted: string): boolean {
    const count = (s: string) => (s.match(/\u0301/g) ?? []).length;
    return count(adapted) >= count(source);
  },

  /**
   * Структурное эхо: грубая проверка, что блоки строк/абзацев не «схлопнулись»
   * (для таблиц/списков нужен отдельный парсер — здесь базовая эвристика).
   */
  validateLineTopology(source: string, adapted: string): boolean {
    const ls = source.split('\n').length;
    const la = adapted.split('\n').length;
    if (ls <= 1) return true;
    return la >= Math.max(1, Math.floor(ls * 0.5));
  },
};

function buildIntegritySnapshot(source: string, output: string): IntegritySnapshot {
  const notes: string[] = [];
  const stressOk = integrityProtocol.validateStressIntegrity(source, output);
  if (!stressOk) notes.push('Stress marks may have been reduced in adaptation.');
  const topoOk = integrityProtocol.validateLineTopology(source, output);
  if (!topoOk) notes.push('Line/block count dropped significantly; check structure.');
  return {
    stressMarksPreserved: stressOk,
    homonymMarkersValid: true,
    notes,
  };
}

function buildVaultFromEntities(entities: EntityMatch[]): CapturedVaultSnapshot {
  const store: Record<string, string> = {};
  const typeMap: Record<string, string> = {};
  entities.forEach((e, i) => {
    const key = `{{IPA_${i + 1}}}`;
    store[key] = e.text;
    typeMap[key] = e.type;
  });
  return { store, typeMap };
}

/** Силовое переключение: токены RU / EN отдельным словом (в т.ч. в конце строки). */
export function parseForcedRuEnToken(commandLine: string): 'RU' | 'EN' | null {
  const t = commandLine.trim();
  if (!t) return null;
  if (/\bRU\b/i.test(t)) return 'RU';
  if (/\bEN\b/i.test(t)) return 'EN';
  return null;
}

/**
 * Явная директива языка в командной строке (фразы + языки кроме силового RU/EN — см. resolveTargetLanguage).
 */
export function parsePhraseExplicitLanguage(commandLine: string): string | null {
  const t = commandLine.trim();
  if (!t) return null;
  if (/\b(?:на\s+русск|in\s+russian|русск(?:ом|ий|ая)?\b)/i.test(t)) return 'RU';
  if (/\b(?:на\s+англ|in\s+english|английск|to\s+EN\b)/i.test(t)) return 'EN';
  if (/\b(?:DE|немец|german|in\s+german)\b/i.test(t)) return 'DE';
  if (/\b(?:FR|француз|french|in\s+french)\b/i.test(t)) return 'FR';
  if (/\b(?:IT|итал|italian)\b/i.test(t)) return 'IT';
  if (/\b(?:HY|армян|armenian)\b/i.test(t)) return 'HY';
  if (/\b(?:ES|español|spanish|на\s+испанск|испанск)\b/i.test(t)) return 'ES';
  return null;
}

function detectScriptDominance(text: string): 'latin' | 'cyrillic' | 'neutral' {
  const cyr = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const lat = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (cyr === 0 && lat === 0) return 'neutral';
  if (cyr > lat) return 'cyrillic';
  if (lat > cyr) return 'latin';
  return 'neutral';
}

/**
 * Авто-режим: латиница в захвате/команде → цель RU; кириллица → цель EN (перевод «на другой» язык).
 */
export function inferAutoTargetFromText(sourceRaw: string, commandLine: string): string | null {
  const combined = `${sourceRaw}\n${commandLine}`;
  const d = detectScriptDominance(combined);
  if (d === 'latin') return 'RU';
  if (d === 'cyrillic') return 'EN';
  return null;
}

/** Латиница по умолчанию (европейские источники) → цель RU; кириллица (RU) → EN; HY — эвристика. */
export function inferAutoTargetWithSourcePreference(
  sourceRaw: string,
  commandLine: string,
  captureSourceLanguage: string
): string | null {
  const c = captureSourceLanguage.trim().toUpperCase();
  if (c === 'AUTO' || c === '') {
    return inferAutoTargetFromText(sourceRaw, commandLine);
  }
  if (['EN', 'IT', 'FR', 'DE', 'ES'].includes(c)) return 'RU';
  if (c === 'RU') return 'EN';
  if (c === 'HY') return 'EN';
  return inferAutoTargetFromText(sourceRaw, commandLine);
}

/**
 * Полное разрешение целевого языка трафарета: директива в команде → фикс. режим Stencil → авто (скрипт + Source) → previous.
 */
export function resolveStencilTargetLanguage(
  sourceRaw: string,
  commandLine: string,
  previousTarget: string,
  captureSourceLanguage: string,
  stencilLanguageMode: string
): string {
  const forced = parseForcedRuEnToken(commandLine);
  if (forced) return forced;
  const phrase = parsePhraseExplicitLanguage(commandLine);
  if (phrase) return phrase;

  const mode = stencilLanguageMode.trim().toUpperCase();
  if (mode && mode !== 'AUTO') return mode;

  const auto = inferAutoTargetWithSourcePreference(sourceRaw, commandLine, captureSourceLanguage);
  if (auto) return auto;
  return previousTarget;
}

/**
 * Обратная совместимость: оба режима AUTO, источник AUTO.
 */
export function resolveTargetLanguage(
  sourceRaw: string,
  commandLine: string,
  previousTarget: string
): string {
  return resolveStencilTargetLanguage(sourceRaw, commandLine, previousTarget, 'AUTO', 'AUTO');
}

/**
 * Язык выдачи из директивы (например «на английском», «to EN»). Иначе — fallback (по умолчанию RU).
 * @deprecated предпочтительнее resolveTargetLanguage для фазы с авто-Lang
 */
export function parseTargetLanguageFromIntent(commandLine: string, fallback: string): string {
  const t = commandLine.trim();
  if (!t) return fallback;
  const forced = parseForcedRuEnToken(t);
  if (forced) return forced;
  const phrase = parsePhraseExplicitLanguage(t);
  if (phrase) return phrase;
  return fallback;
}

function buildIpaExtractorPayload(raw: string): {
  stencilText: string;
  capturedData: CapturedVaultSnapshot;
  captureMeta: Record<string, unknown>;
} {
  const entities = scanEntities(raw);
  const { maskedText } = buildStencilFromEntities(raw, entities);
  const capturedData = buildVaultFromEntities(entities);
  return {
    stencilText: maskedText,
    capturedData,
    captureMeta: {
      ipaVault: capturedData.store,
      ipaTypes: capturedData.typeMap,
      entityCount: entities.length,
      entities: entities.map((e) => ({ ...e })),
    },
  };
}

// ——— Hook ———

/** @param liveSourceRaw — живой текст захвата для useMemo effectiveStencilTarget (без лишних пересчётов на странице). */
export function useAltroCore(liveSourceRaw: string = '') {
  const [captured, setCaptured] = useState<CapturedPayload | null>(null);
  const [legislative, setLegislative] = useState<LegislativeWeights>(neutralLegislative);
  const [executive, setExecutive] = useState<ExecutiveWeights>(neutralExecutive);
  const [commandIntent, setCommandIntent] = useState('');
  /** Лингвистическая нейтральность: целевой язык выдачи (по умолчанию RU) */
  const [targetLanguage, setTargetLanguage] = useState('RU');
  /** Языковая матрица — источник (Терминал Захвата) */
  const [captureSourceLanguage, setCaptureSourceLanguage] = useState('AUTO');
  /** Языковая матрица — трафарет: AUTO или фиксированный код */
  const [stencilLanguageMode, setStencilLanguageModeState] = useState('AUTO');
  const [lastAction, setLastAction] = useState<ActionPayload | null>(null);

  const setStencilLanguageMode = useCallback((mode: string) => {
    setStencilLanguageModeState(mode);
    const m = mode.trim().toUpperCase();
    if (m && m !== 'AUTO') {
      setTargetLanguage(m);
    }
  }, []);

  const effectiveStencilTarget = useMemo(
    () =>
      resolveStencilTargetLanguage(
        liveSourceRaw,
        commandIntent,
        targetLanguage,
        captureSourceLanguage,
        stencilLanguageMode
      ),
    [
      liveSourceRaw,
      commandIntent,
      targetLanguage,
      captureSourceLanguage,
      stencilLanguageMode,
    ]
  );

  const resetStencilCore = useCallback(() => {
    setCaptured(null);
    setCommandIntent('');
    setTargetLanguage('RU');
    setCaptureSourceLanguage('AUTO');
    setStencilLanguageModeState('AUTO');
    setLastAction(null);
    setLegislative(neutralLegislative());
    setExecutive(neutralExecutive());
  }, []);

  useEffect(() => {
    console.log(
      '[ALTRO-CORE]: Матрица 5+8 развернута. Смысловые поля ЭКОНОМИКА...ДУХОВНОСТЬ активны.'
    );
  }, []);

  /** I — Information: захват сырых данных */
  const captureData = useCallback((input: string | Record<string, unknown>, meta?: Record<string, unknown>) => {
    const raw =
      typeof input === 'string' ? integrityProtocol.preserveStressMarks(input) : JSON.stringify(input, null, 0);
    const kind: CapturedPayload['kind'] = typeof input === 'string' ? 'text' : 'structured';
    const payload: CapturedPayload = {
      kind,
      raw,
      meta,
      capturedAt: Date.now(),
    };
    setCaptured(payload);
    return payload;
  }, []);

  /** P — Process: активация полей 5+8 и Command Intent */
  const processIntent = useCallback(
    (opts: {
      commandIntent?: string;
      legislative?: Partial<LegislativeWeights>;
      executive?: Partial<ExecutiveWeights>;
    }): ProcessedIntent => {
      const leg = { ...neutralLegislative(), ...legislative, ...opts.legislative };
      const exe = { ...neutralExecutive(), ...executive, ...opts.executive };
      if (opts.legislative) setLegislative(leg);
      if (opts.executive) setExecutive(exe);
      const ci = opts.commandIntent ?? commandIntent;
      if (opts.commandIntent !== undefined) setCommandIntent(opts.commandIntent);
      const domainWeights = resolveWeightsFromIntent(ci);
      const processed: ProcessedIntent = {
        commandIntent: ci,
        legislative: leg,
        executive: exe,
        domainWeights,
        processedAt: Date.now(),
      };
      return processed;
    },
    [commandIntent, legislative, executive]
  );

  /** A — Action: сборка полезной нагрузки для исполнителя с снимком Integrity */
  const executeAction = useCallback(
    (adaptedText: string, sourceOverride?: string): ActionPayload | null => {
      if (!captured) return null;
      const source = sourceOverride ?? captured.raw;
      const intent = processIntent({});
      const integrity = buildIntegritySnapshot(source, adaptedText);
      const ext = buildIpaExtractorPayload(source);
      const payload: ActionPayload = {
        capture: {
          ...captured,
          meta: { ...captured.meta, ...ext.captureMeta },
        },
        intent,
        integrity,
        stencilText: ext.stencilText,
        capturedData: ext.capturedData,
        targetLanguage,
      };
      setLastAction(payload);
      return payload;
    },
    [captured, processIntent, targetLanguage]
  );

  /**
   * Атомарный IPA (Фаза 1 / Bridge): без гонки между capture и execute.
   * Вызывает внутри тот же смысл, что I → P → A, и обновляет состояние ядра.
   */
  const runIpaPhase1 = useCallback(
    (sourceRaw: string, commandLine: string, adaptedTextForIntegrity: string): ActionPayload => {
      const raw = integrityProtocol.preserveStressMarks(sourceRaw);
      const nextLang = resolveStencilTargetLanguage(
        raw,
        commandLine,
        targetLanguage,
        captureSourceLanguage,
        stencilLanguageMode
      );
      setTargetLanguage(nextLang);

      const ext = buildIpaExtractorPayload(raw);
      const capturePayload: CapturedPayload = {
        kind: 'text',
        raw,
        capturedAt: Date.now(),
        meta: ext.captureMeta,
      };
      setCaptured(capturePayload);
      setCommandIntent(commandLine);
      const leg = { ...neutralLegislative(), ...legislative };
      const exe = { ...neutralExecutive(), ...executive };
      const domainWeights = resolveWeightsFromIntent(commandLine);
      const processed: ProcessedIntent = {
        commandIntent: commandLine,
        legislative: leg,
        executive: exe,
        domainWeights,
        processedAt: Date.now(),
      };
      const integrity = buildIntegritySnapshot(capturePayload.raw, adaptedTextForIntegrity);
      const payload: ActionPayload = {
        capture: capturePayload,
        intent: processed,
        integrity,
        stencilText: ext.stencilText,
        capturedData: ext.capturedData,
        targetLanguage: nextLang,
      };
      setLastAction(payload);
      return payload;
    },
    [legislative, executive, targetLanguage, captureSourceLanguage, stencilLanguageMode]
  );

  const matrix = useMemo(
    () => ({
      legislative: LEGISLATIVE_CORE_5,
      executive: EXECUTIVE_SHELL_8,
    }),
    []
  );

  return {
    /** Финальная матрица (только чтение) */
    ...matrix,
    legislativeWeights: legislative,
    setLegislativeWeights: setLegislative,
    executiveWeights: executive,
    setExecutiveWeights: setExecutive,
    commandIntent,
    setCommandIntent,
    targetLanguage,
    setTargetLanguage,
    captureSourceLanguage,
    setCaptureSourceLanguage,
    stencilLanguageMode,
    setStencilLanguageMode,
    capturePayload: captured,
    lastAction,
    captureData,
    processIntent,
    executeAction,
    runIpaPhase1,
    integrityProtocol,
    /** Разрешённая цель трафарета (превью для UI / OUT=AUTO) */
    effectiveStencilTarget,
    /** Полный сброс IPA: vault, meta, директива, матрица 5+8 → нейтраль */
    resetStencilCore,
  };
}

export { COMBINING_ACUTE };
