# Errata — `business-card/0.1`

Both open issues below are resolved in `business-card/0.2`. See `spec/business-card-spec.md`.

## Acting-layer key set — resolved in 0.2

`business-card/0.1` spec prose defined the Acting layer as sections 1–9 (Identity, Voice, Sound, Offer, Operations, Policy, Handoff, Knowledge, Provenance), but the 0.1 reference implementations computed `acting_hash` over seven JSON keys only:

`identity`, `voice`, `offerings`, `operations`, `policies`, `handoff`, `knowledge`

`sound` and `field_provenance` were excluded. The implementations were self-consistent (TypeScript suite 14/14; Python canonicalization byte-identical), and the conformance fixture matched the implementations, not the spec prose.

**Resolved in 0.2:** spec narrows to the seven-key set. Sound content is already included via `voice.sonic` (nested under the `voice` key). `field_provenance` is excluded — provenance records track claim origins rather than quotable content, and they change state without changing what the agent may quote.

## Field-name discrepancies — resolved in 0.2

The 0.1 spec prose used names that differed from the implementation JSON keys:

| Spec prose | Implementation JSON key |
|---|---|
| `identity.pitch` | `identity.elevator_pitch` |
| `voice.samples` | `voice.sample_phrases` |
| Offer section | `offerings` |
| Policy section | `policies` |
| `updated` (timestamp) | `created_at` — the round-trip-stable key |
| Provenance section | `field_provenance` |
| `format` in JSON | Frontmatter-only — parser does not restore into JSON |
| (new) | `previous_version` — null on v1, integer after; keep null not absent |

**Resolved in 0.2:** spec adopts the implementation JSON keys throughout. The field-name table in `spec/business-card-spec.md` is now canonical.

## Hash prefix convention — settled in 0.1

In **JSON**, `hash`, `acting_hash`, and `previous_hash` are **bare hex** (64 chars, no prefix). The `sha256:` prefix exists only in the **Markdown frontmatter** as a presentation affordance: the emitter adds it on write, the parser strips it on read. Verifiers recompute against the bare-hex JSON form. The JSON Schema validates the JSON form (bare hex).

This convention is unchanged in 0.2.
