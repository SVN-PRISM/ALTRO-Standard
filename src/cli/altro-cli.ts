/**
 * ALTRO 1.4 — терминальный CLI (stencil | mirror + порог критических осей).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../lib/altro/CrystalLoader';
import { DOMAIN_ORDER, SemanticFirewall } from '../security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRYSTAL_PATH = join(__dirname, '..', '..', 'public', 'data', 'altro_crystal.bin');

function parseArgs(argv: string[]): {
  input?: string;
  mode: 'stencil' | 'mirror';
  threshold: number | null;
  difuzzy: boolean;
} {
  let input: string | undefined;
  let mode: 'stencil' | 'mirror' = 'stencil';
  let threshold: number | null = null;
  let difuzzy = false;

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--input' && argv[i + 1]) {
      input = argv[++i];
      continue;
    }
    if (a.startsWith('--input=')) {
      input = a.slice('--input='.length);
      continue;
    }
    if (a === '--mode' && argv[i + 1]) {
      const m = argv[++i]!.toLowerCase();
      if (m !== 'stencil' && m !== 'mirror') {
        console.error('altro-cli: --mode must be stencil or mirror');
        process.exit(2);
      }
      mode = m as 'stencil' | 'mirror';
      continue;
    }
    if (a.startsWith('--mode=')) {
      const m = a.slice('--mode='.length).toLowerCase();
      if (m !== 'stencil' && m !== 'mirror') {
        console.error('altro-cli: --mode must be stencil or mirror');
        process.exit(2);
      }
      mode = m as 'stencil' | 'mirror';
      continue;
    }
    if (a === '--threshold' && argv[i + 1]) {
      const t = Number(argv[++i]);
      if (!Number.isFinite(t)) {
        console.error('altro-cli: --threshold must be a number');
        process.exit(2);
      }
      threshold = t;
      continue;
    }
    if (a.startsWith('--threshold=')) {
      const t = Number(a.slice('--threshold='.length));
      if (!Number.isFinite(t)) {
        console.error('altro-cli: --threshold must be a number');
        process.exit(2);
      }
      threshold = t;
      continue;
    }
    if (a === '--difuzzy') {
      difuzzy = true;
      continue;
    }
    if (a.startsWith('--difuzzy=')) {
      const v = a.slice('--difuzzy='.length).toLowerCase();
      difuzzy = !(v === '0' || v === 'false' || v === 'no' || v === 'off');
      continue;
    }
  }

  return { input, mode, threshold, difuzzy };
}

function main(): void {
  const { input, mode, threshold, difuzzy } = parseArgs(process.argv);
  if (input == null || input === '') {
    console.error(
      'Usage: altro-cli --input "text" [--mode stencil|mirror] [--threshold 0.8] [--difuzzy]'
    );
    process.exit(1);
  }

  const raw = readFileSync(CRYSTAL_PATH);
  const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
  CrystalLoader.getInstance().loadFromArrayBuffer(buf);

  const fw = SemanticFirewall.getInstance();
  fw.setStencilCriticalThresholdOverride(threshold);
  fw.setFuzzyMode(difuzzy);

  if (mode === 'stencil') {
    process.stdout.write(`${fw.maskSentence(input)}\n`);
    return;
  }

  process.stdout.write(`${input}\n`);
  const re = /(\p{L}+(?:[-']\p{L}+)*|\s+|[^\p{L}\s]+)/gu;
  const parts = input.match(re) ?? [];
  for (const part of parts) {
    if (!/^\p{L}+(?:[-']\p{L}+)*$/u.test(part)) continue;
    const scores = fw.getStencilDomainScores(part);
    if (scores) {
      const domains = DOMAIN_ORDER.reduce<Record<string, number>>((acc, k, i) => {
        acc[k] = scores[i]!;
        return acc;
      }, {});
      console.error(JSON.stringify({ token: part, domains }));
    } else {
      console.error(JSON.stringify({ token: part, oov: true }));
    }
  }
}

main();
