# AUDIT REPORT — ALTRO 1 DATA STENCIL

**Дата аудита:** 2026-03-23  
**Ветка:** ALTRO 1  
**Цель:** 100% точность данных через Трафарет (Stencil)

---

## 1. Inventory: Модули в /core и их связи

### Активные модули

| Модуль | Назначение | Зависимости |
|--------|------------|-------------|
| **DataVault.ts** | Хранилище чувствительных данных с ключами `{{IPA_N}}` | — |
| **Masker.ts** | Создание трафарета: regex-поиск, сохранение в DataVault, замена на метки | DataVault |
| **SovereignController.ts** | Оркестратор: createStencil() → inject() | DataVault, Masker |
| **index.ts** | Реэкспорт | DataVault, Masker, SovereignController |

### Граф связей /core

```
SovereignController
    ├── DataVault (создаёт, передаёт в Masker)
    └── Masker (принимает DataVault в конструкторе)

DataVault ← Masker.mask() вызывает vault.push()
```

### Интеграция

- `/core` **не интегрирован** в основной пайплайн приложения.
- Используется только в `test_run.ts` (корень проекта) для проверки.
- API `/api/transcreate` и engine **не используют** SovereignController/DataVault/Masker.

---

## 2. Dead Code Analysis

### Файлы, не используемые после переезда в ALTRO 1

| Файл | Причина |
|------|---------|
| `src/components/LEDIndicator.tsx` | Никогда не импортируется |
| `src/core/contextDetection.ts` | `getZamokContext` не вызывается нигде в src/ |
| `src/core/validation.ts` | `validateTranscreation`, `ValidationResult` — только в archive/orchestrator (исключён) |
| `src/config/altro.config.ts` | Реэкспорт из @/altro/config; используется только archive/DomainSlider (исключён) |

### Тестовые/диагностические файлы (вне сборки)

| Файл | Назначение | Статус |
|------|------------|--------|
| `src/lib/altro/altro_stress_test.ts` | Стресс-тест engine | Запуск вручную |
| `src/lib/altro/adapters/forbidden_fruit_stress_test.ts` | Тест sql-adapter | Запуск вручную |
| `src/lib/altro/adapters/strawberry_plot_test.ts` | Тест sql-adapter | Запуск вручную |
| `src/tests/firewall_smoke_test.ts` | Smoke-тест Firewall + QueryProtector | Запуск вручную |
| `src/tests/firewall_monitor_diagnostic.ts` | Диагностика Firewall | `npm run test:firewall-monitor` |
| `src/lib/altro/tests/ipa_verification.test.ts` | Тест IPA Phase 1 | Запуск вручную |
| `src/lib/altro/tests/sync_integrity.test.ts` | Тест sync | Запуск вручную |

### Stub-модули (заглушки после архивации)

Содержат минимальную логику, полноценные версии — в archive:

- `src/lib/altro/domain-processor.ts`
- `src/lib/altro/trust-layer.ts`
- `src/lib/altro/ResonanceValidator.ts`
- `src/lib/altro/vectorEngine.ts`
- `src/lib/altro/DomainEngine.ts`
- `src/components/altro/MeaningMenu.tsx` (ExternalDomainsBlock — stub)
- `src/components/ResonanceWidget.tsx`
- `src/altro/config.ts`

---

## 3. Security Audit: DataVault и Masker

### DataVault

| Риск | Описание | Уровень |
|------|----------|---------|
| **Потеря данных при пересоздании** | Vault in-memory. Новая инстанция → пустой store. inject() после пересоздания контроллера оставит метки. | **HIGH** |
| **Неизвестный ключ** | `inject()` использует `vault.get(match) ?? match`. При отсутствии ключа метка остаётся в тексте. | **MEDIUM** |
| **Вариации меток** | Regex `/\{\{IPA_\d+\}\}/g` не учитывает пробелы: `{{ IPA_1 }}` не найдётся. | **MEDIUM** |

### Masker

