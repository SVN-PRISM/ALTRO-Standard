/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | Internal validation — Hermetic Math & Armenian */

import { SovereignController } from '../core/SovereignController';

const PHRASE = 'Հզորությունը կազմում է 1.2 MW, իսկ ROI = 15.5%:';

const ctrl = new SovereignController();
const stencil = ctrl.prepareStencil(PHRASE, 'hy');
const vault = ctrl.getVault();

console.log('Input:', PHRASE);
console.log('Stencil:', stencil);

const snapshot = JSON.parse(vault.toJSON()) as {
  store: Record<string, string>;
  typeMap?: Record<string, string>;
  sourceMap?: Record<string, string>;
};

for (const [k, display] of Object.entries(snapshot.store)) {
  const t = snapshot.typeMap?.[k];
  const src = snapshot.sourceMap?.[k];
  console.log(k, 'type=', t, 'source=', src, 'display=', display);
}
