/**
 * MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Logic Layer
 * License: MIT | SERGEI NAZARIAN (SVN).
 *
 * altroLogic — Тяжёлая логика: Scan, Transcreation, омонимы, OPR SEAL.
 * Чистые функции без React-зависимостей.
 *
 * SEMANTIC SOVEREIGNTY (КОНСТАНТА): Если пользователь выбрал ударение для омонима
 * (например, за́мок — строение, замо́к — запор), LLM КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО менять
 * его смысл или ударение в итоговом тексте. Слова с U+0301 передаются в [STRESS] тегах.
 *
 * PLATO'S PROJECTORS: При весе внешнего домена (Экономика, Политика и т.д.) > 50%
 * ослаблена жёсткая блокировка семантического ядра. Разрешён отраслевой тезаурус.
 * DYNAMIC SYNTHESIS: При OPR < 100 система ищет баланс — сохранение омонимов + наложение сетки домена.
 *
 * STRICT ISOMORPHISM (1:1): 1 слово оригинала = 1 концепт в адаптации. Запрещено добавлять
 * новые объекты (туманы, истоки, горы), если их нет в исходном тексте.
 */

import {
  applyBaseCorrection,
  transformPlain,
  getActivePattern,
  tokenizeText,
  applyAccentToWord,
  buildAccentAwareWordRegex,
  orchestrate,
  resolveHomonymByStress,
  type TextToken,
  type SemanticSuggestion,
} from '@/lib/altroEngine';
import { buildAccentedWordWithCharCode } from '@/lib/altro/textUtils';
import {
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  SPELLCHECK_CORRECTIONS,
  SPELLCHECK_DICTIONARY,
  type DomainWeights,
  type ScenarioType,
} from '@/lib/altroData';
import { applyMirrorSterilization } from '@/lib/altro/engine';
import { fuzzySpellSuggest } from '@/lib/altro/spellUtils';

const SOURCE_HOMONYM_LIST = ['дела', 'органы', 'поводу', 'пропасть', 'предусмотреть', 'замок', 'белки', 'атлас', 'дорога', 'стоит'];

export type PresetId = 'mirror' | 'bridge' | 'transfigure' | 'slang' | null;

/** Проверка наличия ударения в слове */
export function wordHasStress(word: string): boolean {
  return /[\u0301]/.test(word) || /[аеёиоуыэюя]'/i.test(word);
}

/** Трансформация текста по пресету */
export function transform(text: string, preset: PresetId, weights: DomainWeights): string {
  if (!text.trim()) return text;
  let out = applyBaseCorrection(text);
  out = transformPlain(out, preset);
  return out;
}

/** Поиск экземпляров омонимов в тексте */
export function detectHomonymInstances(text: string): Array<{ id: string; word: string; position: number; baseWord: string }> {
  const instances: Array<{ id: string; word: string; position: number; baseWord: string }> = [];
  const tokens = tokenizeText(text);
  let pos = 0;
  const countMap = new Map<string, number>();
  for (const token of tokens) {
    if (!token.isPunctuation && !token.isWhitespace && token.isHomonym) {
      const form = token.word.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
      const baseWord = HOMONYM_WORD_FORMS[form] ?? form;
      const count = countMap.get(baseWord) ?? 0;
      countMap.set(baseWord, count + 1);
      instances.push({ id: `homonym_${baseWord}_${count}_${pos}`, word: token.word, position: pos, baseWord });
    }
    pos += token.word.length;
  }
  return instances;
}

