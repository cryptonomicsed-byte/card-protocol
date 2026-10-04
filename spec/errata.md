# Errata — `business-card/0.1`

> **Superseded by `tier-annex-0.2.md` §15**, which locks the normative 0.2
> resolutions. This file is retained as the historical record of what was
> open in 0.1.

## Acting-layer key set (open, resolves in 0.2)

`business-card-spec.md` defines the Acting layer as sections 1–9 (Identity, Voice, Sound, Offer, Operations, Policy, Handoff, Knowledge, Provenance).

The 0.1 reference implementations compute `acting_hash` over seven JSON keys only:

`identity`, `voice`, `offerings`, `operations`, `policies`, `handoff`, `knowledge`

`sound` and `provenance` are **excluded** from the 0.1 `acting_hash`. The implementations are self-consistent (TypeScript suite 14/14; Python canonicalization byte-identical), and the conformance fixture in this repo matches the implementations, not the spec prose.

Rationale for the exclusion (as implemented): Sound asset states flip frequently during rendering without changing what the agent may quote, and Provenance is metadata *about* claims rather than quotable claims themselves. Whether that rationale survives is a 0.2 decision.

**0.2 must resolve this one way or the other:** either the spec narrows to the seven keys, or the implementations widen to all nine sections. Until then, verifiers must use the seven-key set or they will reject conforming 0.1 cards.

## Field-name discrepancies (open, resolves in 0.2)

The 0.1 reference implementations use JSON keys that differ from the spec prose:

| Spec prose | Implementation JSON key |
|---|---|
| `identity.pitch` | `identity.elevator_pitch` |
| `voice.samples` | `voice.sample_phrases` |
| Offer section | `offerings` |
| Policy section | `policies` |
| `updated` (timestamp) | `created_at` — the round-trip-stable key (the emitter also reads `updated_at` on write; the parser always restores `created_at`) |
| Provenance section (array of records) | `field_provenance` — object keyed by field name, values `{sources[], confidence, extractor_agent, extracted_at}` |
| `format` in JSON | Frontmatter-only. The emitter hardcodes `format: business-card/0.1`; the parser does not restore it into JSON. |
| (new) | `previous_version` — always restored by the parser (`null` on v1, number after); keep it `null`, not absent, or the full hash shifts (`null` is not pruned, only empty arrays/objects are) |

## Hash prefix convention (0.1, settled)

In **JSON**, `hash`, `acting_hash`, and `previous_hash` are **bare hex** (64 chars, no prefix). The `sha256:` prefix exists only in the **Markdown frontmatter** as a presentation affordance: the emitter adds it on write (`"sha256:" + hex`), the parser strips it on read. Verifiers recompute against the bare-hex JSON form. The JSON Schema in this repo validates the JSON form (bare hex).

The implementations are self-consistent (emitter ↔ parser round-trip is lossless on these keys; suite green). The JSON Schema in this repo and the conformance fixture follow the implementation keys. 0.2 must canonize one naming.
