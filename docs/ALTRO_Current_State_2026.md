# ALTRO: Current State 2026 — Technical Audit Report

**Дата:** 2026  
**Стандарт:** Technocratic v2.1, Inverted Funnel  
**Цель:** Подтверждение контекста перед Стратегией V2.0 и монетизацией.

---

## 1. Статус Ядра

### 1.1 Ключевые механизмы: реализация и стабильность

| Механизм | Файл / место | Статус | Краткое описание |
|----------|----------------|--------|-------------------|
| **TokenManager** | `src/lib/altro/tokenManager.ts` | ✅ Стабилен | `AltroTokenManager.tokenize()` сохраняет U+0301; интерфейс `TextToken` содержит `isLocked: boolean`. Токены с ударением по умолчанию `isLocked: true`. Методы `wrapTokensForQwen()`, `toggleLock()`, `stripStressTags()` — в наличии. Автономный модуль (без импортов из других файлов ядра). |
| **Engine** | `src/lib/altro/engine.ts` | ✅ Стабилен | `AltroOrchestrator`, `buildSystemPrompt()`, `buildOllamaPayload()`. Режимы: `mirror`, `transfigure`, `slang`, `data_query`. Mirror — Zero-Noise ([IO_CONTRACT] + [LOCKED_MEANING]). Метод Первого Токена (assistant: `[OUTPUT_START]\n`), `extractOutputPayload()`, `stop: ['[OUTPUT_END]', '<thought>', '---']`. Интеграция с `AltroSqlAdapter` для DATA SYNC. |
| **Lock-system** | `engine.ts` + `useAltroPage.ts` | ✅ Стабилен | `buildLockedMeaningLines(resolvedVariantsHint, lockedTokens)` формирует строки вида `word = accented (meaning)` из UI и HOMONYM_DB. Инъекция в начало промпта ([LOCKED_MEANING]) до весов и доменов (OPR Meta-Anchor). В Mirror и non-mirror ветках `buildSystemPrompt` принимает `lockedMeaningLines`. |

**Вывод:** Ядро реализовано в соответствии с Standard v2.1; tokenManager, engine и lock-system согласованы и используются в одном конвейере.

---

## 2. Доказательство Назаряна: как .cursorrules контролирует разработку

**Файл:** `.cursorrules` (Universal ALTRO Manifest v1.0).

- **SEMANTIC_SOVEREIGNTY:** Изменения в `src/lib/altro` подчиняются 5 доменам (Semantic, Context, Intent, Imagery, Ethical). В коде это отражено: `buildSystemPrompt` и `domain-processor` опираются на `internal`/`external`; Mirror явно обходит 8 осей.
- **TOKEN_LOCK_MECHANICS:** В `TextToken` есть `isLocked`; в `engine` токены с `isLocked` и `meaning` участвуют в `buildLockedMeaningLines` и в обёртке для Qwen (wrapTokensForQwen).
- **ORTHOGRAPHIC_SUPREMACY:** U+0301 и маркеры омонимов сохраняются в tokenize, в Mirror ACTION и в [STRESS_PROTECTION] / [LOCKED_MEANING]; trust-layer проверяет пунктуацию без удаления спецсимволов.
- **UI_IMMUTABILITY:** Директива зафиксирована; структура панелей (Workspace, ControlPanel, кнопки режимов) не менялась без явного запроса.
- **LICENSING:** В файлах ядра присутствует заголовок вида «(c) 2026 SERGEI NAZARIAN» / «MIT License».

**LLM_COMMUNICATION_PROTOCOL:** При формировании промпта используется манифест (заголовок отключения reasoning, [IO_CONTRACT], при необходимости [LOCKED_MEANING]); приоритет — правилам из .cursorrules и ALTRO_CORE.md.

**Вывод:** .cursorrules задаёт приоритеты (смысл, токены, орфография, UI, лицензия); текущая реализация ядра и промптов им соответствует.

---

## 3. Анализ 13 доменов: связь 8 внешних и 5 внутренних векторов

