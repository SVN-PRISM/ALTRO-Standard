/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil test */

import { SovereignController } from './core/SovereignController';

const SAMPLE =
  'NVIDIA reported revenue of $22.1 billion, up 265% from a year ago. Date: January 26, 2026.';

const GLUED_SAMPLE =
  'Revenue 22.1billion (2020-2025), period 26.01.2026. Range: 23.5-24.1 million.';

const controller = new SovereignController();

const stencil = controller.prepareStencil(SAMPLE, 'ru');

// Имитация вывода ИИ (может изменить формулировки, но метки сохраняются)
const aiOutput = stencil;

const injected = controller.finalize(aiOutput);

console.log('1. Исходник:\n', SAMPLE);
console.log('\n2. Трафарет:\n', stencil);
console.log('\n3. Итоговый инжект:\n', injected);

// Проверка Masker на склеенные данные
console.log('\n--- Masker: склеенные данные ---');
const ctrl2 = new SovereignController();
const stencil2 = ctrl2.prepareStencil(GLUED_SAMPLE, 'ru');
console.log('Исходник:', GLUED_SAMPLE);
console.log('Трафарет:', stencil2);

// Диагностика: полный захват $850,000 (см. лог [ALTRO][Masker] Captured Unit)
console.log('\n--- Masker: $850,000 ---');
const ctrl3 = new SovereignController();
ctrl3.prepareStencil('Grant amount $850,000 approved.', 'ru');
