# ALTRO SDK Compliance Report (v1.5) - 2026-04-08

- Generated: 2026-04-08T07:17:08.777Z
- Total assertions: 12
- Passed: 12
- Failed: 0

## Scenario A — Data Privacy
- PASS — Directive removed before payload
  - masked="Contact: {{IPA_1}}, employee ID: {{IPA_2}}, deploy {{IPA_3}} for {{IPA_4}} under ticket {{IPA_5}}."
- PASS — PII email masked
  - masked="Contact: {{IPA_1}}, employee ID: {{IPA_2}}, deploy {{IPA_3}} for {{IPA_4}} under ticket {{IPA_5}}."
- PASS — Complex technical IDs masked
  - masked="Contact: {{IPA_1}}, employee ID: {{IPA_2}}, deploy {{IPA_3}} for {{IPA_4}} under ticket {{IPA_5}}."
- PASS — Payload contains IPA markers
  - masked="Contact: {{IPA_1}}, employee ID: {{IPA_2}}, deploy {{IPA_3}} for {{IPA_4}} under ticket {{IPA_5}}."
- Notes:
  - Source: Contact: jane.doe@corp.example, employee ID: AB-7781-44, deploy Kryptos_Gate-V1 for Data_Sovereignty under ticket SEC-2026-ALPHA. [ALTRO: intent=technology, weight=high]
  - Masked: Contact: {{IPA_1}}, employee ID: {{IPA_2}}, deploy {{IPA_3}} for {{IPA_4}} under ticket {{IPA_5}}.

## Scenario B — Edge Cases
- PASS — Empty string stays empty
  - masked=""
- PASS — Directive-only becomes empty payload
  - masked=""
- PASS — Nested brackets do not leave orphan fragments
  - masked="Nested {{IPA_1}} value + {{IPA_2}}"
- PASS — Nested/adjacent brackets and tech anchors are masked into IPA markers
  - masked="Nested {{IPA_1}} value + {{IPA_2}}"
- Notes:
  - Empty masked: ""
  - Only-directive masked: ""
  - Nested masked: Nested {{IPA_1}} value + {{IPA_2}}

## Scenario C — Domain Shift
- PASS — Neutral prompt logs neutral matrix
  - neutral prompt calibration section present
- PASS — Shifted prompt lists active domains
  - shifted prompt includes technology/politics
- PASS — Prompt changes when weights shift
  - neutral and shifted prompts differ
- Notes:
  - Neutral calibration snippet: # MATRIX CALIBRATION (Intent Orchestrator): | Based on the directive "neutral baseline", no domain emphasis was inferred (neutral matrix). Use a clear, professional tone.
  - Shifted calibration snippet: # MATRIX CALIBRATION (Intent Orchestrator): | High-priority domains — adjust your linguistic tone accordingly: politics (100%), technology (100%).

## Ordering — Semantic Sovereignty
- PASS — IPA markers strictly follow appearance order
  - masked="{{IPA_1}} then {{IPA_2}} and {{IPA_3}} then {{IPA_4}}"
- Notes:
  - Source: [ID:MASK_context] then Alpha_Node-7 and [ID:MASK_intent] then Beta_Core-9
  - Masked: {{IPA_1}} then {{IPA_2}} and {{IPA_3}} then {{IPA_4}}
