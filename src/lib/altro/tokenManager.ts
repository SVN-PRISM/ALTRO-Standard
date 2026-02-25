/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO: Semantic Orchestration Layer */
// License: MIT | SERGEI NAZARIAN (SVN).
// Автономный модуль: ЗАПРЕЩЕНО импортировать что-либо из других файлов проекта.

/** Символ ударения (combining acute accent) */
export const ACCENT = '\u0301';

/** Токен для UI и оркестрации */
export interface TextToken {
  id: number;
  word: string;
  type: 'word' | 'space' | 'punct';
  isHomonym: boolean;
  isPunctuation: boolean;
  isWhitespace: boolean;
  hasAccent?: boolean;
  isLocked?: boolean;
  /** Опциональные поля для совместимости с UI и altroLogic */
  resolvedAccent?: string;
  options?: string[];
  isMisspelled?: boolean;
  semanticReplacement?: string;
  spellCorrection?: string;
  isAccepted?: boolean;
  resolvedText?: string;
  isValidated?: boolean;
}

/** AltroTokenManager — класс управления токенами */
export class AltroTokenManager {
  private static readonly ACCENT = ACCENT;

  private static get wordChar(): string {
    return `[а-яёА-ЯЁ${this.ACCENT}]`;
  }

  private static get tokenizeRegex(): RegExp {
    const wc = this.wordChar;
    const accent = this.ACCENT;
    return new RegExp(
      `(\\s+|${wc}+(?:-${wc}+)*|[.!?,;:()\\[\\]]+|[^\\sа-яёА-ЯЁ${accent}]+)`,
      'gi'
    );
  }

  private static hasAccentInWord(word: string): boolean {
    return /[\u0301]/.test(word) || /[аеёиоуыэюя]'/i.test(word);
  }

  /**
   * Токенизация текста. Символы \u0301 сохраняются — учитываются как часть слова.
   * НЕ добавляет ударения — только фиксирует те, что пользователь ввёл вручную.
   * Слова с ударением помечаются hasAccent: true, isLocked: true.
   */
  static tokenize(text: string): TextToken[] {
    const tokens: TextToken[] = [];
    if (!text) return tokens;

    const regex = this.tokenizeRegex;
    const wordChar = this.wordChar;
    const wordTest = new RegExp(`^${wordChar}+(?:-${wordChar}+)*$`, 'i');
    let match: RegExpExecArray | null;
    let tokenId = 0;

    while ((match = regex.exec(text)) !== null) {
      const value = match[0];
      const isWord = wordTest.test(value);
      const isPunct = /^[.!?,;:()\[\]]+$/.test(value);
      const isWhitespace = /^\s+$/.test(value);

      const hasAccent = isWord && this.hasAccentInWord(value);
      const isLocked = hasAccent;

      let type: TextToken['type'] = 'word';
      if (isWhitespace) type = 'space';
      else if (isPunct || (!isWord && value.length > 0)) type = 'punct';

      tokens.push({
        id: tokenId++,
        word: value,
        type,
        isHomonym: false,
        isPunctuation: type === 'punct',
        isWhitespace: type === 'space',
        hasAccent,
        isLocked,
      });
    }

    return tokens;
  }

  /** Оборачивает слова с ударением в [STRESS]...[/STRESS] для LLM */
  static wrapStressTags(text: string): string {
    if (!text || !/[\u0301]/.test(text)) return text;
    const tokens = this.tokenize(text);
    return tokens
      .map((t) => (t.type === 'word' && t.isLocked ? `[STRESS]${t.word}[/STRESS]` : t.word))
      .join('');
  }

  /** Удаляет теги [STRESS] и [/STRESS]. \u0301 не затрагивается. */
  static stripStressTags(text: string): string {
    if (!text) return text;
    return text.replace(/\[\/STRESS\]/g, '').replace(/\[STRESS\]/g, '');
  }
}
