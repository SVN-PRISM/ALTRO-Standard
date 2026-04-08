# Archive — художественные и психологические модули

Файлы перенесены с целью фокуса ALTRO 1 на **100% точность данных через Трафарет (Stencil)**.

## Содержимое

### Метафоры и образность
- `src/lib/altro/DomainEngine.ts` — 5 линз (Semantic, Context, Intent, Imagery, Sacred), метафоры
- `src/lib/altro/vectorEngine.ts` — SEMANTIC_VECTORS (imagery, spirit, context), искривление семантического поля

### Эмоциональные Октавы
- `src/lib/altro/trust-layer.ts` — detectOctaveDomains(), OCTAVE_PATTERNS (8 Civilizational Domains)

### Психологические домены
- `src/lib/altro/domain-processor.ts` — 13 векторов, DOMAIN_THESAURUS, DOMAIN_ROOTS, PLATO'S PROJECTORS
- `src/lib/altro/radarChartData.ts` — prepareRadarSeries для полигона
- `src/components/DomainSlider.tsx` — вертикальный слайдер доменов
- `src/components/altro/ControlPanel.tsx` — INTERNAL CORE (5 слайдеров), OPR, EXTERNAL DOMAINS
- `src/components/altro/MeaningMenu.tsx` — ExternalDomainsBlock (8 доменов), HomonymClarifyButton
- `src/components/altro/CalibrationPanel.tsx` — калибровка
- `src/altro/config.ts` — CANONICAL_DOMAIN_TABLE, AltroDomain
- `src/altro/orchestrator.ts` — intResonSliderPart, computeTransformationLevel

### Resonance (художественное качество)
- `src/lib/altro/ResonanceValidator.ts` — validation structural_anchors
- `src/components/ResonanceWidget.tsx` — RadarChart, OPR-индикатор
- `src/hooks/useResonance.ts` — domainWeights, oprPrismValue state

## Что оставлено нетронутым

- **DATA SYNC**: `useAltroSync`, `QueryProtector`, `firebird.server`, `db.ts`, `sync_integrity.test.ts`
- **API**: `transcreate/route.ts`
- **Phase 1**: `ipaPhase1.ts`, `PromptBuilder`, `foundation`
