/**
 * Проверка Forge 1.2: processAtom для ключевых токенов (после пересборки кристалла).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { SemanticFirewall } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'public', 'data', 'altro_crystal.bin');

const raw = readFileSync(BIN);
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
CrystalLoader.getInstance().loadFromArrayBuffer(buf);

const fw = SemanticFirewall.getInstance();

const words = [
  'смысл',
  'намерение',
  'իմաստ',
  'մտադրություն',
  'meaning',
  'intent',
  'свет',
];

console.log('[Forge 1.2 validate] header:', CrystalLoader.getInstance().getHeader());
console.log('');
for (const w of words) {
  console.log(`«${w}» → ${fw.processAtom(w) ?? '(null)'}`);
}
