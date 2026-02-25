/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { CANONICAL_DOMAIN_TABLE, AltroDomain } from '@/altro/config';
import { DomainSlider } from '@/components/DomainSlider';
import { GOLDEN_DATASET, ExternalDomainKey, InternalDomainKey } from '@/lib/altro/foundation';
import {
  INITIAL_DOMAIN_WEIGHTS,
  EXTERNAL_DOMAIN_LABELS,
  INTERNAL_DOMAIN_LABELS,
  EXTERNAL_DOMAIN_KEYS,
  INTERNAL_DOMAIN_KEYS,
  INTERNAL_BAR_COLOR,
  CLARIFICATION_OPTIONS,
  HOMONYM_DB,
  HOMONYM_WORD_FORMS,
  type DomainWeights,
} from '@/lib/altroData';
import { DOMAIN_MATRIX, SCENARIO_UI_WEIGHTS, HOMONYM_WORDS, type ScenarioType } from '@/lib/altroData';
import { ToolsModal } from '@/components/ToolsModal';
import { useAltroPage } from '@/hooks/useAltroPage';

const INITIAL_DOMAINS: AltroDomain[] = CANONICAL_DOMAIN_TABLE.map((spec) => ({
  name: spec.name,
  weight: 0,
  status: 'active' as const,
}));

