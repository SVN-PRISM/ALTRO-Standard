/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { VoiceService, type SourceLanguageForVoice } from '@/lib/altro/voiceService';
import { processLocalFile } from '@/lib/altro/fileProcessor';

export interface UseNexusProps {
  sourceLanguage: string;
  isScanning?: boolean;
  isScanningRef?: React.MutableRefObject<boolean>;
  onRunScan: (seamless?: boolean) => void;
  onClearAll: () => void;
  onSetOprPrismValue: (val: number) => void;
}

export function useNexus({ sourceLanguage, isScanning, isScanningRef, onRunScan, onClearAll, onSetOprPrismValue }: UseNexusProps) {
  const getIsScanning = () => (isScanningRef ? isScanningRef.current : (isScanning ?? false));
  const [sourceText, setSourceTextState] = useState('');
  /** Единственная точка записи sourceText (терминал, File Gateway, clear). Без slice/sanitize. */
  const setSourceText = useCallback((value: string) => {
    if (typeof window !== 'undefined') {
      console.log('[STATE AUDIT] Setting sourceText length:', value.length);
    }
    setSourceTextState(value);
  }, []);
  const sourceTextRef = useRef('');
  const [nexusCommand, setNexusCommand] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [activeFile, setActiveFile] = useState<{ name: string; isProcessing: boolean } | null>(null);
  const [nexusFlash, setNexusFlash] = useState(false);

  // Sync VoiceService language
  useEffect(() => {
    VoiceService.setLang(sourceLanguage as SourceLanguageForVoice);
  }, [sourceLanguage]);

  /** Сравните с логом при set: если длины расходятся — что-то перезаписывает state после setSourceText. */
  useEffect(() => {
    if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') return;
    console.log('[STATE AUDIT] sourceText in state after sync, length:', sourceText.length);
  }, [sourceText]);

  /** Единый снимок: ref = state после любого commit (FileGateway, архив и т.д. без ручного ref). */
  useEffect(() => {
    sourceTextRef.current = sourceText;
  }, [sourceText]);

  // Smart Command Dispatcher: Free-form intention recognition
  const dispatchSmartCommand = useCallback((text: string): boolean => {
    const lower = text.toLowerCase();
    
    // RESET Intention
    if (/(удали всё|очисти|сброс|зачистка|clear all|reset)/i.test(lower)) {
      onClearAll();
      return true;
    }
    
    // OPR Intention
    const oprMatch = /(?:опр|opr|чувствительность|уровень)[\s\w]*?(\d+)/i.exec(lower);
    if (oprMatch && oprMatch[1]) {
      const val = parseInt(oprMatch[1], 10);
      if (val >= 0 && val <= 100) {
        onSetOprPrismValue(val);
        return true;
      }
    }
    
    // SCAN Intention
    if (/(проверь|анализ|сканируй|scan|analyze)/i.test(lower)) {
      onRunScan(true);
      return true;
    }
    
    return false;
  }, [onClearAll, onRunScan, onSetOprPrismValue]);

  const dispatchSmartCommandRef = useRef(dispatchSmartCommand);
  useEffect(() => {
    dispatchSmartCommandRef.current = dispatchSmartCommand;
  }, [dispatchSmartCommand]);

  const toggleVoiceListening = useCallback(() => {
    if (getIsScanning()) return; // State Lock: disable mic when scanning
    if (isListening) {
      VoiceService.stop();
      setIsListening(false);
      return;
    }
    const ok = VoiceService.start(
      (transcript) => {
        if (getIsScanning()) return; // State Lock
        setNexusCommand((prev) => {
          const next = (prev ? prev + ' ' : '') + transcript;
          if (dispatchSmartCommandRef.current(next)) {
            setNexusFlash(true);
            setTimeout(() => setNexusFlash(false), 800);
            return '';
          }
          return next;
        });
      },
      (listening) => setIsListening(listening)
    );
    if (ok) setIsListening(true);
  }, [isListening]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (getIsScanning()) return; // State Lock
    try {
      setActiveFile({ name: file.name, isProcessing: true });
      const text = await processLocalFile(file);
      setNexusCommand(text);
      setSourceText(text);
      sourceTextRef.current = text;
      
      // Simulate processing animation delay
      setTimeout(() => {
        onRunScan(true);
        setActiveFile({ name: file.name, isProcessing: false });
      }, 800);
    } catch (err) {
      console.error('[ALTRO File Intake Error]', err);
      setActiveFile(null);
    }
  }, [onRunScan]);

  const clearSourceInput = useCallback(() => {
    setSourceText('');
    sourceTextRef.current = '';
  }, []);

  return {
    sourceText,
    setSourceText,
    sourceTextRef,
    nexusCommand,
    setNexusCommand,
    isListening,
    toggleVoiceListening,
    activeFile,
    setActiveFile,
    handleFileUpload,
    nexusFlash,
    setNexusFlash,
    dispatchSmartCommand,
    clearSourceInput,
  };
}