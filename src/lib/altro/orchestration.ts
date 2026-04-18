/**
 * MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer
 * Orchestration — Логика оркестрации и грамматики (слияние из altroEngine)
 */

import {
  ALTRO_LIBRARY,
  type DomainWeights,
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  HOMONYM_WORDS,
  SPELLCHECK_DICTIONARY,
  PROPER_NOUNS,
  type ScenarioType,
} from '@/lib/altroData';
import {
  calculateWeights,
  getActivePattern,
  areWeightsInStandby,
  applyScenarioCoefficients,
  applyOprModulation,
  calculateScenarioWeights,
} from '@/lib/altro/vectorEngine';
import {
  escapeHtml,
  applyAccentToWord,
  stripStressTagsLocal,
  buildAccentAwareWordRegex,
  hasStressMark,
  stripAdaptationMarkers,
  ensureMandatoryStress,
} from '@/lib/altro/textUtils';
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

export type { TextToken };

/** Semantic Suggestion: предложение исправления на основе контекста */
export interface SemanticSuggestion {
  phrase: string;
  suggestion: string;
  tokenIds: number[];
  lowConfidence?: boolean;
}

export { escapeHtml, applyAccentToWord, buildAccentAwareWordRegex, stripStressTagsLocal, stripAdaptationMarkers, ensureMandatoryStress } from '@/lib/altro/textUtils';
export { calculateWeights, getActivePattern, areWeightsInStandby, calculateScenarioWeights } from '@/lib/altro/vectorEngine';

/** Внутренние переменные для сброса при clearAll (стерильность при F5/перезапуске сервера). */
let _orchestrationFlushId = 0;

/** ALTRO Standard: Сброс контекстной памяти. Обнуляет все внутренние переменные — исключает конфликты ID при перезапуске. */
export function resetOrchestrationContext(): void {
  _orchestrationFlushId = 0;
}

function matchCaseOrchestration(source: string, replacement: string): string {
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

export function applyBaseCorrection(text: string): string {
  if (!text.trim()) return text;
  return text.replace(/\bна долго\b/gi, 'надолго');
}

export function transformPlain(text: string, mode: 'mirror' | 'transfigure' | 'slang' | null): string {
  if (!text.trim()) return text;
  let out = text;
  if (mode === 'slang') {
    out = out.replace(/\bфакт\b/giu, (m) => matchCaseOrchestration(m, 'пруф'));
    out = out.replace(/\bоппонентов\b/giu, (m) => matchCaseOrchestration(m, 'хейтеров'));
    out = out.replace(/\bоппоненты\b/giu, (m) => matchCaseOrchestration(m, 'хейтеры'));
    out = out.replace(/\bпутешествие\b/giu, (m) => matchCaseOrchestration(m, 'трип'));
  } else if (mode === 'transfigure') {
    out = out.replace(/\bфакт\b/giu, (m) => matchCaseOrchestration(m, 'аргумент'));
    out = out.replace(/\bвознамерился\b/giu, (m) => matchCaseOrchestration(m, 'направился'));
  }
  return out;
}

function tokenizeOrchestration(text: string): Token[] {
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
  return result.trim();
}

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
        isLocked: false,
      });
    }
  }

  return tokens;
}

export function detectContextualErrors(tokens: TextToken[]): SemanticSuggestion[] {
  const suggestions: SemanticSuggestion[] = [];

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

export function resolveHomonymByStress(word: string): string | null {
  if (!hasStressMark(word)) return null;

  const normalizedWord = word.normalize('NFD').replace(/[\u0301]/g, '').toLowerCase();

  for (const entry of HOMONYM_DB) {
    if (entry.base.toLowerCase() === normalizedWord) {
      const wordWithStress = word.normalize('NFD');
      for (const variant of entry.variants) {
        const variantNormalized = variant.word.normalize('NFD');
        if (variantNormalized.toLowerCase() === wordWithStress.toLowerCase()) {
          return variant.meaning;
        }
      }
    }
  }

  return null;
}

export function detectHomonymsInText(text: string): { word: string; position: number; resolved?: string }[] {
  const cleanText = stripStressTagsLocal(text);
  const foundHomonyms: { word: string; position: number; resolved?: string }[] = [];
  const processedPositions = new Set<number>();

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

        const matchedWord = match[0];
        const wordStart = matchIndex;
        const wordEnd = wordStart + matchedWord.length;

        const textSegment = cleanText.substring(Math.max(0, wordStart - 1), Math.min(cleanText.length, wordEnd + 1));
        if (hasStressMark(textSegment)) {
          const resolved = resolveHomonymByStress(cleanText.substring(wordStart, wordEnd));
          if (resolved) {
            foundHomonyms.push({ word: matchedWord, position: matchIndex, resolved });
            processedPositions.add(matchIndex);
          }
        }
      }
    }
  }

  for (const homonym of HOMONYM_WORDS) {
    const pattern = '\\b' + homonym.split('').map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(combining) + combining + '\\b';
    const regex = new RegExp(pattern, 'gi');
    let match;
    while ((match = regex.exec(cleanText)) !== null) {
      const matchIndex = match.index;
      if (processedPositions.has(matchIndex)) continue;

      const matchedWord = match[0];
      if (!hasStressMark(matchedWord)) {
        const matchedNorm = matchedWord.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        const isInDB = HOMONYM_DB.some((entry) => entry.base.toLowerCase() === matchedNorm);
        if (isInDB) {
          foundHomonyms.push({ word: matchedWord, position: matchIndex });
          processedPositions.add(matchIndex);
        }
      }
    }
  }

  return foundHomonyms;
}