| Риск | Описание | Уровень |
|------|----------|---------|
| **Ограничение валют** | Паттерн только `$`. `€`, `£`, `₽` не маскируются → данные уходят в LLM. | **HIGH** |
| **Форматы дат** | Поддерживается `Jan 26, 2026` / `January 26, 2026`. `26.01.2026`, `2026-01-26` — нет. | **MEDIUM** |
| **Порядок regex** | Деньги, проценты, даты не пересекаются. Риск ложных срабатываний минимален. | **LOW** |
| **Дубликаты** | Одинаковые значения получают разные ключи ({{IPA_1}}, {{IPA_2}}). inject() корректен. | **LOW** |

### Рекомендации по безопасности

1. Сериализация DataVault (JSON) и привязка к сессии/запросу.
2. Расширение regex: `€`, `£`, `₽`, форматы ISO и `DD.MM.YYYY`.
3. Более гибкий поиск меток: `/\{\{\s*IPA_\d+\s*\}\}/g` или нормализация перед inject.

---

## 4. Dependency Graph

### Текущая структура зависимостей

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PAGE (src/app/page.tsx)                        │
└─────────────────────────────────────────────────────────────────────────┘
    │
    ├── useAltroPage
    │     ├── engine (AltroOrchestrator, buildSystemPrompt, ...)
    │     │     ├── domain-processor (stub)
    │     │     ├── trust-layer (stub)
    │     │     ├── ResonanceValidator (stub)
    │     │     ├── vectorEngine (stub) ← orchestration
    │     │     ├── ipaPhase1
    │     │     ├── PromptBuilder, SemanticPackager, ChronosService
    │     │     ├── SemanticFirewall
    │     │     └── AltroGuard
    │     ├── useResonance, useAltroScanner, useNexus
    │     ├── DomainEngine (stub), CommandProcessor
    │     ├── voiceService, fileProcessor
    │     └── useAltroSync
    │           ├── QueryProtector
    │           └── SemanticFirewall
    │
    ├── ControlPanel, Workspace, MeaningMenu, ResonanceWidget
    ├── ToolsModal, Sidebar, ArchiveModal, ArchivePanel, ExportModal, ChronosModal
    └── lib/altroData
```

### API и Firebird Sync

```
/api/transcreate
    └── AltroSafetyGuard.checkRequest()
    (engine вызывается из клиента, не из route)

DATA SYNC (useAltroSync)
    ├── engine.syncDatabaseSchema() → AltroSqlAdapter
    ├── QueryProtector.protectAndPrepare() → SemanticFirewall
    ├── firebird.server (executeFirebirdQuery) — опционально
    └── lib/db (addChronosRecord)
```

### Связь с /core

**Текущая:** отсутствует.  
SovereignController не вызывается из engine, transcreate или useAltroPage.

---

## 5. Recommendations

### Структура папок

1. **Использовать /core как ядро Stencil**  
   - Добавить path `@/core` в tsconfig.  
   - Перенести интеграцию: engine или transcreate route должны вызывать SovereignController.

2. **Очистить src/core**  
   - `validation.ts`, `contextDetection.ts` — удалить или объединить с другими утилитами, если появятся потребители.

3. **Собрать тесты в /test_lab**  
   - `firewall_smoke_test.ts`, `firewall_monitor_diagnostic.ts`, `ipa_verification.test.ts`, `sync_integrity.test.ts` и др. — в `test_lab/` с единым `npm run test`.

4. **Сократить src/config**  
   - `altro.config.ts` сейчас не используется в активной сборке. Либо удалить, либо подключить к реальным потребителям.

### Приоритеты

| # | Действие |
|---|----------|
| 1 | Интегрировать SovereignController в pipeline transcreate (mask → LLM → inject) |
| 2 | Расширить Masker (валюты, форматы дат) и упрочить DataVault (персистентность/сессия) |
| 3 | Удалить dead code и перераспределить тесты в /test_lab |

---

*Конец отчёта.*
