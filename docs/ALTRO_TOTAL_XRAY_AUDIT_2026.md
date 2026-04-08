# ALTRO LIBRA — TOTAL X-RAY AUDIT (Read-Only)

**Дата:** 16 марта 2026  
**Режим:** Только анализ, без изменений кода

---

## 1. АРХИТЕКТУРНЫЙ МОНОЛИТ (TOPOGRAPHY)

### 1.1 Hub-файлы и зависимости

| Hub | Зависимости (импорты) |
|-----|------------------------|
| **useAltroPage.ts** | react, react-dom, altroData, altroLogic, engine, domain-processor, tokenManager, textUtils, CommandProcessor, SemanticFirewall, QueryProtector, DomainEngine, foundation, voiceService, useNexus, useResonance, db |
| **engine.ts** | altroData, dictionary, tokenManager, textUtils, domain-processor, trust-layer, sql-adapter, language-filter, SemanticFirewall; re-exports: orchestration, language-filter, domain-processor, trust-layer, vectorEngine, textUtils, tokenManager |
| **page.tsx** | ToolsModal, useAltroPage, ControlPanel, Workspace, MeaningMenu, ResonanceWidget, Sidebar, ArchiveModal, ArchivePanel, ExportModal, ChronosModal, altroData |

### 1.2 Иерархия управления

| Роль | Файл | Описание |
|------|------|----------|
| **Orchestrator (мозг)** | useAltroPage.ts | Центральный хук: объединяет Nexus, Resonance, Engine, Firewall, DB; управляет runScan, handleSave, clearAll |
| **Engine (исполнитель)** | engine.ts | AltroOrchestrator: buildOllamaPayload, request(), logToChronos; формирует промпты, проксирует к API |
| **API (шлюз)** | api/transcreate/route.ts | Прокси к Ollama; AltroSafetyGuard перед отправкой |
| **Подчинённые** | useNexus, useResonance | Источники данных (текст, веса, OPR) |

### 1.3 Циклические импорты и хрупкие связи

**Результат:** Циклических импортов не обнаружено.

- `engine` → `orchestration` (re-export); `orchestration` не импортирует `engine`
- `useAltroPage` → `useNexus`, `useResonance`; обратных импортов нет
- `SemanticFirewall` → `sql-adapter`; `sql-adapter` не импортирует `SemanticFirewall`

**Хрупкая связь:** `engine.ts` использует `require('@/lib/db')` внутри `logToChronos` и `logSecurityBlockToChronos` — динамический импорт, может усложнить tree-shaking.

---

## 2. МАТРИЦА СМЫСЛОВ (THE FUNNEL & DOMAINS)

### 2.1 Внутренний контур (5 доменов)

**Реализация:** `altroData.ts` → `DomainWeights`, `INTERNAL_DOMAIN_KEYS`, `INTERNAL_DOMAIN_LABELS`

| Домен | Ключ | Лейбл | Диапазон |
|-------|------|-------|----------|
| Семантика | semantics | Семантика | 0..1 |
| Контекст | context | Контекст | 0..1 |
| Интенция | intent | Намерение | 0..1 |
| Образность | imagery | Образность | 0..1 |
| Этика/Сакральное | ethics | Этика & Сакральное | 0..1 |

**В промпте (engine.ts:234):** `[WEIGHTS] Semantics=${internal.semantics}; Context=...; Intent=...; Imagery=...; Ethics=...`

### 2.2 Внешний контур (8 цивилизационных доменов)

**Реализация:** `altroData.ts` → `EXTERNAL_DOMAIN_KEYS`, `EXTERNAL_DOMAIN_LABELS`

| Порядок | Ключ | Лейбл |
|---------|------|-------|
| 1 | economics | Экономика |
| 2 | politics | Политика |
| 3 | society | Общество |
| 4 | history | История |
| 5 | culture | Культура |
| 6 | aesthetics | Эстетика |
| 7 | technology | Технологии |
| 8 | spirituality | Духовность |

**Диапазон:** -1..1 (нормализуется в 0..1 в SemanticFirewall и vectorEngine)

### 2.3 domain-processor.ts — раскладка на 13 векторов

**Фактически реализовано:**
- `getActiveDomainsList(calibration)` — возвращает список активных доменов по порогам (internal > 10, external > 0.1)
- `findDomainForWord(word)` — по DOMAIN_ROOTS (RU/EN/HY) определяет домен слова
- `getDomainTermsForCheck(domainKey, targetLang)` — корни для проверки
- **Нет** прямой функции «разложить текст на 13 векторов» — векторизация идёт через `calibrationToVector` / `domainWeightsToVector` в SemanticFirewall, а не через анализ текста по словам

