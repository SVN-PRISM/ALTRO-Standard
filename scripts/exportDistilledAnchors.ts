/**
 * Одноразовый экспорт: npx tsx scripts/exportDistilledAnchors.ts
 * Генерирует scripts/distilledAnchors.json из встроенной структуры (IP ALTRO).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DISTILLED_ANCHORS_PAYLOAD } from './distilledAnchorsPayload';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'distilledAnchors.json');

writeFileSync(OUT, JSON.stringify(DISTILLED_ANCHORS_PAYLOAD, null, 2), 'utf8');
console.log('Wrote', OUT);
