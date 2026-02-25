/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * ALTRO Dictionary — Золотой запас (Golden Reserve)
 * Хранилище слов с весами по 8 цивилизационным доменам и семантическими определениями.
 * Базовая константа GOLDEN_RESERVE подготовлена для внесения ключевых слов и их весов.
 */

import type { ExternalDomainKey } from './foundation';

/** Веса по 8 цивилизационным доменам (0..1) */
export type CivilizationDomainWeights = Record<ExternalDomainKey, number>;

/** Семантические определения слова (5 внутренних векторов) */
export interface WordDefinitions {
  semantic?: string;
  context?: string;
  intent?: string;
  imagery?: string;
  sacred?: string;
}

/** Запись в Золотом запасе: слово + веса по 8 доменам + определения */
export interface GoldenReserveEntry {
  /** Семантические определения по 5 внутренним векторам */
  definitions: WordDefinitions;
  /** Веса по 8 цивилизационным доменам (0..1). Определяют уклон слова в контексте адаптации */
  domainWeights: CivilizationDomainWeights;
}

/** Золотой запас: слова с весами по 8 цивилизационным доменам */
export const GOLDEN_RESERVE: Record<string, GoldenReserveEntry> = {
  "ДОРОГА": {
    definitions: {
      semantic: "Объект для передвижения между пунктами, типы покрытия (грунт, асфальт), виды (ж/д, авто).",
      context: "Место и действие: стоять на дороге, идти по дороге, выбрать дорогу.",
      intent: "Реализация плана, маршрутизация, обозначение движения.",
      imagery: "Приключение, скорость, шум мотора, извилистая лента, уходящая в неизвестность.",
      sacred: "Выбор и его отсутствие. Дорога жизни, путь к Богу или от Него. Цепь событий.",
    },
    domainWeights: {
      economics: 0.4,
      politics: 0.2,
      society: 0.6,
      history: 0.6,
      culture: 0.5,
      aesthetics: 0.7,
      technology: 0.3,
      religion: 0.5,
    },
  },
  "ДОМ": {
    definitions: {
      semantic: "Объект недвижимости для проживания и деятельности человека.",
      context: "Архитектурный объект, место проживания — 'мой дом'.",
      intent: "Точка своего места, 'логово', малый мир, безопасность.",
      imagery: "Место, где ждут, семья, символ достижений (построить дом, посадить дерево).",
      sacred: "Пристанище души, точка опоры. Отчий дом, мир как общий дом.",
    },
    domainWeights: {
      economics: 0.5,
      politics: 0.2,
      society: 0.8,
      history: 0.7,
      culture: 0.6,
      aesthetics: 0.5,
      technology: 0.2,
      religion: 0.4,
    },
  },
  "ГОЛОС": {
    definitions: {
      semantic: "Звук голосового аппарата человека, тембр, окраска, высота.",
      context: "Характеристика владельца: строгий, спокойный, певческий.",
      intent: "Неотъемлемое качество человека, услышать голос.",
      imagery: "Голоса великих (Паваротти, Меркьюри), голос скрипки.",
      sacred: "ГОЛОС БОГА, Глас судьбы, голоса предков. Источник мистицизма.",
    },
    domainWeights: {
      economics: 0.2,
      politics: 0.3,
      society: 0.5,
      history: 0.5,
      culture: 0.9,
      aesthetics: 0.9,
      technology: 0.3,
      religion: 0.6,
    },
  },
  "ГРАНИЦА": {
    definitions: {
      semantic: "Разделение, оконечная точка, плоскость или сфера.",
      context: "Пересечь на местности, перейти границы дозволенного.",
      intent: "Действие по преодолению или соблюдению пределов.",
      imagery: "Шлагбаум, будка поста, пограничник.",
      sacred: "Границы сознания, пределы знаний, выход за границы мира.",
    },
    domainWeights: {
      economics: 0.4,
      politics: 0.8,
      society: 0.6,
      history: 0.7,
      culture: 0.4,
      aesthetics: 0.3,
      technology: 0.3,
      religion: 0.4,
    },
  },
  "СВЕТ": {
    definitions: {
      semantic: "Поток фотонов от источника.",
      context: "Включить в помещении, солнечный свет, свет Луны.",
      intent: "Осветить.",
      imagery: "Горящая свеча, лунная дорожка на воде, лучи солнца у горизонта, звезды.",
      sacred: "Свет — Свят. Свет истины и знаний (Прометей). Тьма не накроет свет.",
    },
    domainWeights: {
      economics: 0.2,
      politics: 0.2,
      society: 0.4,
      history: 0.5,
      culture: 0.7,
      aesthetics: 0.9,
      technology: 0.6,
      religion: 0.9,
    },
  },
  "ПАМЯТЬ": {
    definitions: {
      semantic: "Способность хранить и извлекать образы, тексты, звуки, запахи.",
      context: "Компьютерная/мышечная память, потеря памяти, 'вспомни'.",
      intent: "Намерение усвоить опыт, основа личности.",
      imagery: "Старый семейный альбом, памятные вещи, строки Пушкина ('Мой дядя...').",
      sacred: "Память — скорбь. Светлая память, память рода и предков.",
    },
    domainWeights: {
      economics: 0.2,
      politics: 0.3,
      society: 0.7,
      history: 0.9,
      culture: 0.8,
      aesthetics: 0.6,
      technology: 0.5,
      religion: 0.7,
    },
  },
  "ДЕЛО": {
    definitions: {
      semantic: "Процесс создания, ремесло, предприятие, судебное дело.",
      context: "Сделать дело, 'шить' дело, открыть дело.",
      intent: "Предпринимать.",
      imagery: "Папка скоросшивателя с надписью 'ДЕЛО №'.",
      sacred: "Наше дело правое! Дело всей жизни.",
    },
    domainWeights: {
      economics: 0.8,
      politics: 0.6,
      society: 0.7,
      history: 0.5,
      culture: 0.4,
      aesthetics: 0.2,
      technology: 0.4,
      religion: 0.4,
    },
  },
  "КОШКА": {
    definitions: {
      semantic: "Домашнее животное.",
      context: "Ловит мышь, мурлычет, трется о ноги.",
      intent: "Уют в доме, характеристика владельца.",
      imagery: "Безмятежно спящее животное.",
      sacred: "Древний сакральный символ, видит сущностей, индикатор безопасности места.",
    },
    domainWeights: {
      economics: 0.2,
      politics: 0.1,
      society: 0.5,
      history: 0.4,
      culture: 0.7,
      aesthetics: 0.8,
      technology: 0.1,
      religion: 0.6,
    },
  },
};

/** Получить запись из Golden Reserve по слову (регистронезависимо) */
export function getGoldenReserveEntry(word: string): GoldenReserveEntry | undefined {
  const upper = word.toUpperCase();
  const capitalized = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return GOLDEN_RESERVE[upper] ?? GOLDEN_RESERVE[capitalized];
}
