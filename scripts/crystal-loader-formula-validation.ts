/**
 * Валидация CrystalLoader: V_raw (384-d), L2, сопоставление с 13 доменами через CENTROIDS
 * (первые 13 координат эмбеддинга ≠ домены — см. вывод).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import { DOMAIN_ORDER } from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_PATH = join(__dirname, '..', 'public', 'data', 'altro_crystal.bin');

/** Слово из ALTRO_LIBRARY: сильный sacred + intent в метаданных */
const TEST_WORD = 'свет';

function l2Norm(v: Float32Array): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  return Math.sqrt(s);
}

/** 13 скаляров: dot(V_raw, centroid_k), порядок строк CENTROIDS = DOMAIN_ORDER (как в build-crystal). */
function domainDots(
  buffer: ArrayBuffer,
  offCentroids: number,
  dim: number,
  v: Float32Array
): number[] {
  const dv = new DataView(buffer);
  const scores: number[] = [];
  for (let k = 0; k < 13; k++) {
    let dot = 0;
    const base = offCentroids + k * dim * 4;
    for (let d = 0; d < dim; d++) {
      dot += v[d]! * dv.getFloat32(base + d * 4, true);
    }
    scores.push(dot);
  }
  return scores;
}

function softmax(scores: number[], tau: number): number[] {
  const scaled = scores.map((x) => x / tau);
  const m = Math.max(...scaled);
  const exp = scaled.map((x) => Math.exp(x - m));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map((x) => x / sum);
}

function main(): void {
  const raw = readFileSync(BIN_PATH);
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

  const loader = new CrystalLoader();
  loader.loadFromArrayBuffer(buffer);

  const h = loader.getHeader();
  const v = loader.getVector(TEST_WORD);

  if (!v) {
    console.error(`OOV: токен «${TEST_WORD}» не найден в кристалле.`);
    process.exit(1);
  }

  const norm = l2Norm(v);
  const dots = domainDots(buffer, h.offCentroids, h.dim, v);
  const tau = 0.15;
  const sm = softmax(dots, tau);

  console.log('=== CrystalLoader — валидация матмодели ===\n');
  console.log(`Слово (ALTRO_LIBRARY, сакральный контур): «${TEST_WORD}»`);
  console.log(`dim=${h.dim}, nTokens=${h.nTokens}, flags=${h.flags} (bit0=L2 rows)\n`);

  console.log(
    '--- Важно: первые 13 компонент V_raw — это координаты эмбеддинга (ось 0..12 пространства MiniLM),'
  );
  console.log(
    '    а НЕ скаляры доменов. Сопоставление с DOMAIN_ORDER ниже — только индексация осей, не семантика доменов.\n'
  );

  for (let i = 0; i < 13; i++) {
    const label = DOMAIN_ORDER[i];
    console.log(`  [ось ${i}] как «${label}» (условная подпись): ${v[i]!.toFixed(6)}`);
  }

  console.log('\n--- L2-норма полного V_raw (384-d) ---');
  console.log(`  ||V_raw||_2 = ${norm.toFixed(6)} (ожидается ≈ 1.0 при L2-строках в билде)`);

  console.log('\n--- 13 доменных сигналов по модели кристалла: dot(V_raw, centroid_k), k ↔ DOMAIN_ORDER ---');
  dots.forEach((d, i) => {
    console.log(`  ${DOMAIN_ORDER[i]!.padEnd(14)}  dot = ${d.toFixed(6)}`);
  });

  console.log(`\n--- Пример: Softmax(dot / tau), tau=${tau} ---`);
  sm.forEach((p, i) => {
    console.log(`  ${DOMAIN_ORDER[i]!.padEnd(14)}  p = ${p.toFixed(6)}`);
  });

  const topIdx = sm.indexOf(Math.max(...sm));
  console.log(`\nАргmax после Softmax: [${DOMAIN_ORDER[topIdx]}] (индекс ${topIdx})`);

  console.log('\n--- Отклонения от «ожидаемых весов» ALTRO_LIBRARY ---');
  console.log(
    '  Для «свет» в библиотеке усилены sacred/semantic/intent — это дискретные метаданные словаря.'
  );
  console.log(
    '  Числа dot/softmax отражают геометрию MiniLM + центроиды из ALTRO_LIBRARY при сборке,'
  );
  console.log(
    '  а не пороги threshold из записи слова. Сильное расхождение с «ожидаемым доменом» возможно,'
  );
  console.log(
    '  если эмбеддинг слова в модели не совпадает с кластером центроида для этого домена.'
  );
}

main();
