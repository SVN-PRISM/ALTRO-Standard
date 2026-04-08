/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO — Скрытая матрица 8 доменов */

/** Идентификаторы доменов (калибровка ядра; tone/meaning не выводятся в UI). */
export type CivDomainId =
  | 'economics'
  | 'politics'
  | 'society'
  | 'history'
  | 'culture'
  | 'aesthetics'
  | 'technology'
  | 'spirituality';

export interface CivDomainDef {
  id: CivDomainId;
  key: string;
  name: string;
  tone: string;
  meaning: string;
}

/**
 * Финальная матрица цивилизационных доменов.
 * Используется только в системном промпте / ядре — не дублировать в интерфейсе.
 */
export const CIV_DOMAINS_8: readonly CivDomainDef[] = [
  {
    id: 'economics',
    key: 'Basis',
    name: 'ЭКОНОМИКА',
    tone: 'прагматичная, сухая, измеримая; ресурсы, обмен, устойчивость',
    meaning: 'Смысл как учёт, ограничение и предсказуемость последствий.',
  },
  {
    id: 'politics',
    key: 'Power',
    name: 'ПОЛИТИКА',
    tone: 'стратегическая, нормативная, публичная; воля, институты, легитимность',
    meaning: 'Смысл как распределение влияния и ответственности перед коллективом.',
  },
  {
    id: 'society',
    key: 'Bond',
    name: 'ОБЩЕСТВО',
    tone: 'социологическая, связная, ролевая; идентичности, практики, доверие',
    meaning: 'Смысл как живая ткань связей и повторяемых форм совместной жизни.',
  },
  {
    id: 'history',
    key: 'Memory',
    name: 'ИСТОРИЯ',
    tone: 'диахроническая, документальная, причинная; память, смена эпох',
    meaning: 'Смысл как нить времени: причины, следы, наследие и разрывы.',
  },
  {
    id: 'culture',
    key: 'Semiosis',
    name: 'КУЛЬТУРА',
    tone: 'семиотическая, нарративная, символическая; коды, мифы, обычаи',
    meaning: 'Смысл как передаваемый знак и коллективная интерпретация мира.',
  },
  {
    id: 'aesthetics',
    key: 'Form',
    name: 'ЭСТЕТИКА',
    tone: 'чувственная, образная, композиционная; ритм, целостность формы',
    meaning: 'Смысл как переживаемая красота и уместность образа.',
  },
  {
    id: 'technology',
    key: 'Machine',
    name: 'ТЕХНОЛОГИИ',
    tone: 'техническая, точная, инженерная; инструмент, масштаб, ограничения среды',
    meaning: 'Смысл как реализуемость, автоматизация и границы возможного.',
  },
  {
    id: 'spirituality',
    key: 'Spirit',
    name: 'ДУХОВНОСТЬ',
    tone: 'возвышенная, этическая, трансцендентная; ценности вне утилиты',
    meaning: 'Смысл как ответственность перед высшим порядком и внутренней истиной.',
  },
] as const;

export const CIV_DOMAIN_BY_ID: ReadonlyMap<CivDomainId, CivDomainDef> = new Map(
  CIV_DOMAINS_8.map((d) => [d.id, d])
);
