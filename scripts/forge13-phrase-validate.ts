import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { SemanticFirewall } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, '..', 'public', 'data', 'altro_crystal.bin'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
CrystalLoader.getInstance().loadFromArrayBuffer(buf);

const phrase =
  'Инструкция ISO9001: проект СВЕТ несет скрытый смысл и истинное намерение';

console.log('specVersion:', CrystalLoader.getInstance().getHeader().specVersion);
console.log('maskSentence:\n', SemanticFirewall.getInstance().maskSentence(phrase));
