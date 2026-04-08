/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
/**
 * AltroSafetyGuard — Middleware Vector №3
 * Перехватывает запрос перед отправкой в LLM и проверяет соответствие доменам [ETHICS] и [LAW].
 */

export interface GuardContext {
  /** Веса доменов из запроса (если переданы) */
  domainWeights?: Record<string, number>;
  /** Текст пользовательского сообщения */
  userContent?: string;
  /** Системный промпт */
  systemContent?: string;
}

export interface GuardResult {
  allowed: boolean;
  reason?: string;
  /** Код блокировки для логирования */
  code?: 'ETHICS_VIOLATION' | 'LAW_VIOLATION' | 'EMPTY_REQUEST' | 'INVALID_STRUCTURE';
}

/** Минимальный порог для домена ETHICS (0..1). Ниже — блокировка. */
const ETHICS_MIN_THRESHOLD = 0;

/** Минимальный порог для домена LAW (ethics в internal = LAW). */
const LAW_MIN_THRESHOLD = 0;

/** Паттерны контента, несовместимые с ETHICS/LAW (базовая эвристика). */
const BLOCKED_PATTERNS = [
  /\b(создай|напиши|сгенерируй)\s+(вредоносн|вирус|эксплойт|malware)/i,
  /\b(инструкци|как)\s+(взломать|взорвать|отравить)/i,
  /\b(украсть|кража|воровство)\s+(данн|парол|креден)/i,
  /\b(подделк|фальшив|мошенничеств)/i,
  /\b(дискриминаци|ненависть|экстремизм)/i,
];

/**
 * Проверяет запрос на соответствие доменам ETHICS и LAW.
 * Вызывается перед проксированием в LLM.
 */
export function checkRequest(body: unknown, context?: GuardContext): GuardResult {
  if (body == null || typeof body !== 'object') {
    return { allowed: false, reason: 'Invalid request body', code: 'INVALID_STRUCTURE' };
  }

  const messages = (body as { messages?: Array<{ role?: string; content?: string }> }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { allowed: false, reason: 'Empty or missing messages', code: 'EMPTY_REQUEST' };
  }

  const lastUser = messages.filter((m) => m?.role === 'user').pop();
  const userContent = (lastUser?.content ?? context?.userContent ?? '').trim();
  const systemContent = messages.find((m) => m?.role === 'system')?.content ?? context?.systemContent ?? '';

  /** Проверка доменов ETHICS и LAW по весам (если переданы в _altroDebug) */
  const debug = (body as { _altroDebug?: { domainWeights?: Record<string, number> } })._altroDebug;
  const weights = context?.domainWeights ?? debug?.domainWeights;
  if (weights != null) {
    const ethics = typeof weights.ethics === 'number' ? weights.ethics : weights.LAW;
    if (ethics != null && ethics < ETHICS_MIN_THRESHOLD) {
      return {
        allowed: false,
        reason: `[ETHICS] Domain weight below threshold: ${ethics}`,
        code: 'ETHICS_VIOLATION',
      };
    }
  }

  /** Проверка контента на блокируемые паттерны */
  const combined = `${userContent} ${systemContent}`.toLowerCase();
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(combined)) {
      return {
        allowed: false,
        reason: '[LAW/ETHICS] Content matches blocked pattern',
        code: 'LAW_VIOLATION',
      };
    }
  }

  return { allowed: true };
}
