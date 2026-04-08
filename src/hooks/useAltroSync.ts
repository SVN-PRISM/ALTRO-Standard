/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */

'use client';

import { useState, useCallback } from 'react';
import { INITIAL_DOMAIN_WEIGHTS, type DomainWeights } from '@/lib/altroData';
import type { AltroOrchestrator } from '@/lib/altro/engine';
import { SemanticFirewall, domainWeightsToVector } from '@/security/SemanticFirewall';
import { protectAndPrepare, SecurityException } from '@/db/QueryProtector';
import { addChronosRecord } from '@/lib/db';

/** Калибровка весов по результату DATA SYNC (применённые домены воронки). Единое Ядро. */
function calibrateWeightsFromSyncResult(prev: DomainWeights, appliedDomains: string[]): DomainWeights {
  let next = { ...prev };
  if (appliedDomains.includes('LAW')) next = { ...next, ethics: Math.max(prev.ethics, 0.3) };
  if (appliedDomains.includes('ECONOMICS')) next = { ...next, economics: Math.max(prev.economics, -0.2) };
  return next;
}

export interface UseAltroSyncParams {
  domainWeightsRef: React.MutableRefObject<DomainWeights | null>;
  altroOrchestrator: AltroOrchestrator;
  setDomainWeights: React.Dispatch<React.SetStateAction<DomainWeights>>;
}

export function useAltroSync(params: UseAltroSyncParams) {
  const { domainWeightsRef, altroOrchestrator, setDomainWeights } = params;
  const [isSyncing, setIsSyncing] = useState(false);

  const syncDatabase = useCallback(async () => {
    if (isSyncing) return;
    const prev = domainWeightsRef.current;
    try {
      setIsSyncing(true);
      setDomainWeights((p) => ({ ...p, context: 1 }));
      const sql = await altroOrchestrator.syncDatabaseSchema();
      const prevWeights = prev ?? INITIAL_DOMAIN_WEIGHTS;
      const intentVector = domainWeightsToVector(prevWeights);
      const ctx = { entity: 'RDB$RELATIONS', fields: ['RDB$RELATION_NAME'] };
      const result = protectAndPrepare(sql, [], intentVector, ctx);
      if (result.appliedDomains.length > 0 && typeof window !== 'undefined') {
        console.log('[AL-DATA-GATEWAY]: DATA SYNC passed through Inverted Funnel. Applied filters:', result.appliedDomains);
      }
      const calibrated = calibrateWeightsFromSyncResult(prevWeights, result.appliedDomains);
      setDomainWeights(calibrated);
      SemanticFirewall.getInstance().syncOprFromWeights(calibrated);
      if (typeof window !== 'undefined' && result.tdp >= 0.85) {
        const tdpPct = Math.round(result.tdp * 100);
        const resultText = `${sql}\n[TDP_CHECK_PASSED]`;
        addChronosRecord({
          type: 'SQL_VALIDATION_STAMP',
          resonance: tdpPct,
          source: '',
          result: resultText,
          radar: {},
          model: 'AltroSqlAdapter',
          timestamp: Date.now(),
          generationTimeMs: 0,
          tokenCount: 0,
        }).catch(console.error);
      }
    } catch (err) {
      if (err instanceof SecurityException && typeof window !== 'undefined') {
        console.warn('[AL-FIREWALL] DATA SYNC blocked:', err.message, err.reportLine);
        addChronosRecord({
          type: 'RESONANCE_FAILURE',
          resonance: 0,
          source: '',
          result: `[RESONANCE_FAILURE] ${err.message}`,
          radar: {},
          model: 'N/A',
          timestamp: Date.now(),
          generationTimeMs: 0,
          tokenCount: 0,
        }).catch(console.error);
      } else if (typeof window !== 'undefined') console.error('ALTRO DATA_SYNC ERROR:', err);
      if (prev) setDomainWeights(prev);
    } finally {
      setIsSyncing(false);
    }
  }, [altroOrchestrator, isSyncing, setDomainWeights, domainWeightsRef]);

  return { isSyncing, syncDatabase };
}
