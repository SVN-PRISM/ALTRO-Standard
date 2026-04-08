/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * LLMs often wrap the whole translation in ASCII or typographic quotes.
 * Strips one layer of matching outer quotes so `{{IPA_N}}` is not hidden from injectors.
 */
export function stripLlmQuoteWrapping(text: string): string {
  let t = text.trim();
  if (t.length < 2) return t;

  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['\u201c', '\u201d'],
    ['\u201e', '\u201c'],
    ['«', '»'],
  ];

  for (const [open, close] of pairs) {
    if (t.startsWith(open) && t.endsWith(close)) {
      t = t.slice(open.length, t.length - close.length).trim();
      break;
    }
  }
  return t;
}

export const ALTRO_STENCIL_VAULT_HEADER = 'X-Altro-Stencil-Vault';

function base64Utf8ToString(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Decode DataVault JSON snapshot from /api/transcreate response header (`store` = display bricks for inject). */
export function parseStencilVaultFromResponseHeaders(headers: Headers): Record<string, string> | null {
  const raw = headers.get(ALTRO_STENCIL_VAULT_HEADER) ?? headers.get('x-altro-stencil-vault');
  if (!raw?.trim()) return null;
  try {
    const json = base64Utf8ToString(raw.trim());
    const snap = JSON.parse(json) as { store?: Record<string, string> };
    const store = snap.store;
    if (!store || typeof store !== 'object') return null;
    return store;
  } catch {
    return null;
  }
}
