/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * Resolves stencil target language for Translation-First masking (API / clients).
 */
export function resolveTargetLanguageFromRequestBody(body: Record<string, unknown> | null | undefined): string {
  if (body && typeof body === 'object') {
    const st = body._altroStencil;
    if (st && typeof st === 'object' && !Array.isArray(st)) {
      const t = (st as { targetLanguage?: unknown }).targetLanguage;
      if (typeof t === 'string' && t.trim()) return t.trim().toLowerCase();
    }
    const top = body.targetLanguage;
    if (typeof top === 'string' && top.trim()) return top.trim().toLowerCase();
  }
  const env = typeof process !== 'undefined' ? process.env.ALTRO_TARGET_LANGUAGE : undefined;
  if (typeof env === 'string' && env.trim()) return env.trim().toLowerCase();
  return 'ru';
}
