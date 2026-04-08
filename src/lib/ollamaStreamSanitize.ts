/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Ollama stream sanitization */

/**
 * Qwen / Ollama may emit NDJSON lines where `message` contains BOTH `thinking` and `content`.
 * Audit (empty Mirror, HTTP 200): some stacks emit `message.content` as an **array** of parts
 * (OpenAI-style) or only populate `thinking` for long stretches — strict `typeof content === 'string'`
 * dropped **every** chunk. We normalize to a single string before forwarding / mirroring.
 *
 * Qwen 3.5 + Ollama (see terminal RAW CHUNK): often `content` stays `""` for the whole stream while
 * **incremental tokens arrive only in `message.thinking`**. If we skip those, the Mirror stays empty
 * despite a 200 stream. We mirror `thinking` into `content` when `content` is empty.
 */

export type OllamaMessage = Record<string, unknown>;

/** NDJSON line may be SSE-wrapped: `data: {"message":...}` — без .trim() всей строки, чтобы не терять пробелы у границы парсера. */
export function stripNdjsonLinePrefix(line: string): string {
  let t = line.replace(/\r$/, '');
  const start = t.trimStart();
  if (start.startsWith('data:')) {
    const i = t.indexOf('data:');
    return t.slice(i + 5).trimStart();
  }
  return t;
}

/**
 * Qwen / Ollama: strip `<thinking>` / `<think>` / `</think>` blocks (complete) from assistant text.
 * Does not remove unclosed tags — `splitSearchableBeforeUnclosedThinking` limits search to the safe prefix.
 */
export function stripThinkingXmlBlocks(s: string): string {
  if (!s) return s;
  let out = s.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '');
  out = out.replace(new RegExp('`[\\s\\S]*?`', 'gi'), '');
  return out;
}

/** Normalize `thinking` the same way as `content` (string or OpenAI-style parts). */
export function normalizeThinkingField(value: unknown): string | null {
  if (typeof value === 'string') return value.length > 0 ? value : null;
  return normalizeOllamaMessageContent(value);
}

function stripThinkingArtifactsFromNullable(s: string | null): string | null {
  if (s === null) return null;
  const t = stripThinkingXmlBlocks(s);
  return t.length > 0 ? t : null;
}

/**
 * If `s` contains an opening `<thinking>` / `<think>` without a closing tag, only the prefix
 * before that tag is searchable for real output (Cyrillic). The tail is buffered until the block completes.
 */
export function splitSearchableBeforeUnclosedThinking(s: string): { searchable: string; tail: string } {
  const m = /<(?:thinking|think)(?:\s[^>]*)?>/i.exec(s);
  if (!m || m.index === undefined) return { searchable: s, tail: '' };
  const afterOpen = s.slice(m.index + m[0].length);
  if (/<\/(?:thinking|think)>/i.test(afterOpen)) {
    return { searchable: s, tail: '' };
  }
  return { searchable: s.slice(0, m.index), tail: s.slice(m.index) };
}

export function normalizeOllamaMessageContent(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return value.length > 0 ? value : null;
  }
  if (Array.isArray(value)) {
    const parts: string[] = [];
    for (const item of value) {
      if (typeof item === 'string') {
        parts.push(item);
      } else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const o = item as Record<string, unknown>;
        if (typeof o.text === 'string') parts.push(o.text);
        else if (typeof o.content === 'string') parts.push(o.content);
      }
    }
    const s = parts.join('');
    return s.length > 0 ? s : null;
  }
  return null;
}

/**
 * Raw assistant text from `message` (content / thinking), без разворачивания вложенного JSON в строке.
 */
function pickAssistantDisplayDeltaBare(msg: OllamaMessage): string | null {
  const thinkingVal = msg.thinking;
  const { thinking: _t, ...rest } = msg;
  void _t;
  const fromContent = stripThinkingArtifactsFromNullable(normalizeOllamaMessageContent(rest.content));
  if (fromContent) return fromContent;
  const fromThinking = stripThinkingArtifactsFromNullable(normalizeThinkingField(thinkingVal));
  if (fromThinking) return fromThinking;
  return null;
}

