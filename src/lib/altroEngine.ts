/**
 * MIT License
 * Copyright (c) 2026 SERGEI NAZARIAN (SVN)
 * ALTRO: Semantic Orchestration Layer
 *
 * ALTRO Engine — Логика оркестрации и грамматики
 * Содержит функции трансформации текста, оркестрации и грамматического согласования
 */

import { ALTRO_LIBRARY, type DomainWeights, INITIAL_DOMAIN_WEIGHTS, DOMAIN_MATRIX, SCENARIO_UI_WEIGHTS, HOMONYM_WORDS, HOMONYM_DB, HOMONYM_WORD_FORMS, SPELLCHECK_DICTIONARY, PROPER_NOUNS, type ScenarioType, type ScenarioProfile, type HomonymEntry } from './altroData';
import {
  calculateWeights,
  getActivePattern,
  areWeightsInStandby,
  applyScenarioCoefficients,
  applyOprModulation,
  calculateScenarioWeights,
} from '@/lib/altro/vectorEngine';
import { escapeHtml, applyAccentToWord, stripStressTagsLocal, buildAccentAwareWordRegex, hasStressMark } from '@/lib/altro/textUtils';
import { AltroTokenManager, type TextToken } from '@/lib/altro/tokenManager';

/** Токен: слово с метаданными для обработки */
interface Token {
  original: string;
  transformed: string;
  isReplaced: boolean;
  isPunctuation: boolean;
  isWhitespace: boolean;
  isTranscreated: boolean;
}

/** TextToken: реэкспорт из tokenManager для совместимости */
export type { TextToken };

/** Semantic Suggestion: предложение исправления на основе контекста */
export interface SemanticSuggestion {
  phrase: string; // исходная фраза с ошибкой
  suggestion: string; // предложенное исправление
  tokenIds: number[]; // ID токенов, которые нужно заменить
  lowConfidence?: boolean; // N-gram: низкий коэффициент доверия — не применять принудительно, только пометить сиреневым
}

export { escapeHtml, applyAccentToWord, buildAccentAwareWordRegex, stripStressTagsLocal, stripAdaptationMarkers, ensureMandatoryStress } from '@/lib/altro/textUtils';

