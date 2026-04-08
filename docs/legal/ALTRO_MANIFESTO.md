# ALTRO License Manifesto v1.5

This document is a license-like notice of the **ALTRO Core Protocol** principles that must remain intact when you integrate, extend, or audit the SDK.

## 1) Semantic Sovereignty (Point of Truth)

ALTRO operates as a **Translation-First** semantic orchestration layer:

- The system performs entity capture and masking so the executor LLM sees **only abstract placeholders**: `{{IPA_N}}`.
- The system never lets the executor LLM read or reconstruct the original “Source” values.
- **Finalize injection** is the **point of truth** for what the user receives: it deterministically replaces `{{IPA_N}}` with the correct localized **Display** bricks from the vault.

Security invariant:
- Preserve the **sequence** and **identity** of `{{IPA_N}}` markers. Do not add, omit, or reorder semantic nodes.

## 2) Metadata Orchestration (Stateless Sync)

ALTRO ensures vault integrity and prompt hygiene through explicit metadata orchestration:

- The server and client must agree on the **display map** without shared session state.
- The standard mechanism is a **stateless header** carrying the serialized vault snapshot (e.g. `X-Altro-Stencil-Vault`):
  - header payload contains `store` where each key is `{{IPA_N}}` and each value is the **Display** brick.
- Client injection (including streaming paths) must consume the header vault as the authoritative source of truth for **Display**.

Security invariant:
- Metadata propagation must be deterministic and must not leak raw source entities into the executor prompt.

## 3) Integrity Protocol (OPR)

ALTRO’s Operational/Integrity principles (OPR filter) enforce that semantic tokens are treated as native grammatical objects in the target language:

- Model placement is responsible for syntax, grammar agreement, and natural resonance around `{{IPA_N}}`.
- Core code is responsible for rendering correct **Display** values and preserving the invariants of the stencil.

