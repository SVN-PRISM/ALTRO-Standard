// ALTRO Core | MIT License | SERGEI NAZARIAN (SVN)
'use client';

import { useState, useRef } from 'react';
import { OutputMirror } from '@/components/altro/OutputMirror';
import { LanguageSelector, SOURCE_OPTIONS, TARGET_OPTIONS } from '@/components/altro/LanguageSelector';
import type { ProcessedToken } from '@/hooks/useAltroPage';
import type { TextToken } from '@/lib/altro/engine';

export interface WorkspaceProps {
  isDark: boolean;
  isScanning: boolean;
  isEditing: boolean;
  sourceText: string;
  nexusCommand: string;
  displayedAdaptation: string;
  adaptationText: string;
  hasAdaptationChangesReady: boolean;
  sourceHighlightHtml: string;
  displayTokens: (TextToken | ProcessedToken)[];
  auditLog: Array<{ word: string; variants?: string[]; priority?: boolean }>;
  selectedScannedTokenId: number | null;
  resolvedVariants: Map<number, string>;
  activePreset: 'mirror' | 'transfigure' | 'slang' | null;
  adaptationDisplayHtml: string;
  adaptationFlash?: boolean;
  textTokens?: TextToken[];
  selectedTokenId?: number | null;
  showHomonymClarify?: boolean;
  semanticSuggestions: Array<{ phrase: string; suggestion: string; lowConfidence?: boolean; tokenIds?: number[] }>;
  selectedSuspiciousTokenId: number | null;
  showSuspiciousSuggestion: boolean;
  nexusCommandRef: React.RefObject<HTMLTextAreaElement | null>;
  suspiciousSuggestionRef: React.RefObject<HTMLDivElement | null>;
  onSourceChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onNexusChange: (value: string) => void;
  onNexusResize: (e: React.FormEvent<HTMLTextAreaElement>, defer?: boolean) => void;
  onEnterKey: (text: string, onSuccess?: () => void) => void;
  onClearSourceInput: () => void;
  onClearSource: () => void;
  onClearNexus?: () => void;
  onSave: () => void;
  onScan: () => void;
  onSourceHomographClick: (id: number) => void;
  onSuspiciousSuggestionSelect: (phrase: string, suggestion: string) => void;
  onStartEditing: () => void;
  setNexusCommand: (v: string) => void;
  setSelectedTokenId: (v: number | null) => void;
  setShowHomonymClarify: (v: boolean) => void;
  setSelectedSuspiciousTokenId: (v: number | null) => void;
  setShowSuspiciousSuggestion: (v: boolean) => void;
  normalizeForAuditMatch: (w: string) => string;
  handleMirrorTokenClick: (id: number) => void;
  handleScannedTokenClick: (id: number) => void;
  handleVariantSelect: (tokenId: number, variant: string) => void;
  handleHomonymVariantSelect: (tokenId: number, variant: string) => void;
  handleClarifyHomonym: () => void;
  clearAdaptation: () => void;
  sourceLanguage?: 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy';
  setSourceLanguage?: (v: 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy') => void;
  outputLanguage?: 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy';
  setOutputLanguage?: (v: 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy') => void;
  isListening?: boolean;
  onToggleVoice?: () => void;
  onFileUpload?: (file: File) => void;
  nexusFlash?: boolean;
}

export function Workspace(props: WorkspaceProps) {
  const {
    isDark,
    isScanning,
    isEditing,
    sourceText,
    nexusCommand,
    displayedAdaptation,
    adaptationText,
    hasAdaptationChangesReady,
    sourceHighlightHtml,
    displayTokens,
    auditLog,
    selectedScannedTokenId,
    resolvedVariants,
    activePreset,
    adaptationDisplayHtml,
    textTokens,
    selectedTokenId,
    showHomonymClarify,
    semanticSuggestions,
    selectedSuspiciousTokenId,
    showSuspiciousSuggestion,
    nexusCommandRef,
    suspiciousSuggestionRef,
    onSourceChange,
    onNexusChange,
    onNexusResize,
    onEnterKey,
    onClearSourceInput,
    onClearSource,
    onClearNexus,
    onSave,
    onScan,
    onSourceHomographClick,
    onSuspiciousSuggestionSelect,
    onStartEditing,
    setNexusCommand,
    setSelectedTokenId,
    setShowHomonymClarify,
    setSelectedSuspiciousTokenId,
    setShowSuspiciousSuggestion,
    normalizeForAuditMatch,
    handleMirrorTokenClick,
    handleScannedTokenClick,
    handleVariantSelect,
    handleHomonymVariantSelect,
    handleClarifyHomonym,
    clearAdaptation,
    sourceLanguage = 'auto',
    setSourceLanguage,
    outputLanguage = 'ru',
    setOutputLanguage,
    isListening = false,
    onToggleVoice,
    onFileUpload,
    nexusFlash = false,
  } = props;

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload?.(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload?.(e.target.files[0]);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full flex-1 min-h-0 overflow-hidden">
      <div 
        className={`flex flex-col min-w-0 flex-1 min-h-0 overflow-hidden relative rounded-lg transition-colors duration-300 ${isDragging ? (isDark ? 'bg-blue-900/20' : 'bg-blue-50') : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragging ? `2px dashed ${isDark ? '#60a5fa' : '#3b82f6'}` : '2px dashed transparent',
        }}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg font-semibold tracking-wider uppercase text-sm animate-pulse">
              Отпустите для загрузки
            </div>
          </div>
        )}
        <div className="flex justify-between items-start gap-3 mb-1 flex-shrink-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs uppercase tracking-tighter pt-1.5" style={{ color: '#6b7280' }}>Источник</span>
            {setSourceLanguage && (
              <LanguageSelector value={sourceLanguage} onChange={setSourceLanguage} options={SOURCE_OPTIONS} isDark={isDark} title="Язык источника (Auto = автоопределение)" />
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Загрузить локальный файл (.txt, .md, .json)"
              className="w-6 h-6 flex items-center justify-center rounded opacity-60 hover:opacity-100 transition-opacity"
              style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', color: isDark ? '#9ca3af' : '#4b5563' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".txt,.md,.json"
              className="hidden"
            />
          </div>
          <div className="relative flex-grow min-w-0">
            <textarea
              ref={nexusCommandRef as React.RefObject<HTMLTextAreaElement>}
              value={nexusCommand}
              onChange={(e) => { onNexusChange(e.target.value); onNexusResize(e, false); }}
              onInput={(e) => onNexusResize(e, false)}
              onPaste={(e) => onNexusResize(e, true)}
              onCut={(e) => onNexusResize(e, true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onEnterKey(nexusCommand, () => setNexusCommand(''));
                }
              }}
              placeholder="Введите директиву или выберите пресет..."
              aria-label="Nexus Command"
              rows={1}
              className="nexus-command-input w-full min-w-0 rounded text-[10px] font-medium placeholder:opacity-60 focus:outline-none border resize-none overflow-hidden"
              style={{
                minHeight: '28px',
                maxHeight: '200px',
                padding: '7px 10px',
                paddingRight: nexusCommand.trim() ? '56px' : '36px',
                boxSizing: 'border-box',
                background: isDark ? '#0d0d0d' : '#e8e8e8',
                borderColor: nexusFlash ? '#3b82f6' : '#C8A2C8',
                color: nexusFlash ? '#3b82f6' : '#C8A2C8',
                boxShadow: nexusFlash ? '0 0 12px rgba(59,130,246,0.6)' : 'none',
                transition: 'all 0.3s ease',
              }}
            />
            {onToggleVoice && (
              <button
                type="button"
                onClick={onToggleVoice}
                title={isListening ? 'Выключить микрофон' : 'Голосовой ввод'}
                aria-label={isListening ? 'Выключить микрофон' : 'Голосовой ввод'}
                className={`absolute top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded transition-all ${isListening ? 'opacity-100' : 'opacity-60 hover:opacity-90'}`}
                style={{
                  right: nexusCommand.trim() ? 36 : 8,
                  color: isListening ? '#ef4444' : (isDark ? '#9ca3af' : '#6b7280'),
                  background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.06)',
                  ...(isListening && { animation: 'voicePulse 1.2s ease-in-out infinite' }),
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="9" y1="22" x2="15" y2="22" />
                </svg>
              </button>
            )}
            {nexusCommand.trim() && (
              <button
                type="button"
                onClick={onClearNexus ?? (() => setNexusCommand(''))}
                title="Очистить команду"
                aria-label="Очистить команду"
                className="absolute top-1/2 right-2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]"
                style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}
              >
                ×
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {(displayedAdaptation?.trim() || adaptationText?.trim()) && (
              <button
                type="button"
                onClick={onSave}
                disabled={isScanning}
                title={isScanning ? 'Ожидание завершения анализа' : 'Сохранить адаптацию в архив'}
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
              onClick={onScan}
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
              {isScanning ? (
                <>
                  <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1.5 align-middle" />
                  АНАЛИЗ...
                </>
              ) : activePreset === 'transfigure' ? (
                'ТРАНСКРЕАЦИЯ'
              ) : (
                'SCAN'
              )}
            </button>
          </div>
        </div>
        {isEditing ? (
          <div className="relative flex-1 min-h-0 flex flex-col" style={{ pointerEvents: isScanning ? 'none' : 'auto', userSelect: isScanning ? 'none' : 'auto', opacity: isScanning ? 0.55 : 1, transition: 'opacity 0.2s ease' }}>
            <textarea
              value={sourceText}
              onChange={onSourceChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onEnterKey(sourceText, onClearSourceInput);
                }
              }}
              spellCheck
              aria-label="Источник текста"
              className={`source-text-field w-full p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none flex-1 min-h-0 overflow-y-auto whitespace-pre-wrap font-inherit ${isScanning ? 'synthesis-scanning' : ''}`}
              style={{ font: 'inherit', background: isDark ? '#111' : '#fff', border: `1px solid ${isDark ? '#1a1a1a' : '#ccc'}`, color: isDark ? '#fff' : '#000' }}
            />
            {sourceText.trim() && (
              <button type="button" onClick={onClearSource} title="Очистить источник" aria-label="Очистить источник" className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]" style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}>×</button>
            )}
          </div>
        ) : (
          <div className="relative flex-1 min-h-0 flex flex-col" style={{ pointerEvents: isScanning ? 'none' : 'auto', userSelect: isScanning ? 'none' : 'auto', opacity: isScanning ? 0.55 : 1, transition: 'opacity 0.2s ease' }}>
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
                      onSourceHomographClick(id);
                    } else if (isSuspicious) {
                      setShowHomonymClarify(false);
                      setSelectedSuspiciousTokenId(id);
                      setShowSuspiciousSuggestion(true);
                    }
                  }
                } else {
                  onStartEditing();
                }
              }}
            />
            {sourceText.trim() && (
              <button type="button" onClick={onClearSource} title="Очистить источник" aria-label="Очистить источник" className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded opacity-50 hover:opacity-90 transition-opacity text-[12px]" style={{ color: isDark ? '#9ca3af' : '#6b7280', background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)' }}>×</button>
            )}
            {showSuspiciousSuggestion && selectedSuspiciousTokenId !== null && (() => {
              const suggestion = semanticSuggestions.find((s) => s.lowConfidence && s.tokenIds?.includes(selectedSuspiciousTokenId));
              if (!suggestion) return null;
              return (
                <div ref={suspiciousSuggestionRef as React.RefObject<HTMLDivElement>} className="absolute left-3 bottom-3 p-2 rounded border shadow-lg z-50 flex flex-col gap-1 min-w-[180px]" style={{ background: isDark ? '#111' : '#fff', borderColor: '#C8A2C8' }}>
                  <span className="text-[9px] font-semibold" style={{ color: '#6b7280' }}>Подозрение на ошибку. Заменить на:</span>
                  <button type="button" onClick={() => onSuspiciousSuggestionSelect(suggestion.phrase, suggestion.suggestion)} className="text-left text-xs px-2 py-1.5 rounded border hover:opacity-90 transition-colors" style={{ borderColor: '#C8A2C8', background: 'rgba(200,162,200,0.15)', color: isDark ? '#e5e7eb' : '#111' }}>
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
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs uppercase tracking-tighter" style={{ color: '#6b7280' }}>Адаптация</span>
            {setOutputLanguage && (
              <LanguageSelector value={outputLanguage} onChange={setOutputLanguage} options={TARGET_OPTIONS} isDark={isDark} title="Выходной язык (Target)" />
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0" />
        </div>
        <OutputMirror
          isDark={isDark}
          isScanning={isScanning}
          adaptationFlash={props.adaptationFlash ?? false}
          displayTokens={displayTokens}
          auditLog={auditLog}
          selectedScannedTokenId={selectedScannedTokenId}
          resolvedVariants={resolvedVariants}
          activePreset={activePreset}
          adaptationDisplayHtml={adaptationDisplayHtml}
          hasAdaptationContent={!!(displayedAdaptation?.trim() || adaptationText?.trim() || (displayTokens && displayTokens.length > 0))}
          normalizeForAuditMatch={normalizeForAuditMatch}
          handleMirrorTokenClick={handleMirrorTokenClick}
          handleScannedTokenClick={handleScannedTokenClick}
          handleVariantSelect={handleVariantSelect}
          clearAdaptation={clearAdaptation}
        />
      </div>
    </div>
  );
}
