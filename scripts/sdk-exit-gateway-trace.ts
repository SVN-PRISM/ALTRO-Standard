/**
 * Trace: тот же пайплайн, что /api/transcreate — stripAltro → partition [USER_DIRECTIVE] → prepareStencil.
 * Запуск: npx tsx scripts/sdk-exit-gateway-trace.ts
 */
import { stripAltroDirectivesFromText } from '../core/IntentOrchestrator';
import { SovereignController } from '../core/SovereignController';
import { maskUserContentWithPrepareStencil } from '../core/transcreateUserContentMask';

const SAMPLE =
  'The deployment of the Kryptos_Gate-V1 is essential for Data_Sovereignty. [ALTRO: intent=politics, technology=0.7, weight=high]';

const { text: stripped } = stripAltroDirectivesFromText(SAMPLE);
const controller = new SovereignController();
const out = maskUserContentWithPrepareStencil(stripped, (body) =>
  controller.prepareStencil(body, 'en', undefined)
);
console.log('[SDK_EXIT_GATEWAY] user message (post-maskMessages, pre-Ollama body):\n', out);
