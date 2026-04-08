# ALTRO Enterprise Documentation Suite

## Executive Summary
ALTRO is a **Zero-Knowledge Semantic Layer**: it converts sensitive surface forms into a secure stencil (`{{IPA_N}}`) *before* the executor LLM sees any data. The executor receives only semantic placeholders, while the system owns entity resolution and renders deterministic, localized **Display** bricks back to the user.

## Security Standards
This SDK implements compliance-oriented logic aligned with:

- **SOC 2**: security controls driven by translation-first masking, integrity-oriented orchestration, and auditability of the vault-to-injection path.
- **GDPR (Pseudonymization)**: sensitive identifiers (e.g., emails, technical IDs, and other entity spans) are pseudonymized into immutable `{{IPA_N}}` tokens; raw source values remain in server-side vault history, not in the executor prompt.
- **ISO 27001**: risk reduction through defense-in-depth (firewall/masking, deterministic injection, stateless vault synchronization via `X-Altro-Stencil-Vault`-style headers) and explicit integrity invariants.

## Verification Guide (Live 12/12)
To verify the security perimeter and masking invariants on your machine, run:

```sh
npm run integrity-check
```

The suite writes a timestamped Markdown report and asserts **12/12 PASS** across privacy, edge cases, domain shift behavior, and strict `{{IPA_N}}` ordering.

Report location: `docs/compliance/SDK_INTEGRITY_REPORT.md`.

## Legal Manifesto
See `docs/legal/ALTRO_MANIFESTO.md` for the **ALTRO License Manifesto v1.5** (Semantic Sovereignty + Metadata Orchestration principles).