export default function Test() {
  const state = useAltroPage();
  const {
    activePreset,
    setActivePreset,
    isEditing,
    isDark,
    setTheme,
    selectedScenario,
    setSelectedScenario,
    archive,
    setArchive,
    showArchive,
    setShowArchive,
    sourceText,
    setSourceText,
    sourceTextRef,
    adaptationText,
    setAdaptationText,
    setDisplayedAdaptation,
    displayedAdaptation,
    ALTRO_GOLDEN_STATE,
    calibratedText,
    domainWeights,
    setDomainWeights,
    activePattern,
    textTokens,
    homonymRegistry,
    homonymInstances,
    semanticSuggestions,
    selectedTokenId,
    setSelectedTokenId,
    showHomonymClarify,
    setShowHomonymClarify,
    showSuspiciousSuggestion,
    setShowSuspiciousSuggestion,
    selectedSuspiciousTokenId,
    setSelectedSuspiciousTokenId,
    semanticOkFlash,
    adaptationFlash,
    homonymReplaceHighlight,
    oprPrismValue,
    setOprPrismValue,
    nexusCommand,
    setNexusCommand,
    isScanning,
    isAnalyzed,
    toolsModalMode,
    setToolsModalMode,
    snapshots,
    language,
    setLanguage,
    committedTokens,
    isCommitted,
    nexusCommandRef,
    homonymClarifyRef,
    suspiciousSuggestionRef,
    handleSourceChange,
    handleNexusResize,
    runScan,
    applyPreset,
    clearAll,
    clearSource,
    clearAdaptation,
    handleSave,
    createSnapshot,
    applySnapshot,
    deleteSnapshot,
    formatTimestamp,
    handleInternalDomainChange,
    handleExternalDomainChange,
    handleSourceHomographClick,
    handleHomonymVariantSelect,
    handleClarifyHomonym,
    handleSuspiciousSuggestionSelect,
    unresolvedHomonyms,
    homonymScan,
    semanticStatus,
    hasAdaptationChangesReady,
    adaptationDisplayHtml,
    sourceHighlightHtml,
    getActivePattern,
    areWeightsInStandby,
    startEditing,
  } = state;

  const handleScan = runScan;
  const handleClear = clearAll;

  return (
    <div
      className="font-sans p-4 transition-colors flex flex-col overflow-hidden max-h-screen"
      style={{ height: '100vh', maxHeight: '100vh', background: isDark ? '#000' : '#f4f4f4', color: isDark ? '#fff' : '#000' }}
    >
      <header className="flex-shrink-0 border-b pb-2 mb-2 flex items-center justify-between" style={{ borderColor: isDark ? '#1a1a1a' : '#ddd' }}>
        <h1 className="text-base font-bold tracking-widest" style={{ color: '#3b82f6' }}>
          ALTRO ORCHESTRATOR SVN STANDARD 2026
        </h1>
        <button
          type="button"
          onClick={() => setTheme(!isDark)}
          className="w-9 h-9 rounded-lg flex items-center justify-center border transition-colors"
          style={{ borderColor: isDark ? '#333' : '#ddd', background: isDark ? '#111' : '#fff' }}
          title={isDark ? 'Светлая тема' : 'Тёмная тема'}
          aria-label={isDark ? 'Light' : 'Dark'}
        >
          {isDark ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
      </header>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col min-w-0 flex-1 min-h-0 overflow-hidden">
          <div className="flex justify-between items-start gap-3 mb-1 flex-shrink-0">
            <span className="text-xs uppercase tracking-tighter flex-shrink-0 pt-1.5" style={{ color: '#6b7280' }}>Источник</span>
            <textarea
              ref={nexusCommandRef}
              value={nexusCommand}
              onChange={(e) => {
                setNexusCommand(e.target.value);
                handleNexusResize(e, false);
              }}
              onInput={(e) => handleNexusResize(e, false)}
              onPaste={(e) => handleNexusResize(e, true)}
              onCut={(e) => handleNexusResize(e, true)}
              placeholder="Введите директиву или выберите пресет..."
              aria-label="Nexus Command"
              rows={1}
              className="nexus-command-input flex-grow min-w-0 rounded text-[10px] font-medium placeholder:opacity-60 focus:outline-none border resize-none overflow-hidden"
              style={{
                minHeight: '28px',
                maxHeight: '200px',
                padding: '7px 10px',
                boxSizing: 'border-box',
                background: isDark ? '#0d0d0d' : '#e8e8e8',
                borderColor: '#C8A2C8',
                color: '#C8A2C8',
              }}
            />
            <div className="flex items-center gap-1 flex-shrink-0">
              {(displayedAdaptation?.trim() || adaptationText?.trim()) && (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isScanning}
                  title={isScanning ? 'Ожидание завершения анализа' : 'Сохранить адаптацию в архив под текущим таймстампом'}
                  className="text-[10px] px-3 py-1.5 rounded font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-200"
                  style={{
                    background: hasAdaptationChangesReady ? 'rgba(200,162,200,0.25)' : (isDark ? '#333' : '#e5e7eb'),
                    border: `1px solid ${hasAdaptationChangesReady ? '#C8A2C8' : (isDark ? '#444' : '#ccc')}`,
                    color: hasAdaptationChangesReady ? '#C8A2C8' : (isDark ? '#e5e7eb' : '#374151'),
                    boxShadow: hasAdaptationChangesReady ? '0 0 8px rgba(200,162,200,0.4)' : 'none',
                    opacity: isScanning ? 0.5 : 1,
                    cursor: isScanning ? 'not-allowed' : 'pointer',
                  }}
                >
                  СОХРАНИТЬ
                </button>
              )}
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                title={isScanning ? 'Анализ...' : 'Анализ текста'}
                className="text-[10px] px-3 py-1.5 rounded font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed"
                style={{
                  background: isScanning ? 'rgba(59,130,246,0.7)' : '#3b82f6',
                  border: '1px solid #2563eb',
                  color: '#fff',
                  boxShadow: isScanning ? '0 0 0 2px rgba(59,130,246,0.6)' : '0 0 10px rgba(59,130,246,0.5)',
                  opacity: isScanning ? 0.9 : 1,
                }}
              >
                {isScanning ? 'АНАЛИЗ...' : isAnalyzed && activePreset === 'transfigure' ? 'ТРАНСКРЕАЦИЯ' : 'SCAN'}
              </button>
            </div>
          </div>
          {isEditing ? (
            <div className="relative flex-1 min-h-0 flex flex-col">
              <textarea
                value={sourceText}
                onChange={handleSourceChange}
                spellCheck
                aria-label="Источник текста"
                className={`source-text-field w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none flex-1 min-h-0 overflow-y-auto whitespace-pre-wrap font-inherit ${isScanning ? 'synthesis-scanning' : ''}`}
                style={{ font: 'inherit', background: isDark ? '#111' : '#fff', border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}`, color: isDark ? '#fff' : '#000' }}
              />
              <button
                type="button"
                onClick={clearSource}
                title="Очистить источник"
                aria-label="Очистить источник"
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]"
                style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="relative flex-1 min-h-0 flex flex-col">
              <div
                className={`source-text-field w-full p-3 rounded-lg flex-1 min-h-0 overflow-y-auto whitespace-pre-wrap ${isScanning ? 'synthesis-scanning' : ''}`}
                style={{ font: 'inherit', background: isDark ? '#111' : '#fff', border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}`, color: isDark ? '#fff' : '#000' }}
                dangerouslySetInnerHTML={{ __html: sourceHighlightHtml ?? '' }}
                onClick={(e) => {
                const target = e.target as HTMLElement;
                const mark = target.closest?.('[data-token-id]');
                if (mark instanceof HTMLElement) {
                  const tokenId = mark.getAttribute('data-token-id');
                  if (tokenId) {
                    const id = parseInt(tokenId, 10);
                    const isHomonym = mark.classList.contains('homonym-highlight');
                    const isSuspicious = mark.classList.contains('suspicious-suggestion');
                    if (isHomonym) {
                      setShowSuspiciousSuggestion(false);
                      handleSourceHomographClick(id);
                    } else if (isSuspicious) {
                      setShowHomonymClarify(false);
                      setSelectedSuspiciousTokenId(id);
                      setShowSuspiciousSuggestion(true);
                    }
                  }
                } else {
                  startEditing();
                }
              }}
              />
              <button
                type="button"
                onClick={clearSource}
                title="Очистить источник"
                aria-label="Очистить источник"
                className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]"
                style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}
              >
                ×
              </button>
              {showSuspiciousSuggestion && selectedSuspiciousTokenId !== null && (() => {
                const suggestion = semanticSuggestions.find((s) => s.lowConfidence && s.tokenIds.includes(selectedSuspiciousTokenId));
                if (!suggestion) return null;
                return (
                  <div
                    ref={suspiciousSuggestionRef}
                    className="absolute left-3 bottom-3 p-2 rounded border shadow-lg z-50 flex flex-col gap-1 min-w-[180px]"
                    style={{ background: isDark ? '#111' : '#fff', borderColor: '#C8A2C8' }}
                  >
                    <span className="text-[9px] font-semibold" style={{ color: '#6b7280' }}>
                      Подозрение на ошибку. Заменить на:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSuspiciousSuggestionSelect(suggestion.phrase, suggestion.suggestion)}
                      className="text-left text-xs px-2 py-1.5 rounded border hover:opacity-90 transition-colors"
                      style={{ borderColor: '#C8A2C8', background: 'rgba(200,162,200,0.15)', color: isDark ? '#e5e7eb' : '#111' }}
                    >
                      {suggestion.suggestion}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}
        </div>


        <div className="flex flex-col min-w-0 flex-1 min-h-0 overflow-hidden">
          <div className="flex justify-between items-center gap-3 mb-1 flex-shrink-0">
            <span className="text-xs uppercase tracking-tighter" style={{ color: '#6b7280' }}>Адаптация</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <div
                className="w-2 h-2 rounded-full transition-all duration-300"
                style={{
                  background: semanticStatus.isOK ? '#22c55e' : '#6b7280',
                  boxShadow: semanticOkFlash ? '0 0 16px rgba(34,197,94,1)' : semanticStatus.isOK ? '0 0 8px rgba(34,197,94,0.6)' : 'none',
                }}
              />
              <span className="text-[9px] uppercase tracking-wider" style={{ color: semanticStatus.isOK ? '#22c55e' : '#6b7280' }}>
                Semantic {semanticStatus.isOK ? 'OK' : '...'}
              </span>
            </div>
          </div>
          <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
            <div
              contentEditable={false}
              role="region"
              aria-label="Адаптация"
              className={`adaptation-text-field w-full p-3 rounded-lg whitespace-pre-wrap flex-1 min-h-0 overflow-y-auto transition-opacity duration-300 ${isScanning ? 'synthesis-scanning' : ''}`}
              style={{
                fontFamily: "'Arial', 'Roboto', system-ui, sans-serif",
                background: isDark ? '#111' : '#fff',
                border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}`,
                color: isDark ? '#fff' : '#000',
                opacity: adaptationFlash ? 0.5 : 1,
              }}
              dangerouslySetInnerHTML={{ __html: adaptationDisplayHtml }}
            />
            <button
              type="button"
              onClick={clearAdaptation}
              title="Очистить адаптацию"
              aria-label="Очистить адаптацию"
              className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]"
              style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}
            >
              ×
            </button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 flex-shrink-0">
        <div className="flex items-center gap-4 py-2.5 px-3 rounded-lg flex-shrink-0 flex-wrap" style={{ background: isDark ? '#0d0d0d' : '#e8e8e8', border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}` }}>
          <button
            type="button"
            onClick={() => applyPreset('mirror')}
            title="Подстрочник 1-в-1"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            style={{
              borderColor: activePreset === 'mirror' ? '#3b82f6' : isDark ? '#333' : '#aaa',
              background: activePreset === 'mirror' ? 'rgba(59,130,246,0.2)' : isDark ? '#111' : '#fff',
              color: activePreset === 'mirror' ? '#60a5fa' : isDark ? '#e5e7eb' : '#111',
            }}
          >
            ЗЕРКАЛО
          </button>
          <button
            type="button"
            onClick={() => applyPreset('transfigure')}
            title="Транскреация"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            style={{
              borderColor: activePreset === 'transfigure' ? '#3b82f6' : isDark ? '#333' : '#aaa',
              background: activePreset === 'transfigure' ? 'rgba(59,130,246,0.2)' : isDark ? '#111' : '#fff',
              color: activePreset === 'transfigure' ? '#60a5fa' : isDark ? '#e5e7eb' : '#111',
            }}
          >
            ТРАНСКРЕАЦИЯ
          </button>
          <button
            type="button"
            onClick={() => applyPreset('bridge')}
            title="Synchronizer Lingua"
            className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            style={{
              borderColor: activePreset === 'bridge' ? '#3b82f6' : isDark ? '#333' : '#aaa',
              background: activePreset === 'bridge' ? 'rgba(59,130,246,0.2)' : isDark ? '#111' : '#fff',
              color: activePreset === 'bridge' ? '#60a5fa' : isDark ? '#e5e7eb' : '#111',
            }}
          >
            SYNCHRONIZER LINGUA
          </button>
          <button
            type="button"
            onClick={() => setLanguage(language === 'RU' ? 'EN' : 'RU')}
            className="text-[9px] px-1.5 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap"
            style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
          >
            {language}
          </button>
          <div className="relative" ref={homonymClarifyRef}>
            <button
              type="button"
              onClick={handleClarifyHomonym}
              disabled={unresolvedHomonyms.length === 0}
              title={unresolvedHomonyms.length > 0 ? `Омонимы: ${unresolvedHomonyms.map((t) => t.word).join(', ')} (использует getHomonymWordsFromEngine)` : 'Нет неразрешённых омонимов'}
              className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              УТОЧНИТЬ ОМОНИМ
            </button>
            {showHomonymClarify && selectedTokenId !== null && (() => {
              const token = textTokens.find((t) => t.id === selectedTokenId);
              if (!token?.isHomonym) return null;
              const form = token.word.toLowerCase().normalize('NFD').replace(/[\u0301]/g, '');
              const base = HOMONYM_WORD_FORMS[form] ?? form;
              const dbEntry = HOMONYM_DB.find((e) => e.base.toLowerCase() === base);
              const opts = dbEntry ? dbEntry.variants.map((v) => ({ label: `${v.word} (${v.meaning})`, value: v.word })) : (CLARIFICATION_OPTIONS[base] || []);
              if (opts.length === 0) return null;
              return (
                <div className="absolute left-0 top-full mt-1 p-2 rounded border shadow-lg z-50 flex flex-col gap-1 min-w-[200px]" style={{ background: isDark ? '#111' : '#fff', borderColor: isDark ? '#333' : '#ccc' }}>
                  <span className="text-[9px] font-semibold" style={{ color: '#6b7280' }}>Выберите значение для «{token.word}»:</span>
                  {opts.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleHomonymVariantSelect(selectedTokenId, opt.value)}
                      className="text-left text-xs px-2 py-1.5 rounded border hover:opacity-90 transition-colors"
                      style={{ borderColor: isDark ? '#333' : '#ddd', background: isDark ? '#1a1a1a' : '#f9fafb', color: isDark ? '#e5e7eb' : '#111' }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>
          <button type="button" onClick={handleClear} className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors whitespace-nowrap" style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}>
            ОЧИСТИТЬ
          </button>
        </div>


        <div className="flex items-center py-2 px-3 rounded-lg flex-shrink-0" style={{ background: isDark ? '#0d0d0d' : '#e8e8e8', border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}` }}>
          <div className="flex items-center gap-3 font-mono text-[9px] w-full">
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider" style={{ color: '#6b7280' }}>Режим:</span>
              <span className="font-semibold" style={{
                color: activePreset === 'mirror' ? (isDark ? '#6b7280' : '#9ca3af') : (isDark ? '#60a5fa' : '#3b82f6'),
                textShadow: activePreset !== 'mirror' ? '0 0 6px rgba(96,165,250,0.4)' : 'none'
              }}>
                {activePreset === 'mirror' ? 'Зеркало' : activePreset === 'transfigure' ? 'Транскреация' : activePreset === 'bridge' ? 'Синхронизатор' : 'Зеркало'}
              </span>
            </div>
            <span style={{ color: '#6b7280' }}>|</span>
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider" style={{ color: '#6b7280' }}>Паттерн:</span>
              <span className="font-semibold" style={{
                color: activePreset === 'mirror' ? (isDark ? '#4b5563' : '#9ca3af') : (activePattern || selectedScenario !== 'without') ? (isDark ? '#60a5fa' : '#3b82f6') : (isDark ? '#6b7280' : '#9ca3af')
              }}>
                {activePreset === 'mirror' ? '—' : activePattern ? activePattern.name : selectedScenario !== 'without' ? (selectedScenario === 'goldStandard' ? 'Gold Standard' : selectedScenario) : '—'}
              </span>
            </div>
            <span style={{ color: '#6b7280' }}>|</span>
            <div className="flex items-center gap-1.5">
              <span className="uppercase tracking-wider" style={{ color: '#6b7280' }}>Контекст зафиксирован:</span>
              <span className="font-semibold" style={{
                color: ALTRO_GOLDEN_STATE?.trim() ? '#22c55e' : (isDark ? '#6b7280' : '#9ca3af'),
                textShadow: ALTRO_GOLDEN_STATE?.trim() ? '0 0 6px rgba(34,197,94,0.4)' : 'none'
              }}>
                {ALTRO_GOLDEN_STATE?.trim() ? '✓' : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>


      <div className="mt-3 flex-shrink-0 flex flex-row items-stretch flex-nowrap overflow-x-auto" data-panel-container="true" style={{ width: '100%', minWidth: 0, gap: '12px' }}>
        {/* Блок 1: INTERNAL CORE — 5 горизонтальных слайдеров */}
        <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '315px', minWidth: '315px' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>INTERNAL CORE</p>
          <div className="flex flex-col flex-1 justify-between gap-3 min-h-0" style={{ paddingLeft: '12px', paddingRight: '12px' }}>
            {INTERNAL_DOMAIN_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-2 min-w-0 flex-shrink-0">
                <span className={`font-medium uppercase tracking-wider w-24 flex-shrink-0 whitespace-nowrap ${key === 'ethics' ? 'text-[8px]' : 'text-[9px]'}`} style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>{INTERNAL_DOMAIN_LABELS[key]}</span>
                <div className="flex-1 min-w-0 flex items-center gap-1">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={domainWeights[key]}
                    onChange={(e) => handleInternalDomainChange(key, parseFloat(e.target.value))}
                    className="internal-core-range flex-1 cursor-pointer"
                    disabled={activePreset === 'mirror'}
                    style={{
                      background: `linear-gradient(to right, ${INTERNAL_BAR_COLOR} 0%, ${INTERNAL_BAR_COLOR} ${domainWeights[key] * 100}%, ${isDark ? '#333' : '#e5e7eb'} ${domainWeights[key] * 100}%, ${isDark ? '#333' : '#e5e7eb'} 100%)`,
                    }}
                  />
                  <span className="text-[9px] font-mono font-bold tabular-nums w-10 flex-shrink-0 text-right px-1 py-0.5 rounded" style={{ background: isDark ? '#333' : '#e5e7eb', color: isDark ? '#e5e7eb' : '#374151' }}>
                    {(domainWeights[key] * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* OPR — -100..100, O=0 центр. Сиреневая уникальность (#C8A2C8). */}
        <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '72px', minWidth: '72px' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 pt-0 pb-0.5" style={{ color: '#6b7280', lineHeight: 1.2 }}>OPR</p>
          <div className="flex flex-col items-center gap-0 flex-1 min-w-0" style={{ minWidth: '36px', margin: '0 auto' }}>
            <div className="flex items-center justify-center flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
              <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>
                {oprPrismValue >= 0 ? '+' : ''}{oprPrismValue}
              </span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-0.5 shrink-0 w-full">
              <div className="relative flex flex-col items-center flex-shrink-0" style={{ height: 108 }}>
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-2.5 h-px bg-gray-400 pointer-events-none z-[1]"
                  style={{ top: '50%' }}
                  title="Центр (0)"
                />
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={oprPrismValue}
                  onChange={(e) => setOprPrismValue(parseInt(e.target.value, 10))}
                  className="vertical-slider-lilac"
                  data-opr-prism
                  style={{
                    writingMode: 'vertical-lr',
                    transform: 'rotate(180deg)',
                    width: '4px',
                    height: '108px',
                    ['--value' as string]: `${((oprPrismValue + 100) / 2)}%`,
                    accentColor: '#C8A2C8',
                    appearance: 'slider-vertical' as React.CSSProperties['appearance'],
                    WebkitAppearance: 'slider-vertical' as React.CSSProperties['WebkitAppearance'],
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>
            <div className="flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
              <span className="text-[8px] text-center leading-tight w-full px-0.5 block whitespace-nowrap overflow-hidden truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>−100..+100</span>
            </div>
          </div>
        </div>


        {/* Блок 2: EXTERNAL DOMAINS — 8 вертикальных слайдеров, flex-grow: 1 (reduced width for OPR PRISM) */}
        <div className="flex flex-col gap-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', flexGrow: 1, minWidth: '280px' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 pt-0 pb-0.5" style={{ color: '#6b7280', lineHeight: 1.2 }}>EXTERNAL DOMAINS</p>
          <div className="flex gap-1 flex-1 justify-between items-stretch min-h-0" style={{ width: '100%', minWidth: 0 }}>
            {EXTERNAL_DOMAIN_KEYS.map((key) => (
              <div key={key} className="flex flex-col items-center gap-0 flex-1 min-w-0" style={{ minWidth: '36px' }}>
                <div className="flex items-center justify-center flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
                  <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: isDark ? '#9ca3af' : '#4b5563' }}>
                    {domainWeights[key] >= 0 ? '+' : ''}{domainWeights[key].toFixed(2)}
                  </span>
                </div>
                <DomainSlider
                  domain={{ name: key, weight: domainWeights[key], status: 'active' }}
                  onChange={(_, weight) => handleExternalDomainChange(key, weight)}
                  showValue={false}
                  showLabel={false}
                  disabled={activePreset === 'mirror'}
                  height={108}
                />
                <div className="flex-shrink-0 py-0.5" style={{ minHeight: '14px' }}>
                  <span className="text-[8px] text-center leading-tight w-full px-0.5 block whitespace-nowrap overflow-hidden truncate" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>{EXTERNAL_DOMAIN_LABELS[key]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>


        {/* Блок 3: СЦЕНАРИИ — выбор сценария */}
        <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '180px', minWidth: '180px' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>СЦЕНАРИИ</p>
          <div className="flex flex-col gap-2 flex-1">
            <select
              className="text-[10px] px-2 py-1.5 rounded border font-medium uppercase tracking-wider transition-colors w-full"
              style={{
                borderColor: isDark ? '#333' : '#ddd',
                background: isDark ? '#111' : '#fff',
                color: isDark ? '#e5e7eb' : '#111',
                opacity: activePreset === 'mirror' ? 0.5 : 1,
                cursor: activePreset === 'mirror' ? 'not-allowed' : 'pointer',
              }}
              value={selectedScenario}
              disabled={activePreset === 'mirror'}
              onChange={(e) => {
                const v = e.target.value as 'without' | 'poetry' | 'technocrat' | 'sacred' | 'goldStandard';
                setSelectedScenario(v);
                if (v !== 'without') {
                  const weights = SCENARIO_UI_WEIGHTS[v === 'poetry' ? 'poetics' : v];
                  setDomainWeights({ ...weights });
                }
              }}
            >
              <option value="without">Without</option>
              <option value="poetry">Poetry</option>
              <option value="technocrat">Technocrat</option>
              <option value="sacred">Sacred</option>
              <option value="goldStandard">GOLD STANDARD</option>
            </select>
          </div>
        </div>


        {/* Блок 4: ИНСТРУМЕНТЫ — СЛЕПОК / АРХИВ / ЭКСПОРТ */}
        <div className="flex flex-col flex-shrink-0 rounded overflow-hidden" style={{ border: '1px solid #333', padding: '10px', height: '180px', width: '180px', minWidth: '180px' }}>
          <p className="text-[9px] uppercase tracking-widest font-semibold flex-shrink-0 mb-2" style={{ color: '#6b7280' }}>ИНСТРУМЕНТЫ</p>
          <div className="flex flex-col gap-1.5 flex-1 min-h-0">
            <button
              type="button"
              onClick={() => setToolsModalMode('snapshot')}
              title="Слепок настроек (13 слайдеров + OPR)"
              className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
              style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
              СЛЕПОК
            </button>
            <button
              type="button"
              onClick={() => setToolsModalMode('archive')}
              title="Архив сохранённых текстов"
              className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
              style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
              АРХИВ
            </button>
            <button
              type="button"
              onClick={() => setToolsModalMode('export')}
              title="Экспорт: буфер, TXT, MD"
              className="text-[9px] px-2 py-1 rounded border font-semibold uppercase tracking-wider transition-colors w-full text-center truncate flex items-center justify-center gap-1.5"
              style={{ borderColor: isDark ? '#333' : '#aaa', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              ЭКСПОРТ
            </button>
          </div>
        </div>
      </div>


      <ToolsModal
        isOpen={toolsModalMode !== null}
        onClose={() => setToolsModalMode(null)}
        title={toolsModalMode === 'snapshot' ? 'Слепок настроек' : toolsModalMode === 'archive' ? 'Архив' : 'Экспорт'}
        isDark={isDark}
      >
        {toolsModalMode === 'snapshot' && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => { createSnapshot(); setToolsModalMode(null); }}
              className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider w-full transition-colors"
              style={{ borderColor: '#C8A2C8', background: 'rgba(200,162,200,0.15)', color: isDark ? '#e5e7eb' : '#111' }}
            >
              Создать новый слепок
            </button>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: '#6b7280' }}>Существующие:</div>
            {snapshots.length === 0 ? (
              <span className="text-[10px]" style={{ color: '#6b7280' }}>Нет слепков</span>
            ) : (
              <ul className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
                {snapshots.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border" style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}>
                    <span className="text-[10px] truncate flex-1" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>{formatTimestamp(s.timestamp)}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button" onClick={() => { applySnapshot(s); setToolsModalMode(null); }} className="text-[9px] px-1.5 py-0.5 rounded border" style={{ borderColor: '#C8A2C8', color: '#C8A2C8' }}>Применить</button>
                      <button type="button" onClick={() => deleteSnapshot(s.id)} className="text-[9px] px-1.5 py-0.5 rounded border opacity-60 hover:opacity-100" style={{ borderColor: isDark ? '#555' : '#999', color: isDark ? '#9ca3af' : '#6b7280' }}>×</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {toolsModalMode === 'archive' && (
          <div className="flex flex-col gap-2">
            {archive.length === 0 ? (
              <span className="text-[10px]" style={{ color: '#6b7280' }}>Архив пуст. Сохраните результат после Анализа.</span>
            ) : (
              <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {archive.map((e) => (
                  <li
                    key={e.id}
                    className="py-2 px-2 rounded border cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ borderColor: isDark ? '#333' : '#e5e7eb' }}
                    onClick={() => {
                      setSourceText(e.source);
                      sourceTextRef.current = e.source;
                      setDisplayedAdaptation(e.adaptation);
                      setAdaptationText(e.adaptation);
                      setToolsModalMode(null);
                    }}
                  >
                    <span className="text-[10px] block truncate" style={{ color: isDark ? '#e5e7eb' : '#374151' }}>
                      {(e.adaptation || e.source || '').slice(0, 30)}
                      {((e.adaptation || e.source || '').length > 30) ? '…' : ''}
                    </span>
                    <span className="text-[8px]" style={{ color: '#6b7280' }}>{new Date(e.timestamp).toLocaleString('ru-RU')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {toolsModalMode === 'export' && (
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={async () => {
                const text = (displayedAdaptation || '').trim();
                await navigator.clipboard.writeText(text);
                setToolsModalMode(null);
              }}
              className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors"
              style={{ borderColor: isDark ? '#333' : '#e5e7eb', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy to Clipboard
            </button>
            <button
              type="button"
              onClick={() => {
                const text = (displayedAdaptation || '').trim();
                const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'altro_result.txt';
                a.click();
                URL.revokeObjectURL(a.href);
                setToolsModalMode(null);
              }}
              className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors"
              style={{ borderColor: isDark ? '#333' : '#e5e7eb', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download .TXT
            </button>
            <button
              type="button"
              onClick={() => {
                const text = (displayedAdaptation || '').trim();
                const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'altro_result.md';
                a.click();
                URL.revokeObjectURL(a.href);
                setToolsModalMode(null);
              }}
              className="text-[10px] px-3 py-2 rounded border font-semibold uppercase tracking-wider w-full text-left flex items-center gap-2 transition-colors"
              style={{ borderColor: isDark ? '#333' : '#e5e7eb', background: isDark ? '#111' : '#fff', color: isDark ? '#e5e7eb' : '#111' }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              Download .MD
            </button>
          </div>
        )}
      </ToolsModal>

      <footer className="mt-2 pt-2 pb-1 flex-shrink-0 text-[9px]" style={{ borderTop: '1px solid ' + (isDark ? '#0a0a0a' : '#ddd'), color: isDark ? '#4b5563' : '#6b7280' }}>
        (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Semantic Orchestration Layer
      </footer>
    </div>
  );
}



