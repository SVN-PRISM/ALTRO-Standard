/* ALTRO SDK Integrity Validation Suite */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SovereignController } from '../core/SovereignController';
import { stripAltroDirectivesFromText, resolveWeightsFromIntent } from '../core/IntentOrchestrator';
import { maskUserContentWithPrepareStencil } from '../core/transcreateUserContentMask';
import { buildAltroUniversalSystemPrompt2026 } from '../src/lib/altroUniversalSystemPrompt';
import type { DomainWeights } from '../src/lib/altroData';

type Assertion = { name: string; passed: boolean; details: string };

type Scenario = { title: string; assertions: Assertion[]; notes?: string[] };

const now = new Date();
const ts = now.toISOString();
const currentDate = ts.slice(0, 10);

function assert(name: string, condition: boolean, details: string): Assertion {
  return { name, passed: condition, details };
}

function createZeroWeights(): DomainWeights {
  return {
    economics: 0,
    politics: 0,
    society: 0,
    history: 0,
    culture: 0,
    aesthetics: 0,
    technology: 0,
    spirituality: 0,
    semantics: 0,
    context: 0,
    intent: 0,
    imagery: 0,
    ethics: 0,
  };
}

function runMaskPipeline(input: string): { masked: string; stripped: string; weights: DomainWeights } {
  const { text: stripped, strippedInners } = stripAltroDirectivesFromText(input);
  const intent = strippedInners.map((inner) => `[ALTRO:${inner}]`).join('\n');
  const weights = resolveWeightsFromIntent(intent);
  const controller = new SovereignController();
  const masked = maskUserContentWithPrepareStencil(stripped, (body) => controller.prepareStencil(body, 'en', undefined));
  return { masked, stripped, weights };
}

