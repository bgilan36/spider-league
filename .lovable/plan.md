# Improve spider species identification: model upgrade + smart escalation

## Current state (verified in `supabase/functions/spider-identify/index.ts`)
- Primary model: `google/gemini-2.5-pro` (slow — 3–8s typical on image reasoning)
- Fallback: `google/gemini-2.5-flash`, only on 429/503
- Single-pass call, closed-set catalog, JSON output

Two problems: Gemini 2.5 Pro is the slowest option in the catalog, and there's no accuracy-based escalation — a low-confidence Pro answer is just accepted.

## Proposed change

**Two-tier confidence-gated pipeline** using newer, faster models from the catalog:

1. **Fast first pass** — `google/gemini-3.6-flash` (latest-gen flash, multimodal, materially faster than 2.5 Pro; the project's documented default chat model). Runs on every upload.
2. **Escalate on uncertainty** — if the top candidate's confidence is below a threshold (e.g. `< 70`) OR the top two candidates are within 10 points of each other, re-run on `google/gemini-3.1-pro-preview` (stronger reasoning than 2.5 Pro, newer generation) with the flash result included in the prompt as a "second opinion" hint. High-confidence answers skip this and return in a single fast call.
3. **Fallback on 429/503** — same as today, drop one tier (pro-preview → 3.6-flash → 3.1-flash-lite).

Expected impact:
- **Speed**: majority of uploads (clear photos, high confidence) return from a single flash call — noticeably faster than today's Pro-first path.
- **Accuracy**: ambiguous cases get a stronger model (3.1 Pro Preview > 2.5 Pro) *and* a two-model cross-check, which is more accurate than a single Pro call.

## Why these models (from `ai-models-chat`)
- `google/gemini-3.6-flash` — latest Flash, fast coding/reasoning, multimodal (T,I,A,V→T). Better speed/quality tradeoff than 2.5-flash.
- `google/gemini-3.1-pro-preview` — "stronger next-generation Gemini reasoning when quality matters more than latency." Newer than 2.5-pro.
- Considered `openai/gpt-5.5` (frontier, priority-serving capable) — rejected as primary because it's more expensive and the Gemini models handle the closed-set classification well; leaving as a future option if accuracy still lags.

## Files to change
- `supabase/functions/spider-identify/index.ts`
  - Rename/restructure `callVision(model)` to accept an optional `priorHint` string.
  - Replace lines ~629–634 with the two-tier pipeline:
    - Call `gemini-3.6-flash` first.
    - Parse; if top confidence `< 70` or (top1 - top2 `< 10`), call `gemini-3.1-pro-preview` passing the flash result as context ("A first-pass model suggested X (n%) and Y (n%); verify or correct using the diagnostic features you see").
    - Merge: use the escalation result when it runs; otherwise use flash.
  - Keep JSON schema, catalog, location hint, and downstream parsing unchanged.
  - Log which tier answered (for future tuning).

## Out of scope
- Changing the catalog, the prompt schema, or the client-side reveal UI.
- Adding a third provider (OpenAI). Can revisit if accuracy still lags after this rollout.
