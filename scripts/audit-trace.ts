/**
 * Trace "Life of a Label" with ALTRO_AUDIT_STENCIL=1.
 * Run: npx tsx scripts/audit-trace.ts
 */
process.env.ALTRO_AUDIT_STENCIL = '1';

import { SovereignController } from '../core/SovereignController';

const phrase = 'The event was scheduled for March 28, 2026.';

console.log('\n========== INPUT ==========\n', phrase, '\n');

const c = new SovereignController();
const masked = c.prepareStencil(phrase, 'ru');

console.log('\n========== MASKED (sent to LLM — bare {{IPA_N}} only) ==========\n', masked, '\n');

/** Scenario C check: LLM echoes tags unchanged → finalize should inject display (Russian). */
const simulatedLlmOutput = masked;
console.log('\n========== finalize(simulated LLM output) ==========\n');
const finalized = c.finalize(simulatedLlmOutput);
console.log('RESULT:', finalized, '\n');