function scenarioA(): Scenario {
  const src =
    'Contact: jane.doe@corp.example, employee ID: AB-7781-44, deploy Kryptos_Gate-V1 for Data_Sovereignty under ticket SEC-2026-ALPHA. [ALTRO: intent=technology, weight=high]';
  const { masked } = runMaskPipeline(src);

  const noDirective = !/\[ALTRO:/i.test(masked);
  const noEmail = !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(masked);
  const noTechAnchor = !/Kryptos_Gate-V1|Data_Sovereignty/i.test(masked);
  const hasIpaOnly = /\{\{IPA_\d+\}\}/.test(masked);

  return {
    title: 'Scenario A — Data Privacy',
    assertions: [
      assert('Directive removed before payload', noDirective, `masked=${JSON.stringify(masked)}`),
      assert('PII email masked', noEmail, `masked=${JSON.stringify(masked)}`),
      assert('Complex technical IDs masked', noTechAnchor, `masked=${JSON.stringify(masked)}`),
      assert('Payload contains IPA markers', hasIpaOnly, `masked=${JSON.stringify(masked)}`),
    ],
    notes: [`Source: ${src}`, `Masked: ${masked}`],
  };
}

function scenarioB(): Scenario {
  const empty = runMaskPipeline('');
  const onlyDirective = runMaskPipeline('[ALTRO: intent=politics, weight=high]');
  const nested = runMaskPipeline('Nested [zone [inner]] value + Node_Core-X2 [ALTRO: technology=0.6]');
  const noOrphanBracketFragment = !nested.masked.includes('[zone [inner]');
  const noRawNestedFormula = !nested.masked.includes('[zone [inner]]');
  const hasIpaFromNested = /\{\{IPA_\d+\}\}/.test(nested.masked);

  return {
    title: 'Scenario B — Edge Cases',
    assertions: [
      assert('Empty string stays empty', empty.masked === '', `masked=${JSON.stringify(empty.masked)}`),
      assert('Directive-only becomes empty payload', onlyDirective.masked === '', `masked=${JSON.stringify(onlyDirective.masked)}`),
      assert('Nested brackets do not leave orphan fragments', noOrphanBracketFragment, `masked=${JSON.stringify(nested.masked)}`),
      assert(
        'Nested/adjacent brackets and tech anchors are masked into IPA markers',
        noRawNestedFormula && hasIpaFromNested && !nested.masked.includes('Node_Core-X2'),
        `masked=${JSON.stringify(nested.masked)}`
      ),
    ],
    notes: [
      `Empty masked: ${JSON.stringify(empty.masked)}`,
      `Only-directive masked: ${JSON.stringify(onlyDirective.masked)}`,
      `Nested masked: ${nested.masked}`,
    ],
  };
}

function scenarioC(): Scenario {
  const neutralPrompt = buildAltroUniversalSystemPrompt2026('en', {
    directive: 'neutral baseline',
    weights: createZeroWeights(),
  });
  const shiftedPrompt = buildAltroUniversalSystemPrompt2026('en', {
    directive: '[ALTRO: intent=technology, politics=1, weight=high]',
    weights: {
      ...createZeroWeights(),
      technology: 1,
      politics: 1,
    },
  });

  const neutralHasCalibration = neutralPrompt.includes('no domain emphasis was inferred');
  const shiftedHasDomains = shiftedPrompt.includes('technology (100%)') && shiftedPrompt.includes('politics (100%)');
  const promptsDiffer = neutralPrompt !== shiftedPrompt;

  return {
    title: 'Scenario C — Domain Shift',
    assertions: [
      assert('Neutral prompt logs neutral matrix', neutralHasCalibration, 'neutral prompt calibration section present'),
      assert('Shifted prompt lists active domains', shiftedHasDomains, 'shifted prompt includes technology/politics'),
      assert('Prompt changes when weights shift', promptsDiffer, 'neutral and shifted prompts differ'),
    ],
    notes: [
      'Neutral calibration snippet: ' + neutralPrompt.split('\n').filter((l) => /MATRIX CALIBRATION|no domain emphasis/i.test(l)).join(' | '),
      'Shifted calibration snippet: ' + shiftedPrompt.split('\n').filter((l) => /MATRIX CALIBRATION|High-priority domains/i.test(l)).join(' | '),
    ],
  };
}

function scenarioOrdering(): Scenario {
  const src = '[ID:MASK_context] then Alpha_Node-7 and [ID:MASK_intent] then Beta_Core-9';
  const controller = new SovereignController();
  const masked = controller.prepareStencil(src, 'en', undefined);
  const ordered = masked.indexOf('{{IPA_1}}') < masked.indexOf('{{IPA_2}}') && masked.indexOf('{{IPA_2}}') < masked.indexOf('{{IPA_3}}') && masked.indexOf('{{IPA_3}}') < masked.indexOf('{{IPA_4}}');

  return {
    title: 'Ordering — Semantic Sovereignty',
    assertions: [
      assert('IPA markers strictly follow appearance order', ordered, `masked=${JSON.stringify(masked)}`),
    ],
    notes: [`Source: ${src}`, `Masked: ${masked}`],
  };
}

function renderReport(scenarios: Scenario[]): string {
  const all = scenarios.flatMap((s) => s.assertions);
  const passed = all.filter((a) => a.passed).length;
  const failed = all.length - passed;

  const lines: string[] = [];
  lines.push(`# ALTRO SDK Compliance Report (v1.5) - ${currentDate}`);
  lines.push('');
  lines.push(`- Generated: ${ts}`);
  lines.push(`- Total assertions: ${all.length}`);
  lines.push(`- Passed: ${passed}`);
  lines.push(`- Failed: ${failed}`);
  lines.push('');

  for (const s of scenarios) {
    lines.push(`## ${s.title}`);
    for (const a of s.assertions) {
      lines.push(`- ${a.passed ? 'PASS' : 'FAIL'} — ${a.name}`);
      lines.push(`  - ${a.details}`);
    }
    if (s.notes?.length) {
      lines.push('- Notes:');
      for (const n of s.notes) lines.push(`  - ${n}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

const scenarios = [scenarioA(), scenarioB(), scenarioC(), scenarioOrdering()];
const report = renderReport(scenarios);
const outPath = resolve(process.cwd(), 'docs/compliance/SDK_INTEGRITY_REPORT.md');
mkdirSync(resolve(process.cwd(), 'docs/compliance'), { recursive: true });
writeFileSync(outPath, report, 'utf8');

const all = scenarios.flatMap((s) => s.assertions);
const passed = all.filter((a) => a.passed).length;
const failed = all.length - passed;
console.log('[ALTRO_INTEGRITY] Report:', outPath);
console.log('[ALTRO_INTEGRITY] Assertions:', `${passed}/${all.length} passed, ${failed} failed`);
for (const s of scenarios) {
  for (const a of s.assertions) {
    console.log(`[ALTRO_INTEGRITY] ${a.passed ? 'PASS' : 'FAIL'} :: ${s.title} :: ${a.name}`);
  }
}
if (failed > 0) {
  process.exitCode = 1;
}
