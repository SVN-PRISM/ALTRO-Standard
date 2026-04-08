/**
 * ALTRO Sync Integrity Test
 * - Verifies that:
 *   1) ALTRO_LIBRARY is importable and non-empty (data layer integrity).
 *   2) AltroOrchestrator.syncDatabaseSchema() returns a Firebird schema SQL string.
 *
 * Run (dev): npx tsx src/lib/altro/tests/sync_integrity.test.ts
 */

import { ALTRO_LIBRARY } from '@/lib/altroData';
import { AltroOrchestrator } from '@/lib/altro/engine';

async function run() {
  // 1) ALTRO_LIBRARY still intact
  const libraryKeys = Object.keys(ALTRO_LIBRARY);
  if (libraryKeys.length === 0) {
    console.error('[SYNC INTEGRITY] FAIL: ALTRO_LIBRARY is empty or not loaded.');
    process.exit(1);
  }

  // 2) syncDatabaseSchema produces SQL and mentions RDB$RELATIONS
  const orchestrator = new AltroOrchestrator();
  let sql: string;
  try {
    sql = await orchestrator.syncDatabaseSchema();
  } catch (err) {
    console.error('[SYNC INTEGRITY] FAIL: syncDatabaseSchema threw:', err);
    process.exit(1);
    return;
  }

  if (!sql || !/RDB\$RELATIONS/i.test(sql)) {
    console.error('[SYNC INTEGRITY] FAIL: syncDatabaseSchema did not target RDB$RELATIONS as expected.');
    console.error('SQL:', sql);
    process.exit(1);
  }

  console.log('[SYNC INTEGRITY] PASS');
  console.log('  ALTRO_LIBRARY keys:', libraryKeys.length);
  console.log('  syncDatabaseSchema SQL:', sql);
}

run();

