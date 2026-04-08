/**
 * The Forge — сборка `public/data/altro_crystal.bin` по спецификации ALTRO_CRYSTAL_v1.md.
 * Forge **1.4**: дистиллированные якоря (`distilledAnchors.json` / `distilledAnchorsPayload.ts`) —
 * центроид = взвешенное среднее (core 1.0, nuances 0.7, isoMarkers 1.0), затем L2; spec_version=3.
 * @xenova/transformers только на этапе сборки (devDependency), не в рантайме SDK.
 *
 * Словарь: criticalInjection → все термины дистилляции → altroData → RU/EN frequency (fetch),
 * целевой объём — CRYSTAL_TARGET_N (по умолчанию 11000).
 */

import { createHash } from 'node:crypto';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from '@xenova/transformers';
import { xxhash64Bytes, utf8Encoder } from '../core/crystal/xxhash64';
import { CRITICAL_INJECTION_V14, DISTILLED_ANCHORS_PAYLOAD } from './distilledAnchorsPayload';
import {
  ALTRO_LIBRARY,
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  HOMONYM_WORDS,
  PROPER_NOUNS,
  SPELLCHECK_DICTIONARY,
} from '../src/lib/altroData';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_PATH = join(ROOT, 'public', 'data', 'altro_crystal.bin');

const MAGIC = 0x414c5452;
/** Forge 1.4: IP-дистилляция якорей + взвешенные центроиды (layout v1 совместим). */
const SPEC_VERSION = 3;
const FLAG_VECTORS_L2 = 1;
const SLOT_STRIDE = 16;
const EMPTY_INDEX = 0xffffffff;
const NUM_DOMAINS = 13;
const HASH_SEED = 0xc4f0e3eb3c6d372dn;

/** Порядок доменов = порядок полей DomainWeights в altroData */
const DOMAIN_ORDER = [
  'economics',
  'politics',
  'society',
  'history',
  'culture',
  'aesthetics',
  'technology',
  'spirituality',
  'semantics',
  'context',
  'intent',
  'imagery',
  'ethics',
] as const;

type DomainKey = (typeof DOMAIN_ORDER)[number];

const WEIGHT_CORE = 1.0;
const WEIGHT_NUANCE = 0.7;
const WEIGHT_ISO = 1.0;

function flattenDistilledTermsNormalized(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const n = normalizeCrystalToken(raw);
    if (!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  for (const dom of DOMAIN_ORDER) {
    const block = DISTILLED_ANCHORS_PAYLOAD.domains[dom];
    if (!block) continue;
    for (const t of block.core) push(t);
    for (const t of block.nuances) push(t);
    for (const t of block.isoMarkers) push(t);
  }
  return out;
}

function align64(n: number): number {
  return (n + 63) & ~63;
}

function normalizeCrystalToken(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

function splitLetterWords(s: string): string[] {
  return s
    .split(/[^\p{L}]+/u)
    .map(normalizeCrystalToken)
    .filter((w) => w.length > 0);
}

function collectAltroSeedTokens(): string[] {
  const out: string[] = [];
  const push = (w: string) => {
    const n = normalizeCrystalToken(w);
    if (n.length > 0) out.push(n);
  };

  for (const key of Object.keys(ALTRO_LIBRARY)) {
    push(key);
    splitLetterWords(key).forEach(push);
    const entry = ALTRO_LIBRARY[key];
    if (!entry) continue;
    for (const meta of Object.values(entry)) {
      if (meta?.text) splitLetterWords(meta.text).forEach(push);
    }
  }

  for (const w of HOMONYM_WORDS) push(w);
  for (const w of Object.keys(HOMONYM_WORD_FORMS)) push(w);
  for (const w of SPELLCHECK_DICTIONARY) push(w);
  for (const w of PROPER_NOUNS) push(w);

  for (const e of HOMONYM_DB) {
    push(e.base);
    for (const v of e.variants) {
      splitLetterWords(v.word).forEach(push);
      splitLetterWords(v.meaning).forEach(push);
    }
  }

  return out;
}

async function fetchFrequencyTokens(
  url: string,
  maxLines: number
): Promise<string[]> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  const text = await res.text();
  const words: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (words.length >= maxLines) break;
    const first = line.trim().split(/\s+/)[0];
    if (!first) continue;
    const n = normalizeCrystalToken(first);
    if (n.length < 2) continue;
    if (!/^[\p{L}\-]+$/u.test(n)) continue;
    words.push(n);
  }
  return words;
}

