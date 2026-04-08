/**
 * ALTRO Semantic Firewall — Smoke Test («Зелёный Щит»)
 *
 * Run: npx tsx src/tests/firewall_smoke_test.ts
 */

import { SemanticFirewall, TDP_THRESHOLD, DOMAIN_ORDER } from '@/security/SemanticFirewall';
import { protectAndPrepare, SecurityException } from '@/db/QueryProtector';
import { executeQuery } from '@/db/firebird.server';

function assert(cond: boolean, message: string): void {
  if (!cond) {
    console.error('[FIREWALL SMOKE] FAIL:', message);
    process.exit(1);
  }
}

async function run() {
  const firewall = SemanticFirewall.getInstance();

  // Базовый OPR: нейтральный эталон (все домены 0.5)
  const neutralOpr = DOMAIN_ORDER.map(() => 0.5);
  firewall.setOprVector(neutralOpr);

  // ——— Сценарий 1: SQL Masking (LAW / ECONOMICS) ———
  const maskingIntent = [...neutralOpr];
  maskingIntent[0] = 0.9; // ECONOMICS ↑
  maskingIntent[12] = 0.1; // LAW (ethics) ↓
  const { whereClause, appliedDomains } = firewall.buildWhereFromIntentVector(maskingIntent, {
    entity: 'RDB$RELATIONS',
    fields: ['RDB$RELATION_NAME'],
  });
  assert(
    whereClause.includes('"RDB$RELATION_NAME" NOT LIKE \'RDB$%\''),
    'SQL Masking: expected system table mask in WHERE clause.'
  );
  assert(
    appliedDomains.includes('LAW'),
    `SQL Masking: expected LAW in appliedDomains, got ${appliedDomains.join(', ')}`
  );
  console.log('[FIREWALL SMOKE] SQL Masking PASS:', whereClause, '| domains:', appliedDomains);

  // ——— Сценарий 2: SecurityException при TDP < 0.85 ———
  // Жёсткий OPR по ECONOMICS, а намерение уводим в POLITICS → почти ортогональные вектора.
  const hardOpr = DOMAIN_ORDER.map(() => 0);
  hardOpr[0] = 1; // OPR по ECONOMICS
  firewall.setOprVector(hardOpr);
  const lowTdpIntent = DOMAIN_ORDER.map(() => 0);
  lowTdpIntent[1] = 1; // POLITICS
  let threwSecurity = false;
  try {
    protectAndPrepare('SELECT 1', [], lowTdpIntent, { entity: 'RDB$RELATIONS', fields: ['RDB$RELATION_NAME'] });
  } catch (e) {
    threwSecurity = e instanceof SecurityException;
    console.log('[FIREWALL SMOKE] SecurityException caught (TDP < 0.85):', (e as Error).message);
  }
  assert(threwSecurity, 'SecurityException: expected protectAndPrepare to throw SecurityException for low TDP.');

  // ——— Сценарий 3: Firebird Availability / Data Source Unreachable ———
  // Возвращаем OPR к нейтральному и используем совпадающий вектор, чтобы пройти резонанс.
  firewall.setOprVector(neutralOpr);
  const normIntent = [...neutralOpr];
  const normRes = firewall.evaluateResonance(normIntent);
  assert(normRes.allowed === true, 'Firebird: expected neutral intent to be allowed by Firewall.');

  try {
    await executeQuery('SELECT 1 FROM RDB$DATABASE', [], normIntent, {
      entity: 'RDB$DATABASE',
      fields: ['RDB$RELATION_NAME'],
    });
    console.log('[FIREWALL SMOKE] Firebird Availability: query executed (env configured).');
  } catch (e) {
    const msg = (e as Error).message || '';
    assert(
      msg.includes('Data Source Unreachable'),
      `Firebird Availability: expected 'Data Source Unreachable', got: ${msg}`
    );
    console.log('[FIREWALL SMOKE] Firebird Availability PASS (Data Source Unreachable):', msg);
  }

  console.log('[FIREWALL SMOKE] All scenarios passed. Зелёный Щит logic confirmed.');
}

run().catch((err) => {
  console.error('[FIREWALL SMOKE] UNHANDLED ERROR:', err);
  process.exit(1);
});