/**
 * Если модель вложила в content целую NDJSON-строку (`{"model":...`), развернуть после JSON.parse.
 * stripLeadingInstructionEcho вызывается только для уже извлечённого текста (см. ThinkingStreamCleaner).
 */
function peelNestedOllamaJsonEchoInText(s: string, depth: number): string {
  if (depth > 4) return s;
  const i = s.indexOf('{');
  if (i < 0) return s;
  const t = s.slice(i);
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    const nested = obj.message;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const inner = pickAssistantDisplayDeltaBare(nested as OllamaMessage);
      if (inner !== null && inner !== '') {
        return peelNestedOllamaJsonEchoInText(inner, depth + 1);
      }
    }
  } catch {
    return s;
  }
  return s;
}

/**
 * Prefer visible `message.content`; if empty, use `message.thinking` (Qwen 3.5 streams there).
 */
export function pickAssistantDisplayDelta(msg: OllamaMessage): string | null {
  const raw = pickAssistantDisplayDeltaBare(msg);
  if (raw === null) return null;
  return peelNestedOllamaJsonEchoInText(raw, 0);
}

/**
 * One NDJSON line for the proxy: strip `message.thinking`, forward if normalized content is non-empty.
 * Forwards bare `{ "done": true }` lines (no `message`).
 */
export function sanitizeOllamaNdjsonLine(line: string): string | null {
  const lineForParse = stripNdjsonLinePrefix(line).replace(/\r$/, '');
  if (!lineForParse) return null;
  if (!lineForParse.trimStart().startsWith('{')) return null;
  try {
    const obj = JSON.parse(lineForParse) as Record<string, unknown>;
    const msg = obj.message;

    if (msg === undefined || msg === null) {
      if (obj.done === true) return `${lineForParse}\n`;
      return null;
    }

    if (typeof msg !== 'object' || Array.isArray(msg)) return null;

    const m = msg as OllamaMessage;
    const normalized = pickAssistantDisplayDelta(m);
    if (!normalized) {
      return null;
    }

    const { thinking: _t, ...rest } = m;
    void _t;
    const outMsg = { ...rest, content: normalized };
    return `${JSON.stringify({ ...obj, message: outMsg })}\n`;
  } catch {
    return null;
  }
}

/** Client-side: same parse rules; returns only the normalized `message.content` delta string, or `null`. */
export function getOllamaContentDelta(line: string): string | null {
  const lineForParse = stripNdjsonLinePrefix(line).replace(/\r$/, '');
  if (!lineForParse) return null;
  if (!lineForParse.trimStart().startsWith('{')) return null;
  try {
    const obj = JSON.parse(lineForParse) as Record<string, unknown>;
    const msg = obj.message;
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return null;
    const m = msg as OllamaMessage;
    return pickAssistantDisplayDelta(m);
  } catch {
    return null;
  }
}

/** Non-stream JSON: remove `thinking` from `message` before reading `content`. */
export function stripThinkingFromChatPayload(data: unknown): void {
  const d = data as { message?: OllamaMessage };
  if (!d?.message || typeof d.message !== 'object' || Array.isArray(d.message)) return;
  if ('thinking' in d.message) {
    const { thinking: _t, ...rest } = d.message;
    void _t;
    d.message = rest;
  }
}

/** Non-stream `/api/chat` JSON: assistant text for finalize (handles array `content`). */
export function extractOllamaAssistantText(data: unknown): string {
  const d = data as { message?: OllamaMessage };
  if (!d?.message || typeof d.message !== 'object' || Array.isArray(d.message)) return '';
  return pickAssistantDisplayDelta(d.message) ?? '';
}

const BUFFER_CAP = 16_000;