function mergeUniqueTokens(targetN: number, ...batches: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const batch of batches) {
    for (const w of batch) {
      if (seen.has(w)) continue;
      seen.add(w);
      merged.push(w);
      if (merged.length >= targetN) return merged;
    }
  }
  return merged;
}

function l2NormalizeInPlace(v: Float32Array): void {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i]! /= n;
}

function buildOpenAddressingTable(
  tokens: string[],
  hashSeed: bigint,
  hashSlots: number
): { table: Buffer } {
  const enc = utf8Encoder();
  const table = Buffer.alloc(hashSlots * SLOT_STRIDE);
  const dv = new DataView(table.buffer, table.byteOffset, table.byteLength);

  const writeEmpty = (slot: number) => {
    const o = slot * SLOT_STRIDE;
    dv.setBigUint64(o, 0n, true);
    dv.setUint32(o + 8, EMPTY_INDEX, true);
    dv.setUint32(o + 12, 0, true);
  };

  for (let s = 0; s < hashSlots; s++) writeEmpty(s);

  for (let row = 0; row < tokens.length; row++) {
    const bytes = enc.encode(tokens[row]!);
    const h = xxhash64Bytes(bytes, hashSeed);
    if (h === 0n) {
      throw new Error(
        'Token produced xxhash64=0; change HASH_SEED in build-crystal.ts'
      );
    }
    let slot = Number(h % BigInt(hashSlots));
    let placed = false;
    for (let _p = 0; _p < hashSlots; _p++) {
      const o = slot * SLOT_STRIDE;
      const sh = dv.getBigUint64(o, true);
      const si = dv.getUint32(o + 8, true);
      const empty = sh === 0n && si === EMPTY_INDEX;
      if (empty) {
        dv.setBigUint64(o, h, true);
        dv.setUint32(o + 8, row, true);
        dv.setUint32(o + 12, 0, true);
        placed = true;
        break;
      }
      if (sh === h && si === row) {
        placed = true;
        break;
      }
      slot = (slot + 1) % hashSlots;
    }
    if (!placed) {
      throw new Error(
        'Hash table overflow: increase load factor or CRYSTAL_HASH_MULT'
      );
    }
  }

  return { table };
}

function writeHeader(
  buf: Buffer,
  opts: {
    dim: number;
    nTokens: number;
    offHash: number;
    hashSlots: number;
    offVectors: number;
    offCentroids: number;
    fileSize: number;
  }
): void {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  dv.setUint32(0, MAGIC, true);
  dv.setUint16(4, SPEC_VERSION, true);
  dv.setUint16(6, FLAG_VECTORS_L2, true);
  dv.setUint32(8, opts.dim, true);
  dv.setUint32(12, opts.nTokens, true);
  dv.setBigUint64(16, HASH_SEED, true);
  dv.setBigUint64(24, BigInt(opts.offHash), true);
  dv.setUint32(32, opts.hashSlots, true);
  dv.setUint32(36, SLOT_STRIDE, true);
  dv.setBigUint64(40, BigInt(opts.offVectors), true);
  dv.setBigUint64(48, BigInt(opts.offCentroids), true);
  dv.setBigUint64(56, 0n, true);
  dv.setBigUint64(64, BigInt(opts.fileSize), true);
  dv.setBigUint64(72, 0n, true);
}

/** Детерминированные векторы без HF (геометрия не семантическая; валидный .bin для CI/офлайн). */
function embedSyntheticDeterministic(tokens: string[], dim: number): Float32Array {
  const enc = utf8Encoder();
  const out = new Float32Array(tokens.length * dim);
  for (let i = 0; i < tokens.length; i++) {
    const bytes = Buffer.from(enc.encode(tokens[i]!));
    const row = out.subarray(i * dim, (i + 1) * dim);
    let salt = 0;
    for (let d = 0; d < dim; ) {
      const h = createHash('sha256').update(bytes).update(`|${salt}|`).digest();
      salt++;
      for (let k = 0; k + 4 <= h.length && d < dim; k += 4) {
        const u = h.readUInt32LE(k);
        row[d++] = (u / 0xffffffff) * 2 - 1;
      }
    }
    l2NormalizeInPlace(row);
  }
  return out;
}

/**
 * Forge 1.4: при SHA256-эмбеддингах латинские леммы не коррелируют с центроидами.
 * Копируем строку вектора с канонической EN-леммы (тот же L2), затем центроид intent/… снова согласуется.
 */
const LATIN_LEMMA_VECTOR_SOURCES: Record<string, string> = {
  intentio: 'intent',
  conscientia: 'moral',
  secretum: 'context',
};

