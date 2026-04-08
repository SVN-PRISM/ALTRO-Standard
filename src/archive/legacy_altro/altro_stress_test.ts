/**
 * ALTRO Stress Test — Method B (Inverted Funnel) validation. (Legacy — moved from test_lab/)
 * Run: npx tsx src/archive/legacy_altro/altro_stress_test.ts
 */

import { AltroOrchestrator, buildSystemPrompt } from '@/lib/altro/engine';

const PHRASE = 'Он наложил замок на свои слова';
const LOCKED_MEANING_MARKER = 'замок'; // must appear in prompt
const LOCKED_MEANING_SENSE = 'запор'; // meaning to lock (замо́к = запор)
const MAX_PROCESSING_MS = 100;

const FORBIDDEN_IN_MIRROR = ['Imagery', 'WEIGHTS', 'TRANSFIGURE', 'Spatial Logic', 'Semantics=', 'Context=', 'Intent=', 'Ethics='];

function runStressTest(): void {
  const orch = new AltroOrchestrator();
  const t0 = performance.now();
  const payload = orch.buildOllamaPayload({
    text: PHRASE,
    mode: 'mirror',
    targetLanguage: 'ru',
    resolvedVariantsHint: `[замок] = ${LOCKED_MEANING_SENSE}`,
  });
  const elapsed = performance.now() - t0;

  const systemPrompt = payload.messages.find((m) => m.role === 'system')?.content ?? '';
  const userContent = payload.messages.find((m) => m.role === 'user')?.content ?? '';

  let passed = true;
  const errors: string[] = [];

  // 1) Prompt must contain locked meaning (замок = замо́к (запор) or equivalent)
  const hasLockedMeaning =
    systemPrompt.includes('замок') &&
    (systemPrompt.includes('запор') || systemPrompt.includes('замо\u0301к') || systemPrompt.includes('[LOCKED_MEANING]'));
  if (!hasLockedMeaning) {
    passed = false;
    errors.push('FAIL: Generated prompt does not contain locked meaning (замок = замо́к (запор)) or [LOCKED_MEANING]');
  }

  // 2) No weights/Imagery/TRANSFIGURE in Mirror prompt
  for (const forbidden of FORBIDDEN_IN_MIRROR) {
    if (systemPrompt.includes(forbidden)) {
      passed = false;
      errors.push(`FAIL: Mirror prompt must not contain "${forbidden}"`);
    }
  }

  // 3) Internal processing time < 100ms
  if (elapsed > MAX_PROCESSING_MS) {
    passed = false;
    errors.push(`FAIL: Processing time ${elapsed.toFixed(2)}ms exceeds ${MAX_PROCESSING_MS}ms`);
  }

  // 4) User message must be only [INPUT_START] + segment + [INPUT_END]
  if (!userContent.includes('[INPUT_START]') || !userContent.includes('[INPUT_END]')) {
    passed = false;
    errors.push('FAIL: User content must be wrapped in [INPUT_START]/[INPUT_END]');
  }
  if (userContent.includes('Remember accents') || userContent.includes('Сохрани ударения') || userContent.includes('Запертые смыслы')) {
    passed = false;
    errors.push('FAIL: User content must not contain extra instructions after [INPUT_END]');
  }

  if (passed) {
    console.log('[ALTRO STRESS TEST] PASS');
    console.log(`  Locked meaning present: yes`);
    console.log(`  No Imagery/WEIGHTS in Mirror: yes`);
    console.log(`  Processing time: ${elapsed.toFixed(2)}ms (< ${MAX_PROCESSING_MS}ms)`);
    console.log(`  User content clean: yes`);
  } else {
    console.error('[ALTRO STRESS TEST] FAIL');
    errors.forEach((e) => console.error('  ', e));
    console.error(`  Processing time: ${elapsed.toFixed(2)}ms`);
    process.exit(1);
  }
}

// Also test buildSystemPrompt directly (mirror, with lockedMeaningLines)
function runBuildSystemPromptTest(): void {
  const prompt = buildSystemPrompt({
    mode: 'mirror',
    calibration: {} as import('@/lib/altro/engine').AltroCalibration,
    targetLanguage: 'ru',
    lockedMeaningLines: ['замок = замо́к (запор)'],
  });
  const hasLock = prompt.includes('замок') && (prompt.includes('запор') || prompt.includes('замо́к'));
  const noWeights = !prompt.includes('WEIGHTS') && !prompt.includes('Imagery');
  if (!hasLock || !noWeights) {
    console.error('[ALTRO STRESS TEST] buildSystemPrompt(mirror) FAIL: locked meaning or zero-noise');
    process.exit(1);
  }
  console.log('[ALTRO STRESS TEST] buildSystemPrompt(mirror + locked) OK');
}

runBuildSystemPromptTest();
runStressTest();
