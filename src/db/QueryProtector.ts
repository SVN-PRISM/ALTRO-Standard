/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Sovereign Data Gateway */
/**
 * QueryProtector — обёртка запросов к БД через Semantic Firewall (Единое Ядро).
 * Если TDP < 0.85, запрос не уходит в базу: выбрасывается SecurityException.
 * Применяет политики по аномалиям доменов [ECONOMICS] / [LAW] и логирует [AL-DATA-GATEWAY].
 * Stateless: не хранит в памяти последние SQL/фильтры; после очистки (Full Semantic Reset) следов не остаётся.
 */

import { SemanticFirewall, TDP_THRESHOLD } from '@/security/SemanticFirewall';

export class SecurityException extends Error {
  constructor(
    message: string,
    public readonly tdp?: number,
    public readonly reportLine?: string
  ) {
    super(message);
    this.name = 'SecurityException';
    Object.setPrototypeOf(this, SecurityException.prototype);
  }
}

export interface ProtectResult {
  allowed: boolean;
  modifiedSql: string;
  modifiedParams: unknown[];
  appliedDomains: string[];
  tdp: number;
}

/**
 * Проверяет запрос через Инвертированную воронку. При TDP < 0.85 запрос не выполняется.
 * Применяет WHERE-политики по аномалиям доменов и возвращает модифицированные SQL и params.
 */
export function protectAndPrepare(
  sql: string,
  params: unknown[],
  intentVector: number[],
  context?: { entity: string; fields: string[] }
): ProtectResult {
  const firewall = SemanticFirewall.getInstance();
  const resonance = firewall.evaluateResonance(intentVector);

  if (!resonance.allowed && resonance.tdp < TDP_THRESHOLD) {
    throw new SecurityException(
      `[AL-FIREWALL] Query blocked: TDP ${(resonance.tdp * 100).toFixed(0)}% < ${TDP_THRESHOLD * 100}%.`,
      resonance.tdp,
      resonance.reportLine
    );
  }

  const { whereClause, appliedDomains } = firewall.buildWhereFromIntentVector(intentVector, context);
  let modifiedSql = sql;
  const modifiedParams = [...params];

  if (whereClause.trim()) {
    const fragment = whereClause.trim();
    const hasWhere = /\s+WHERE\s+/i.test(sql);
    let base = sql.trimEnd();
    if (base.endsWith(';')) base = base.slice(0, -1);
    modifiedSql = hasWhere ? `${base} AND ${fragment}` : `${base} WHERE ${fragment}`;
    if (appliedDomains.length > 0) {
      const domainList = appliedDomains
        .map((d) => `Domain: ${d === 'LAW' ? 'PRIVACY' : d}`)
        .join(', ');
      const logLine = `[AL-DATA-GATEWAY]: SQL Query modified by Semantic Policy. Applied filters: [${domainList}].`;
      if (typeof window !== 'undefined') console.log(logLine);
      if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'test') console.log(logLine);
    }
  }

  return {
    allowed: true,
    modifiedSql,
    modifiedParams,
    appliedDomains,
    tdp: resonance.tdp,
  };
}