/** Умная замена с сохранением регистра первой буквы */
function matchCase(source: string, replacement: string): string {
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Грамматический патч: «на долго» → «надолго» во всех режимах */
export function applyBaseCorrection(text: string): string {
  if (!text.trim()) return text;
  return text.replace(/\bна долго\b/gi, 'надолго');
}

/** Трансформация в чистый текст */
export function transformPlain(text: string, mode: 'mirror' | 'bridge' | 'transfigure' | 'slang' | null): string {
  if (!text.trim()) return text;
  let out = text;
  if (mode === 'slang') {
    out = out.replace(/\bфакт\b/giu, (m) => matchCase(m, 'пруф'));
    out = out.replace(/\bоппонентов\b/giu, (m) => matchCase(m, 'хейтеров'));
    out = out.replace(/\bоппоненты\b/giu, (m) => matchCase(m, 'хейтеры'));
    out = out.replace(/\bпутешествие\b/giu, (m) => matchCase(m, 'трип'));
  } else if (mode === 'transfigure') {
    out = out.replace(/\bфакт\b/giu, (m) => matchCase(m, 'аргумент'));
    out = out.replace(/\bвознамерился\b/giu, (m) => matchCase(m, 'направился'));
  }
  return out;
}

/** Функция matchGender: определяет род слова для грамматического согласования */
function matchGender(word: string): 'женский' | 'мужской' | 'средний' {
  const lowerWord = word.toLowerCase();
  
  if (lowerWord.includes('чертеж') || lowerWord.includes('вектор') || 
      lowerWord.includes('контакт') || lowerWord.includes('цикл') ||
      lowerWord.includes('батя') || lowerWord.includes('эффект') ||
      lowerWord.includes('путь') || lowerWord.includes('узел') ||
      lowerWord.includes('синхронизация') || lowerWord.includes('детерминированный') ||
      lowerWord.includes('целевой') || lowerWord.includes('эхо') ||
      lowerWord.includes('порог') || lowerWord.includes('источник') ||
      lowerWord.includes('хранилище') || lowerWord.includes('миссия') ||
      lowerWord.includes('голос') || lowerWord.includes('хранитель') ||
      lowerWord.match(/([а-яё]+(?:ой|ый|ий|ей))$/)) {
    return 'мужской';
  } else if (lowerWord.includes('бытие') || lowerWord.includes('свет') ||
           lowerWord.includes('событие') || lowerWord.includes('пристанище') ||
           lowerWord.includes('фото') || lowerWord.match(/([а-яё]+(?:ое|ее))$/)) {
    return 'средний';
  } else if (lowerWord.match(/([а-яё]+(?:ая|яя|ь))$/)) {
    return 'женский';
  }
  
  return 'женский';
}

/** Функция токенизации: разбивает текст на массив слов. U+0301 сохраняется внутри слова. */
function tokenize(text: string): Token[] {
  const altroTokens = AltroTokenManager.tokenize(text);
  return altroTokens.map((t) => ({
    original: t.word,
    transformed: t.word,
    isReplaced: false,
    isTranscreated: false,
    isPunctuation: t.type === 'punct',
    isWhitespace: t.type === 'space',
  }));
}

/** Функция детокенизации: собирает токены обратно в строку */
function detokenize(tokens: Token[]): string {
  let result = '';
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token.isWhitespace || token.isPunctuation) {
      result += token.transformed;
      continue;
    }
    
    if (i > 0) {
      const prevToken = tokens[i - 1];
      if (!prevToken.isWhitespace && !prevToken.isPunctuation && prevToken.transformed[prevToken.transformed.length - 1] !== '(') {
        result += ' ';
      }
    }
    
    result += token.transformed;
  }
  
  result = result.replace(/\s+/g, ' ');
  result = result.replace(/\s+([.!?,;:])/g, '$1');
  result = result.replace(/([.!?,;:])\s+/g, '$1 ');
  result = result.replace(/\)\s*([а-яёА-ЯЁ\u0301])/g, ') $1');
  result = result.trim();
  
  return result;
}

export { calculateWeights, getActivePattern, areWeightsInStandby, calculateScenarioWeights } from '@/lib/altro/vectorEngine';

/**
 * Токенизация для UI: базовая разбивка через AltroTokenManager + обогащение омонимами.
 * Символы \u0301 сохраняются (tokenManager не изменяет текст).
 */
export function tokenizeText(text: string): TextToken[] {
  const baseTokens = AltroTokenManager.tokenize(text);
  const tokens: TextToken[] = [];
  let tokenId = 0;

  for (const t of baseTokens) {
    const value = t.word;
    const isWord = t.type === 'word';

    if (isWord) {
      const lowerWord = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const baseForHomonym = HOMONYM_WORD_FORMS[lowerWord] ?? lowerWord;
      const homonymEntry = HOMONYM_DB.find((entry) => entry.base.toLowerCase() === baseForHomonym);
      const isHomonym = !!homonymEntry && !hasStressMark(value);

      const isMisspelled =
        !SPELLCHECK_DICTIONARY.has(lowerWord) &&
        !PROPER_NOUNS.has(value) &&
        !hasStressMark(value);

      const token: TextToken = {
        id: tokenId++,
        word: value,
        type: t.type,
        isHomonym,
        isPunctuation: false,
        isWhitespace: false,
        isMisspelled,
        hasAccent: t.hasAccent,
        isLocked: t.isLocked,
      };

      if (isHomonym && homonymEntry) {
        token.options = homonymEntry.variants.map((v) => v.word);
      }
      if (hasStressMark(value)) {
        token.resolvedAccent = value;
        token.isHomonym = false;
      }

      tokens.push(token);
    } else {
      tokens.push({
        id: tokenId++,
        word: value,
        type: t.type,
        isHomonym: false,
        isPunctuation: t.type === 'punct',
        isWhitespace: t.type === 'space',
      });
    }
  }

  return tokens;
}

