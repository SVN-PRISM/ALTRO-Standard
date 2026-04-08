# ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)

## 0. BEACON: Манифест Смыслового Суверенитета

Этот раздел является высшей директивой для всех модулей Ядра ALTRO. Любая генерация, транскреация или семантический поиск должны соотноситься с данными принципами.

### 0.1. Миссия: Высокоточный прицел

ALTRO — это Semantic Orchestration Layer. Это инструмент, превращающий хаос данных в кристально чистую волю Наблюдателя. Цель — защита Смыслового Суверенитета в эпоху ИИ-доминирования.

### 0.2. Система Координат (Двухдвижковая Модель)

Три уровня защиты смысла, выстроенные от эталона к исполнению:

- **Золотой Резерв (8 слов-якорей):** Незыблемый эталон метра в пространстве смыслов. Точка отсчёта для калибровки всех языковых пар.
- **Legislative Core (5 Внутренних доменов):** Semantic, Context, Intent, Imagery, Ethical. Законодательное ядро, формирующее "ДНК", глубину и вектор цели сообщения.
- **Executive Shell (8 Цивилизационных осей):** Basis (Экономика), Power (Политика), Society (Общество), Time (История), Code (Культура), Form (Эстетика), Tech (Технологии), Spirit (Духовность). Исполнительная оболочка, выступающая контекстным фильтром для адаптации смысла под конкретную среду реализации.
- **Integrity Protocol (OPR):** Трансформация внешнего фильтра в базовый стандарт нерушимости связей. Протокол гарантирует сохранение авторских смысловых «замков», ударений и омонимов в процессе любой транскреации — скелет нерушимости Объекта и Предиката.

### 0.3. Статус Продукта: The Trust Layer

ALTRO функционирует как Мета-Протокол (Middleware), обеспечивающий "Смысловую Печать" и иммунитет к информационному шуму.

### 0.4. Психология управления

В системе ALTRO пользователь является Архитектором Смыслов. ИИ ([EXECUTOR_LLM] — любая языковая модель) — это ассистент-аудитор и исполнительный механизм, действующий строго в рамках заданных Архитектором "законов физики смысла", получая директивы детерминации через Command Bar (вектор воли).

---

## 1. ALTRO Core Architecture: Semantic Orchestration Layer

This section is the **canonical manifesto** for STENCIL-era development, prompt design, and any code path that touches entity masking, the vault, or mirror output. All future features must remain consistent with it.

ALTRO 1 implements a **Translation-First** pipeline: sensitive surface forms are normalized into an abstract stencil **before** the executor LLM sees them. The Semantic Orchestration Layer is the contract between **data sovereignty** (what we store), **prompt hygiene** (what the model may see), and **mirror integrity** (what the user receives).

### 1.1. Data–Display Bifurcation

| Concept | Role |
|--------|------|
| **Source (Data)** | The original entity span as extracted from input (e.g. `March 28, 2026`). Held for audit, history, and vault bookkeeping. |
| **Display (Brick)** | The localized surface form in the **target language** (e.g. `28 марта 2026 г.`). This is what substitution and injection must use when rendering to the user. |

**Hard rule — prompt firewall:** The executor LLM must **never** see the Source. It only sees the abstract placeholder `{{IPA_N}}` in the masked prompt. Translation-First masking computes the Display brick during masking and stores it in the vault; the model’s job is syntactic and stylistic placement around the tag, not re-reading raw foreign literals.

*Рус.: Исходник хранится отдельно; в промпт попадает только трафарет с `{{IPA_N}}`.*

### 1.2. Vault Synchronization (`X-Altro-Stencil-Vault`)

Server and browser must agree on the **display map** without sharing session state. The standard mechanism is a **stateless HTTP header**:

- **Header name:** `X-Altro-Stencil-Vault`
- **Value:** **Base64-encoded UTF-8 JSON** of the server `DataVault` snapshot (the payload includes `store`, where each key is `{{IPA_N}}` and each value is the **Display** brick).

