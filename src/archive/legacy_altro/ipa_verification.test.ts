/**
 * IPA Phase 1 — Verification Tests (Legacy — moved from test_lab/)
 * Run: npx tsx src/archive/legacy_altro/ipa_verification.test.ts
 */

import { generatePacket, wrapPrompt, parseAnalysisResponse } from '@/archive/legacy_altro/SemanticPackager';
import type { DomainWeights } from '@/lib/altroData';
import { INITIAL_DOMAIN_WEIGHTS } from '@/lib/altroData';

const COMPLEX_TEXT = `Начну, пожалуй. Здравствуй, читатель! Папа прошёл путь от брошенного своим отцом ребёнка до заместителя директора. Помню его выражение: «Мороженой картошки вдоволь не ели». Мама сейчас вспоминает своё детство с дрожащим голосом. И сколько света и тепла в маме!`;

const WEIGHTS: DomainWeights = {
  ...INITIAL_DOMAIN_WEIGHTS,
  history: 0.9,
  semantics: 0.7,
  ethics: 0.6,
};

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`[IPA TEST FAIL] ${msg}`);
    process.exit(1);
  }
}

async function run() {
  // 1. JSON Validation: generatePacket returns valid SemanticPacket
  const packet = generatePacket(COMPLEX_TEXT, WEIGHTS);
  assert(typeof packet === 'object', 'generatePacket must return object');
  assert(typeof packet.intent_summary === 'string', 'intent_summary must be string');
  assert(Array.isArray(packet.domain_focus), 'domain_focus must be array');
  assert(packet.domain_focus.length === 3, 'domain_focus must have 3 elements');
  assert(Array.isArray(packet.structural_anchors), 'structural_anchors must be array');
  console.log('[IPA TEST] generatePacket: valid JSON structure ✓');

  // 2. parseAnalysisResponse: Mirror Extraction schema { structural_anchors, homonym_locks }
  const mirrorSchemaJson = '{"structural_anchors":["слово","термин","хроника"],"homonym_locks":[{"word":"косой","variants":["инструмент","прическа"]}]}';
  const parsed = parseAnalysisResponse(mirrorSchemaJson);
  assert(parsed !== null, 'parseAnalysisResponse must parse Mirror Extraction JSON');
  assert(Array.isArray(parsed!.structural_anchors) && parsed!.structural_anchors.length === 3, 'structural_anchors preserved');
  assert(parsed!.structural_anchors[0] === 'слово', 'structural_anchors[0] preserved');
  assert(Array.isArray(parsed!.homonym_locks) && parsed!.homonym_locks!.length === 1, 'homonym_locks parsed');
  assert(parsed!.homonym_locks![0].word === 'косой' && parsed!.homonym_locks![0].variants?.length === 2, 'homonym_locks structure');
  assert(parsed!.domain_focus[0] === 'semantics', 'domain_focus inferred by Kernel (default)');
  console.log('[IPA TEST] parseAnalysisResponse Mirror Extraction schema ✓');

  // 3. parseAnalysisResponse: malformed / truncated
  const truncated = '{"intent_summary":"broken';
  const badParsed = parseAnalysisResponse(truncated);
  assert(badParsed === null, 'parseAnalysisResponse must return null for truncated JSON');
  console.log('[IPA TEST] parseAnalysisResponse truncated → null ✓');

  // 4. parseAnalysisResponse: non-JSON text
  const nonJson = 'Это просто текст без JSON.';
  const nonJsonParsed = parseAnalysisResponse(nonJson);
  assert(nonJsonParsed === null, 'parseAnalysisResponse must return null for non-JSON');
  console.log('[IPA TEST] parseAnalysisResponse non-JSON → null ✓');

  // 5. wrapPrompt format
  const wrapped = wrapPrompt(packet, COMPLEX_TEXT);
  assert(wrapped.includes('[IPA_DATA_START]'), 'wrapPrompt must contain IPA_DATA_START');
  assert(wrapped.includes('[IPA_DATA_END]'), 'wrapPrompt must contain IPA_DATA_END');
  assert(wrapped.includes(COMPLEX_TEXT), 'wrapPrompt must contain source text');
  assert(wrapped.includes(packet.intent_summary), 'wrapPrompt must contain packet');
  console.log('[IPA TEST] wrapPrompt format ✓');

  console.log('\n[IPA VERIFICATION] All tests PASS');
}

run().catch((e) => {
  console.error('[IPA VERIFICATION] Unhandled error:', e);
  process.exit(1);
});