/** Context Guard: Проверка контекста для обнаружения семантических ошибок (домен Контекст).
 * Выделяет маловероятные сочетания слов и предлагает альтернативы. */
export function detectContextualErrors(tokens: TextToken[]): SemanticSuggestion[] {
  const suggestions: SemanticSuggestion[] = [];
  
  // Паттерн 1: "Папа имама" -> "Папа и мама" (подозрительное сочетание)
  for (let i = 0; i < tokens.length - 2; i++) {
    const token1 = tokens[i];
    const token2 = tokens[i + 1];
    const token3 = tokens[i + 2];
    
    if (token1 && token2 && token3 &&
        token1.word.replace(/\u0301/g, '').toLowerCase() === 'папа' && 
        token2.isWhitespace &&
        token3.word.replace(/\u0301/g, '').toLowerCase() === 'имама' &&
        !token1.isPunctuation && !token1.isWhitespace &&
        !token3.isPunctuation && !token3.isWhitespace) {
      suggestions.push({
        phrase: `${token1.word} ${token3.word}`,
        suggestion: 'Папа и мама',
        tokenIds: [token1.id, token3.id],
      });
    }
  }
  
  // Паттерн 2: "папаимама" (слитно) -> "Папа и мама"
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token && !token.isPunctuation && !token.isWhitespace &&
        token.word.replace(/\u0301/g, '').toLowerCase() === 'папаимама') {
      suggestions.push({
        phrase: token.word,
        suggestion: 'Папа и мама',
        tokenIds: [token.id],
      });
    }
  }
  
  return suggestions;
}

/**
 * resolveHomonymByStress: Автоматически разрешает омоним по Unicode-символу ударения (\u0301)
 * Если в слове есть знак ударения, функция находит соответствующее значение из HOMONYM_DB
 * @param word - Слово с возможным ударением
 * @returns Значение омонима из БД или null, если не найдено
 */
export function resolveHomonymByStress(word: string): string | null {
  // Проверяем наличие Unicode-символа ударения
  if (!hasStressMark(word)) {
    return null;
  }
  
  // Нормализуем слово для поиска (убираем ударение для поиска базовой формы)
  const normalizedWord = word.normalize('NFD').replace(/[\u0301]/g, '').toLowerCase();
  
  // Ищем в базе данных омонимов
  for (const entry of HOMONYM_DB) {
    if (entry.base.toLowerCase() === normalizedWord) {
      // Находим вариант с ударением, который соответствует входному слову
      const wordWithStress = word.normalize('NFD');
      for (const variant of entry.variants) {
        const variantNormalized = variant.word.normalize('NFD');
        // Сравниваем нормализованные формы (с ударениями)
        if (variantNormalized.toLowerCase() === wordWithStress.toLowerCase()) {
          return variant.meaning;
        }
      }
    }
  }
  
  return null;
}

