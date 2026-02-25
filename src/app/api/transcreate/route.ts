/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */

/**
 * API Route: /api/transcreate
 * Проксирует запросы к Ollama /api/chat.
 * stream: true — прокидывает стрим; stream: false — ждёт полный ответ.
 */

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_TIMEOUT_MS = 600_000;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return Response.json(
        { error: '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]' },
        { status: 502 }
      );
    }

    if (body.stream === true && response.body) {
      return new Response(response.body, {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err) {
    console.error('ALTRO transcreate proxy error:', err);
    return Response.json(
      { error: '[ALTRO ERROR: Сбой связи с Ядром. Перезапустите Ollama]' },
      { status: 502 }
    );
  }
}
