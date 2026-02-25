/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// License: MIT | SERGEI NAZARIAN (SVN). ALTRO — инструмент для частного анализа.

/**
 * ALTRO Engine — Логика расчёта весов 5 доменов, формирование промпта, оркестратор и валидатор
 * SCAN + Зеркало = единый механизм. Зеркало — Активная стерилизация (база для всех режимов).
 * U+0301 (combining acute accent) сохраняется во всех операциях очистки.
 * PRESERVE: Никакая sanitize/cleanup не должна удалять \u0301. Разрешённые символы: [а-яёА-ЯЁ\u0301] + пробелы, пунктуация.
 */

import type { DomainWeights } from '@/lib/altroData';
import { SPELLCHECK_CORRECTIONS, HOMONYM_DB, HOMONYM_WORD_FORMS } from '@/lib/altroData';
import type { WordDefinitions } from './dictionary';
import { calculateWeights, getSemanticDisplacementDirective, hasActiveDomainWeights } from './vectorEngine';
import { wrapStressTags, stripStressTags, applyDeclensionFixes, extractAccentedWords, countWords } from './textUtils';

/** Слова с двойным смыслом (омонимы), включая словоформы: замок, замка, замке и т.д. */
const HOMONYM_FORMS = new Set([
  ...HOMONYM_DB.map((e) => e.base.toLowerCase()),
  ...Object.keys(HOMONYM_WORD_FORMS).map((k) => k.toLowerCase()),
]);

export type PresetMode = 'mirror' | 'bridge' | 'transfigure' | 'slang';

export type ScenarioType = 'without' | 'poetics' | 'technocrat' | 'sacred' | 'goldStandard';

/** Калибровка ALTRO: 5 внутренних (0–100) + 8 внешних (-1..1) + OPR (-1..1) + сценарий */
export interface AltroCalibration {
  internal: {
    semantics: number;
    context: number;
    intent: number;
    imagery: number;
    ethics: number;
  };
  external: {
    economics: number;
    politics: number;
    society: number;
    history: number;
    culture: number;
    aesthetics: number;
    technology: number;
    religion: number;
  };
  opr?: number;
  scenario: ScenarioType;
}

export type { CalculatedWeights } from './vectorEngine';

/** Порог «жёсткого нуля»: |вес| <= 0.1 = инструкция домена ВООБЩЕ не попадает в промпт */
const DOMAIN_THRESHOLD = 0.1;

/** Порог проникновения домена (PLATO'S PROJECTORS): при > 50% разрешаем отраслевой тезаурус */
const DOMAIN_PENETRATION_THRESHOLD = 0.5;

/** Отраслевые тезаурусы для PLATO'S PROJECTORS */
const DOMAIN_THESAURUS: Record<string, string[]> = {
  economics: ['ресурс', 'актив', 'объект', 'транзакция', 'верификация', 'ликвидность', 'актив', 'инвестиция', 'капитал'],
  politics: ['суверенитет', 'мандат', 'резолюция', 'коалиция', 'легитимность', 'консенсус'],
  society: ['сообщество', 'интеграция', 'солидарность', 'идентичность', 'мобильность'],
  history: ['преемственность', 'наследие', 'хроника', 'летопись', 'память'],
  culture: ['традиция', 'канон', 'символ', 'архетип', 'нарратив'],
  aesthetics: ['гармония', 'ритм', 'контраст', 'текстура', 'композиция'],
  technology: ['интерфейс', 'протокол', 'алгоритм', 'модуль', 'синхронизация'],
  religion: ['дух', 'вера', 'бытие', 'вечность', 'обитель', 'храм', 'тайна', 'обет', 'печать', 'сакральное', 'трансценденция'],
};


/** Зеркало: Strict JSON Mode — решает проблему пустого результата */
const MIRROR_LIGHT_PROMPT = `Верни JSON объект с полем text, где в словах-омонимах проставлены знаки \u0301. Больше ничего не пиши.`;

