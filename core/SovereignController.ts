/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

import type { DomainWeights } from '@/lib/altroData';
import { ensureCrystalForStencil } from '@/lib/altro/crystalBootstrap';
import { SemanticFirewall } from '@/security/SemanticFirewall';
import { DataVault } from './DataVault';
import { Masker, IPA_LABEL_REGEX } from './Masker';
import { createStreamInjectorTransform } from './StreamInjector';

export interface SovereignControllerSnapshot {
  vaultJson: string;
}

/**
 * SovereignController — контроллер Трафарета (Translation-First).
 * 1. prepareStencil(text, targetLanguage, weights?) — порядок: SemanticFirewall.maskSentence (Кристалл, [ID:MASK_*]) → Masker (RegExp, {{IPA_N}}); vault — только RegExp-сущности.
 * 2. finalize — подставляет display по {{IPA_N}}; литералы [ID:MASK_*] проходят без изменений (не в vault).
 */
export class SovereignController {
  private vault: DataVault;
  private masker: Masker;

  constructor() {
    this.vault = new DataVault();
    this.masker = new Masker(this.vault);
  }

  getVault(): DataVault {
    return this.vault;
  }

  /**
   * Трафарет: сначала семантическое сито (Кристалл), затем RegExp-Маскер (числа, даты, формулы → {{IPA_N}}).
   */
  prepareStencil(sourceText: string, targetLanguage: string, weights?: DomainWeights): string {
    ensureCrystalForStencil();
    const afterSemantic = SemanticFirewall.getInstance().maskSentence(sourceText);
    return this.masker.mask(afterSemantic, targetLanguage, weights);
  }

  /** @deprecated Используй prepareStencil(text, targetLanguage, weights?). */
  createStencil(sourceText: string, targetLanguage: string, weights?: DomainWeights): string {
    return this.prepareStencil(sourceText, targetLanguage, weights);
  }

  getTypeForLabel(label: string): string | undefined {
    const m = label.match(/IPA_(\d+)/);
    if (!m) return undefined;
    const canonicalKey = `{{IPA_${m[1]}}}`;
    return this.vault.getType(canonicalKey);
  }

  /**
   * Подставляет значения vault (display, язык цели) вместо {{IPA_N}}.
   */
  finalize(modifiedText: string): string {
    let result = modifiedText;

    result = result.replace(IPA_LABEL_REGEX, (match) => {
      const canonicalKey = `{{IPA_${match.match(/IPA_(\d+)/)?.[1] ?? '0'}}}`;
      const value = this.vault.get(canonicalKey) ?? match;
      if (process.env.ALTRO_AUDIT_STENCIL === '1') {
        console.log('[ALTRO_AUDIT][finalize] vault.get', {
          match,
          canonicalKey,
          returned: value,
          hit: this.vault.get(canonicalKey) !== undefined,
        });
      }
      return value;
    });

    const remaining = result.match(/\{\{\s*IPA_\d+(?:\s*:\s*[^}]*)?\s*\}\}/g);
    if (remaining && remaining.length > 0) {
      const missingIds = remaining.map((m) => {
        const id = m.match(/IPA_(\d+)/)?.[1];
        return id ?? m;
      });
      console.error(
        '[ALTRO STENCIL ERROR] Unresolved placeholders in output. Missing IDs:',
        [...new Set(missingIds)].join(', ')
      );
    }

    return result;
  }

  inject(modifiedText: string): string {
    return this.finalize(modifiedText);
  }

  createStreamTransform(): TransformStream<Uint8Array, Uint8Array> {
    return createStreamInjectorTransform(this.vault);
  }

  serialize(): string {
    return JSON.stringify({ vaultJson: this.vault.toJSON() });
  }

  static deserialize(data: string): SovereignController {
    const ctrl = new SovereignController();
    try {
      const parsed: SovereignControllerSnapshot = JSON.parse(data);
      ctrl.vault = DataVault.fromJSON(parsed.vaultJson ?? '{}');
      ctrl.masker = new Masker(ctrl.vault);
    } catch {
      // пустой vault
    }
    return ctrl;
  }
}
