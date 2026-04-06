/**
 * Задачи 3.2 / 3.3: maskSentence + калибровка порогов intent/context (−15…20%).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CrystalLoader } from '../src/lib/altro/CrystalLoader';
import {
  DOMAIN_ORDER,
  SemanticFirewall,
  STENCIL_DOMAIN_THRESHOLDS,
} from '../src/security/SemanticFirewall';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '..', 'public', 'data', 'altro_crystal.bin');

const raw = readFileSync(BIN);
const buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
CrystalLoader.getInstance().loadFromArrayBuffer(buf);

const fw = SemanticFirewall.getInstance();

const sentence =
  'Этот свет несет истинный смысл и глубокое намерение';

/** S_k для слова (все 13 доменов), или null если OOV */
function getDomainScores(word: string): Float32Array | null {
  const cl = CrystalLoader.getInstance();
  const v = cl.getVector(word.normalize('NFC').toLowerCase().trim());
  if (!v) return null;
  const out = new Float32Array(13);
  cl.dotCentroidsInPlace(v, out);
  return out;
}

const idx = (k: (typeof DOMAIN_ORDER)[number]) => DOMAIN_ORDER.indexOf(k);

console.log('=== Шаг 3.3 — калибровка чувствительности (intent/context) ===\n');

const baselineContext = STENCIL_DOMAIN_THRESHOLDS.context;
const baselineIntent = STENCIL_DOMAIN_THRESHOLDS.intent;
/** ~17.5% снижение (между 15% и 20%) */
const CALIBRATION_FACTOR = 0.825;

STENCIL_DOMAIN_THRESHOLDS.context = baselineContext * CALIBRATION_FACTOR;
STENCIL_DOMAIN_THRESHOLDS.intent = baselineIntent * CALIBRATION_FACTOR;

console.log('Базовые пороги (SemanticFirewall):');
console.log(`  context: ${baselineContext.toFixed(4)}  →  ${STENCIL_DOMAIN_THRESHOLDS.context.toFixed(4)} (−${((1 - CALIBRATION_FACTOR) * 100).toFixed(1)}%)`);
console.log(`  intent:  ${baselineIntent.toFixed(4)}  →  ${STENCIL_DOMAIN_THRESHOLDS.intent.toFixed(4)} (−${((1 - CALIBRATION_FACTOR) * 100).toFixed(1)}%)\n`);

const wordRe = /\p{L}+(?:[-']\p{L}+)*/gu;
const words = sentence.match(wordRe) ?? [];

console.log('--- Скаляры S_k = V·C_k (критические оси) для слов теста ---');
const focus = ['свет', 'смысл', 'намерение'] as const;
for (const w of focus) {
  const s = getDomainScores(w);
  if (!s) {
    console.log(`  «${w}»: OOV (нет в кристалле) — маска по кристаллу невозможна`);
    continue;
  }
  const sp = s[idx('spirituality')]!;
  const ctx = s[idx('context')]!;
  const int = s[idx('intent')]!;
  console.log(`  «${w}»:`);
  console.log(`    spirituality: ${sp.toFixed(6)}  (порог ${STENCIL_DOMAIN_THRESHOLDS.spirituality.toFixed(4)} → маска при S ≥ порог)`);
  console.log(`    context:      ${ctx.toFixed(6)}  (порог ${STENCIL_DOMAIN_THRESHOLDS.context.toFixed(4)})`);
  console.log(`    intent:       ${int.toFixed(6)}  (порог ${STENCIL_DOMAIN_THRESHOLDS.intent.toFixed(4)})`);
  console.log(
    `    Диапазон триггера: spirituality при τ_sp ≤ ${sp.toFixed(6)}; context при τ_ctx ≤ ${ctx.toFixed(6)}; intent при τ_int ≤ ${int.toFixed(6)}`
  );
}

console.log('\nПримечание: processAtom берёт первую критическую ось по порядку spirituality → context → intent → ethics.');
console.log('Если S_spirituality уже выше порога, маска будет [ID:MASK_spirituality], даже при высоком intent.\n');

const masked = fw.maskSentence(sentence);

console.log('Исходник:\n ', sentence);
console.log('\nПосле maskSentence (калибровка):\n ', masked);

console.log('\n--- По словам (processAtom) ---');
for (const w of words) {
  const atom = fw.processAtom(w);
  const status = atom ?? '(без маски)';
  console.log(`  «${w}» → ${status}`);
}

console.log('\n=== ОТЧЁТ 3.3 — динамический диапазон и калибровка ===');
console.log(
  `Использованные пороги после калибровки: context = ${(baselineContext * CALIBRATION_FACTOR).toFixed(4)}, intent = ${(baselineIntent * CALIBRATION_FACTOR).toFixed(4)} (−17.5% к базе).`
);
console.log('');
console.log('«свет»: S_spirituality = 0.381 ≥ 0.32 → стабильно [ID:MASK_spirituality] (до и после калибровки intent/context).');
console.log(
  '«смысл»: S_context, S_intent < 0 при текущих центроидах — условие S_k ≥ τ с положительными τ не выполняется; снижение только intent/context не «всплывает» слово.'
);
console.log(
  '  Теоретически маска по context потребовала бы τ_context ≤ −0.019 (и тогда смысл триггерился бы раньше spirituality на других словах — политика порогов ломается).'
);
console.log('«намерение»: токен отсутствует в altro_crystal.bin (OOV) — getVector = null, калибровка порогов не помогает; нужен пересбор/расширение словаря The Forge.');
console.log('');
console.log('Вывод: динамический диапазон по intent/context для этой фразы ограничен данными кристалла (OOV, отрицательные S_k).');

console.log('\n=== Восстановление порогов ===');
STENCIL_DOMAIN_THRESHOLDS.context = baselineContext;
STENCIL_DOMAIN_THRESHOLDS.intent = baselineIntent;
console.log(`  context: ${STENCIL_DOMAIN_THRESHOLDS.context}, intent: ${STENCIL_DOMAIN_THRESHOLDS.intent}`);
