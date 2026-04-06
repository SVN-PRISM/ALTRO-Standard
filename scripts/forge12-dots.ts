import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { DOMAIN_ORDER } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, '..', 'public', 'data', 'altro_crystal.bin'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
const cl = CrystalLoader.getInstance();
cl.loadFromArrayBuffer(buf);

const w = process.argv[2] ?? 'смысл';
const v = cl.getVector(w);
console.log('word:', w, 'vector:', v ? `len=${v.length}` : 'OOV');
if (!v) process.exit(0);
const out = new Float32Array(13);
cl.dotCentroidsInPlace(v, out);
for (let i = 0; i < 13; i++) {
  console.log(DOMAIN_ORDER[i], out[i]!.toFixed(6));
}
