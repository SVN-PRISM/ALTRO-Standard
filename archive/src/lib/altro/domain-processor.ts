/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * domain-processor — Логика доменов: пороги, тезаурусы, активные домены для промпта.
 */

import type { DomainCalibration } from './types/altro';
export type { DomainCalibration } from './types/altro';

/** Порог «жёсткого нуля»: |вес| <= 0.1 = инструкция домена ВООБЩЕ не попадает в промпт */
export const DOMAIN_THRESHOLD = 0.1;

/** Порог проникновения домена (PLATO'S PROJECTORS): при > 50% разрешаем отраслевой тезаурус */
export const DOMAIN_PENETRATION_THRESHOLD = 0.5;

/** Отраслевые тезаурусы для PLATO'S PROJECTORS */
export const DOMAIN_THESAURUS: Record<string, string[]> = {
  economics: ['ресурс', 'актив', 'объект', 'транзакция', 'верификация', 'ликвидность', 'актив', 'инвестиция', 'капитал'],
  politics: ['суверенитет', 'мандат', 'резолюция', 'коалиция', 'легитимность', 'консенсус'],
  society: ['сообщество', 'интеграция', 'солидарность', 'идентичность', 'мобильность'],
  history: ['преемственность', 'наследие', 'хроника', 'летопись', 'память'],
  culture: ['традиция', 'канон', 'символ', 'архетип', 'нарратив'],
  aesthetics: ['гармония', 'ритм', 'контраст', 'текстура', 'композиция'],
  technology: ['интерфейс', 'протокол', 'алгоритм', 'модуль', 'синхронизация'],
  spirituality: ['дух', 'вера', 'бытие', 'вечность', 'обитель', 'храм', 'тайна', 'обет', 'печать', 'сакральное', 'трансценденция'],
};

/** Семантические корни доменов (RU, EN, HY). Гибкий поиск — окончания не обнуляют результат. */
export const DOMAIN_ROOTS: Record<string, { ru: string[]; en: string[]; hy: string[] }> = {
  history: { ru: ['наслед', 'преемств', 'хроник', 'летопис', 'памят'], en: ['herit', 'memor', 'chronicl', 'legac'], hy: ['ժառանգ', 'հիշող', 'պատմ', 'ժամանակ'] },
  culture: { ru: ['традиц', 'канон', 'символ', 'архетип', 'нарратив'], en: ['tradit', 'canon', 'symbol', 'archetyp'], hy: ['ավանդ', 'սիմվոլ', 'կանոն'] },
  spirituality: { ru: ['дух', 'вер', 'быти', 'вечност', 'обител', 'храм', 'тайна', 'обет', 'печат', 'сакрал', 'трансценд'], en: ['spirit', 'faith', 'etern', 'sanct'], hy: ['հոգ', 'հավատ', 'հավերժ', 'սրբ'] },
  economics: { ru: ['ресурс', 'актив', 'объект', 'транзакц', 'капитал'], en: ['resourc', 'asset', 'capital', 'invest'], hy: ['ակտիվ', 'կապիտալ', 'ներդր'] },
  politics: { ru: ['суверенитет', 'мандат', 'резолюц', 'коалиц', 'легитим'], en: ['mandate', 'coalit', 'legitim'], hy: ['իրավաս', 'կոալից', 'լեգիտիմ'] },
  society: { ru: ['сообществ', 'интеграц', 'солидарн', 'идентичн', 'мобильн'], en: ['communit', 'integrat', 'solidar'], hy: ['համայնք', 'ինտեգր', 'սոլիդար'] },
  aesthetics: { ru: ['гармони', 'ритм', 'контраст', 'текстур', 'композиц'], en: ['harmon', 'rhythm', 'contrast'], hy: ['հարմոն', 'ռիթմ', 'կոնտրաստ'] },
  technology: { ru: ['интерфейс', 'протокол', 'алгоритм', 'модул', 'синхрон'], en: ['interfac', 'protocol', 'algorithm'], hy: ['ինտերֆեյս', 'ալգորիթմ', 'մոդուլ'] },
};

/** Кросс-языковые эквиваленты (обратная совместимость). Теперь используем DOMAIN_ROOTS. */
export const DOMAIN_TERMS_MULTILANG: Record<string, Record<string, string[]>> = Object.fromEntries(
  Object.entries(DOMAIN_ROOTS).map(([k, v]) => [k, { hy: v.hy, en: v.en }])
);

/** Возвращает семантические корни домена для проверки (RU / EN / HY). */
export function getDomainTermsForCheck(domainKey: string, targetLang?: string): string[] {
  const roots = DOMAIN_ROOTS[domainKey as keyof typeof DOMAIN_ROOTS];
  if (!roots) return [];
  const lang = targetLang === 'hy' ? 'hy' : targetLang === 'en' ? 'en' : 'ru';
  return [...(roots[lang] ?? roots.ru ?? [])];
}

/** Находит домен по слову (Смысловой Отпечаток). Использует корни — грамматические формы не обнуляют результат. */
export function findDomainForWord(word: string): string | undefined {
  const w = word.toLowerCase().replace(/[\u0301]/g, '');
  if (w.length < 3) return undefined;
  for (const [key, roots] of Object.entries(DOMAIN_ROOTS)) {
    for (const lang of ['ru', 'en', 'hy'] as const) {
      for (const r of roots[lang] ?? []) {
        const rl = r.toLowerCase();
        if (w.includes(rl) || rl.includes(w)) return key;
      }
    }
  }
  return undefined;
}

/** Список активных доменов для короткого промпта */
export function getActiveDomainsList(calibration: DomainCalibration): string[] {
  if (!calibration?.internal || !calibration?.external) return [];
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
  if (Math.abs(external.spirituality) > DOMAIN_THRESHOLD) domains.push('Духовность');
  return domains;
}
