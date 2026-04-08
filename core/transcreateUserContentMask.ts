/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/** Префикс зеркала директивы в user.content (см. extractUserDirectiveFromMessages). */
export const USER_DIRECTIVE_TAG = '[USER_DIRECTIVE]';

/**
 * Текст от `[USER_DIRECTIVE]` до первого `\n\n` не проходит через SemanticFirewall/Masker,
 * чтобы тег и блок директивы не давали ложных {{IPA_*}} (например {{IPA_8}}).
 */
export function partitionUserDirectiveForMasking(content: string): { head: string; tail: string } {
  const t = content.trimStart();
  const lead = content.length - t.length;
  if (!t.startsWith(USER_DIRECTIVE_TAG)) {
    return { head: '', tail: content };
  }
  const absTagStart = lead;
  const afterTag = content.slice(absTagStart + USER_DIRECTIVE_TAG.length);
  const splitIdx = afterTag.indexOf('\n\n');
  if (splitIdx < 0) {
    return { head: content, tail: '' };
  }
  const headEnd = absTagStart + USER_DIRECTIVE_TAG.length + splitIdx + 2;
  return { head: content.slice(0, headEnd), tail: content.slice(headEnd) };
}

/**
 * Применяет `prepare` только к «телу» после защищённого блока `[USER_DIRECTIVE]…\n\n`, либо ко всему тексту.
 */
export function maskUserContentWithPrepareStencil(
  content: string,
  prepare: (body: string) => string
): string {
  const { head, tail } = partitionUserDirectiveForMasking(content);
  if (head) {
    return tail ? head + prepare(tail) : head;
  }
  return prepare(content);
}