/** Common English tokens (leaked explanations). Ratio = hits / Latin words in sample. */
const ENGLISH_LEXICON = new Set(
  `the a an is are was were be been being to of and or but in on at for with from by as if so than then that this these those it we you i my your our their they them he she his her its not no yes also just only about into through over after before when where how what which who can could will would should must need may might let wait think translation refining checking okay first now hmm so into onto up down out off than such both each few more most other some such very what which while whereas whether within without across along around behind below beneath beside between beyond despite during except inside like near onto outside past since toward under until upon via within worth
  wait should could would might must need think translation discuss grammar explain node nodes ipa explain discuss preamble meta output result here there where why how about into`.split(/\s+/)
);

const HEAD_SAMPLE = 200;
const ENGLISH_LEXICON_THRESHOLD = 0.7;

/** Letter counts in a short window — detects tutor-style English with embedded Russian quotes. */
function windowCyrillicVsLatin(sample: string): { cyr: number; lat: number } {
  let cyr = 0;
  let lat = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    if (c >= 0x0400 && c <= 0x04ff) cyr++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) lat++;
  }
  return { cyr, lat };
}

/** Share of Latin words in `sample` that appear in ENGLISH_LEXICON (2+ letter tokens). */
export function englishLexiconRatio(sample: string): number {
  const words = sample.toLowerCase().match(/[a-z]{2,}/g) ?? [];
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (ENGLISH_LEXICON.has(w)) hits++;
  }
  return hits / words.length;
}

/**
 * TRUE start: prefer Cyrillic (Russian). If the first 200 chars from a candidate are
 * dominated by English lexicon tokens (>70%), skip to the next Cyrillic run.
 */
export function findTrueRussianStart(buffer: string): number {
  /** Предпочитаем якорь с кириллицей в окне; пороги чуть мягче, чтобы не глотать нормальный перевод. */
  for (const m of buffer.matchAll(/[а-яёА-ЯЁ]{4,}/g)) {
    if (m.index === undefined) continue;
    const i = m.index;
    const head = buffer.slice(i, i + HEAD_SAMPLE);
    const { cyr, lat } = windowCyrillicVsLatin(head);
    if (cyr >= 6 && cyr >= lat * 0.5) return i;
  }
  const cyrIndices: number[] = [];
  for (let i = 0; i < buffer.length; i++) {
    const c = buffer.charCodeAt(i);
    if (c >= 0x0400 && c <= 0x04ff) cyrIndices.push(i);
  }
  for (const i of cyrIndices) {
    const head = buffer.slice(i, i + HEAD_SAMPLE);
    const { cyr, lat } = windowCyrillicVsLatin(head);
    if (cyr >= 4 && cyr >= lat * 0.42) return i;
    if (englishLexiconRatio(head) <= ENGLISH_LEXICON_THRESHOLD) return i;
  }
  for (const re of [/\bTranslation\s*:\s*/i, /\bПеревод\s*:\s*/i]) {
    const trans = buffer.match(re);
    if (trans && trans.index !== undefined) {
      const after = trans.index + trans[0].length;
      const head = buffer.slice(after, after + HEAD_SAMPLE);
      if (englishLexiconRatio(head) <= ENGLISH_LEXICON_THRESHOLD) return after;
    }
  }
  if (cyrIndices.length > 0) return cyrIndices[0];
  return -1;
}

/**
 * When the model mixes English tutor text with Russian, keep the longest contiguous
 * Russian-heavy span (for finalize / assertions). Skips IPA placeholders.
 */
export function extractLongestRussianSpan(s: string): string {
  const re = /[а-яёА-ЯЁ][а-яёА-ЯЁ0-9\s,.!?;:«»""''\-—–]{6,}/g;
  let best = '';
  for (const m of s.matchAll(re)) {
    const t = m[0].trim();
    if (t.length > best.length) best = t;
  }
  return best.trim();
}