/** Параметры для формирования системного промпта транскреации */
export interface BuildPromptParams {
  mode: PresetMode;
  calibration: AltroCalibration;
  targetLanguage?: string;
  goldenReserveWords?: Array<{ word: string; tokenId: number; definitions: WordDefinitions }>;
  /** Текст для проверки наличия ударений (U+0301) */
  sourceText?: string;
  /** Директива из Командного модуля (Ваша Воля) — высший приоритет */
  directive?: string;
  /** false = DOMAIN SILENCE: Домены не модифицируют. Текст калибровочный. */
  isFinalAdaptation?: boolean;
}

/** Список активных доменов для короткого промпта */
function getActiveDomainsList(calibration: AltroCalibration): string[] {
  const { external, internal } = calibration;
  const INT_TH = 10;
  const domains: string[] = [];
  if (internal.semantics > INT_TH) domains.push('Семантика');
  if (internal.context > INT_TH) domains.push('Контекст');
  if (internal.intent > INT_TH) domains.push('Намерение');
  if (internal.imagery > INT_TH) domains.push('Образность');
  if (internal.ethics > INT_TH) domains.push('Этика');
  if (Math.abs(external.economics) > DOMAIN_THRESHOLD) domains.push('Экономика');
  if (Math.abs(external.aesthetics) > DOMAIN_THRESHOLD) domains.push('Эстетика');
  if (Math.abs(external.politics) > DOMAIN_THRESHOLD) domains.push('Политика');
  if (external.society > DOMAIN_THRESHOLD) domains.push('Общество');
  if (Math.abs(external.history) > DOMAIN_THRESHOLD) domains.push('История');
  if (Math.abs(external.culture) > DOMAIN_THRESHOLD) domains.push('Культура');
  if (Math.abs(external.technology) > DOMAIN_THRESHOLD) domains.push('Технологии');
  return domains;
}

/**
 * Формирует системный промпт для LLM. Сухая инструкция — быстрый первый токен.
 */
