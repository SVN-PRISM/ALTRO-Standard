/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | Continue .continue/config.yaml */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Читает тег Ollama из `.continue/config.yaml` (поле `model:` под `models:`).
 * Без зависимости от yaml-пакета — достаточно первого совпадения `model:` в файле.
 */
export function getOllamaModelFromContinueConfig(cwd: string = process.cwd()): string | null {
  const p = join(cwd, '.continue', 'config.yaml');
  if (!existsSync(p)) return null;
  try {
    const raw = readFileSync(p, 'utf8');
    const m = raw.match(/^\s*model:\s*(.+)\s*$/m);
    if (!m) return null;
    return m[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    return null;
  }
}