/** Поиск омонимов в тексте. Слова с \u0301 (hasStressMark) считаются решёнными и не требуют уточнения. */
export function detectHomonymsInText(text: string): { word: string; position: number; resolved?: string }[] {
  const cleanText = stripStressTagsLocal(text);
  const foundHomonyms: { word: string; position: number; resolved?: string }[] = [];
  const processedPositions = new Set<number>();
  
  // Сначала проверяем слова с ударениями - они автоматически разрешаются
  const combining = '[\\u0300-\\u036f]*';
  for (const entry of HOMONYM_DB) {
    for (const variant of entry.variants) {
      const baseWord = variant.word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const pattern = '\\b' + baseWord.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(combining) + combining + '\\b';
      const regex = new RegExp(pattern, 'gi');
      let match;
      while ((match = regex.exec(cleanText)) !== null) {
        const matchIndex = match.index;
        if (processedPositions.has(matchIndex)) continue;
        
        // Извлекаем слово из текста с учетом возможного ударения
        const matchedWord = match[0];
        const wordStart = matchIndex;
        const wordEnd = wordStart + matchedWord.length;
        
        // Проверяем, есть ли ударение в исходном тексте (Unicode \u0301 может быть после гласной)
        const textSegment = cleanText.substring(Math.max(0, wordStart - 1), Math.min(cleanText.length, wordEnd + 1));
        if (hasStressMark(textSegment)) {
          // Находим точное слово с ударением
          const wordWithStress = cleanText.substring(wordStart, wordEnd);
          // Автоматически разрешаем омоним по ударению
          const resolved = resolveHomonymByStress(wordWithStress);
          if (resolved) {
            foundHomonyms.push({
              word: matchedWord,
              position: matchIndex,
              resolved: resolved,
            });
            processedPositions.add(matchIndex);
          }
        }
      }
    }
  }
  
  // Затем ищем омонимы без ударений (требуют уточнения)
  for (const homonym of HOMONYM_WORDS) {
    const pattern = '\\b' + homonym.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(combining) + combining + '\\b';
    const regex = new RegExp(pattern, 'gi');
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      const matchIndex = match.index;
      if (processedPositions.has(matchIndex)) continue;
      
      const matchedWord = match[0];
      // Пропускаем слова с ударением (они уже обработаны выше)
      if (!hasStressMark(matchedWord)) {
        // Проверяем, есть ли этот омоним в базе данных
        const matchedNorm = matchedWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const isInDB = HOMONYM_DB.some(entry => entry.base.toLowerCase() === matchedNorm);
        if (isInDB) {
          foundHomonyms.push({
            word: matchedWord,
            position: matchIndex,
          });
          processedPositions.add(matchIndex);
        }
      }
    }
  }
  
  return foundHomonyms;
}

