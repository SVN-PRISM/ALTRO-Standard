/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Crystal — runtime loader (isolated) */

import { utf8Encoder, xxhash64Bytes } from '@core/crystal/xxhash64';

const CRYSTAL_MAGIC = 0x414c5452;
const HEADER_SIZE = 256;
const EXPECTED_DIM = 384;
const SLOT_STRIDE = 16;
const EMPTY_INDEX = 0xffffffff;
const NUM_DOMAINS = 13;

export interface CrystalHeaderInfo {
  specVersion: number;
  flags: number;
  dim: number;
  nTokens: number;
  hashSeed: bigint;
  hashSlots: number;
  offHash: number;
  offVectors: number;
  offCentroids: number;
}

function normalizeCrystalToken(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

/**
 * Загрузчик `altro_crystal.bin`: HEADER 256B, HASH_TABLE (open addressing + xxHash64),
 * VECTORS row-major Float32. Не подключается к UI — только загрузка и getVector.
 */
export class CrystalLoader {
  private static instance: CrystalLoader | null = null;

  private buffer: ArrayBuffer | null = null;
  private header: CrystalHeaderInfo | null = null;
  private tableView: DataView | null = null;
  private vectors: Float32Array | null = null;
  /** 13 × dim, row-major: строка k = домен k в порядке ALTRO_CRYSTAL_v1 / DOMAIN_ORDER */
  private centroidsFlat: Float32Array | null = null;
  private readonly encoder = utf8Encoder();

  static getInstance(): CrystalLoader {
    if (CrystalLoader.instance == null) {
      CrystalLoader.instance = new CrystalLoader();
    }
    return CrystalLoader.instance;
  }

  /**
   * Загружает артефакт с публичного URL (Next: `public/data` → `/data/...`).
   */
  async load(url = '/data/altro_crystal.bin'): Promise<void> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`CrystalLoader: fetch failed ${res.status} ${res.statusText}`);
    }
    this.buffer = await res.arrayBuffer();
    this.parseAndBind();
  }

  /**
   * Загрузка из уже полученного буфера (тесты, Node `readFileSync`, без fetch).
   */
  loadFromArrayBuffer(buffer: ArrayBuffer): void {
    this.buffer = buffer;
    this.parseAndBind();
  }

  /** Парсинг заголовка и привязка представлений; проверка dim=384 и N_tokens. */
  private parseAndBind(): void {
    const buf = this.buffer;
    if (!buf || buf.byteLength < HEADER_SIZE) {
      throw new Error('CrystalLoader: buffer too small for header');
    }

    const dv = new DataView(buf);
    const magic = dv.getUint32(0, true);
    if (magic !== CRYSTAL_MAGIC) {
      throw new Error(
        `CrystalLoader: bad magic 0x${magic.toString(16)}, expected 0x${CRYSTAL_MAGIC.toString(16)}`
      );
    }

    const specVersion = dv.getUint16(4, true);
    const flags = dv.getUint16(6, true);
    const dim = dv.getUint32(8, true);
    const nTokens = dv.getUint32(12, true);

    if (dim !== EXPECTED_DIM) {
      throw new Error(`CrystalLoader: expected dim ${EXPECTED_DIM}, got ${dim}`);
    }
    if (nTokens < 1) {
      throw new Error(`CrystalLoader: invalid nTokens ${nTokens}`);
    }

    const hashSeed = dv.getBigUint64(16, true);
    const offHash = Number(dv.getBigUint64(24, true));
    const hashSlots = dv.getUint32(32, true);
    const slotStride = dv.getUint32(36, true);
    const offVectors = Number(dv.getBigUint64(40, true));
    const offCentroids = Number(dv.getBigUint64(48, true));

    if (slotStride !== SLOT_STRIDE) {
      throw new Error(`CrystalLoader: expected slot_stride ${SLOT_STRIDE}, got ${slotStride}`);
    }
    if (!Number.isSafeInteger(offHash) || offHash < HEADER_SIZE) {
      throw new Error(`CrystalLoader: invalid off_hash ${offHash}`);
    }
    if (!Number.isSafeInteger(offVectors) || offVectors < offHash) {
      throw new Error(`CrystalLoader: invalid off_vectors ${offVectors}`);
    }

    const vectorsFloats = nTokens * dim;
    const vectorsBytes = vectorsFloats * 4;
    if (offVectors + vectorsBytes > buf.byteLength) {
      throw new Error(
        `CrystalLoader: VECTORS region out of range (need ${offVectors + vectorsBytes}, have ${buf.byteLength})`
      );
    }

    const centroidsFloats = NUM_DOMAINS * dim;
    const centroidsBytes = centroidsFloats * 4;
    if (offCentroids + centroidsBytes > buf.byteLength) {
      throw new Error(
        `CrystalLoader: CENTROIDS region out of range (need ${offCentroids + centroidsBytes}, have ${buf.byteLength})`
      );
    }

    this.header = {
      specVersion,
      flags,
      dim,
      nTokens,
      hashSeed,
      hashSlots,
      offHash,
      offVectors,
      offCentroids,
    };

    this.tableView = new DataView(buf, offHash, hashSlots * SLOT_STRIDE);
    this.vectors = new Float32Array(buf, offVectors, vectorsFloats);
    this.centroidsFlat = new Float32Array(buf, offCentroids, centroidsFloats);
  }

  /** Кристалл загружен и готов к lookup / dot с центроидами */
  isReady(): boolean {
    return this.buffer != null && this.vectors != null && this.centroidsFlat != null && this.header != null;
  }

  /**
   * S_k = V · C_k для k = 0..12; без аллокаций (out длины ≥ 13).
   */
  dotCentroidsInPlace(v: Float32Array, out: Float32Array): void {
    const c = this.centroidsFlat;
    const hInfo = this.header;
    if (!c || !hInfo) {
      throw new Error('CrystalLoader: load() first');
    }
    const dim = hInfo.dim;
    if (v.length < dim) {
      throw new Error(`CrystalLoader: vector dim mismatch (need ${dim})`);
    }
    if (out.length < NUM_DOMAINS) {
      throw new Error('CrystalLoader: out.length must be >= 13');
    }
    for (let k = 0; k < NUM_DOMAINS; k++) {
      let dot = 0;
      const base = k * dim;
      for (let d = 0; d < dim; d++) {
        dot += v[d]! * c[base + d]!;
      }
      out[k] = dot;
    }
  }

  getHeader(): CrystalHeaderInfo {
    if (!this.header) {
      throw new Error('CrystalLoader: load() first');
    }
    return this.header;
  }

  /**
   * Индекс строки в HASH_TABLE: xxHash64(UTF-8(normalized word), hash_seed) + linear probing
   * (как в scripts/build-crystal.ts).
   */
  private lookupRowIndex(word: string): number | null {
    const hInfo = this.header;
    const table = this.tableView;
    if (!hInfo || !table) {
      throw new Error('CrystalLoader: load() first');
    }

    const bytes = this.encoder.encode(normalizeCrystalToken(word));
    const h = xxhash64Bytes(bytes, hInfo.hashSeed);
    if (h === 0n) {
      return null;
    }

    const { hashSlots, offHash, nTokens } = hInfo;
    let slot = Number(h % BigInt(hashSlots));

    for (let probe = 0; probe < hashSlots; probe++) {
      const o = slot * SLOT_STRIDE;
      const sh = table.getBigUint64(o, true);
      const si = table.getUint32(o + 8, true);
      const empty = sh === 0n && si === EMPTY_INDEX;
      if (empty) {
        return null;
      }
      if (sh === h) {
        if (si >= nTokens) {
          return null;
        }
        return si;
      }
      slot = (slot + 1) % hashSlots;
    }
    return null;
  }

  /**
   * Вектор эмбеддинга строки словаря [dim], или null если OOV / не загружено.
   */
  getVector(word: string): Float32Array | null {
    const vecs = this.vectors;
    const hInfo = this.header;
    if (!vecs || !hInfo) {
      throw new Error('CrystalLoader: load() first');
    }
    const row = this.lookupRowIndex(word);
    if (row === null) {
      return null;
    }
    const dim = hInfo.dim;
    const start = row * dim;
    return vecs.subarray(start, start + dim);
  }
}
