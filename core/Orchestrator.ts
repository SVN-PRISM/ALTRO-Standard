/* MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO 1 */

/**
 * Thin entry for prompt orchestration used by executors and tools.
 * Lean stack lives in `@/lib/altroUniversalSystemPrompt`; `buildAltroUniversalSystemPrompt2026` auto-selects it when `weights` is set and all axes are 0.
 */
export {
  getLeanPrompt,
  type UniversalPromptIntentOpts,
} from '@/lib/altroUniversalSystemPrompt';
