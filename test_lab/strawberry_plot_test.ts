/**
 * TEST: "Strawberry Plot Analytics"
 * Target: Firebird SQL Generation (Standard v2.1)
 *
 * User request (RU): "Выведи 5 самых урожайных участков сорта 'Азия',
 * посаженных в 2025 году, у которых состояние 'Excellent'.
 * Отсортируй по убыванию веса ягод."
 *
 * Schema: STRAWBERRY_PLOTS (ID, VARIETY, PLANTED_DATE, YIELD_KG, HEALTH_STATUS)
 */

import { AltroSqlAdapter, type SemanticIntent } from '@/lib/altro/adapters/sql-adapter';

// Step 1: SemanticIntent as produced by engine (mode: 'data_query') from the user request.
// Legislative Core maps: entity → STRAWBERRY_PLOTS; Context → filters; Locked Meaning → none here.
const intent: SemanticIntent = {
  entity: 'STRAWBERRY_PLOTS',
  fields: ['ID', 'VARIETY', 'PLANTED_DATE', 'YIELD_KG', 'HEALTH_STATUS'],
  filters: [
    { field: 'VARIETY', op: '=', value: 'Азия' },
    { field: 'PLANTED_DATE', op: '>=', value: '2025-01-01' },
    { field: 'PLANTED_DATE', op: '<=', value: '2025-12-31' },
    { field: 'HEALTH_STATUS', op: '=', value: 'Excellent' },
  ],
  orderBy: 'YIELD_KG',
  orderDirection: 'DESC',
  limit: 5,
  offset: 0,
};

// Step 2 & 3: Pass to Executive Shell (Firebird adapter).
const adapter = new AltroSqlAdapter(3);
const result = adapter.buildFirebirdSelect(intent);

// Step 4: Output.
if (result.deniedReason) {
  console.error('Semantic Access Denied:', result.deniedReason);
  process.exit(1);
}

console.log('-- Strawberry Plot Analytics (Firebird Dialect 3)');
console.log(result.sql!);
console.log('-- Params:', result.params);
