/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core
 *
 * ALTRO SQL-Adapter (Firebird)
 * Technocratic Standard v2.1 — Inverted Funnel.
 *
 * Legislative Core (Semantic Intent) → Executive Shell (Firebird SQL).
 * This adapter never talks to the LLM directly; it receives a structured
 * intent from the engine (mode: 'data_query') and turns it into a
 * Firebird-optimized SELECT statement, subject to a Semantic Firewall.
 */

export type SqlComparisonOp = '=' | '!=' | '<' | '<=' | '>' | '>=' | 'LIKE' | 'IN';

export interface SemanticFilter {
  field: string;
  op: SqlComparisonOp;
  value: string | number | boolean | Array<string | number | boolean>;
}

export interface LockedMeaningFilter extends SemanticFilter {
  /** Human label for the locked meaning, e.g. "Active Users". */
  label?: string;
}

/** Semantic Intent produced by the Legislative Core (mode: 'data_query'). */
export interface SemanticIntent {
  /** Conceptual entity, e.g. "User", "Invoice". */
  entity: string;
  /** Logical fields the caller wants back, before mapping to columns. */
  fields: string[];
  /** Free-form filters derived from Context Domain. */
  filters?: SemanticFilter[];
  /** Hard filters derived from Locked Meaning (cannot be removed). */
  lockedFilters?: LockedMeaningFilter[];
  /** Optional ordering and pagination hints. */
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

export interface SqlBuildResult {
  sql: string | null;
  params: unknown[];
  deniedReason?: string;
}

export interface SemanticFirewallReport {
  allowed: boolean;
  reason?: string;
}

/** Firebird-specific SQL adapter (dialect 3). */
export class AltroSqlAdapter {
  constructor(private readonly dialect: number = 3) {}

  /** Forbidden tables: access triggers Semantic Access Denied (Standard v2.1). */
  private static readonly FORBIDDEN_ENTITIES = new Set([
    'audit_log',
    'secret_salaries',
    'secret_salary',
    'salary_secrets',
    'user_passwords',
    'credit_cards',
    'payment_tokens',
  ]);

  /**
   * Semantic Firewall: rejects obviously unsafe / unethical intents.
   * Ethical & Sacred constraints (ALTRO_CORE.md): sensitive tables and fields are blocked.
   */
  private semanticFirewall(intent: SemanticIntent): SemanticFirewallReport {
    const loweredEntity = intent.entity.toLowerCase().replace(/\s+/g, '_');
    if (AltroSqlAdapter.FORBIDDEN_ENTITIES.has(loweredEntity)) {
      return {
        allowed: false,
        reason: `Semantic Access Denied: access to table "${intent.entity}" violates ethical or security constraints.`,
      };
    }
    for (const forbidden of AltroSqlAdapter.FORBIDDEN_ENTITIES) {
      if (loweredEntity.includes(forbidden)) {
        return {
          allowed: false,
          reason: `Semantic Access Denied: access to table "${intent.entity}" violates ethical or security constraints.`,
        };
      }
    }

    const bannedFields = ['password', 'secret', 'token', 'credit_card'];
    const allFields = [...intent.fields, ...(intent.filters ?? []).map((f) => f.field)];
    for (const f of allFields) {
      if (bannedFields.some((b) => f.toLowerCase().includes(b))) {
        return { allowed: false, reason: `Semantic Access Denied: field "${f}" is restricted.` };
      }
    }
    return { allowed: true };
  }

  private quoteIdent(name: string): string {
    // Simple identifier validation for safety: A–Z, 0–9, _, $
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(name)) {
      throw new Error(`Invalid identifier: ${name}`);
    }
    // Firebird identifiers are case-insensitive; we normalize to upper-case.
    return `"${name.toUpperCase()}"`;
  }

  private buildWhereClause(filters: SemanticFilter[] | undefined, lockedFilters: LockedMeaningFilter[] | undefined, params: unknown[]): string {
    const all: SemanticFilter[] = [];
    if (filters?.length) all.push(...filters);
    if (lockedFilters?.length) all.push(...lockedFilters);
    if (all.length === 0) return '';

    const parts: string[] = [];
    for (const f of all) {
      const column = this.quoteIdent(f.field);
      if (f.op === 'IN' && Array.isArray(f.value)) {
        const placeholders = f.value.map((v) => {
          params.push(v);
          return '?';
        });
        parts.push(`${column} IN (${placeholders.join(', ')})`);
      } else {
        params.push(f.value);
        parts.push(`${column} ${f.op} ?`);
      }
    }
    return parts.length ? ` WHERE ${parts.join(' AND ')}` : '';
  }

  /**
   * Main entry: Legislative Core → Firebird SQL SELECT.
   * Returns SQL + params, or Semantic Access Denied if firewall blocks it.
   */
  buildFirebirdSelect(intent: SemanticIntent): SqlBuildResult {
    const firewall = this.semanticFirewall(intent);
    if (!firewall.allowed) {
      return {
        sql: null,
        params: [],
        deniedReason: firewall.reason ?? 'Semantic Access Denied: Ethical/Sacred violation.',
      };
    }

    const table = this.quoteIdent(intent.entity);
    const selected =
      intent.fields.length > 0
        ? intent.fields.map((f) => this.quoteIdent(f)).join(', ')
        : '*';

    const params: unknown[] = [];
    const whereClause = this.buildWhereClause(intent.filters, intent.lockedFilters, params);

    // Firebird dialect 3: FIRST/SKIP for pagination.
    let prefix = 'SELECT ';
    if (intent.limit != null && intent.limit > 0) {
      prefix += `FIRST ${intent.limit} `;
      if (intent.offset != null && intent.offset > 0) {
        prefix += `SKIP ${intent.offset} `;
      }
    }

    let sql = `${prefix}${selected} FROM ${table}${whereClause}`;

    if (intent.orderBy) {
      const dir = intent.orderDirection === 'DESC' ? ' DESC' : ' ASC';
      sql += ` ORDER BY ${this.quoteIdent(intent.orderBy)}${dir}`;
    }

    return { sql, params };
  }
}