**Слепая зона:** Текст не «раскладывается» на 13 векторов по словам. Вектор намерения строится из слайдеров (domainWeights), а не из семантического анализа текста.

---

## 3. РЕЗОНАНС И ПЕТЛЯ (OPR & IPA)

### 3.1 OPR — физическое расположение

| Компонент | Файл | Роль |
|-----------|------|------|
| **Хранение OPR** | useResonance.ts | `oprPrismValue` (0–100) в React state |
| **Передача в Engine** | useAltroPage.ts | `calibration.opr = oprPrismValue / 100` |
| **Модуляция весов** | vectorEngine.ts | `applyOprModulation(weights, oprPrism)` — Effective_Influence_i = D_i * O |
| **Firewall OPR** | SemanticFirewall.ts | `oprVector` — 13-мерный эталон; TDP = cosineSimilarity(intentVector, oprVector) |

**Индукция на входе:** OPR передаётся в `_altroDebug.oprIntensity` в API и в `[WEIGHTS]` промпта. Работает как «индукция» — задаёт интенсивность влияния доменов.

**Дуальность:** 
- **Инженерный контроль:** TDP < 0.85 → блок (SemanticFirewall.evaluateResonance)
- **Квантовый резонанс:** trust-layer.verifyResonance — формула 40/40/20 (Структура/Якоря/Домены) для пост-проверки выхода

### 3.2 IPA (Semantic Packets) — петля в engine.ts

**Фактически реализовано:**
- **Пакет:** `buildOllamaPayload()` → messages (system, user, assistant seed)
- **Структура:** `[INPUT_START]` … `[INPUT_END]` / `[OUTPUT_START]` … `[OUTPUT_END]`
- **Разделение фаз:** 
  - `SYSTEM_DISABLE_THINKING_HEADER` — отключает `<thought>` теги
  - Нет явной «аналитической» vs «исполнительной» фазы в одном запросе — один system prompt, один user message
- **Петля:** Нет явной «петли» (повторной отправки пакета в модель). Есть retry при низком resonance (trust-layer) и при AbortError (упрощённый промпт).

**Слепая зона:** Термин «IPA» / «Semantic Packets» в коде не встречается. Петля реализована как retry, а не как двухфазный цикл.

---

## 4. БЕЗОПАСНОСТЬ И FIREWALL (GUARD LAYER)

### 4.1 SemanticFirewall.ts

| Механизм | Описание |
|----------|----------|
| **TDP** | cosineSimilarity(intentVector, oprVector); порог 0.85 |
| **LEARNING_MODE** | true — не блокирует, только логирует |
| **checkLockedSeal** | Блок, если locked token отсутствует в requestText |
| **evaluate()** | 1) checkLockedSeal 2) evaluateResonance |
| **Коды** | reportLine в виде строки; нет отдельного code/reason |

### 4.2 AltroSafetyGuard.ts

| Проверка | code | reason |
|----------|------|--------|
| Invalid body | INVALID_STRUCTURE | Invalid request body |
| Empty messages | EMPTY_REQUEST | Empty or missing messages |
| ethics < 0 | ETHICS_VIOLATION | [ETHICS] Domain weight below threshold |
| BLOCKED_PATTERNS | LAW_VIOLATION | [LAW/ETHICS] Content matches blocked pattern |

### 4.3 API 403 — что получает фронтенд

**api/transcreate/route.ts:** Возвращает `{ error, code, reason }` при 403.

**engine.ts:** При 403 парсит body, вызывает `logSecurityBlockToChronos(params, code, reason)`.

**useAltroPage.ts:** Ловит `err.message.includes('Security Policy Violation')` → `setSecurityBlocked(true)`, `setDisplayedAdaptation('Security Policy Violation')`.

**Вывод:** Фронтенд **не** получает code/reason в UI — только общее «Security Policy Violation». code и reason пишутся в Chronos, но не отображаются пользователю в основном интерфейсе.

---

## 5. ТРИЕДИНСТВО ПАМЯТИ (VAULT, ARCHIVE, CHRONOS)

### 5.1 Схема IndexedDB (lib/db.ts)

| Таблица | Поля | Ротация |
|--------|------|---------|
| **vault** | id, name, source, result, radar, model, timestamp, resonance?, nexusCommand? | Нет |
| **chronos** | id, name, source, result, radar, model, timestamp, generationTimeMs, tokenCount | FIFO 5000 |
| **archive** | id, source, result, timestamp | FIFO 500 |