function orchestrateText(
  text: string,
  weights: DomainWeights,
  preset: 'mirror' | 'transfigure' | 'slang' | null,
  scenario?: ScenarioType,
  oprPrism: number = 0,
  oprNegative?: boolean
): { text: string; requiresClarification?: boolean } {
  if (typeof text !== 'string' || !text.trim()) {
    return { text: '' };
  }
  const enhancedCriticism = oprNegative === true;

  let adjustedWeights = scenario ? applyScenarioCoefficients(weights, scenario) : weights;
  adjustedWeights = applyOprModulation(adjustedWeights, oprPrism);

  if (adjustedWeights.history <= -0.99) {
    return {
      text: text.split('').map((char) => {
        if (char === ' ') return ' ';
        if (char.match(/[.!?,;:]/)) return char;
        return char.charCodeAt(0) % 3 === 0 ? String.fromCharCode(0x200b) : char;
      }).join(''),
    };
  }

  let requiresClarification = false;
  const homonyms = detectHomonymsInText(text);
  if (homonyms.length > 0) requiresClarification = true;

  let normalized = text;

  if (preset === 'mirror') {
    normalized = normalized.trim().replace(/\s+/g, ' ');
    normalized = normalized.replace(/\)([а-яёА-ЯЁ\u0301])/g, ') $1');
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

  let tokens = tokenizeOrchestration(normalized);
  const calcWeights = calculateWeights(adjustedWeights);

  const allSlidersZero = Object.values(adjustedWeights).every((w) => w === 0);
  const shouldApplyLibrary = preset === 'transfigure' && !allSlidersZero;

  const LIBRARY_WEIGHT_MAP: Record<string, keyof DomainWeights> = {
    imagery: 'imagery', ethics: 'ethics', context: 'context', intent: 'intent',
    semantics: 'semantics', semantic: 'semantics', sacred: 'ethics', history: 'history',
    aesthetics: 'aesthetics', culture: 'culture', politics: 'politics', economics: 'economics', technology: 'technology',
  };
  if (shouldApplyLibrary) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.isWhitespace || token.isPunctuation || token.isReplaced) continue;
      if (/[\u0301]/.test(token.original)) continue;
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

  let result = detokenize(tokens);
  result = result.replace(/\)([а-яёА-ЯЁ\u0301])/g, ') $1');

  return { text: result, requiresClarification };
}

export function diffHighlight(sourceText: string, adaptedText: string): string {
  if (!sourceText || !adaptedText) {
    return escapeHtml(adaptedText || '');
  }

  const sourceTokens = tokenizeOrchestration(sourceText);
  const adaptedTokens = tokenizeOrchestration(adaptedText);

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

export function orchestrate(
  text: string,
  weights: DomainWeights,
  preset: 'mirror' | 'transfigure' | 'slang' | null,
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
  } else if (preset !== 'transfigure') {
    outputText = transformedText;
  } else {
    const allSlidersZero = Object.values(weights).every((w) => Math.abs(w) < 1e-6);
    outputText = transformedText;
    if (!allSlidersZero) {
      const calcWeights = calculateWeights(weights);
      if (preset === 'transfigure' && calcWeights.transcreationActive) {
        transcreationNotice = 'Транскреация с учетом исторической вертикали и ценности преемственности';
      }
    }
  }

  const finalText = outputText ?? transformedText ?? '';
  return { text: finalText, notice: transcreationNotice, requiresClarification };
}
