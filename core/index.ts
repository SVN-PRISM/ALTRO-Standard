/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil */

export { DataVault } from './DataVault';
export {
  getMaskerUnitPatternSpecs,
  getUnitMagnetAlternationSource,
  listUnitDefinitions,
  localizeUnit,
  resolveUnitIdFromCapture,
  resolveUnitMagnetDisambiguation,
  type UnitId,
} from './dictionaries/UnitRegistry';
export {
  Masker,
  IPA_LABEL_REGEX,
  MASKER_SECONDARY_PATTERN_SPECS,
  MASKER_SECONDARY_REST_SPECS,
  PRIORITY_MONOLITHS,
  PRIORITY_MONOLITHS_NON_REGISTRY,
  PRIORITY_REGISTRY_MONOLITH_SPECS,
} from './MaskerClient';
export { getLeanPrompt, type UniversalPromptIntentOpts } from './Orchestrator';
export { normalizeHomographs } from './normalizeHomographs';
export { parseDecimalNumericString } from './parseDecimalNumeric';
export { SovereignController } from './SovereignController';
export { resolveTargetLanguageFromRequestBody } from './stencilTargetLanguage';
export {
  StreamInjector,
  RecordVaultStore,
  joinInjectedParts,
  createStreamInjectorTransform,
  type IVaultRead,
} from './StreamInjector';
