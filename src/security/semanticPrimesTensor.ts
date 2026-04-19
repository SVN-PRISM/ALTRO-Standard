/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Primes (Crystal R^384) */

/** Crystal embedding width (must match CrystalLoader.EXPECTED_DIM). */
export const CRYSTAL_EMB_DIM = 384;

export const RESONANCE_MATRIX_ROWS = 5;
export const RESONANCE_MATRIX_COLS = 8;
export const RESONANCE_MATRIX_LEN = RESONANCE_MATRIX_ROWS * RESONANCE_MATRIX_COLS;

export type SemanticPrimeId =
  | 'Subject'
  | 'Object'
  | 'Act'
  | 'Space'
  | 'Time'
  | 'Quality'
  | 'Quantity'
  | 'Relation';

/** Canonical 8 primes (order = rows of the projection basis in crystal space). */
export const SEMANTIC_PRIME_IDS: readonly SemanticPrimeId[] = [
  'Subject',
  'Object',
  'Act',
  'Space',
  'Time',
  'Quality',
  'Quantity',
  'Relation',
] as const;

function l2NormalizeRowInPlace(m: Float32Array, row: number, cols: number): void {
  const base = row * cols;
  let s = 0;
  for (let d = 0; d < cols; d++) {
    const v = m[base + d]!;
    s += v * v;
  }
  const inv = s > 0 ? 1 / Math.sqrt(s) : 0;
  for (let d = 0; d < cols; d++) m[base + d]! *= inv;
}

/**
 * Fixed 8×384 matrix in crystal space: each row is a unit vector; rows are numerically orthogonalized (Gram–Schmidt).
 * Coordinates are deterministic from golden-angle phases (reproducible across builds).
 */
export const SEMANTIC_PRIMES_MATRIX: Float32Array = (() => {
  const rows = 8;
  const cols = CRYSTAL_EMB_DIM;
  const m = new Float32Array(rows * cols);
  const PHI = (1 + Math.sqrt(5)) / 2;
  for (let p = 0; p < rows; p++) {
    for (let d = 0; d < cols; d++) {
      const t = ((p + 1) * PHI + (d + 1) * PHI * PHI) % (2 * Math.PI);
      m[p * cols + d] = Math.sin(t);
    }
  }
  for (let p = 0; p < rows; p++) {
    const pb = p * cols;
    for (let q = 0; q < p; q++) {
      const qb = q * cols;
      let dot = 0;
      for (let d = 0; d < cols; d++) dot += m[pb + d]! * m[qb + d]!;
      for (let d = 0; d < cols; d++) m[pb + d]! -= dot * m[qb + d]!;
    }
    l2NormalizeRowInPlace(m, p, cols);
  }
  return m;
})();

/** W_int (5) ⊗ W_ext (8) → row-major 5×8 tensor (internal × external). */
export function tensorOuterProduct5x8(
  internal: ArrayLike<number>,
  external: ArrayLike<number>,
  out: Float32Array
): void {
  for (let i = 0; i < RESONANCE_MATRIX_ROWS; i++) {
    const wi = internal[i] ?? 0;
    const row = i * RESONANCE_MATRIX_COLS;
    for (let j = 0; j < RESONANCE_MATRIX_COLS; j++) {
      out[row + j] = wi * (external[j] ?? 0);
    }
  }
}

/**
 * OPR_M: multiplicative resonance on tensor cells (no additive score pooling).
 * Per cell r = (1+min(a,b))/(1+max(a,b)); returns geometric mean of r over all cells in [0,1].
 */
export function oprModulatedPsi(
  tensorObs: ArrayLike<number>,
  tensorRef: ArrayLike<number>,
  len: number = RESONANCE_MATRIX_LEN
): number {
  let acc = 0;
  for (let k = 0; k < len; k++) {
    const a = Math.max(0, Number(tensorObs[k]));
    const b = Math.max(0, Number(tensorRef[k]));
    const ratio = (1 + Math.min(a, b)) / (1 + Math.max(a, b));
    acc += Math.log(Math.max(1e-300, ratio));
  }
  return Math.exp(acc / len);
}

/** Nonlinear squash of centroid dot scores into [0,1) without affine sum-to-one. */
export function squashCentroidScore(x: number): number {
  const t = x / (1 + Math.abs(x));
  return 0.5 * (t + 1);
}