- **Тип и источник:** Единая структура `DomainWeights` в `src/lib/altroData.ts`: 5 внутренних (semantics, context, intent, imagery, ethics), 8 внешних (economics, politics, society, history, culture, aesthetics, technology, religion). Используется в `useAltroPage` (domainWeights, setDomainWeights), в `altroCalibration` и во всех вызовах engine/orchestration.
- **Связь внутренних и внешних:**  
  - `domain-processor.ts`: `getActiveDomainsList(calibration)` строит один список из **обоих** векторов: пороги по `internal` (INT_TH = 10) и по `external` (DOMAIN_THRESHOLD). Имена доменов (Семантика, Контекст, … Экономика, Политика, …) попадают в промпт и в trust-layer.  
  - `engine.ts`: в non-mirror ветке `buildSystemPrompt` выводит `[WEIGHTS]` (5 внутренних) и `[DOMAINS_ACTIVE]` (результат getActiveDomainsList — смесь внутренних и внешних).  
  - `orchestration.ts` и `vectorEngine.ts`: расчёт весов и применение ALTRO_LIBRARY используют и internal, и external (в т.ч. spirit/religion, imagery, context).
- **Иерархия (ALTRO_CORE §6.4):** Законодательное ядро = 5 внутренних (Meaning Generation); исполнительная оболочка = 8 осей (Reality Validation). В коде это реализовано: Mirror не использует веса и оси; Transfigure/data_query используют оба набора через calibration и getActiveDomainsList.

**Вывод:** Система явно видит связь между 8 внешними и 5 внутренними векторами: общий тип, единый список активных доменов и разделение ролей (ядро vs оболочка) соблюдаются.

---

## 4. Готовность к [DATA SYNC]: активные хуки и интеграция SQL/Firebird

- **UI:** В `page.tsx` кнопка **[DATA SYNC]** вызывает `syncDatabase`, отображается состояние `isSyncing` (подсветка, disabled во время запроса).
- **Хуки:** В `useAltroPage.ts`: `isSyncing`, `syncDatabase`; при DATA SYNC временно выставляется приоритет Контекста (`context: 1`), затем веса восстанавливаются. `altroOrchestrator.syncDatabaseSchema()` вызывается из `syncDatabase`.
- **Engine:** В `engine.ts`: `AltroOrchestrator.syncDatabaseSchema()` строит `SemanticIntent` (entity: `RDB$RELATIONS`, fields: `['RDB$RELATION_NAME']`), передаёт в `AltroSqlAdapter.buildFirebirdSelect()`, возвращает SQL (или выбрасывает при Semantic Access Denied). Импорт: `AltroSqlAdapter`, `SemanticIntent` из `./adapters/sql-adapter`.
- **Адаптер:** `src/lib/altro/adapters/sql-adapter.ts` — Firebird Dialect 3, FIRST/SKIP, Semantic Firewall (запрет таблиц из FORBIDDEN_ENTITIES). Используется в тестах (Strawberry Plot, Forbidden Fruit) и в `syncDatabaseSchema()`.
- **Режим data_query:** В `buildSystemPrompt` есть ветка `mode === 'data_query'` (SQL-INTENT manifest, без сырого SQL); в `processAndMaybeRetry` data_query обходится без Libra/Resonance.

**Вывод:** Хуки для интеграции с SQL/Firebird активны: UI → useAltroPage (isSyncing, syncDatabase) → engine.syncDatabaseSchema() → AltroSqlAdapter. Цепочка Legislative Core (intent) → Executive Shell (SQL) соблюдена; готовность к расширению реальным подключением к Firebird имеется.

---

## 5. Краткое резюме для перехода к Стратегии V2.0 и монетизации

- **Ядро:** tokenManager, engine, lock-system реализованы и согласованы со Standard v2.1; Mirror Zero-Noise и OPR Meta-Anchor работают.
- **Контроль разработки:** .cursorrules (Назарян) задаёт приоритеты; код и промпты им соответствуют.
- **13 доменов:** Связь 5 внутренних и 8 внешних векторов реализована (общий тип, getActiveDomainsList, иерархия Legislative/Executive).
- **DATA SYNC:** UI, хуки и engine интегрированы с AltroSqlAdapter; тесты и Semantic Firewall подтверждают готовность к дальнейшей интеграции с Firebird.

Контекст для перехода к Стратегии V2.0 и монетизации подтверждён.
