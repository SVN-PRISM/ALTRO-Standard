# ALTRO White Paper (v1.5)

**MIT License | Copyright (c) 2026 SERGEI NAZARIAN (SVN) | ALTRO Stencil**

## Abstract

ALTRO STENCIL implements a **Translation-First semantic orchestration layer**: sensitive surface forms are normalized into an abstract stencil **before** the executor LLM sees user text. The executor receives only `{{IPA_N}}` placeholders (“bricks”); localization and policy live in core code and the vault, not in the model’s prompt channel.

## Core pipeline

1. **Intent & directives** — Optional `[ALTRO: …]` blocks are parsed for domain weights, then **stripped** from text destined for masking so directives are not translated or partially tokenized as entities.
2. **Semantic firewall** — `SemanticFirewall.maskSentence` applies crystal / mask literals (e.g. `[ID:MASK_*]`) before regex masking.
3. **Masker (Formula-Magnet №0 + secondary magnets)** — Formulas in `$…$`, `$$…$$`, `[…]`, `(…)` are isolated first; then units, money, **PII email**, semantic anchors (snake_case / kebab-case IDs), dates, numbers, etc. Matches are merged by span rules; **`{{IPA_N}}` IDs are assigned in left-to-right order** to preserve semantic sovereignty.
4. **Vault** — Each `{{IPA_N}}` maps to a **Display** value (target language) for finalize / stream injection; the executor never sees raw source spans in the masked prompt.

## Security & privacy posture

- **Pseudonymization**: emails and technical identifiers are captured as typed entities and replaced by `{{IPA_N}}` in the payload to the LLM.
- **Formula integrity**: bracket and LaTeX spans use explicit patterns (including nested bracket handling) to avoid orphan captures and split-brain tokenization.

## Automated integrity (12 / 12)

The repository ships an automated suite (`npm run integrity-check`) that asserts **12/12 PASS**, covering data privacy (including email masking), edge cases (empty input, directive-only, nested brackets), domain-weight shifts in the universal system prompt, and strict ordering of `{{IPA_N}}` markers.

**Authoritative report:** `docs/compliance/SDK_INTEGRITY_REPORT.md`

## Live demo

For colored **BEFORE / AFTER** examples (email, bracketed projects, nested formulas), run:

```bash
npx tsx scripts/altro-showcase.ts
```

---

*This document summarizes architecture intent for ALTRO 1.5; refer to `ALTRO_CORE.md` and in-repo source for canonical behavior.*
