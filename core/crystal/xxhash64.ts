/* MIT License | Copyright (c) XXHash authors / ALTRO Crystal | xxHash64 for UTF-8 keys, seed support */

const P64_1 = 0x9e3779b185ebca87n;
const P64_2 = 0xc2b2ae3d27d4eb4fn;
const P64_3 = 0x165667b19e3779f9n;
const P64_4 = 0x85ebca77c2b2ae63n;
const P64_5 = 0x27d4eb2f165667c5n;

function rotl64(x: bigint, r: number): bigint {
  return ((x << BigInt(r)) | (x >> BigInt(64 - r))) & 0xffffffffffffffffn;
}

function mix64(a: bigint): bigint {
  a ^= a >> 33n;
  a = (a * P64_2) & 0xffffffffffffffffn;
  a ^= a >> 29n;
  a = (a * P64_3) & 0xffffffffffffffffn;
  a ^= a >> 32n;
  return a;
}

function readU64LE(buf: Uint8Array, pos: number): bigint {
  let v = 0n;
  for (let i = 0; i < 8; i++) v |= BigInt(buf[pos + i]!) << BigInt(8 * i);
  return v & 0xffffffffffffffffn;
}

/**
 * xxHash64 over byte sequence (UTF-8 of normalized token). Same algorithm as build-crystal + CrystalLoader.
 */
export function xxhash64Bytes(buf: Uint8Array, seed: bigint = 0n): bigint {
  const len = buf.length;
  let h64: bigint;
  let pos = 0;

  if (len >= 32) {
    const limit = len - 32;
    let v1 = (seed + P64_1 + P64_2) & 0xffffffffffffffffn;
    let v2 = (seed + P64_2) & 0xffffffffffffffffn;
    let v3 = seed;
    let v4 = (seed - P64_1) & 0xffffffffffffffffn;

    do {
      v1 = (v1 + readU64LE(buf, pos) * P64_2) & 0xffffffffffffffffn;
      v1 = rotl64(v1, 31);
      v1 = (v1 * P64_1) & 0xffffffffffffffffn;
      pos += 8;
      v2 = (v2 + readU64LE(buf, pos) * P64_2) & 0xffffffffffffffffn;
      v2 = rotl64(v2, 31);
      v2 = (v2 * P64_1) & 0xffffffffffffffffn;
      pos += 8;
      v3 = (v3 + readU64LE(buf, pos) * P64_2) & 0xffffffffffffffffn;
      v3 = rotl64(v3, 31);
      v3 = (v3 * P64_1) & 0xffffffffffffffffn;
      pos += 8;
      v4 = (v4 + readU64LE(buf, pos) * P64_2) & 0xffffffffffffffffn;
      v4 = rotl64(v4, 31);
      v4 = (v4 * P64_1) & 0xffffffffffffffffn;
      pos += 8;
    } while (pos <= limit);

    h64 =
      (rotl64(v1, 1) + rotl64(v2, 7) + rotl64(v3, 12) + rotl64(v4, 18)) &
      0xffffffffffffffffn;
    h64 = (h64 ^ mix64(v1)) & 0xffffffffffffffffn;
    h64 = ((h64 + mix64(v2)) * P64_1) & 0xffffffffffffffffn;
    h64 = (h64 + mix64(v3)) & 0xffffffffffffffffn;
    h64 = ((h64 + mix64(v4)) * P64_1) & 0xffffffffffffffffn;
  } else {
    h64 = (seed + P64_5) & 0xffffffffffffffffn;
  }

  h64 = (h64 + BigInt(len)) & 0xffffffffffffffffn;

  while (pos + 8 <= len) {
    const k1 = readU64LE(buf, pos);
    h64 = (h64 ^ (mix64(k1 * P64_2) * P64_1)) & 0xffffffffffffffffn;
    pos += 8;
  }

  if (pos + 4 <= len) {
    let k1 = 0n;
    for (let i = 0; i < 4; i++) k1 |= BigInt(buf[pos + i]!) << BigInt(8 * i);
    h64 = (h64 ^ (k1 * P64_1)) & 0xffffffffffffffffn;
    h64 = (rotl64(h64, 23) * P64_2 + P64_3) & 0xffffffffffffffffn;
    pos += 4;
  }

  while (pos < len) {
    h64 = (h64 ^ (BigInt(buf[pos]!) * P64_5)) & 0xffffffffffffffffn;
    h64 = (rotl64(h64, 11) * P64_1) & 0xffffffffffffffffn;
    pos++;
  }

  return mix64(h64) & 0xffffffffffffffffn;
}

export function utf8Encoder(): TextEncoder {
  return new TextEncoder();
}