The client decodes this header and hydrates `StreamInjector` / final injectors so streaming and completion paths substitute **Display**, not the client-side capture snapshot (which may still hold Source-like strings from entity scan).

**Rule:** Treat the header as the authoritative **display vault** for the request; client-side `ipaVault` from capture is a fallback only when the header is absent or empty.

### 1.3. Semantic Domain Constraint — OPR Filter & Adaptive Grammar

The **OPR (Operational / Integrity) filter** applies to how the model treats stencil nodes: a tag is not an opaque foreign blob; it is a **slot for a native grammatical object** in the target language.

**Adaptive grammar (required):** The LLM is responsible for the **syntactic environment** around each `{{IPA_N}}` tag — agreement, government, and natural word order. The standard is:

- Output must respect **case (падеж)**, **gender**, and **prepositional / government rules** of the **target language**, as if the resolved brick were a native phrase.
- The tag must be positioned so that, **after Finalize injection**, the full sentence remains grammatical when Display replaces `{{IPA_N}}`.

Prompts should state this explicitly (Constraint 3 family): nodes represent entities **already adapted** to the target language; the model places them correctly **in the sentence**, not as quoted literals.

### 1.4. Sovereignty & Security — Finalize as Point of Truth

**Finalize (injection)** is the **point of truth** for what the user sees: it runs **outside** the LLM’s generative space. The model emits text that may still contain `{{IPA_N}}` markers; **Finalize** replaces those markers with vault **Display** values deterministically.

This guarantees:

- **Data integrity:** Source never leaks into UI through the model’s channel; Display is applied by core code.
- **Sovereignty:** The orchestration layer—not the model—owns entity resolution and localization policy.

Any “mirror” or output surface that shows final text must consume the **post-Finalize** (or equivalently **post–StreamInjector**) string when vault sync is active.

### СТАНДАРТ: ДОКАЗАТЕЛЬСТВО НАЗАРЯНА (The Sovereign Formula Rule)

* **Определение объекта:** Формулой считается любой блок текста, заключенный в ограничители ($$, $, \[... \], \(... \)) ИЛИ содержащий явные математические операторы (=, ≈, ≠, ±, ∑, ∫, \times) в сочетании с переменными.
* **Приоритет Изоляции (№0):** Захват формул выполняется ПЕРВЫМ, до начала работы любых числовых, валютных или лингвистических магнитов.
* **Семантическая Квантованность:** Формула является неделимым объектом. Внутренние элементы (числа, проценты, слова внутри \text{}) НЕ могут получать собственные ID. Весь блок получает единый ID: `{{IPA_FORMULA_N}}`.
* **Принцип Инвариантности:** При демаскировании (unmask) исходная строка должна быть восстановлена байт-в-байт, исключая искажения со стороны LLM.

---

## 2. Архитектурный Стандарт: IPA-Протокол

Обработка информации идет строго по протоколу Information-Process-Action:

* **I (Information):** Захват сырых данных (Capture).
* **P (Process):** Активация весов (5 Внутренних + 8 Цивилизационных доменов) через Command Intent.
* **A (Action):** Финальная генерация с учетом Протокола Целостности.

## 3. Режим «Зеркало» (Mirror Mode)

Состояние лингвистической нейтральности. Коэффициент трансформации смыслов `K_trans = 0`. Обеспечение абсолютного изоморфизма (1:1). Инструкция для [EXECUTOR_LLM]: строго следовать принципу неприкосновенности авторской структуры.

## 4. Интерфейс и Визуальный Стандарт

* Интерфейс должен строго следовать архитектуре **Glass Engine** (3 панели: Терминал захвата, Монитор Трафарета, Смысловой Шлюз).
* Использование "упрощенного вида" или откат к старым методам управления категорически запрещены.

[ALTRO-CORE]: Закон ALTRO1 утвержден. OPR трансформирован. Матрица 5+8 зафиксирована.
