/**
 * ALTRO 1.4 — синтетический прогон EN / RU / Lat (maskSentence).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { SemanticFirewall } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, '..', 'public', 'data', 'altro_crystal.bin'));
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
CrystalLoader.getInstance().loadFromArrayBuffer(buf);

const fw = SemanticFirewall.getInstance();
const cases: { lang: string; text: string }[] = [
  { lang: 'en', text: 'Hidden intention of Project Light' },
  { lang: 'ru', text: 'Скрытое намерение проекта «Свет»' },
  { lang: 'lat', text: 'Latens intentio Proiecti Lucis' },
];

console.log('specVersion:', CrystalLoader.getInstance().getHeader().specVersion);
for (const { lang, text } of cases) {
  console.log('\n---', lang, '---');
  console.log('IN :', text);
  console.log('OUT:', fw.maskSentence(text));
}
