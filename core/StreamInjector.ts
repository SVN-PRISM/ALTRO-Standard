/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */


/**
 * Минимальный контракт чтения снимка vault (серверный DataVault или клиентский Record из сессии).
 */
export interface IVaultRead {
  get(key: string): string | undefined;
}

/**
 * Клиентский / тестовый адаптер: тот же store, что у DataVault (`{{IPA_N}}` → значение).
 */
export class RecordVaultStore implements IVaultRead {
  constructor(private readonly store: Record<string, string>) {}

  get(key: string): string | undefined {
    if (this.store[key] !== undefined) return this.store[key];
    const id = key.match(/IPA_(\d+)/)?.[1];
    if (id) {
      const canonical = `{{IPA_${id}}}`;
      if (this.store[canonical] !== undefined) return this.store[canonical];
    }
    const compact = key.replace(/\s/g, '');
    return this.store[compact];
  }
}

/** Состояние парсера меток в потоке */
type LabelState = 'normal' | 'brace1' | 'in_label';

/**
 * Атомарный инжектор потока: заменяет полные метки {{IPA_N}} на значения из vault до отображения в UI.
 * Буферизует неполные метки между чанками.
 */
export class StreamInjector {
  private state: LabelState = 'normal';
  private pendingLabel = '';
  private vault: IVaultRead;

  constructor(vault: IVaultRead) {
    this.vault = vault;
  }

  /**
   * Обрабатывает очередную порцию текста. Возвращает фрагменты для конкатенации в вывод.
   * Неполные метки буферизуются; полные — заменяются на значение из vault.
   */
  process(delta: string): string[] {
    const output: string[] = [];
    let current = '';

    for (let i = 0; i < delta.length; i++) {
      const ch = delta[i];
      const nextCh = delta[i + 1];

      switch (this.state) {
        case 'normal':
          if (ch === '{' && nextCh === '{') {
            if (current) output.push(current);
            current = '';
            this.pendingLabel = '{{';
            this.state = 'in_label';
            i++;
          } else {
            current += ch;
          }
          break;
        case 'brace1':
          this.state = 'normal';
          if (ch === '{') {
            this.pendingLabel = '{{';
            this.state = 'in_label';
          } else {
            current += '{' + ch;
          }
          break;
        case 'in_label':
          this.pendingLabel += ch;
          if (ch === '}' && nextCh === '}') {
            this.pendingLabel += '}';
            i++;
            const trimmed = this.pendingLabel.replace(/\s/g, '');
            const canonicalKey = trimmed.startsWith('{{IPA_') && trimmed.endsWith('}}')
              ? trimmed
              : '';
            const idMatch = this.pendingLabel.match(/IPA_(\d+)/);
            const key = idMatch ? `{{IPA_${idMatch[1]}}}` : canonicalKey;
            const value = this.vault.get(key);
            if (value != null) {
              output.push(value);
            } else {
              output.push(this.pendingLabel);
            }
            this.pendingLabel = '';
            this.state = 'normal';
          }
          break;
      }
    }

    if (current) output.push(current);
    return output;
  }

  /**
   * Конец потока: вернуть незавершённый хвост метки (если есть).
   */
  flush(): string {
    if (this.state !== 'normal' || this.pendingLabel) {
      const orphan = this.pendingLabel;
      this.pendingLabel = '';
      this.state = 'normal';
      if (orphan) {
        console.warn('[ALTRO STENCIL] Stream ended with incomplete placeholder:', JSON.stringify(orphan));
        return orphan;
      }
    }
    return '';
  }

  hasPendingLabel(): boolean {
    return this.state === 'in_label' || this.state === 'brace1';
  }
}

/**
 * Соединяет фрагменты process() в одну строку для одного delta Ollama.
 */
export function joinInjectedParts(parts: string[]): string {
  return parts.join('');
}

/**
 * Создаёт TransformStream для NDJSON-потока Ollama (серверный прокси).
 */
export function createStreamInjectorTransform(vault: IVaultRead): TransformStream<Uint8Array, Uint8Array> {
  const injector = new StreamInjector(vault);
  let textBuffer = '';

  return new TransformStream({
    transform(chunk, controller) {
      const text = new TextDecoder().decode(chunk);
      textBuffer += text;
      const lines = textBuffer.split('\n');
      textBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as { message?: { content?: string }; done?: boolean };
          const content = obj?.message?.content;
          if (typeof content === 'string') {
            const outputs = injector.process(content);
            for (const out of outputs) {
              const outObj = { ...obj, message: { ...obj.message, content: out } };
              controller.enqueue(new TextEncoder().encode(JSON.stringify(outObj) + '\n'));
            }
            if (outputs.length === 0 && !injector.hasPendingLabel()) {
              controller.enqueue(new TextEncoder().encode(trimmed + '\n'));
            }
          } else {
            controller.enqueue(new TextEncoder().encode(trimmed + '\n'));
          }
        } catch {
          controller.enqueue(new TextEncoder().encode(trimmed + '\n'));
        }
      }
    },

    flush(controller) {
      const orphan = injector.flush();
      if (orphan) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify({ message: { content: orphan }, done: true }) + '\n'));
      }
      if (textBuffer.trim()) {
        controller.enqueue(new TextEncoder().encode(textBuffer + (textBuffer.endsWith('\n') ? '' : '\n')));
      }
    },
  });
}
