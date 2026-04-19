/**
 * KSHERQ verification: registry monolith → один блок {{IPA_N}} в StencilDisplayHelper (как Masker phase 2).
 * Запуск: npx tsx scripts/stencil-registry-monolith-check.ts
 */
import { buildStencilForDisplay } from '../core/StencilDisplayHelper';
import { REGISTRY_NUMBER_GREEDY_SOURCE } from '../core/maskMonolithPatterns';

const re = new RegExp(REGISTRY_NUMBER_GREEDY_SOURCE, 'gu');

const samples = ['№ 2026/ОФ-15-Б', 'Договор № 2026/ОФ-15-Б между сторонами', '№АК-007/2026'];

for (const s of samples) {
  const m = re.exec(s);
  re.lastIndex = 0;
  const full = m ? s.slice(m.index, m.index + m[0].length) : '(no match)';
  const { maskedText, ipaToEntity } = buildStencilForDisplay(s);
  const ipaCount = (maskedText.match(/\{\{IPA_\d+\}\}/g) ?? []).length;
  console.log('---');
  console.log('input:', JSON.stringify(s));
  console.log('regexFullMatch:', JSON.stringify(full));
  console.log('totalIPA:', ipaCount, 'masked:', JSON.stringify(maskedText));
  ipaToEntity.forEach((e) => console.log('  entity', e.ipaId, e.type, JSON.stringify(s.slice(e.start, e.end))));
  if (ipaCount === 1 && ipaToEntity.length >= 1) {
    const e0 = ipaToEntity[0]!;
    const seg = s.slice(e0.start, e0.end);
    const oneRegistry = /^(?:\u2116|№|No\.?)/i.test(seg.trim()) && seg.includes('2026');
    console.log('firstBlockSlice:', JSON.stringify(seg), 'coversFullRegistry:', oneRegistry);
  }
}
