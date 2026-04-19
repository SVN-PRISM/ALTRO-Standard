/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */
/**
 * Браузер-безопасный вход: только Masker и паттерны, без Node bootstrap (`ensureCrystalForStencil` / `node:fs`).
 * Серверный полный пайплайн — `SovereignController`.
 */
export {
  Masker,
  IPA_LABEL_REGEX,
  MASKER_SECONDARY_PATTERN_SPECS,
  MASKER_SECONDARY_REST_SPECS,
  PRIORITY_MONOLITHS,
  PRIORITY_MONOLITHS_NON_REGISTRY,
  PRIORITY_REGISTRY_MONOLITH_SPECS,
} from './Masker';
