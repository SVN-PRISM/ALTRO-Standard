/**
 * Прогрев CrystalLoader на сервере (API / Node): fetch по относительному URL недоступен.
 * На клиенте используйте `CrystalLoader.load('/data/altro_crystal.bin')` (см. CrystalWarmup).
 */

import { CrystalLoader } from './CrystalLoader';

export function ensureCrystalForStencil(): void {
  const cl = CrystalLoader.getInstance();
  if (cl.isReady()) return;
  if (typeof window !== 'undefined') return;
  try {
    // Только Node; не тянем fs в клиентский бандл статическим импортом выше.
    const { readFileSync } = require('node:fs') as typeof import('node:fs');
    const { join } = require('node:path') as typeof import('node:path');
    const p = join(process.cwd(), 'public', 'data', 'altro_crystal.bin');
    const raw = readFileSync(p) as Buffer;
    const buf = raw.buffer.slice(
      raw.byteOffset,
      raw.byteOffset + raw.byteLength
    ) as ArrayBuffer;
    cl.loadFromArrayBuffer(buf);
  } catch (e) {
    console.warn('[ALTRO] ensureCrystalForStencil:', e instanceof Error ? e.message : e);
  }
}