/** Функция трансформации чистого текста */
function orchestrateText(
  text: string, 
  weights: DomainWeights, 
  preset: 'mirror' | 'bridge' | 'transfigure' | 'slang' | null,
  scenario?: ScenarioType,
  oprPrism: number = 0,
  oprNegative?: boolean
): { text: string; requiresClarification?: boolean } {
  if (typeof text !== 'string' || !text.trim()) {
    return { text: '' };
  }
  // OPR NEGATIVE: oprNegative === true → режим повышенного критицизма (поиск логических дыр)
  const enhancedCriticism = oprNegative === true;

  // Применяем коэффициенты сценария к весам
  let adjustedWeights = scenario ? applyScenarioCoefficients(weights, scenario) : weights;
  // OPR: Effective_Influence_i = D_i * O
  adjustedWeights = applyOprModulation(adjustedWeights, oprPrism);
  
  // ДЕКОНСТРУКЦИЯ: Если история = -1, текст разрушается
  if (adjustedWeights.history <= -0.99) {
    return {
      text: text.split('').map((char) => {
        if (char === ' ') return ' ';
        if (char.match(/[.!?,;:]/)) return char;
        return Math.random() > 0.3 ? String.fromCharCode(0x200B) : char;
      }).join(''),
    };
  }
  
  // Проверка омонимов: для mirror и bridge — флаг requiresClarification для подсветки UI
  let requiresClarification = false;
  const homonyms = detectHomonymsInText(text);
  if (homonyms.length > 0) {
    requiresClarification = true;
  }

  // ШАГ 1: НОРМАЛИЗАЦИЯ
  let normalized = text;

  // MIRROR: только базовая нормализация пробелов, БЕЗ замен слов. Метаданные омонимов — через requiresClarification.
  if (preset === 'mirror') {
    normalized = normalized.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/\)([а-яёА-ЯЁ\u0301])/g, ') $1'); // пробел после )
    return { text: normalized, requiresClarification };
  }

  normalized = normalized.replace(/(папа)\s*(и)\s*(мама)|(папаимама)/gi, (match) => {
    const isCapitalized = match[0] === match[0].toUpperCase();
    return isCapitalized ? 'Папа и мама' : 'папа и мама';
  });

  normalized = normalized.replace(/(Ростов)\s*[-]*\s*(на)\s*[-]*\s*(Дону)|(Ростовенадону)|(Роственадону)/gi, (match) => {
    const isCapitalized = match[0] === match[0].toUpperCase();
    return isCapitalized ? 'Ростове-на-Дону' : 'ростове-на-Дону';
  });

  normalized = normalized.replace(/(встеча)/gi, (match) => {
    const isCapitalized = match[0] === match[0].toUpperCase();
    return isCapitalized ? 'Встреча' : 'встреча';
  });
  
  // Режим SLANG: приоритет отдается упрощениям
  if (preset === 'slang') {
    normalized = normalized.replace(/\bвстреча\b/gi, (match) => {
      const isCapitalized = match[0] === match[0].toUpperCase();
      return isCapitalized ? 'Стрелка' : 'стрелка';
    });
    normalized = normalized.replace(/\b(папа|отец)\b/gi, (match) => {
      const isCapitalized = match[0] === match[0].toUpperCase();
      return isCapitalized ? 'Батя' : 'батя';
    });
    normalized = normalized.replace(/\bмама\b/gi, (match) => {
      const isCapitalized = match[0] === match[0].toUpperCase();
      return isCapitalized ? 'Матушка' : 'матушка';
    });
  }
  
  // ШАГ 2: ТОКЕНИЗАЦИЯ И СЛАЙДЕРЫ
  let tokens = tokenize(normalized);
  const calcWeights = calculateWeights(adjustedWeights);
  
  const allSlidersZero = Object.values(adjustedWeights).every(w => w === 0);
  const shouldApplyLibrary = (preset === 'bridge' || preset === 'transfigure') && !allSlidersZero;
  
  // Применяем ALTRO_LIBRARY замены по весам доменов
  const LIBRARY_WEIGHT_MAP: Record<string, keyof DomainWeights> = {
    imagery: 'imagery', ethics: 'ethics', context: 'context', intent: 'intent',
    semantics: 'semantics', semantic: 'semantics', sacred: 'ethics', history: 'history',
    aesthetics: 'aesthetics', culture: 'culture', politics: 'politics', economics: 'economics', technology: 'technology',
  };
  if (shouldApplyLibrary) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.isWhitespace || token.isPunctuation || token.isReplaced) continue;
      if (/[\u0301]/.test(token.original)) continue; // НЕ заменять слова с ударением — пользователь уже уточнил
      const word = token.original.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
      const isCapitalized = token.original[0] === token.original[0].toUpperCase();
      const libraryEntry = ALTRO_LIBRARY[word];
      
      if (libraryEntry) {
        let bestReplacement: string | null = null;
        let bestScore = 0;
        for (const [domainKey, entry] of Object.entries(libraryEntry)) {
          const weightKey = LIBRARY_WEIGHT_MAP[domainKey];
          if (!weightKey || !entry || typeof entry !== 'object' || !('text' in entry)) continue;
          const weight = Math.abs(adjustedWeights[weightKey] ?? 0);
          const threshold = (entry as { threshold?: number }).threshold ?? 0;
          if (weight >= threshold && weight > bestScore) {
            bestScore = weight;
            bestReplacement = (entry as { text: string }).text;
          }
        }
        if (bestReplacement) {
          const cleaned = bestReplacement.replace(/\s*\([^)]*\/[^)]*\)/g, '').trim();
          const finalReplacement = cleaned || bestReplacement.split(/\s*\(/)[0]?.trim() || bestReplacement;
          tokens[i] = {
            ...token,
            transformed: isCapitalized ? finalReplacement[0].toUpperCase() + finalReplacement.slice(1) : finalReplacement,
            isReplaced: true,
          };
        }
      }
    }
  }
  
  // ШАГ 3: ГРАММАТИЧЕСКИЙ МОДУЛЬ (упрощенная версия)
  // Полная версия грамматического согласования слишком сложная для переноса в один файл
  
  // ШАГ 4: СБОРКА (U+0301 сохраняется в capture)
  let result = detokenize(tokens);
  result = result.replace(/\)([а-яёА-ЯЁ\u0301])/g, ') $1');
  
  return { text: result, requiresClarification };
}

