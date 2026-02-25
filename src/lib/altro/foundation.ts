/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// src/lib/altro/foundation.ts

export interface AltroSample {
  id: string;
  sourceText: string;
  contextDescription: string;
  domainWeights: {
    // Внешние (Цивилизационные)
    economics?: number;
    politics?: number;
    society?: number;
    history?: number;
    culture?: number;
    aesthetics?: number;
    technology?: number;
    religion?: number; // Religious/Sacred context
    // Внутренние (Ядро)
    semantics?: number;
    context?: number;
    intent?: number;
    imagery?: number; // Metaphor/Imagery
    ethics?: number; // Ethics/Sacred
  };
  adaptationGoal: string;
}

// (Здесь я сократил для кода, но система поймет контекст. В реальном файле можно вставить полный текст, если нужно, но для обучения достаточно ключевых узлов)
export const GOLDEN_DATASET: AltroSample[] = [
  {
    id: "family_roots_manifesto",
    contextDescription: "Personal history, deep roots, Soviet era context, family tragedy and resilience.",
    sourceText: `Начну, пожалуй. Здравствуй, читатель! ... Папа прошёл путь от брошенного своим отцом ребёнка... до заместителя директора... Помню его выражение: «Мороженой картошки вдоволь не ели». ... Мама сейчас вспоминает своё детство с дрожащим голосом... И сколько света и тепла в маме!`, 
    domainWeights: {
      history: 1.0,    // Абсолютный приоритет исторической памяти
      society: 0.9,    // Социальный контекст (СССР, быт)
      context: 1.0,    // Личный контекст
      imagery: 0.7,    // "Пещера", "Чудовища"
      ethics: 0.9      // Уважение к предкам
    },
    adaptationGoal: "Preserve the soul, historical accuracy, and emotional warmth. Do not dry out the language."
  },
  {
    id: "poem_to_fate",
    contextDescription: "High poetry, direct dialogue with Fate, existential intent.",
    sourceText: `Дай мне, закрывшись надеждой, Внезапную встречу внести в расписанье. Дай неприменнное счастье познать, словно бы в детстве прощанье... Но непременно со смелостью воли, неодолимого страсти желанья.`,
    domainWeights: {
      aesthetics: 1.0,
      intent: 1.0,     // Чистое намерение
      ethics: 0.8,     // Сакральное (Sacred)
      semantics: 0.6   // Важна не буква, а дух
    },
    adaptationGoal: "Maintain rhythm, high register, and existential depth. Metaphorical transcreation."
  },
  {
    id: "hamlet_monologue",
    contextDescription: "Shakespeare, existential philosophy, archaic high style.",
    sourceText: "To be, or not to be, that is the question...",
    domainWeights: {
      culture: 1.0,
      religion: 0.8,
      aesthetics: 0.9
    },
    adaptationGoal: "Classical adaptation, retaining archaic flavor."
  },
  {
    id: "pelevin_slang",
    contextDescription: "Modern postmodernism, slang, deconstruction of meanings.",
    sourceText: "Когда я чуть подрос, тетка сказала, что мое имя - индийское... умудренные порнотрафиком одноклассники...",
    domainWeights: {
      technology: 0.8,
      culture: 0.4,
      semantics: 0.9   // Игра слов
    },
    adaptationGoal: "Sharp, modern, slightly cynical adaptation."
  }
];

// Типы для 13 доменов (Строгая типизация для TypeScript)
export type ExternalDomainKey = 'economics' | 'politics' | 'society' | 'history' | 'culture' | 'aesthetics' | 'technology' | 'religion';
export type InternalDomainKey = 'semantics' | 'context' | 'intent' | 'imagery' | 'ethics';
