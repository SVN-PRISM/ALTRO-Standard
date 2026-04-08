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
export { Masker } from './Masker';
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
