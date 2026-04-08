/**
 * Temporary: simulate Ollama NDJSON with `thinking` + `content` and assert sanitizer behavior.
 * Run: npx tsx scripts/test-stream.ts
 */
import {
  extractLongestRussianSpan,
  extractOllamaAssistantText,
  findTrueRussianStart,
  getOllamaContentDelta,
  isTeachingListLine,
  sanitizeOllamaNdjsonLine,
  stripLeadingTeachingListsPartial,
  stripThinkingFromChatPayload,
  ThinkingStreamCleaner,
} from '../src/lib/ollamaStreamSanitize';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

// Qwen 3.5: content "" while thinking streams (terminal RAW CHUNK audit)
const qwenStyle = JSON.stringify({
  message: { role: 'assistant', content: '', thinking: 'При' },
});
assert(getOllamaContentDelta(qwenStyle) === 'При', 'empty content + thinking');
assert(sanitizeOllamaNdjsonLine(qwenStyle)!.includes('"content":"При"'), 'sanitize maps thinking');

// thinking-only message (no content key) → use thinking as stream
assert(getOllamaContentDelta('{"message":{"thinking":"x"}}') === 'x', 'thinking-only delta');
assert(sanitizeOllamaNdjsonLine('{"message":{"thinking":"long"}}')!.includes('"content":"long"'), 'thinking-only sanitize');

// combined thinking + content → prefer content
const combined = JSON.stringify({
  message: { role: 'assistant', thinking: 'step 1...', content: 'Привет' },
});
const sanitized = sanitizeOllamaNdjsonLine(combined);
assert(sanitized !== null, 'sanitized non-null');
assert(sanitized!.includes('Привет'), 'sanitized has text');
assert(!sanitized!.includes('thinking'), 'sanitized strips thinking key');
assert(getOllamaContentDelta(combined) === 'Привет', 'delta matches');

// incremental deltas (typical stream)
assert(getOllamaContentDelta('{"message":{"content":"Hel"}}') === 'Hel', 'partial content');
assert(getOllamaContentDelta('{"message":{"thinking":"","content":"lo"}}') === 'lo', 'empty thinking str + content');

// OpenAI-style array segments (audit: strict string-only dropped all chunks)
const arrayLine = JSON.stringify({
  message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
});
assert(getOllamaContentDelta(arrayLine) === 'Hello', 'array content parts');
assert(extractOllamaAssistantText(JSON.parse(arrayLine)) === 'Hello', 'extract array');

// SSE-style prefix
assert(getOllamaContentDelta('data: {"message":{"content":"x"}}') === 'x', 'data: prefix');

// done heartbeat
const doneLine = '{"done":true}';
assert(sanitizeOllamaNdjsonLine(doneLine)?.trim() === doneLine, 'forward done');

// non-stream payload
const payload = { message: { thinking: 'noise', content: 'Final' } };
stripThinkingFromChatPayload(payload);
assert(
  !(payload as { message: { thinking?: unknown } }).message.thinking,
  'stripThinking removes thinking'
);
assert((payload as { message: { content: string } }).message.content === 'Final', 'content kept');

const tc = new ThinkingStreamCleaner();
assert(tc.push('Wait, let me think. ') === '', 'cleaner buffers meta');
assert(tc.push('Translation: ') === '', 'still before target');
assert(tc.push('В') === 'В', 'starts at Russian');
assert(tc.push(' test') === ' test', 'pass-through after release');

// Skip first Cyrillic when the next ~200 chars are English-heavy (leaked explanation).
const leak =
  'Preamble. В ' +
  Array.from({ length: 80 }, () => 'the ').join('') +
  'Настоящий текст здесь.';
const idxLeak = findTrueRussianStart(leak);
assert(idxLeak >= 0 && leak.slice(idxLeak).startsWith('Настоящий'), 'skip English-heavy false start');

assert(isTeachingListLine('- word -> gloss'), 'bullet arrow line');
assert(isTeachingListLine('1. announced'), 'numbered English teaching');
assert(!isTeachingListLine('1. Объявлено'), 'numbered Cyrillic not teaching');
assert(!isTeachingListLine('- cat -> кот'), 'arrow line with Cyrillic gloss kept');
const stripped = stripLeadingTeachingListsPartial('- cat -> meow\nЗдравствуйте', false);
assert(stripped.emit === 'Здравствуйте' && stripped.hold === '', 'strip list head');

const mixed =
  'Check: *"Hello"->"Привет".* Noise. Здравствуйте, это нормальный русский текст для проверки.';
assert(
  extractLongestRussianSpan(mixed).includes('Здравствуйте'),
  'extractLongestRussianSpan prefers long Russian run'
);

const tcList = new ThinkingStreamCleaner();
assert(tcList.push('- x -> y\n') === '', 'no Cyrillic yet');
assert(tcList.push('Привет') === 'Привет', 'Russian after discarded list block');

console.log('scripts/test-stream.ts: OK');
