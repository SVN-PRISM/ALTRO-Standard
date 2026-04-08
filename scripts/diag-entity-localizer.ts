/** Regression: Translation-First mask — vault display = target locale, source = original. */
import { SovereignController } from '../core/SovereignController';

const c = new SovereignController();
const stencil = c.prepareStencil('Date: March 28, 2024.', 'ru');
const v = c.getVault();
console.log('stencil (bare tags only):', stencil);
for (const [k, display] of v.entries()) {
  console.log('key', k, 'display', display, 'source', v.getSource(k), 'type', v.getType(k));
}
console.log('finalize:', c.finalize(stencil));
