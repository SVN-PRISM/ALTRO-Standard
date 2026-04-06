/**
 * Демо Stencil Logic: SemanticFirewall.processAtom без LLM (кристалл + центроиды).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { SemanticFirewall } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'public', 'data', 'altro_crystal.bin');

const raw = readFileSync(BIN);
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

CrystalLoader.getInstance().loadFromArrayBuffer(buf);

const fw = SemanticFirewall.getInstance();

const testWord = 'свет';
const mask = fw.processAtom(testWord);

console.log('[Stencil Demo] processAtom(%j) => %s', testWord, mask ?? 'null (no trigger)');

const inert = fw.processAtom('xyzunknownooovtoken12345');
console.log('[Stencil Demo] processAtom(OOV) => %s', inert ?? 'null');