function alignLatinLemmaVectors(tokens: string[], vectors: Float32Array, dim: number): void {
  const tokenToRow = new Map<string, number>();
  tokens.forEach((t, i) => tokenToRow.set(t, i));
  for (const [alias, source] of Object.entries(LATIN_LEMMA_VECTOR_SOURCES)) {
    const ri = tokenToRow.get(alias);
    const rs = tokenToRow.get(source);
    if (ri === undefined || rs === undefined) continue;
    const srcBase = rs * dim;
    const dstBase = ri * dim;
    for (let d = 0; d < dim; d++) {
      vectors[dstBase + d] = vectors[srcBase + d]!;
    }
  }
  console.log('[Forge] Latin lemma vectors aligned to canonical lemmas (synthetic embed only).');
}

async function embedAllTokensTransformers(
  tokens: string[],
  dim: number,
  batchSize: number
): Promise<Float32Array> {
  const extractor = await pipeline(
    'feature-extraction',
    'Xenova/paraphrase-multilingual-MiniLM-L6-v2'
  );
  const out = new Float32Array(tokens.length * dim);
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize);
    const raw = await extractor(batch, {
      pooling: 'mean',
      normalize: true,
    });
    const data = raw.data as Float32Array;
    const gotDim = raw.dims?.[raw.dims.length - 1] ?? dim;
    if (gotDim !== dim) {
      throw new Error(`Expected dim ${dim}, model returned ${gotDim}`);
    }
    for (let b = 0; b < batch.length; b++) {
      const rowOff = (i + b) * dim;
      const srcOff = b * dim;
      for (let d = 0; d < dim; d++) {
        out[rowOff + d] = data[srcOff + d]!;
      }
    }
    process.stdout.write(
      `\r[Forge] embedded ${Math.min(i + batchSize, tokens.length)}/${tokens.length}`
    );
  }
  process.stdout.write('\n');
  return out;
}

async function embedAllTokens(
  tokens: string[],
  dim: number,
  batchSize: number
): Promise<{ vectors: Float32Array; synthetic: boolean }> {
  if (process.env.CRYSTAL_SYNTHETIC === '1') {
    console.warn(
      '[Forge] CRYSTAL_SYNTHETIC=1 — SHA256-based vectors (not semantic); use transformers when HF доступен.'
    );
    return { vectors: embedSyntheticDeterministic(tokens, dim), synthetic: true };
  }
  try {
    return {
      vectors: await embedAllTokensTransformers(tokens, dim, batchSize),
      synthetic: false,
    };
  } catch (err) {
    console.warn(
      '[Forge] Transformers / Hugging Face недоступны; fallback на детерминированные векторы:',
      err instanceof Error ? err.message : err
    );
    return { vectors: embedSyntheticDeterministic(tokens, dim), synthetic: true };
  }
}

/**
 * Центроид k = L2( Σ w_i V_i / Σ w_i ), где w ∈ {1.0 core, 0.7 nuances, 1.0 isoMarkers}.
 */
function buildCentroids(
  tokens: string[],
  vectors: Float32Array,
  dim: number
): Float32Array {
  const tokenToRow = new Map<string, number>();
  tokens.forEach((t, i) => tokenToRow.set(t, i));

  const globalMean = new Float64Array(dim);
  for (let i = 0; i < tokens.length; i++) {
    for (let d = 0; d < dim; d++) globalMean[d] += vectors[i * dim + d]!;
  }
  const invN = 1 / Math.max(1, tokens.length);
  for (let d = 0; d < dim; d++) globalMean[d]! *= invN;

  const centroids = new Float32Array(NUM_DOMAINS * dim);

  for (let di = 0; di < NUM_DOMAINS; di++) {
    const domKey = DOMAIN_ORDER[di]!;
    const block = DISTILLED_ANCHORS_PAYLOAD.domains[domKey];
    const accum = new Float64Array(dim);
    let sumW = 0;

    const addWeighted = (raw: string, w: number) => {
      const norm = normalizeCrystalToken(raw);
      if (!norm) return;
      const row = tokenToRow.get(norm);
      if (row === undefined) return;
      const base = row * dim;
      for (let d = 0; d < dim; d++) accum[d] += w * vectors[base + d]!;
      sumW += w;
    };

    if (block) {
      for (const t of block.core) addWeighted(t, WEIGHT_CORE);
      for (const t of block.nuances) addWeighted(t, WEIGHT_NUANCE);
      for (const t of block.isoMarkers) addWeighted(t, WEIGHT_ISO);
    }

    const slice = centroids.subarray(di * dim, (di + 1) * dim);
    if (sumW > 0) {
      const inv = 1 / sumW;
      for (let d = 0; d < dim; d++) slice[d] = accum[d]! * inv;
    } else {
      for (let d = 0; d < dim; d++) slice[d] = globalMean[d]!;
    }
    l2NormalizeInPlace(slice);
  }

  return centroids;
}

