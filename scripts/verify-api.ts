/**
 * Temporary: call local Ollama /api/chat (same shape as /api/transcreate) and assert Russian output.
 * Requires Ollama running and NEXT_PUBLIC_DEFAULT_MODEL (or OLLAMA_MODEL) set.
 * Run: npx tsx scripts/verify-api.ts
 */
import {
  extractLongestRussianSpan,
  getOllamaContentDelta,
  ThinkingStreamCleaner,
} from '../src/lib/ollamaStreamSanitize';

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const MODEL =
  process.env.NEXT_PUBLIC_DEFAULT_MODEL?.trim() ||
  process.env.OLLAMA_MODEL?.trim() ||
  '';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`VERIFY: ${msg}`);
}

function predominantlyRussian(s: string): boolean {
  const trimmed = s.trim();
  if (trimmed.length < 3) return false;
  const cyr = (trimmed.match(/[а-яёА-ЯЁ]/g) ?? []).length;
  const latin = (trimmed.match(/[a-zA-Z]/g) ?? []).length;
  return cyr >= 8 && cyr >= latin * 1.5;
}

async function main(): Promise<void> {
  if (!MODEL) {
    console.error('Set NEXT_PUBLIC_DEFAULT_MODEL or OLLAMA_MODEL to an Ollama tag.');
    process.exit(1);
  }

  const body = {
    model: MODEL,
    stream: true,
    options: { temperature: 0.35, top_p: 0.85, num_predict: 384 },
    messages: [
      {
        role: 'system' as const,
        content: [
          'Role: Semantic Orchestrator for ALTRO 1. Task: translate [SRC] into Russian.',
          'Constraint 1: Generate the full translated text first, ensuring it is pure Russian.',
          'Constraint 2: No explanations, no vocabulary lists, no internal dialogue.',
          'Please respond with the translation only; do not repeat these instructions.',
        ].join('\n'),
      },
      { role: 'user' as const, content: 'Hello world. The weather is fine today.' },
    ],
  };

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 120_000);

  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal,
    });
  } catch (e) {
    clearTimeout(t);
    console.error('Cannot reach Ollama at', OLLAMA_BASE, e);
    process.exit(1);
  }
  clearTimeout(t);

  if (!res.ok) {
    console.error('Ollama HTTP', res.status, await res.text().catch(() => ''));
    process.exit(1);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    console.error('No response body');
    process.exit(1);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  const cleaner = new ThinkingStreamCleaner();
  let accumulated = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const delta = getOllamaContentDelta(line);
      if (!delta) continue;
      const cleaned = cleaner.push(delta);
      if (cleaned) accumulated += cleaned;
    }
  }
  if (buffer.trim()) {
    const tailDelta = getOllamaContentDelta(buffer);
    if (tailDelta) {
      const c = cleaner.push(tailDelta);
      if (c) accumulated += c;
    }
  }
  accumulated += cleaner.flush();

  let judged = accumulated.trim();
  const span = extractLongestRussianSpan(judged);
  if (span.length >= 6) judged = span;

  assert(judged.length > 0, 'empty stream after sanitize + ThinkingStreamCleaner + span extract');
  assert(predominantlyRussian(judged), `expected mostly Russian, got: ${judged.slice(0, 400)}`);
  console.log('scripts/verify-api.ts: OK\n---\n', judged.slice(0, 500));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