/** Функция diffHighlight: сравнивает sourceText и adaptedText, подсвечивает измененные слова */
export function diffHighlight(sourceText: string, adaptedText: string): string {
  if (!sourceText || !adaptedText) {
    return escapeHtml(adaptedText || '');
  }
  
  const sourceTokens = tokenize(sourceText);
  const adaptedTokens = tokenize(adaptedText);
  
  let result = escapeHtml(adaptedText);
  
  const changedWords = new Set<string>();
  
  const sourceWords: string[] = [];
  const adaptedWords: string[] = [];
  
  for (const token of sourceTokens) {
    if (!token.isWhitespace && !token.isPunctuation) {
      sourceWords.push(token.original.toLowerCase().trim());
    }
  }
  
  for (const token of adaptedTokens) {
    if (!token.isWhitespace && !token.isPunctuation) {
      adaptedWords.push(token.transformed.toLowerCase().trim());
    }
  }
  
  const maxLength = Math.max(sourceWords.length, adaptedWords.length);
  for (let i = 0; i < maxLength; i++) {
    const sourceWord = sourceWords[i] || '';
    const adaptedWord = adaptedWords[i] || '';
    
    if (sourceWord !== adaptedWord && sourceWord && adaptedWord) {
      changedWords.add(adaptedWord);
    }
    
    if ((sourceWord === 'моя' || sourceWord === 'мой' || sourceWord === 'моё') &&
        (adaptedWord === 'мой' || adaptedWord === 'моя' || adaptedWord === 'моё') &&
        sourceWord !== adaptedWord) {
      changedWords.add(adaptedWord);
    }
  }
  
  const sortedWords = Array.from(changedWords).sort((a, b) => b.length - a.length);
  
  for (const word of sortedWords) {
    const escapedWord = escapeHtml(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b(${escapedWord})\\b`, 'gi');
    result = result.replace(regex, (match) => {
      if (match.includes('<span') || match.includes('</span>')) return match;
      return `<span class="text-blue-400 underline">${match}</span>`;
    });
  }
  
  return result;
}

/** Функция оркестрации с HTML-оформлением
 * @param directive — Global Intent Overrider из Nexus Command (передаётся при SCAN)
 */
export function orchestrate(
  text: string, 
  weights: DomainWeights, 
  preset: 'mirror' | 'bridge' | 'transfigure' | 'slang' | null,
  scenario?: ScenarioType,
  directive?: string,
  oprPrism: number = 0,
  oprNegative?: boolean
): { text: string; notice: string | null; requiresClarification?: boolean } {
  if (typeof text !== 'string') {
    return { text: '', notice: null };
  }
  if (oprPrism >= 1) {
    return { text, notice: null };
  }
  const result = orchestrateText(text, weights, preset, scenario, oprPrism, oprNegative);
  const transformedText = result.text ?? '';
  const requiresClarification = result.requiresClarification;
  
  let outputText: string;
  let transcreationNotice: string | null = null;
  
  if (preset === 'mirror') {
    outputText = transformedText;
  } else if (preset === 'slang') {
    outputText = diffHighlight(text, transformedText);
  } else if (preset !== 'bridge' && preset !== 'transfigure') {
    outputText = transformedText;
  } else {
    const allSlidersZero = Object.values(weights).every((w) => Math.abs(w) < 1e-6);
    outputText = transformedText;
    if (!allSlidersZero) {
      const calcWeights = calculateWeights(weights);
      if ((preset === 'bridge' || preset === 'transfigure') && calcWeights.transcreationActive) {
        transcreationNotice = 'Транскреация с учетом исторической вертикали и ценности преемственности';
      }
    }
  }
  
  const finalText = outputText ?? transformedText ?? '';
  return { text: finalText, notice: transcreationNotice, requiresClarification };
}
