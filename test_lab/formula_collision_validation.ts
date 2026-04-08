/* MIT License | Internal validation — Formula & KPI collision */

import { SovereignController } from '../core/SovereignController';

function run(label: string, text: string, lang = 'en') {
  const c = new SovereignController();
  const stencil = c.prepareStencil(text, lang);
  const vault = c.getVault();
  const snap = JSON.parse(vault.toJSON()) as {
    store: Record<string, string>;
    typeMap?: Record<string, string>;
    sourceMap?: Record<string, string>;
  };
  console.log('\n===', label, '===');
  console.log('in:', text);
  console.log('stencil:', stencil);
  for (const k of Object.keys(snap.store)) {
    console.log(k, snap.typeMap?.[k], '<-', snap.sourceMap?.[k]);
  }
}

run('inline LaTeX', String.raw`Test $x + y = 1$ end`);
run('display LaTeX', 'Line1\n$$a\n+\nb$$\nrest');
run('Russian decimal', 'значение 1,85 и ещё слово1.85 тут', 'ru');
run('display $$Profit$$', String.raw`Intro $$\nProfit = \\sum_i x_i$$\nend`);
run('inline A-L=E', String.raw`Eq $A - L = E$ done`);
