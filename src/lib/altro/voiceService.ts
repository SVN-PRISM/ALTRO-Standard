/* (c) 2026 SERGEI NAZARIAN | MIT License | ALTRO Core */
'use client';

/** Source language → BCP-47 for SpeechRecognition. */
export type SourceLanguageForVoice = 'auto' | 'ru' | 'en' | 'de' | 'fr' | 'it' | 'hy';

const LANG_TO_BCP47: Record<SourceLanguageForVoice, string> = {
  auto: 'ru-RU',
  ru: 'ru-RU',
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  it: 'it-IT',
  hy: 'hy-AM',
};

function getRecognitionLang(sourceLanguage: SourceLanguageForVoice): string {
  return LANG_TO_BCP47[sourceLanguage] ?? 'ru-RU';
}

type SpeechRecognitionInstance = any;

/** Singleton for browser SpeechRecognition. SSR-safe; no-op when API missing. */
class VoiceServiceClass {
  private recognition: SpeechRecognitionInstance | null = null;
  private onResultCallback: ((transcript: string) => void) | null = null;
  private _isListening = false;
  private _lang: string = 'ru-RU';

  isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  getIsListening(): boolean {
    return this._isListening;
  }

  setLang(sourceLanguage: SourceLanguageForVoice): void {
    const lang = getRecognitionLang(sourceLanguage);
    this._lang = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  private ensureRecognition(): SpeechRecognitionInstance | null {
    if (typeof window === 'undefined') return null;
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
    if (!this.recognition) {
      this.recognition = new Ctor();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = this._lang;
      this.recognition.onresult = (e: any) => {
        const last = e.results.length - 1;
        const item = e.results[last];
        if (item.isFinal && item.length > 0) {
          const transcript = item[0].transcript?.trim?.();
          if (transcript && this.onResultCallback) this.onResultCallback(transcript);
        }
      };
      this.recognition.onend = () => {
        this._isListening = false;
        this.onListeningChange?.(false);
      };
      this.recognition.onerror = () => {
        this._isListening = false;
        this.onListeningChange?.(false);
      };
    }
    return this.recognition;
  }

  private onListeningChange: ((listening: boolean) => void) | null = null;

  start(onResult: (transcript: string) => void, onListeningChange?: (listening: boolean) => void): boolean {
    if (this._isListening) return true;
    this.onResultCallback = onResult;
    this.onListeningChange = onListeningChange ?? null;
    const rec = this.ensureRecognition();
    if (!rec) {
      if (typeof window !== 'undefined') console.warn('[VoiceService] SpeechRecognition not available.');
      return false;
    }
    rec.lang = this._lang;
    try {
      rec.start();
      this._isListening = true;
      this.onListeningChange?.(true);
      return true;
    } catch (err) {
      this._isListening = false;
      this.onListeningChange?.(false);
      return false;
    }
  }

  stop(): void {
    if (!this.recognition || !this._isListening) return;
    try {
      this.recognition.stop();
    } catch {
      // ignore
    }
    this._isListening = false;
    this.onListeningChange?.(false);
  }
}

export const VoiceService = new VoiceServiceClass();