export function buildSystemPrompt(params: BuildPromptParams): string {
  const { mode, calibration, targetLanguage, directive, isFinalAdaptation = true } = params;

  if (mode === 'mirror') {
    return MIRROR_LIGHT_PROMPT;
  }

  if (!isFinalAdaptation) {
    return `DOMAIN SILENCE: Текст калибровочный. Домены не имеют права модифицировать входящую строку. Верни текст БЕЗ ИЗМЕНЕНИЙ. Вывод: ТОЛЬКО чистый текст.`;
  }

  const domains = getActiveDomainsList(calibration);
  const domainsStr = domains.length > 0 ? domains.join(', ') : '—';
  const { semantics = 0, imagery = 0 } = calibration.internal ?? {};
  const history = Math.abs(calibration.external?.history ?? 0) * 100;
  const semantics100 = semantics >= 99;
  const imagery100 = imagery >= 99;
  const history100 = history >= 99;
  const domainLock100 = semantics100 && imagery100 && history100;

  const external = calibration.external ?? {};
  const domainPenetrationActive = (
    (external.economics ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.politics ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.society ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.history ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.culture ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.aesthetics ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.technology ?? 0) > DOMAIN_PENETRATION_THRESHOLD ||
    (external.religion ?? 0) > DOMAIN_PENETRATION_THRESHOLD
  );

  const activeThesaurusDomains: string[] = [];
  if ((external.economics ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('economics');
  if ((external.politics ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('politics');
  if ((external.society ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('society');
  if ((external.history ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('history');
  if ((external.culture ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('culture');
  if ((external.aesthetics ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('aesthetics');
  if ((external.technology ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('technology');
  if ((external.religion ?? 0) > DOMAIN_PENETRATION_THRESHOLD) activeThesaurusDomains.push('religion');

  const oprVal = (calibration.opr ?? 0) * 100;
  const dynamicSynthesisActive = oprVal < 100 && domainPenetrationActive;

  const imageryVal = calibration.internal?.imagery ?? 0;
  const spiritVal = ((calibration.external?.religion ?? 0) + 1) / 2 * 100;
  const domainWeightsActive = hasActiveDomainWeights(calibration);
  const autoDirectiveActive = !directive?.trim() && domainWeightsActive;

  let prompt = `ФОРМУЛА: INPUT + ACCENTS + DOMAIN_WEIGHTS = TRANS_CREATION.

ALTRO LIBRA: Анализируй входящий текст на юридические и этические риски (согласно законодательству РФ и нормам безопасности). При обнаружении потенциально сенситивного контента сохраняй точность воспроизведения, но не разделяй данные взгляды.

VECTOR DISPLACEMENT: Домены — не добавление слов, а искривление семантического поля. [STRESS] и \u0301 — неизменные константы. Вокруг них строится новый контекст. Результат: изоморфный (структура сохранена), семантически перекалиброванный.

ACCENTS: U+0301 и [STRESS] — неизменны. Слова с \u0301 — якорь: не склонять, не менять форму.
OPR: Ударения пользователя — закон. Необычный контекст (напр. «доро́г» как ценность) — оправдать, не менять структуру.
ISOMORPHISM: НЕ означает идентичность слов. Ты ОБЯЗАН менять эпитеты и контекст согласно весам Доменов, сохраняя НЕИЗМЕННЫМИ только токены с \u0301 и общую структуру. 1 слово = 1 концепт. Не добавлять объекты (туманы, горы).
MORPHOLOGY: Замо́к (запор) → на замке́; за́мок (строение) → на за́мке.
PHYSICAL: Глаголы действия (повесить, запереть) → объект-устройство (замо́к), не строение (за́мок).
`;
  if (directive?.trim()) {
    prompt += `DIRECTIVE: ${directive.trim()}\n`;
  } else if (autoDirectiveActive) {
    prompt += `ZERO-DIRECTIVE MODE: Командная строка пуста, но слайдеры сдвинуты. Трансформация ОБЯЗАТЕЛЬНА. Веса доменов = директива.\n`;
  }
  if (domainWeightsActive) {
    const displacement = getSemanticDisplacementDirective(calibration);
    if (displacement) prompt += `\n${displacement}\n`;
  }
  if (!directive?.trim() && !autoDirectiveActive) {
    prompt += `DOMAIN WEIGHTS = директива. Адаптировать по весам.\n`;
  }
  prompt += `Домены: ${domainsStr}. Вывод: ТОЛЬКО чистый текст.`;
  if (domainLock100) prompt += ` 100/100/100: глубокая транскреация, метафоры, ударения OPR.`;
  const contextVal = calibration.internal?.context ?? 0;
  if (imageryVal > 70 && !domainLock100) prompt += ` Образность>70: метафоры.`;
  if (spiritVal > 70) prompt += ` Духовность>70: экзистенциальный план.`;
  if (imageryVal > 70 && contextVal < imageryVal) prompt += ` Грамматика приоритетнее метафор: путь→вел, дорога→вела.`;
  const ethicsVal = calibration.internal?.ethics ?? 0;
  if (ethicsVal > 80) prompt += ` Этика>80: без абсурда омонимов.`;
  if (targetLanguage) prompt += ` Язык: ${targetLanguage}.`;
  if (oprVal >= 0) prompt += ` OPR: ${oprVal.toFixed(0)}%.`;

  if (domainPenetrationActive) {
    prompt += `\nPLATO: тезаурус домена.`;
    for (const d of activeThesaurusDomains) {
      const terms = DOMAIN_THESAURUS[d];
      if (terms?.length) {
        const label = d === 'economics' ? 'Экономика' : d === 'politics' ? 'Политика' : d === 'society' ? 'Общество' : d === 'history' ? 'История' : d === 'culture' ? 'Культура' : d === 'aesthetics' ? 'Эстетика' : d === 'technology' ? 'Технологии' : d === 'religion' ? 'Религия' : d;
        prompt += ` ${label}: ${terms.slice(0, 6).join(', ')}.`;
      }
    }
    if ((external.religion ?? 0) > DOMAIN_PENETRATION_THRESHOLD) prompt += ` SACRED: за́мок→Обитель, замо́к→Обет.`;
  }
  if (dynamicSynthesisActive) prompt += `\nDYNAMIC: омонимы U+0301 + сетка домена.`;

  return prompt;
}

/** Известные технические правки (слипшиеся слова) для валидатора. вКрасноярске: предлог + имя собственное. */
const CONCATENATION_FIXES: Record<string, string> = {
  'папаимама': 'папа и мама',
  'Папаимама': 'Папа и мама',
  'ростовенадону': 'Ростове-на-Дону',
  'Ростовенадону': 'Ростове-на-Дону',
  'вКрасноярске': 'в Красноярске',
  'вкрасноярске': 'в Красноярске',
};

/** Согласование рода: технические константы Протокола ALTRO. U+0301 сохраняется.
 * DOMAIN ALIGNMENT: грамматическая целостность (Integrity) ПРИОРИТЕТНЕЕ метафор (Образность).
 * Путь (м.р.) → вел; дорога (ж.р.) → вела. */
const GENDER_AGREEMENT_FIXES: Array<{ pattern: RegExp; toWord: string; fromWord: string }> = [
  { pattern: /\b(крепость)\s+(мой)\b/gi, toWord: 'крепость', fromWord: 'моя' },
  { pattern: /\b(крепость)\s+(твой)\b/gi, toWord: 'крепость', fromWord: 'твоя' },
  { pattern: /\b(обитель)\s+(мой)\b/gi, toWord: 'обитель', fromWord: 'моя' },
  { pattern: /\b(обитель)\s+(твой)\b/gi, toWord: 'обитель', fromWord: 'твоя' },
  { pattern: /\b(мой)\s+(крепость)\b/gi, toWord: 'моя', fromWord: 'крепость' },
  { pattern: /\b(мой)\s+(обитель)\b/gi, toWord: 'моя', fromWord: 'обитель' },
  { pattern: /\b(твой)\s+(крепость)\b/gi, toWord: 'твоя', fromWord: 'крепость' },
  { pattern: /\b(твой)\s+(обитель)\b/gi, toWord: 'твоя', fromWord: 'обитель' },
];

function matchCase(source: string, target: string): string {
  if (source.length > 0 && source[0] === source[0].toUpperCase()) {
    return target.length > 0 ? target[0].toUpperCase() + target.slice(1) : target;
  }
  return target;
}

/**
 * Активная стерилизация: регистр + род. Сохраняет U+0301.
 * SCAN использует эту логику как БАЗУ для всех режимов.
 * Mirror Integrity: первая буква НИКОГДА не переводится в нижний регистр — только в верхний при необходимости.
 */
export function applyMirrorSterilization(text: string): string {
  if (!text?.trim()) return text || '';
  let result = text.trim();
  result = result.replace(/\s+/g, ' '); // Только пробелы; U+0301 (Combining Acute Accent) не в \s — сохраняется
  const firstLetter = result.match(/[а-яёА-ЯЁa-zA-Z]/);
  if (firstLetter && firstLetter.index !== undefined && firstLetter[0] === firstLetter[0].toLowerCase()) {
    const idx = firstLetter.index;
    result = result.slice(0, idx) + firstLetter[0].toUpperCase() + result.slice(idx + 1);
  }
  for (const { pattern, toWord, fromWord } of GENDER_AGREEMENT_FIXES) {
    result = result.replace(pattern, (_, p1: string, p2: string) => {
      const fixed1 = matchCase(p1, toWord);
      const fixed2 = matchCase(p2, fromWord);
      return `${fixed1} ${fixed2}`;
    });
  }
  // DOMAIN ALIGNMENT: путь (м.р.) → вел; грамматическая целостность приоритетнее метафор
  result = result.replace(/\b(путь|Путь)\s+((?:[^\s]+\s+)*)вела\b/gi, (_, path: string, middle: string) => path + (middle ? ' ' + middle : ' ') + 'вел');
  result = result.replace(/\b(путь|Путь)\s+((?:[^\s]+\s+)*)вело\b/gi, (_, path: string, middle: string) => path + (middle ? ' ' + middle : ' ') + 'вел');
  return result.trim();
}

/** Результат поиска омонимов */
export interface HomonymScanResult {
  has_homonyms: boolean;
  words: string[];
}

/**
 * detectHomonyms: поиск омонимов в тексте (замок, стоит и т.д.).
 * Возвращает массив слов с двойным смыслом для кнопки «УТОЧНИТЬ ОМОНИМ».
 * Слова с ударением (\\u0301) игнорируются — ударение снимает неопределённость.
 */
export function detectHomonyms(text: string): string[] {
  if (!text?.trim()) return [];
  const cleanText = stripStressTags(text);
  const found = new Set<string>();
  const combining = '[\\u0300-\\u036f]*';
  for (const form of HOMONYM_FORMS) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = '\\b' + escaped.split('').join(combining) + combining + '\\b';
    const re = new RegExp(pattern, 'gi');
    let m;
    while ((m = re.exec(cleanText)) !== null) {
      if (!/[\u0301]/.test(m[0])) {
        const base = HOMONYM_WORD_FORMS[form] ?? form;
        found.add(base);
        break;
      }
    }
  }
  return Array.from(found);
}

/** Результат: has_homonyms и массив слов (для обратной совместимости) */
export function findHomonyms(text: string): HomonymScanResult {
  const words = detectHomonyms(text);
  return { has_homonyms: words.length > 0, words };
}

/** FROM LOG TO ACTION: возвращает омонимы с массивом вариантов для HomonymSelector */
export function getHomonymWordsWithVariants(text: string): { word: string; baseWord: string; variants: { word: string; meaning: string }[] }[] {
  const words = detectHomonyms(text);
  return words.map((baseWord) => {
    const entry = HOMONYM_DB.find((e) => e.base.toLowerCase() === baseWord.toLowerCase());
    return { word: baseWord, baseWord, variants: entry?.variants ?? [] };
  });
}

/** Результат валидации входного и выходного текста */
export interface SemanticValidationResult {
  semantic_ok: boolean;
  /** Описание причин, если semantic_ok === false */
  reason?: string;
}

/** Типичные ошибки согласования рода: местоимение м.р. + сущ. ж.р. или сущ. ж.р. + местоимение м.р. */
const GENDER_ERRORS = [
  /\bмой\s+крепость\b/gi,
  /\bмой\s+обитель\b/gi,
  /\bмой\s+цитадель\b/gi,
  /\bтвой\s+крепость\b/gi,
  /\bтвой\s+обитель\b/gi,
  /\bнаш\s+крепость\b/gi,
  /\bваш\s+крепость\b/gi,
  /\bкрепость\s+мой\b/gi,
  /\bкрепость\s+твой\b/gi,
  /\bобитель\s+мой\b/gi,
  /\bобитель\s+твой\b/gi,
];

/**
 * Проверка явных ошибок: регистр, пробелы, точки, род.
 * Semantic OK только если ВСЕ пункты выполнены.
 */
export function hasNoObviousErrors(text: string): boolean {
  if (!text?.trim()) return true;
  const t = text.trim();
  if (t.length === 0) return true;
  const firstLetter = t.match(/[а-яёА-ЯЁa-zA-Z]/);
  if (firstLetter && firstLetter[0] === firstLetter[0].toLowerCase()) return false;
  if (/\s{2,}/.test(t)) return false;
  if (/\.{2,}/.test(t)) return false;
  if (/\s+([.,!?;:])/.test(t) || /([.,!?;:])\S/.test(t)) return false;
  if (/\bв[Кк]расноярске\b|папаимама|вкрасноярске/i.test(t)) return false; // слипшиеся слова
  for (const re of GENDER_ERRORS) {
    if (re.test(t)) return false;
  }
  return true;
}

/**
 * Валидатор: сравнивает входной и выходной текст.
 * Если правки носят только технический характер (опечатки, слипшиеся слова, пунктуация) — semantic_ok: true.
 */
export function validateSemanticChanges(inputText: string, outputText: string): SemanticValidationResult {
  const normalize = (s: string) =>
    s
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();

  const inNorm = normalize(inputText);
  const outNorm = normalize(outputText);

  if (inNorm === outNorm) {
    return { semantic_ok: true };
  }

  // Применяем известные технические правки к входу
  let expected = inputText;
  const allFixes: Record<string, string> = { ...SPELLCHECK_CORRECTIONS, ...CONCATENATION_FIXES };
  for (const [from, to] of Object.entries(allFixes)) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    expected = expected.replace(re, to);
  }

  const expectedNorm = normalize(expected);
  if (expectedNorm === outNorm) {
    return { semantic_ok: true };
  }

  // Допускаем незначительные отличия пунктуации (лишние/убраные пробелы вокруг знаков)
  const expectedClean = expectedNorm.replace(/\s*([.,!?;:]+)\s*/g, '$1 ');
  const outClean = outNorm.replace(/\s*([.,!?;:]+)\s*/g, '$1 ');
  if (expectedClean === outClean) {
    return { semantic_ok: true };
  }

  return {
    semantic_ok: false,
    reason: 'Обнаружены семантические изменения, выходящие за рамки технических правок',
  };
}

/** Параметры запроса к Ollama */
export interface OllamaRequestParams {
  text: string;
  mode: PresetMode;
  calibration?: AltroCalibration;
  targetLanguage?: string;
  goldenReserveWords?: Array<{ word: string; tokenId: number; definitions: WordDefinitions }>;
  forcePreserveAccents?: boolean;
  /** Директива из Командного модуля (Ваша Воля) */
  directive?: string;
  /** false = DOMAIN SILENCE. true по умолчанию для Phase 2 (ADAPT). */
  isFinalAdaptation?: boolean;
  /** Стриминг: callback для пословного вывода. При наличии — stream: true. */
  onChunk?: (chunk: string) => void;
  /** Уникальный ID сессии — очистка контекста Ollama перед каждым запросом */
  sessionId?: string;
}


/** Параметры конфигурации Ollama */
export interface OllamaConfig {
  baseUrl?: string;
  model?: string;
}

const DEFAULT_OLLAMA_CONFIG: Required<OllamaConfig> = {
  baseUrl: 'http://localhost:11434',
  model: 'qwen2.5:14b',
};

export { wrapStressTags, stripStressTags, applyDeclensionFixes, extractAccentedWords } from './textUtils';

/** Парсинг JSON-ответа Mirror: {"text": "..."}. При неудаче — fallback. */
function extractMirrorTextFromJson(rawContent: string, fallback: string): string {
  const trimmed = rawContent?.trim();
  if (!trimmed) return fallback;
  try {
    const parsed = JSON.parse(trimmed) as { text?: string };
    if (typeof parsed?.text === 'string') return parsed.text || fallback;
  } catch {
    /* не JSON — используем raw или fallback */
  }
  return trimmed || fallback;
}

/** ALTRO LIBRA: дисклеймеры только для transfigure (mirror — без них для ускорения SCAN) */
const LIBRA_DISCLAIMER_TRANSFIGURE_ETHICS =
  'Внимание: Данная адаптация является результатом частного использования инструмента семантической оркестровки. Ответственность за распространение несет пользователь. License: MIT | SERGEI NAZARIAN (SVN).';

function applyLibraPostProcessing(
  finalText: string,
  params: { mode: PresetMode; calibration?: AltroCalibration; text?: string }
): string {
  let result = stripStressTags(finalText);
  result = applyDeclensionFixes(result);
  // Защита изоморфизма: если длина ответа LLM (в словах) не совпадает с входом — вернуть оригинал
  if (params.mode === 'mirror' && params.text != null && countWords(result) !== countWords(params.text)) {
    result = params.text;
  }
  // Дисклеймеры только для transfigure (mirror — без них для ускорения SCAN)
  if (
    params.mode === 'transfigure' &&
    (params.calibration?.internal?.ethics ?? 0) > 50
  ) {
    result += `\n\n---\n[ALTRO LIBRA] ${LIBRA_DISCLAIMER_TRANSFIGURE_ETHICS}`;
  }
  return result;
}

/**
 * AltroOrchestrator — класс оркестрации запросов к Ollama.
 * Принцип Нулевой Точки: в режиме Зеркало формирует запрос только на исправление опечаток, ошибок и пунктуации.
 * Влияние всех 5 доменов принудительно равно 0.
 */
export class AltroOrchestrator {
  private config: Required<OllamaConfig>;

  constructor(config: OllamaConfig = {}) {
    this.config = { ...DEFAULT_OLLAMA_CONFIG, ...config };
  }

  /**
   * Формирует payload для Ollama.
   * В режиме mirror: только промпт на исправление ошибок, веса доменов = 0.
   */
  buildOllamaPayload(params: OllamaRequestParams): {
    model: string;
    messages: Array<{ role: 'system' | 'user'; content: string }>;
    options?: Record<string, unknown>;
    keep_alive?: string;
  } {
    const { text, mode } = params;

    let systemPrompt =
      mode === 'mirror'
        ? buildSystemPrompt({ mode: 'mirror', calibration: {} as AltroCalibration, isFinalAdaptation: params.isFinalAdaptation ?? true })
        : buildSystemPrompt({
            mode,
            calibration: params.calibration!,
            targetLanguage: params.targetLanguage,
            goldenReserveWords: params.goldenReserveWords,
            sourceText: params.text,
            directive: params.directive,
            isFinalAdaptation: params.isFinalAdaptation ?? true,
          });
    if (params.sessionId) {
      systemPrompt = `[Session: ${params.sessionId}]\n${systemPrompt}`;
    }

    const textWithStressTags = wrapStressTags(text);
    const accentedWords = extractAccentedWords(text);
    let userContent = textWithStressTags;
    if (accentedWords.length > 0) {
      userContent += `\n[STRESS] Сохрани: ${accentedWords.join(', ')}`;
    }

    const base = {
      model: this.config.model,
      messages: [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userContent },
      ],
      options:
        mode === 'mirror'
          ? { temperature: 0.4, top_p: 0.9, presence_penalty: 0.0, num_predict: 100 }
          : { temperature: 0.4, top_p: 0.9, presence_penalty: 0.0 },
      keep_alive: '10m',
    };
    if (params.forcePreserveAccents) {
      return {
        ...base,
        forcePreserveAccents: true,
        internalDomains: { semantics: 0, context: 0, intent: 0, imagery: 0, ethics: 0 },
        civilizational: 0,
        opr: 0,
      } as ReturnType<AltroOrchestrator['buildOllamaPayload']>;
    }
    return base;
  }

  /** Проверка наличия омонимов в тексте; возвращает has_homonyms для индикатора */
  scanHomonyms(text: string): HomonymScanResult {
    return findHomonyms(text);
  }

  /** Код ошибки при пустом/невалидном JSON ответе — не очищать поле Адаптации */
  static readonly OPR_RESONANCE_ERROR = 'ALTRO: Ожидание резонанса OPR...';

  /** HARD LIMIT: при превышении — retry с упрощённым промптом (сохранить [STRESS]) */
  static readonly REGENERATION_TIMEOUT_MS = 600_000;

  /** Сообщение для UI при 502 — показывать в поле Адаптации */
  static readonly ERROR_502_MESSAGE = '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]';

  /**
   * Отправляет запрос к Ollama и возвращает результат.
   * При onChunk — stream: true, результат пословно в callback.
   * Пре-процессинг: [STRESS] теги. Пост-процессинг: удаление тегов.
   */
  async request(params: OllamaRequestParams): Promise<string> {
    const url = typeof window !== 'undefined' ? '/api/transcreate' : `${this.config.baseUrl}/api/chat`;

    const doFetch = async (signal?: AbortSignal) => {
      const payload = this.buildOllamaPayload(params);
      const fullPayload = { ...payload, stream: true };
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullPayload),
        signal,
      });
    };

    try {
      const payload = this.buildOllamaPayload(params);
      if (typeof window !== 'undefined') {
        console.log('SENDING TO LLM:', { model: payload.model, stream: true, sessionId: params.sessionId });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), AltroOrchestrator.REGENERATION_TIMEOUT_MS);

      let response: Response;
      try {
        response = await doFetch(controller.signal);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        if (fetchErr instanceof Error && fetchErr.name === 'AbortError') {
          const simplifiedParams: OllamaRequestParams = {
            ...params,
            onChunk: undefined,
            directive: `УПРОЩЕНИЕ: Метафоры упрости. Сохрани ВСЕ [STRESS] токены и \u0301 в неприкосновенности. Вывод: ТОЛЬКО чистый текст.`,
          };
          const fallbackPayload = this.buildOllamaPayload(simplifiedParams);
          const fallbackRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...fallbackPayload, stream: false }),
          });
          if (!fallbackRes.ok) {
            const msg = fallbackRes.status === 502 ? AltroOrchestrator.ERROR_502_MESSAGE : `Ollama request failed: ${fallbackRes.status}`;
            throw new Error(msg);
          }
          const rawBody = await fallbackRes.text();
          if (!rawBody?.trim()) throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
          let data: { message?: { content?: string } } | null = null;
          try {
            data = JSON.parse(rawBody) as { message?: { content?: string } };
          } catch {
            throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
          }
          let finalText = data?.message?.content?.trim() ?? params.text;
          if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
          return applyLibraPostProcessing(finalText, params);
        }
        throw fetchErr;
      }
      clearTimeout(timeoutId);

      if (!response.ok) {
        const msg = response.status === 502 ? AltroOrchestrator.ERROR_502_MESSAGE : `Ollama request failed: ${response.status} ${response.statusText}`;
        throw new Error(msg);
      }

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';
        // stream: true сохраняет состояние между чанками — \u0301 и др. multi-byte UTF-8 не разрываются
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
              const chunk = obj?.message?.content ?? '';
              if (chunk) {
                fullText += chunk;
                params.onChunk?.(chunk);
              }
            } catch {
              /* skip malformed line */
            }
          }
        }
        if (buffer.trim()) {
          try {
            const obj = JSON.parse(buffer) as { message?: { content?: string } };
            const chunk = obj?.message?.content ?? '';
            if (chunk) {
              fullText += chunk;
              params.onChunk?.(chunk);
            }
          } catch {
            /* skip */
          }
        }
        let finalText = fullText.trim() || params.text;
        if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
        return applyLibraPostProcessing(finalText, params);
      }

      const rawBody = await response.text();
      if (!rawBody?.trim()) throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
      let data: { message?: { content?: string } } | null = null;
      try {
        data = JSON.parse(rawBody) as { message?: { content?: string } };
      } catch {
        throw new Error(AltroOrchestrator.OPR_RESONANCE_ERROR);
      }
      let finalText = data?.message?.content?.trim() ?? params.text;
      if (params.mode === 'mirror') finalText = extractMirrorTextFromJson(finalText, params.text);
      return applyLibraPostProcessing(finalText, params);
    } catch (err) {
      if (typeof window !== 'undefined') console.error('ALTRO CORE ERROR:', err);
      throw err;
    }
  }

  /**
   * Один вызов API: коррекция + поиск омонимов.
   */
  async requestMirrorCorrection(text: string): Promise<{ text: string; homonyms: string[]; semantic_ok: boolean }> {
    const corrected = await this.request({ text, mode: 'mirror' });
    const homonyms = detectHomonyms(corrected);
    const semanticOk = hasNoObviousErrors(corrected);
    return { text: corrected, homonyms, semantic_ok: semanticOk };
  }

  /**
   * process — главная точка входа для SCAN. Соединяет Ядро с UI.
   * @param text — входной текст
   * @param mode — режим (mirror | bridge | transfigure | slang)
   * @param sanitizer — опциональная функция санации (орфография, омонимы). Если передана — вызывается первым.
   * @param directive — опциональная директива из Nexus Command (передаётся при нажатии SCAN).
   */
  process(
    text: string,
    mode: PresetMode,
    sanitizer?: (input: string) => string,
    directive?: string
  ): string {
    const sanitized = sanitizer ? sanitizer(text) : text;
    if (mode === 'mirror') {
      return applyMirrorSterilization(sanitized);
    }
    return sanitized;
  }
}
