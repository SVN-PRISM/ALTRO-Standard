import { scanEntities } from '../core/EntityScanner';
import { buildStencilFromEntities } from '../core/StencilDisplayHelper';

const cases = [
  'Eq $A - L = E$ done',
  'баланс активов равен $A - L = E$',
  'Intro $$\nProfit = \\sum_i x_i$$\nend',
  /** Не съедать от $ до $ между двумя суммами как «формулу». */
  'Range $1,200,000 to $500,000 and $x + y = 1$ end',
  /** En-dash (U+2013) вместо минуса — должно оставаться formula_inline. */
  'Eq $A\u2013L = E$ ok',
];

for (const t of cases) {
  const e = scanEntities(t);
  const { maskedText, ipaToEntity } = buildStencilFromEntities(t, e);
  console.log('---');
  console.log('in:', JSON.stringify(t));
  console.log('entities:', e.map((x) => ({ ...x })));
  console.log('masked:', maskedText);
  console.log('ipa:', ipaToEntity);
}
