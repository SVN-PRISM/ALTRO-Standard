"""
ALTRO Core — общая библиотека «ремонта» зацикливания (OPR / resonance retry).

Назначение: вынести сюда логику выхода из повторных проходов верификации, которая в TS
связана с AltroOrchestrator и LIBRA. Слой STENCIL (Next.js /api/transcreate) этот модуль
не обязан импортировать — он остаётся стерильным прокси.

Реализация по мере переноса из `src/lib/altro/engine.ts` и смежных модулей.
"""

from __future__ import annotations


def should_break_resonance_loop(iteration: int, max_iterations: int = 2) -> bool:
    """Порог остановки повторов при неудачной резонансной верификации (заглушка)."""
    return iteration >= max_iterations


def suggest_repair_action(last_error_code: str | None) -> str:
    """Рекомендуемое действие при детекте зацикливания (заглушка для оркестраторов)."""
    if not last_error_code:
        return "noop"
    return "halt_retry"
