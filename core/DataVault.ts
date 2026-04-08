/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

/**
 * DataVault — хранилище сущностей с ключами {{IPA_N}}.
 * Translation-First: `get` / inject use **display** (target-language); **source** (e.g. English) kept for history/audit.
 */

export interface DataVaultSnapshot {
  store: Record<string, string>;
  typeMap?: Record<string, string>;
  sourceMap?: Record<string, string>;
  counter: number;
}

export class DataVault {
  private store = new Map<string, string>();
  private sourceMap = new Map<string, string>();
  private typeMap = new Map<string, string>();
  private counter = 0;

  /**
   * Сохраняет display (для инжекта/финализации) и source (оригинал сегмента), возвращает {{IPA_N}}.
   */
  push(display: string, type: string, source: string): string {
    this.counter++;
    const key = `{{IPA_${this.counter}}}`;
    this.store.set(key, display);
    this.sourceMap.set(key, source);
    this.typeMap.set(key, type);
    if (process.env.ALTRO_AUDIT_STENCIL === '1') {
      console.log('[ALTRO_AUDIT][DataVault] push', {
        id: key,
        /** display — то, что вернёт get() / finalize */
        storeDisplay: display,
        /** source — оригинальный сегмент (англ. и т.д.) */
        sourceMapSource: source,
        type,
      });
    }
    return key;
  }

  /**
   * Фиксированный ключ — display и source совпадают (без отдельной трансфигурации).
   */
  setNamed(key: string, value: string, type = 'source_doc'): void {
    this.store.set(key, value);
    this.sourceMap.set(key, value);
    this.typeMap.set(key, type);
  }

  removeNamed(key: string): void {
    this.store.delete(key);
    this.sourceMap.delete(key);
    this.typeMap.delete(key);
  }

  /**
   * Значение для finalize / StreamInjector (язык цели — «кирпич»).
   */
  get(key: string): string | undefined {
    return this.store.get(key);
  }

  /**
   * Исходный сегмент до micro-transcreate (история / аудит).
   */
  getSource(key: string): string | undefined {
    return this.sourceMap.get(key);
  }

  getType(key: string): string | undefined {
    return this.typeMap.get(key);
  }

  entries(): IterableIterator<[string, string]> {
    return this.store.entries();
  }

  toJSON(): string {
    const snapshot: DataVaultSnapshot = {
      store: Object.fromEntries(this.store),
      typeMap: Object.fromEntries(this.typeMap),
      sourceMap: Object.fromEntries(this.sourceMap),
      counter: this.counter,
    };
    return JSON.stringify(snapshot);
  }

  static fromJSON(json: string): DataVault {
    const vault = new DataVault();
    try {
      const snapshot: DataVaultSnapshot = JSON.parse(json);
      vault.store = new Map(Object.entries(snapshot.store ?? {}));
      if (snapshot.typeMap) {
        vault.typeMap = new Map(Object.entries(snapshot.typeMap));
      }
      if (snapshot.sourceMap) {
        vault.sourceMap = new Map(Object.entries(snapshot.sourceMap));
      } else {
        for (const [k, v] of vault.store) {
          vault.sourceMap.set(k, v);
        }
      }
      vault.counter = snapshot.counter ?? 0;
    } catch {
      // пустой vault
    }
    return vault;
  }

  static restore(snapshot: DataVaultSnapshot): DataVault {
    const vault = new DataVault();
    vault.store = new Map(Object.entries(snapshot.store ?? {}));
    if (snapshot.typeMap) {
      vault.typeMap = new Map(Object.entries(snapshot.typeMap));
    }
    if (snapshot.sourceMap) {
      vault.sourceMap = new Map(Object.entries(snapshot.sourceMap));
    } else {
      for (const [k, v] of vault.store) {
        vault.sourceMap.set(k, v);
      }
    }
    vault.counter = snapshot.counter ?? 0;
    return vault;
  }
}