/** Ведущий мусор до первой кириллицы (русский таргет): латиница, обрывки Constraint 1 и т.д. */
const LEADING_NON_CYRILLIC = /^[^\u0400-\u04FF]*/;

/**
 * Убирает эхо инструкций и ведущий «шум» до реального текста перевода.
 * Для `ru`: агрессивно — всё до первого символа в диапазоне U+0400–U+04FF (включая обрывки слов).
 */
export function stripLeadingInstructionEcho(s: string, targetLang = 'ru'): string {
  const code = targetLang.trim().toLowerCase() || 'ru';
  if (code === 'ru') {
    return s.replace(LEADING_NON_CYRILLIC, '');
  }
  const lines = s.split('\n');
  let i = 0;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (t === '') {
      i++;
      continue;
    }
    if (
      /^constraint\s*\d/i.test(t) ||
      /^role:\s*/i.test(t) ||
      /^task:\s*/i.test(t) ||
      /^failure\s+to\s+comply/i.test(t) ||
      /^please\s+respond\s+with\s+the\s+translation\s+only/i.test(t) ||
      /^respond\s+with\s+the\s+translation\s+only/i.test(t)
    ) {
      i++;
      continue;
    }
    break;
  }
  return lines.slice(i).join('\n').trimStart();
}

/**
 * Когда имеет смысл вырезать «длинный русский блок» из шума — не трогаем уже чистый перевод.
 */
export function shouldPolishRussianOutput(s: string): boolean {
  const t = s.trim();
  if (t.length < 48) return false;
  const head = t.slice(0, 800);
  if (/constraint\s*\d|role:\s*(semantic|translator)|task:\s*translate/i.test(head)) {
    return true;
  }
  const cyr = (t.match(/[а-яёА-ЯЁ]/g) ?? []).length;
  const lat = (t.match(/[a-zA-Z]/g) ?? []).length;
  if (cyr < 10) return false;
  return lat > cyr * 0.65;
}

/** Strip obvious English meta lines at the start (fallback when buffer cap hit). */
export function stripLeadingEnglishMeta(s: string): string {
  const lines = s.split(/\n/);
  const metaLine = /^(?:Wait,|I should|Let me think|Let's|Okay,|First,|Checking|Refining|Now,|Hmm,|So,)\s/i;
  let i = 0;
  while (i < lines.length && metaLine.test(lines[i].trimStart())) {
    i++;
  }
  return lines.slice(i).join('\n').trimStart();
}

/**
 * Vocabulary teaching lines: "- word -> gloss" where gloss is not Cyrillic, or "1. announced".
 * Lines like "- x -> кот" are real output — Cyrillic after the arrow excludes them.
 */
export function isTeachingListLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  const arrow = /^-\s+.+\s*->\s*(.*)$/.exec(t);
  if (arrow) {
    const after = arrow[1].trim();
    if (!after) return true;
    if (!/[а-яёА-ЯЁ]/.test(after)) return true;
    return false;
  }
  if (/^\d+\.\s+[a-zA-Z]/.test(t)) return true;
  return false;
}

function couldBePartialTeachingListLine(s: string): boolean {
  const t = s.trimStart();
  if (t.startsWith('-') && !t.includes('->')) return true;
  if (/^\d+\.\s*$/.test(t)) return true;
  if (/^\d+\.\s+[a-zA-Z]/.test(t) && !/[а-яёА-ЯЁ]/.test(s)) return true;
  return false;
}

/**
 * Drop leading teaching-list lines at stream start; buffer until a line is complete or eof.
 * `hold` retains an incomplete first line that might still match a list pattern.
 */