### 5.2 Сохранение OPR, Radar, nexusCommand

| Хранилище | OPR (resonance) | Radar | nexusCommand |
|-----------|-----------------|-------|--------------|
| **Vault** | ✅ Да | ✅ Полный (13 доменов) | ✅ Да |
| **Archive** | ❌ Нет | ❌ Нет | ❌ Нет |
| **Chronos** | ✅ В name (resonance) | ⚠️ Только internal (5 доменов) | ❌ Нет |

### 5.3 Аномалии

- **Chronos.radar:** `params.calibration?.internal || {}` — только 5 внутренних, 8 внешних не сохраняются
- **Archive:** Только source, result, timestamp — для «лёгкого» просмотра истории

---

## 6. СОСТОЯНИЕ ИНТЕРФЕЙСА (NEXUS & CHRONOS)

### 6.1 Данные в логе Chronos

| Поле | Отображение |
|------|-------------|
| name | Имя записи (например, 0001_MIRROR_20260316_1230_50) |
| generationTimeMs, tokenCount | «Xms · Y tok» |
| result / source | Первые 80 символов |

**Индикация уровней (Зелёный/Жёлтый/Красный):** Нет. Все записи в одном стиле. Для security_block — result = "Security Block: [CODE] - [REASON]", визуально не выделяется цветом.

### 6.2 Восстановление состояния при клике

| Модал | onClick | Восстанавливает |
|-------|---------|-----------------|
| **Vault (ArchiveModal)** | onSelectRecord | source, result, radar, resonance, nexusCommand ✅ |
| **Chronos** | Нет | Клик по записи ничего не делает ❌ |

**Слепая зона:** ChronosModal не имеет onSelectRecord — восстановление из Chronos не реализовано.

---

## 7. МАНИФЕСТЫ И СТАНДАРТЫ

### 7.1 "ALTRO Golden Standard"

**В коде:**
- `goldStandard` — сценарий в SCENARIO_UI_WEIGHTS (culture 0.7, aesthetics 0.5, technology 0.3, semantics 0.85, context 0.75, intent 0.62, imagery 0.45, ethics 0.9)
- UI: Sidebar, CalibrationPanel — опция «GOLD STANDARD»
- `ALTRO_GOLDEN_STATE` — внутренняя переменная в useAltroPage: «золотой» текст после Scan/Transcreate (не путать с goldStandard-сценарием)

**Трансляция модели:** Сценарий goldStandard задаёт веса доменов. В промпт попадает через `[WEIGHTS]` и `[DOMAINS_ACTIVE]` (getActiveDomainsList). Прямого текста «ALTRO Golden Standard» в промпте нет.

### 7.2 GOLDEN_DATASET (foundation.ts)

Массив AltroSample для обучения/калибровки. Используется в vectorEngine (calculateScenarioWeights при scenario === 'goldStandard'). Не передаётся в системный промпт LLM.

---

## 8. СВОДНАЯ ТАБЛИЦА МОДУЛЕЙ

| Модуль | Реализовано | Связи | Аномалии |
|--------|-------------|-------|----------|
| useAltroPage | Hub UI, runScan, handleSave, clearAll | engine, useNexus, useResonance, db, SemanticFirewall | — |
| engine | AltroOrchestrator, buildSystemPrompt, request, logToChronos | orchestration, domain-processor, trust-layer, SemanticFirewall | require('@/lib/db') |
| domain-processor | getActiveDomainsList, findDomainForWord | altroData, types/altro | Текст не векторизуется по словам |
| SemanticFirewall | TDP, checkLockedSeal, evaluateResonance | sql-adapter | LEARNING_MODE=true — не блокирует |
| AltroSafetyGuard | checkRequest, ETHICS/LAW | api/transcreate | — |
| lib/db | vault, chronos, archive | addVaultRecord, addArchiveRecord, addChronosRecord | Chronos.radar только internal |
| ChronosModal | Список логов | db.chronos | Нет onClick, нет восстановления |
| ArchiveModal | Список Vault, onSelectRecord | db.vault, page | Восстановление работает |
| API 403 | code, reason в body | engine.logSecurityBlockToChronos | Фронт не показывает code/reason |
| OPR | oprPrismValue, applyOprModulation, TDP | useResonance, vectorEngine, SemanticFirewall | — |
| goldStandard | Сценарий, SCENARIO_UI_WEIGHTS | altroData, vectorEngine | Не в промпте как текст |

---

*Отчёт подготовлен в режиме read-only. Изменения в код не вносились.*
