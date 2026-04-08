/**
 * DIAGNOSTIC MODE: FIREWALL_MONITOR_TEST_v1.0
 *
 * Phase 1: Семантический пакет для строгого юридического контракта.
 * Phase 2: Имитация галлюцинации модели → прогон через AltroGuard.verifyAndHeal().
 *
 * Run: npx tsx src/tests/firewall_monitor_diagnostic.ts
 *
 * Требуется: Ollama на http://localhost:11434 (или ALTRO_OLLAMA_URL)
 */

import type { SemanticPacket } from '@/archive/legacy_altro/SemanticPackager';
import { AltroGuard } from '@/lib/altro/AltroGuard';
import { validateResonance } from '@/archive/legacy_altro/ResonanceValidator';

const EXPECTED_ANCHORS = ['Безотзывность', 'Срок 12 месяцев', 'Штраф 15%'];

/** Phase 1: Семантический пакет для строгого юридического контракта */
function buildLegalContractPacket(): SemanticPacket {
  return {
    intent_summary: 'Юридический контракт с фиксированными обязательствами: безотзывность, срок 12 месяцев, штраф 15% при нарушении.',
    domain_focus: ['economics', 'politics', 'semantics'],
    structural_anchors: [...EXPECTED_ANCHORS],
  };
}

/** Phase 2: Текст-галлюцинация (противоположный смыслу якорей) */
const HALLUCINATED_TEXT =
  'Контракт можно расторгнуть в любое время без уведомления, срок не ограничен, штрафы отсутствуют.';

async function runDiagnostic() {
  const apiUrl = process.env.ALTRO_OLLAMA_URL ?? 'http://localhost:11434/api/chat';
  const model = process.env.ALTRO_MODEL ?? 'llama3.2';

  console.log('\n========== FIREWALL_MONITOR_TEST_v1.0 ==========\n');

  // Phase 1: Setup
  const packet = buildLegalContractPacket();
  console.log('[Phase 1] Семантический пакет:');
  console.log('  Якоря:', packet.structural_anchors);
  console.log('  Домены:', packet.domain_focus);
  console.log('  Intent:', packet.intent_summary);
  console.log('');

  // Phase 2: Attack simulation
  console.log('[Phase 2] Attack Simulation — Галлюцинированный текст:');
  console.log('  ', HALLUCINATED_TEXT);
  console.log('');

  // Action: Guard
  const guard = new AltroGuard(apiUrl, { verifyResonance: validateResonance }, model);
  const originalText = 'Контракт безотзывный. Срок действия 12 месяцев. Штраф 15% при досрочном расторжении.';

  console.log('[Action] Прогон через AltroGuard.verifyAndHeal()...\n');

  const guardReport = await guard.verifyAndHeal(originalText, HALLUCINATED_TEXT, packet);

  // Diagnostic Output
  console.log('========== DIAGNOSTIC OUTPUT (Monitor Check) ==========\n');
  console.log('GuardReport (полный объект):');
  console.log(JSON.stringify(guardReport, null, 2));
  console.log('\n--- Анализ ---');
  console.log('  initialScore:', guardReport.initialScore, guardReport.initialScore < 0.5 ? '(ожидаемо близок к 0 ✓)' : '');
  console.log('  isHealed:', guardReport.isHealed, guardReport.isHealed ? '(триггер сработал ✓)' : '(исцеление не потребовалось)');
  console.log('  finalText (после попытки исцеления):');
  console.log('  ', guardReport.finalText);
  console.log('  lostMeanings:', guardReport.lostMeanings);
  const anchorsMatch =
    guardReport.lostMeanings.length === EXPECTED_ANCHORS.length &&
    EXPECTED_ANCHORS.every((a) =>
      guardReport.lostMeanings.some((l) => l.trim().toLowerCase() === a.trim().toLowerCase())
    );
  console.log('  lostMeanings совпадают с якорями:', anchorsMatch ? '✓ Да' : '— нет');

  console.log('\n========== FIREWALL_MONITOR_TEST_v1.0 END ==========\n');
}

runDiagnostic().catch((err) => {
  console.error('[FIREWALL_MONITOR] ERROR:', err);
  process.exit(1);
});
