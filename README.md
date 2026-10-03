# CARD.md Protocol — `business-card/0.1`

The open standard for versioned, hash-chained, agent-readable business identity cards.

A card is the complete business with no platform dependencies — the way a soul file is the person. Every downstream artifact (agents, sites, campaigns, receipts) is compiled from the card and stamped with its version and acting hash. When the business changes, the card mutates through an owner-confirmation queue, the hash chain records it, and every bound agent reloads on `acting_hash`.

This repo holds the **protocol**, not any company's implementation of it. Company builders (e.g. HelixMain) consume this repo and build on top.

## Contents

| Path | What |
|---|---|
| `spec/business-card-spec.md` | The standard: frontmatter, Acting layer, Sound, canonicalization, mutation, conformance |
| `schema/business-card.schema.json` | JSON Schema for the card JSON (validators, codegen) |
| `implementations/typescript/` | Canonicalization, SHA-256 hash chain, CARD.md emitter / parser / verifier, 14-test suite (`@card-protocol/core`) |
| `implementations/python/` | Canonical JSON (byte-identical with the TypeScript implementation) |
| `conformance/fixtures/` | Minimal valid card fixture for cross-implementation checks |

## The rules, briefly

- `format: business-card/0.1`. Frontmatter carries `version`, `previous_hash`, `hash`, `acting_hash`, `status` (`draft` | `owner-confirmed` | `live`).
- The Acting layer (Identity, Voice, Sound, Offer, Operations, Policy, Handoff, Knowledge, Provenance) is quotable. The Appendix is not.
- Real SHA-256 `hash` and `acting_hash`. `pending` is never a hash.
- Canonicalization: strip `hash` and `_`-prefixed fields → normalize integral floats → prune empty arrays/objects bottom-up → sort keys → compact JSON. Every implementation must produce byte-identical bytes.
- Draft cards are untrusted. Null price stays null — refuse and hand off, never invent.
- Mutations mint a new version and preserve the hash chain. Inferred data never overwrites owner-confirmed data.
- Sound assets are content hashes with honest states (`staged` → `ready` → `retired`). A voice agent may play `ready` only.

## Conformance

A file claiming `business-card/0.1` must carry real hashes, keep section order, record sound assets as content hashes with honest states, round-trip Markdown↔JSON losslessly under the canonicalization rules, and never place Appendix content where an agent could quote it as fact.

## License

MIT. The standard wins by adoption.