/** Поиск омонимов из источника */
export function getHomonymWordsFromSource(text: string): string[] {
  const found = new Set<string>();
  for (const base of SOURCE_HOMONYM_LIST) {
    const re = new RegExp(`\\b${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (re.test(text)) found.add(base);
  }
  return Array.from(found);
}

export { buildAccentedWordWithCharCode } from '@/lib/altro/textUtils';

/** OPR SEAL: при oprWeight === 100 → output = input (предохранитель от галлюцинаций LLM) */
export function applyOprSeal(inputText: string, oprPrismValue: number): string | null {
  if (oprPrismValue === 100) return inputText;
  return null;
}

export interface RunCoreSanitationInput {
  inputText: string;
  validatedTokens: Set<number>;
  resolvedHomonyms: Map<string, string>;
  /** Контекст 0..1: при > 70% предлагать замену «Папа имама» → «Папа и мама» с повышенной уверенностью */
  contextWeight?: number;
}

export interface RunCoreSanitationResult {
  correctedTextResult: string;
  semanticSuggestions: SemanticSuggestion[];
  homonymRegistry: Map<number, { resolved: boolean; variant?: string }>;
  homonymInstances: Array<{ id: string; word: string; position: number; baseWord: string }>;
  resolvedHomonyms: Map<string, string>;
  textTokens: TextToken[];
  isCleaningComplete: boolean;
  semanticOkFlash: boolean;
  altroGoldenState: string;
}

/** Ядро санации: орфография, омонимы, семантика */
export function runCoreSanitation(input: RunCoreSanitationInput): RunCoreSanitationResult {
  const { inputText, validatedTokens, resolvedHomonyms, contextWeight = 0 } = input;
  const text = inputText;
  const tokens = tokenizeText(text);
  const suggestions: SemanticSuggestion[] = [];
  const newRegistry = new Map<number, { resolved: boolean; variant?: string }>();
  const autoResolved = new Map(resolvedHomonyms);
  const instances: Array<{ id: string; word: string; position: number; baseWord: string }> = [];
  const positionMap = new Map<string, number>();
  const processedTokens: TextToken[] = [];
  let runningPos = 0;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const isWord = !token.isPunctuation && !token.isWhitespace;

    if (isWord) {
      const lowerWord = token.word.toLowerCase();
      if (!token.isValidated && !validatedTokens.has(token.id)) {
        if (i + 2 < tokens.length) {
          const t2 = tokens[i + 1];
          const t3 = tokens[i + 2];
          if (t2?.isWhitespace && token.word.toLowerCase() === 'папа' && t3?.word?.toLowerCase() === 'имама') {
            const contextHigh = (contextWeight ?? 0) > 0.7;
            suggestions.push({ phrase: `${token.word} ${t3.word}`, suggestion: 'Папа и мама', tokenIds: [token.id, t3.id], lowConfidence: !contextHigh });
          }
        }
        if (token.isHomonym) {
          if (token.resolvedAccent) {
            newRegistry.set(token.id, { resolved: true, variant: token.resolvedAccent });
          } else if (wordHasStress(token.word)) {
            const resolved = resolveHomonymByStress(token.word);
            if (resolved) {
              const baseForDb = HOMONYM_WORD_FORMS[lowerWord] ?? lowerWord;
              const dbEntry = HOMONYM_DB.find((e) => e.base.toLowerCase() === baseForDb);
              if (dbEntry) {
                for (const v of dbEntry.variants) {
                  if (v.word && v.meaning === resolved) {
                    newRegistry.set(token.id, { resolved: true, variant: v.word });
                    autoResolved.set(`${lowerWord}_${runningPos}`, v.word);
                    break;
                  }
                }
              }
            }
          } else {
            newRegistry.set(token.id, { resolved: false });
            const baseWord = HOMONYM_WORD_FORMS[lowerWord] ?? lowerWord;
            const count = positionMap.get(baseWord) || 0;
            positionMap.set(baseWord, count + 1);
            instances.push({ id: `homonym_${baseWord}_${count}_${runningPos}`, word: token.word, position: runningPos, baseWord });
          }
        }
        runningPos += token.word.length;
      } else {
        runningPos += token.word.length;
      }
    } else {
      runningPos += token.word.length;
    }

    if (token.isValidated || validatedTokens.has(token.id)) {
      processedTokens.push({ ...token, isValidated: true });
      continue;
    }

    if (token.isMisspelled && isWord) {
      const lowerWord = token.word.toLowerCase().replace(/[\u0301]/g, '');
      let correction = SPELLCHECK_CORRECTIONS[lowerWord];

      if (!correction) {
        const fuzzy = fuzzySpellSuggest(token.word, SPELLCHECK_DICTIONARY);
        if (fuzzy) {
          if (fuzzy.confidence >= 0.7) {
            correction = fuzzy.correction;
          } else {
            const matchCase = (src: string, tgt: string) =>
              src[0] === src[0].toUpperCase() ? tgt[0].toUpperCase() + tgt.slice(1) : tgt;
            suggestions.push({
              phrase: token.word,
              suggestion: matchCase(token.word, fuzzy.correction),
              tokenIds: [token.id],
              lowConfidence: true,
            });
          }
        }
      }

      if (correction) {
        const matchCase = (src: string, tgt: string) =>
          src[0] === src[0].toUpperCase() ? tgt[0].toUpperCase() + tgt.slice(1) : tgt;
        const finalCorrection = matchCase(token.word, correction);
        processedTokens.push({
          ...token,
          word: finalCorrection,
          isMisspelled: false,
          spellCorrection: finalCorrection,
          isAccepted: true,
        });
        continue;
      }
    }

    if (token.isHomonym) {
      const registryEntry = newRegistry.get(token.id);
      if (registryEntry?.resolved && registryEntry.variant) {
        processedTokens.push({ ...token, resolvedText: registryEntry.variant, isAccepted: true });
        continue;
      }
    }

    processedTokens.push(token);
  }

  let correctedTextResult = processedTokens
    .map((t) => {
      if (t.resolvedText) return t.resolvedText;
      const registryEntry = newRegistry.get(t.id);
      if (registryEntry?.resolved && registryEntry.variant) return registryEntry.variant;
      if (t.resolvedAccent) return t.resolvedAccent;
      if (t.spellCorrection) return t.spellCorrection;
      return t.word;
    })
    .join('');
  correctedTextResult = correctedTextResult.replace(/\s+/g, ' ').trim();
  correctedTextResult = applyMirrorSterilization(correctedTextResult);

  const unresolvedHomonymsCount = Array.from(newRegistry.values()).filter((h) => !h.resolved).length;
  const hasErrors = suggestions.length > 0;
  const isCleaningOK = unresolvedHomonymsCount === 0 && !hasErrors;
  const altroGoldenState = correctedTextResult?.trim() ? correctedTextResult : '';

  return {
    correctedTextResult,
    semanticSuggestions: suggestions,
    homonymRegistry: newRegistry,
    homonymInstances: instances,
    resolvedHomonyms: autoResolved,
    textTokens: tokens,
    isCleaningComplete: isCleaningOK,
    semanticOkFlash: isCleaningOK,
    altroGoldenState,
  };
}

/** DATA ORCHESTRATION: входные данные для SCAN 2.0 (Synthesis Engine) */
export interface SynthesisScanInput {
  /** Source Text — исходник */
  sourceText: string;
  /** 5 Core Domains: Семантика, Контекст, Интент, Образность, Этика (0..1) */
  coreDomains: { semantics: number; context: number; intent: number; imagery: number; ethics: number };
  /** OPR Position: коэффициент «Зеркальности» 0..100. 100 = Идеальный подстрочник + опечатки */
  oprPosition: number;
  /** Directive: текст из Командного модуля (Ваша Воля) — высший приоритет */
  directive: string;
}

export interface RunScanInput {
  inputText: string;
  sourceText: string;
  activePreset: PresetId;
  domainWeights: DomainWeights;
  altroCalibration: {
    internal: { semantics: number; context: number; intent: number; imagery: number; ethics: number };
    external: { economics: number; politics: number; society: number; history: number; culture: number; aesthetics: number; technology: number; religion: number };
  };
  isCommitted: boolean;
  committedTokens: TextToken[];
  ALTRO_GOLDEN_STATE: string;
  mappedScenario: ScenarioType;
  nexusCommand: string;
  oprPrismValue: number;
  sanitizedText: string;
  /** SCAN phase: Домены не модифицируют. Только mirror/sanitized. */
  isScanPhase?: boolean;
}

export interface RunScanResult {
  mode: 'mirror' | 'transfigure' | 'pattern_only';
  mirrorText?: string;
  adaptationText?: string;
  displayedAdaptation?: string;
  altroGoldenState?: string;
  activePattern?: { id: string; name: string } | null;
}

/** Логика SCAN: зеркало, транскреация, OPR SEAL */
export function runScanLogic(input: RunScanInput): RunScanResult {
  const {
    activePreset,
    domainWeights,
    altroCalibration,
    ALTRO_GOLDEN_STATE,
    mappedScenario,
    nexusCommand,
    oprPrismValue,
    sanitizedText,
    inputText,
    sourceText,
    isCommitted,
    committedTokens,
    isScanPhase = false,
  } = input;

  if (isScanPhase) {
    const mirrorText = (sanitizedText && sanitizedText.trim()) ? sanitizedText : inputText || sourceText || '';
    return {
      mode: 'mirror',
      mirrorText: mirrorText?.trim() ? mirrorText : undefined,
      activePattern: null,
    };
  }

  const mode = activePreset || 'mirror';

  const allInternalSlidersZero =
    altroCalibration.internal.semantics === 0 &&
    altroCalibration.internal.context === 0 &&
    altroCalibration.internal.intent === 0 &&
    altroCalibration.internal.imagery === 0 &&
    altroCalibration.internal.ethics === 0;
  const allExternalSlidersZero =
    altroCalibration.external.economics === 0 &&
    altroCalibration.external.politics === 0 &&
    altroCalibration.external.society === 0 &&
    altroCalibration.external.history === 0 &&
    altroCalibration.external.culture === 0 &&
    altroCalibration.external.aesthetics === 0 &&
    altroCalibration.external.technology === 0 &&
    altroCalibration.external.religion === 0;
  const isMirrorMode = allInternalSlidersZero && allExternalSlidersZero;

  if (isMirrorMode || activePreset === 'mirror') {
    const mirrorText = (sanitizedText && sanitizedText.trim()) ? sanitizedText : inputText || sourceText || '';
    return {
      mode: 'mirror',
      mirrorText: mirrorText?.trim() ? mirrorText : undefined,
      activePattern: null,
    };
  }

  if (activePreset !== 'transfigure') {
    const pattern = getActivePattern(domainWeights);
    return { mode: 'pattern_only', activePattern: pattern };
  }

  let textForTranscreation: string;
  if (ALTRO_GOLDEN_STATE?.trim()) {
    textForTranscreation = ALTRO_GOLDEN_STATE.trim();
  } else {
    textForTranscreation = sanitizedText?.trim() || '';
  }

  if (!textForTranscreation?.trim()) {
    return { mode: 'transfigure' };
  }

  // OPR SEAL: при 100% output = input
  const sealed = applyOprSeal(textForTranscreation, oprPrismValue);
  if (sealed !== null) {
    return {
      mode: 'transfigure',
      adaptationText: sealed,
      displayedAdaptation: sealed,
      altroGoldenState: sealed,
    };
  }

  const result = orchestrate(
    textForTranscreation,
    domainWeights,
    'transfigure',
    mappedScenario,
    nexusCommand?.trim() || undefined,
    oprPrismValue / 100,
    oprPrismValue < 0
  );
  return {
    mode: 'transfigure',
    adaptationText: result.text,
    displayedAdaptation: result.text,
    altroGoldenState: result.text?.trim() ? result.text : undefined,
  };
}

export interface ApplyPresetInput {
  preset: 'mirror' | 'bridge' | 'transfigure' | 'slang';
  textToUse: string;
  domainWeights: DomainWeights;
  mappedScenario: ScenarioType;
  nexusCommand: string;
  oprPrismValue: number;
}

export interface ApplyPresetResult {
  displayedAdaptation: string;
  adaptationText: string;
}

/** Логика применения пресета с OPR SEAL */
export function applyPresetLogic(input: ApplyPresetInput): ApplyPresetResult | null {
  const { preset, textToUse, domainWeights, mappedScenario, nexusCommand, oprPrismValue } = input;
  if (!textToUse || preset === 'mirror') return null;

  const sealed = applyOprSeal(textToUse, oprPrismValue);
  if (sealed !== null) {
    return { displayedAdaptation: sealed, adaptationText: sealed };
  }

  const result = orchestrate(
    textToUse,
    domainWeights,
    preset,
    mappedScenario,
    nexusCommand?.trim() || undefined,
    oprPrismValue / 100,
    oprPrismValue < 0
  );
  return { displayedAdaptation: result.text, adaptationText: result.text };
}

export interface ApplyHomonymVariantSelectInput {
  tokenId: number;
  variantWord: string;
  textTokens: TextToken[];
  displayedAdaptation: string;
}

export interface ApplyHomonymVariantSelectResult {
  accentedWord: string;
  homonymRegistryUpdate: Map<number, { resolved: boolean; variant?: string }>;
  textTokensUpdate: TextToken[];
  rebuiltText: string;
  homonymReplaceHighlight: { start: number; end: number } | null;
  closePopup: boolean;
}

/**
 * Применение выбора омонима: вставка \u0301 СРАЗУ ПОСЛЕ ударной гласной в текст.
 */
export function applyHomonymVariantSelect(input: ApplyHomonymVariantSelectInput): ApplyHomonymVariantSelectResult {
  const { tokenId, variantWord, textTokens, displayedAdaptation } = input;
  const token = textTokens.find((t) => t.id === tokenId);

  const accentedWord =
    token && /[\u0301]/.test(variantWord)
      ? buildAccentedWordWithCharCode(token.word, variantWord)
      : token
        ? applyAccentToWord(token.word, variantWord)
        : variantWord;

  const homonymRegistryUpdate = new Map<number, { resolved: boolean; variant?: string }>();
  homonymRegistryUpdate.set(tokenId, { resolved: true, variant: accentedWord });

  const textTokensUpdate = textTokens.map((t) =>
    t.id === tokenId ? { ...t, resolvedAccent: accentedWord, resolvedText: accentedWord, isAccepted: true } : t
  );

  const base = displayedAdaptation || '';
  if (!base.trim() || !token) {
    return {
      accentedWord,
      homonymRegistryUpdate,
      textTokensUpdate,
      rebuiltText: base,
      homonymReplaceHighlight: null,
      closePopup: true,
    };
  }

  const tokenIndex = textTokens.findIndex((t) => t.id === tokenId);
  if (tokenIndex < 0) {
    return {
      accentedWord,
      homonymRegistryUpdate,
      textTokensUpdate,
      rebuiltText: base,
      homonymReplaceHighlight: null,
      closePopup: true,
    };
  }

  const adaptTokens = tokenizeText(base);
  if (tokenIndex >= adaptTokens.length) {
    const norm = (w: string) => w.normalize('NFD').replace(/[\u0301]/g, '').toLowerCase();
    const searchWord = token.word;
    const occurrenceIndex = textTokens
      .slice(0, tokenIndex)
      .filter((t) => norm(t.word) === norm(searchWord))
      .length;
    const wordRegex = buildAccentAwareWordRegex(searchWord);
    let match;
    let count = 0;
    let charStart = -1;
    let charEnd = -1;
    while ((match = wordRegex.exec(base)) !== null) {
      if (count === occurrenceIndex) {
        charStart = match.index;
        charEnd = match.index + match[0].length;
        break;
      }
      count++;
    }
    if (charStart < 0 || charEnd <= charStart) {
      return {
        accentedWord,
        homonymRegistryUpdate,
        textTokensUpdate,
        rebuiltText: base,
        homonymReplaceHighlight: null,
        closePopup: true,
      };
    }
    const rebuilt = base.slice(0, charStart) + accentedWord + base.slice(charEnd);
    const cleaned = rebuilt.replace(/\s{2,}/g, ' ');
    return {
      accentedWord,
      homonymRegistryUpdate,
      textTokensUpdate,
      rebuiltText: cleaned,
      homonymReplaceHighlight: { start: charStart, end: charStart + accentedWord.length },
      closePopup: true,
    };
  }

  let charStart = 0;
  for (let i = 0; i < tokenIndex; i++) charStart += adaptTokens[i].word.length;
  const targetToken = adaptTokens[tokenIndex];
  let charEnd = charStart + targetToken.word.length;
  const targetSlice = base.slice(charStart, charEnd);
  const norm = (w: string) => w.normalize('NFD').replace(/[\u0301]/g, '').toLowerCase();
  if (norm(targetSlice) !== norm(token.word)) {
    const occurrenceIndex = textTokens
      .slice(0, tokenIndex)
      .filter((t) => norm(t.word) === norm(token.word))
      .length;
    const wordRegex = buildAccentAwareWordRegex(token.word);
    let match;
    let count = 0;
    charStart = -1;
    charEnd = -1;
    while ((match = wordRegex.exec(base)) !== null) {
      if (count === occurrenceIndex) {
        charStart = match.index;
        charEnd = match.index + match[0].length;
        break;
      }
      count++;
    }
    if (charStart < 0 || charEnd <= charStart) {
      return {
        accentedWord,
        homonymRegistryUpdate,
        textTokensUpdate,
        rebuiltText: base,
        homonymReplaceHighlight: null,
        closePopup: true,
      };
    }
  }

  const rebuilt = base.slice(0, charStart) + accentedWord + base.slice(charEnd);
  const cleaned = rebuilt.replace(/\s{2,}/g, ' ');

  return {
    accentedWord,
    homonymRegistryUpdate,
    textTokensUpdate,
    rebuiltText: cleaned,
    homonymReplaceHighlight: { start: charStart, end: charStart + accentedWord.length },
    closePopup: true,
  };
}