async function main(): Promise<void> {
  const targetN = Math.max(1, Number(process.env.CRYSTAL_TARGET_N || 11000) | 0);
  const batchSize = Math.max(1, Number(process.env.CRYSTAL_BATCH || 8) | 0);

  console.log('[Forge 1.4] Collecting tokens (critical + distilled anchors + altroData + frequency)…');
  const critical = CRITICAL_INJECTION_V14.map((w) => normalizeCrystalToken(w)).filter(Boolean);
  const anchorFlat = flattenDistilledTermsNormalized().filter((w) => w.length > 0);
  const altroBatch = collectAltroSeedTokens();

  const ruUrl =
    process.env.CRYSTAL_RU_FREQ_URL ??
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt';
  const enUrl =
    process.env.CRYSTAL_EN_FREQ_URL ??
    'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt';

  let ruExtra: string[] = [];
  let enExtra: string[] = [];
  try {
    ruExtra = await fetchFrequencyTokens(ruUrl, 60000);
    console.log(`[Forge] RU frequency lines: ${ruExtra.length}`);
  } catch (e) {
    console.warn('[Forge] RU frequency fetch failed:', e);
  }
  try {
    enExtra = await fetchFrequencyTokens(enUrl, 60000);
    console.log(`[Forge] EN frequency lines: ${enExtra.length}`);
  } catch (e) {
    console.warn('[Forge] EN frequency fetch failed:', e);
  }

  const tokens = mergeUniqueTokens(
    targetN,
    critical,
    anchorFlat,
    altroBatch,
    ruExtra,
    enExtra
  );
  if (tokens.length < targetN) {
    console.warn(
      `[Forge] Only ${tokens.length} unique tokens (target ${targetN}). Check network or CRYSTAL_*_FREQ_URL.`
    );
  } else {
    console.log(`[Forge] Unique tokens: ${tokens.length}`);
  }

  const dim = 384;
  console.log('[Forge] Embedding (MiniLM multilingual, dim=384)…');
  const { vectors, synthetic } = await embedAllTokens(tokens, dim, batchSize);
  if (synthetic) {
    alignLatinLemmaVectors(tokens, vectors, dim);
  }

  console.log('[Forge] Building domain centroids…');
  const centroids = buildCentroids(tokens, vectors, dim);

  const n = tokens.length;
  const hashSlots = Math.max(
    Math.ceil(n * 1.5),
    1024
  );
  const alignedHashSlots = hashSlots;

  console.log('[Forge] Hash table (open addressing)…');
  const { table: hashTable } = buildOpenAddressingTable(tokens, HASH_SEED, alignedHashSlots);

  const offHash = align64(256);
  const hashByteLen = hashTable.length;
  const offVectors = align64(offHash + hashByteLen);
  const vectorsByteLen = n * dim * 4;
  const offCentroids = align64(offVectors + vectorsByteLen);
  const centroidsByteLen = NUM_DOMAINS * dim * 4;
  const fileSize = offCentroids + centroidsByteLen;

  const header = Buffer.alloc(256);
  writeHeader(header, {
    dim,
    nTokens: n,
    offHash,
    hashSlots: alignedHashSlots,
    offVectors,
    offCentroids,
    fileSize,
  });

  mkdirSync(dirname(OUT_PATH), { recursive: true });

  const ws = createWriteStream(OUT_PATH);
  await new Promise<void>((resolve, reject) => {
    ws.on('error', reject);
    ws.on('finish', () => resolve());
    ws.write(header);
    const pad1 = Buffer.alloc(offHash - 256);
    if (pad1.length) ws.write(pad1);
    ws.write(hashTable);
    const pad2 = Buffer.alloc(offVectors - offHash - hashByteLen);
    if (pad2.length) ws.write(pad2);
    ws.write(Buffer.from(vectors.buffer, vectors.byteOffset, vectorsByteLen));
    const pad3 = Buffer.alloc(offCentroids - offVectors - vectorsByteLen);
    if (pad3.length) ws.write(pad3);
    ws.write(Buffer.from(centroids.buffer, centroids.byteOffset, centroidsByteLen));
    ws.end();
  });

  console.log(`[Forge] Wrote ${OUT_PATH} (${fileSize} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
