/* MIT License | Validation — Nazaryan balance phrase */

import { SovereignController } from '../core/SovereignController';

const phrase = 'баланс активов равен $A - L = E$';
const ctrl = new SovereignController();
const stencil = ctrl.prepareStencil(phrase, 'ru');
const snap = JSON.parse(ctrl.getVault().toJSON()) as {
  store: Record<string, string>;
  typeMap?: Record<string, string>;
  sourceMap?: Record<string, string>;
};

console.log('phrase:', phrase);
console.log('stencil:', stencil);
console.log('vault entries:', Object.keys(snap.store).length);
for (const k of Object.keys(snap.store)) {
  console.log(k, snap.typeMap?.[k], '<-', snap.sourceMap?.[k]);
}