export function stripLeadingTeachingListsPartial(
  buf: string,
  eof: boolean
): { emit: string; hold: string } {
  let working = buf;
  while (true) {
    const nl = working.indexOf('\n');
    if (nl === -1) {
      if (!eof) {
        if (working.trim() === '') return { emit: '', hold: working };
        if (couldBePartialTeachingListLine(working)) return { emit: '', hold: working };
        if (isTeachingListLine(working.trim())) return { emit: '', hold: '' };
        return { emit: working, hold: '' };
      }
      if (working.trim() === '') return { emit: '', hold: '' };
      if (isTeachingListLine(working.trim())) return { emit: '', hold: '' };
      return { emit: working, hold: '' };
    }
    const first = working.slice(0, nl);
    const rest = working.slice(nl + 1);
    if (first.trim() === '') {
      working = rest;
      continue;
    }
    if (isTeachingListLine(first.trim())) {
      working = rest;
      continue;
    }
    return { emit: working, hold: '' };
  }
}

/**
 * Stateful: Qwen streams internal reasoning in `thinking` before Cyrillic output.
 * Buffers until `Translation:` or first Cyrillic, then passes through subsequent deltas.
 */
export class ThinkingStreamCleaner {
  private buf = '';
  private released = false;
  private listStripBuf = '';
  private listStripDone = false;

  constructor(private readonly targetLang = 'ru') {}

  /** Prepare accumulated text: drop complete thinking blocks, then only search before any unclosed tag. */
  private prepareForRussianSearch(raw: string): string {
    const stripped = stripThinkingXmlBlocks(raw);
    const { searchable } = splitSearchableBeforeUnclosedThinking(stripped);
    return searchable;
  }

  private emitWithListStrip(chunk: string, eof = false): string {
    if (this.listStripDone) return chunk;
    this.listStripBuf += chunk;
    const { emit, hold } = stripLeadingTeachingListsPartial(this.listStripBuf, eof);
    this.listStripBuf = hold;
    if (emit !== '') this.listStripDone = true;
    else if (eof && !hold) this.listStripDone = true;
    return emit;
  }

  push(delta: string): string {
    if (this.released) return this.emitWithListStrip(delta);
    this.buf += delta;
    const work = this.prepareForRussianSearch(this.buf);
    const idx = findTrueRussianStart(work);
    if (idx >= 0) {
      let slice = work.slice(idx);
      slice = slice.replace(/^\s*Translation\s*:\s*/i, '');
      slice = slice.replace(/^\s*Перевод\s*:\s*/i, '');
      /** stripLeadingInstructionEcho только для текста после JSON.parse (getOllamaContentDelta), не для сырого NDJSON. */
      slice = stripLeadingInstructionEcho(slice, this.targetLang);
      this.released = true;
      this.buf = '';
      return this.emitWithListStrip(slice);
    }
    if (this.buf.length > BUFFER_CAP) {
      this.released = true;
      const s = stripLeadingInstructionEcho(
        stripLeadingEnglishMeta(stripThinkingXmlBlocks(this.buf)),
        this.targetLang
      );
      this.buf = '';
      return this.emitWithListStrip(s);
    }
    return '';
  }

  /** End of HTTP stream: emit remainder if we never saw Cyrillic / Translation. */
  flush(): string {
    if (this.released) {
      return this.emitWithListStrip('', true);
    }
    const s = this.buf;
    this.buf = '';
    this.released = true;
    if (!s) return this.emitWithListStrip('', true);
    const work = this.prepareForRussianSearch(s);
    const idx = findTrueRussianStart(work);
    if (idx >= 0) {
      let slice = work
        .slice(idx)
        .replace(/^\s*Translation\s*:\s*/i, '')
        .replace(/^\s*Перевод\s*:\s*/i, '');
      slice = stripLeadingInstructionEcho(slice, this.targetLang);
      return this.emitWithListStrip(slice, true);
    }
    const fallback = stripLeadingInstructionEcho(
      stripLeadingEnglishMeta(stripThinkingXmlBlocks(s)) || stripThinkingXmlBlocks(s) || s,
      this.targetLang
    );
    return this.emitWithListStrip(fallback, true);
  }
}
