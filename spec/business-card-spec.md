# Business Card — `business-card/0.2`

**Status:** draft standard · 2026-10-05
**Supersedes:** `business-card/0.1`; which superseded the `BUSINESS.md` / `dna-card` contract.

## The product

The card is the product. `CARD.md` is the file any agent reads cold — the way a soul file is the person. It mutates with the company. It is not a brochure.

File: `CARD.md` at the company root. Agents also accept `business-card.md`.

## Read rules

1. Read the frontmatter first. If `status` is `draft`, treat every field without `owner-confirmed` as untrusted. Do not invent the missing ones.
2. Quote only the Acting layer. The Appendix is for humans and planners. Never speak SWOT, competitor guesses, personas, or staged audio in a reply.
3. If a field is absent or `null`, refuse that act and hand off. Do not fill it from memory. A null price stays null.
4. Cite `field_provenance` when a guest or owner asks why you said something.
5. A mutation writes a new version. Do not edit a live hash in place.

## File shape

```yaml
---
format: business-card/0.2
id: dna_<id>
version: 2
previous_version: 1            # omit on v1
previous_hash: sha256:<hex>    # or "none" for v1
hash: sha256:<hex>             # over the full canonical JSON; never "pending"
acting_hash: sha256:<hex>      # over the 7 acting JSON keys only
organization_id: org_<id>
status: draft                  # draft | owner-confirmed | live
updated: 2026-10-01T00:00:00Z
---
```

Sections in the Markdown document, in order:

1. Identity
2. Voice
3. Sound
4. Offer
5. Operations
6. Policy
7. Handoff
8. Knowledge
9. Provenance
10. Changelog
11. Appendix (optional — not quotable, not in `acting_hash`)

## JSON key names (canonical)

The spec prose and the implementation JSON keys differ in a few places. 0.2 canonizes the implementation keys. Use these names in JSON and code:

| Section / concept | JSON key |
|---|---|
| Identity: one-sentence pitch | `identity.elevator_pitch` |
| Voice: samples | `voice.sample_phrases` |
| Sound assets (nested under voice) | `voice.sonic` |
| Offer section | `offerings` |
| Policy section | `policies` |
| Provenance section | `field_provenance` |
| Timestamp (round-trip stable) | `created_at` |
| Version chain | `previous_version` (null on v1, integer after) |
| Format (frontmatter only) | `format: business-card/0.2` — not restored into JSON |

`updated` in the frontmatter maps to `created_at` in the JSON card (the emitter writes `card.updated_at ?? card.created_at`; the parser restores it as `card.created_at`). This is the round-trip stable key.

## Acting fields

### Identity
`name`, `elevator_pitch` (one sentence), `location`/`address`, `phone`, `email`, `timezone`, `source_url`/`website`. `mission`, `founded`, and `values` may also appear.

### Voice
`tone`, `personality`, `sample_phrases` (3–5), `donts`, `lexicon_use`, `lexicon_never`. Sound assets live in `voice.sonic`.

### Sound
A company has a boot sound, the way a machine does. Three assets, each with a state machine: `staged` → `ready` → `retired`. Sound content is stored in `voice.sonic` and is part of `acting_hash` via the `voice` key.

- `sonic_logo` — the mark you hear once, under 4 seconds. Netflix dum-dum, console power-on.
- `voice_logo` — one spoken line: the name plus one welcome sentence. Under 6 seconds.
- `ui_sounds` — notification, success, error. Each under 1.2 seconds. Error is round and quiet, never a buzz.

```yaml
sound:
  logo: { state: staged, brief: "wooden knock, then a warm muted tone", asset: null, seconds: 4 }
  voice_logo: { state: ready, line: "Welcome to …", voice: "<voice-id>", asset: "sha256:<hex>" }
  ui:
    notification: { state: staged, brief: "single gentle wooden knock" }
    success: { state: staged, brief: "two rising soft notes" }
    error: { state: staged, brief: "one low rounded tone, no buzz" }
```

Rules:

- A state becomes `ready` only when the asset file exists. A brief is not an asset.
- `asset` is a content hash (`sha256:<hex>`), never a bare filename. Filenames are not content-addressed.
- A voice agent may play `ready` assets only. It must never play `staged` ones.
- `draft` status does not block rendering, but machine-rendered audio is not owner confirmation: the owner confirms the *line*, and confirmation is recorded in `field_provenance` before `status` leaves `draft`.

### Offer
A list. Each row: `name`, `kind`, `orderable`, `price` (number or null), `confidence`. Null price is allowed. A made-up price is not — the agent refuses and hands off.

### Operations
`hours`, `channels`, `delivery_fence`, `catering`, `human_confirm` (acts requiring a human), `response_sla` (how quickly the agent promises to reply, e.g. `"within 24 hours"`), and `pipeline_stages` (the ordered stages a lead moves through, e.g. `["new","contacted","booked"]`). Both are part of the acting layer, so changing either moves `acting_hash`.

### Policy
refunds, cancellations, allergens, alcohol, promises the agent must not make. Empty means hand off, not guess.

### Handoff
when, channel, after-hours behavior.

### Knowledge
Pointers to menus, PDFs, FAQs. Not the documents themselves.

### Provenance
`field_provenance` — object keyed by field path (e.g. `"identity.name"`). Each value: `sources[]`, `confidence`, `extractor_agent`, `extracted_at`. Every acting-layer claim an agent might quote traces here. `field_provenance` is **not** part of `acting_hash` — it is metadata about claims, not quotable claims themselves.

## Canonicalization (hash identity)

The hash chain is only as real as its canonicalization. Every implementation must produce byte-identical canonical JSON:

1. Strip the `hash` field and any `_`-prefixed ephemeral fields.
2. Normalize integral floats to integers (`4.0` → `4`). Python's `json.dumps` writes `4.0`; `JSON.stringify` writes `4`.
3. Prune bottom-up: an empty array or empty object as an object value is identical to a missing key (`"threats": []` ≡ no `threats`). This keeps the Markdown↔JSON round-trip lossless where Markdown omits empty sections.
4. Sort object keys; serialize with `(",", ":")` separators, no whitespace.

**`hash`** = SHA-256 of the canonical full card (all fields except `hash` and `_`-prefixed), stored `sha256:`-prefixed in frontmatter, bare hex in JSON.

**`acting_hash`** = SHA-256 of the canonical JSON of exactly these seven JSON keys:
`identity`, `voice`, `offerings`, `operations`, `policies`, `handoff`, `knowledge`.

`voice.sonic` (sound assets) is included via the `voice` key. `field_provenance` is excluded — provenance records change state without changing what the agent may quote.

Agents pin the quotable surface to `acting_hash`. When `acting_hash` changes, agents must reload before quoting the card again.

**Hash prefix convention:** bare hex in JSON (`^[0-9a-f]{64}$`); `sha256:` prefix in Markdown frontmatter only. Verifiers recompute against the bare-hex JSON form.

## Mutation

The card mutates. The company is not a snapshot.

Triggers: owner edit, new menu, hour change, review import, tool result that contradicts a field, expired confidence.

Rules:

- A mutation bumps `version`, sets `previous_hash`, recomputes `hash` (and `acting_hash` when the Acting layer changed).
- `previous_version` is `null` on v1 and the integer previous version number after that. Keep it `null` (not absent) on v1 — absence shifts the full hash.
- Inferred fields never overwrite `owner-confirmed` fields.
- A contradiction opens a question for the owner. It does not silently win.
- Changelog gets one line: version, time, what changed, who (owner or extractor).

## What any agent may produce from a card

| Agent | Reads | May do | May not |
|---|---|---|---|
| Front desk | voice, offerings, operations, policies, handoff | answer, book within rules | price if null, refund, allergen promise |
| Sales | voice, offerings, appendix customers | draft outreach | send, invent proof |
| Content | voice, lexicon, offerings | draft pages and posts | publish, use appendix as copy |
| Sound | voice.sonic briefs, voice.sample_phrases | write a jingle brief, call the sonic skill | play staged assets |
| Policy | policies, handoff | allow / deny / ask | widen a gate |

## Skill: sonic-brand

Name: `sonic-brand`
Input: a `business-card/0.2` file.
Output: patches `voice.sonic` only. Never touches offerings, policies, or other voice fields.

1. Load identity and voice. **Refusal:** if `identity.name` or `voice.tone` is missing, stop and ask. Do not score a jingle for a company you cannot name.
2. `sonic_logo` brief, under 4 seconds, matched to temperament.
3. `voice_logo` line: the name plus one welcome sentence from `identity.elevator_pitch`. No hype words from `voice.donts`/`voice.lexicon_never`.
4. `ui_sounds` briefs: notification, success, error. Error is round and quiet.
5. Speak the voice logo. Record the content hash on `voice.sonic.voice_logo.asset_ref`. State becomes `ready` only after the file exists.
6. Leave `sonic_logo` and `ui_sounds` `staged` until an audio renderer produces them.
7. Write the patch into `voice.sonic`. Bump version, chain the hash, append a changelog line.

## Conformance

A file claiming `format: business-card/0.2` must:

- carry a real `hash` and `acting_hash` (no placeholders);
- keep the section order above;
- record sound assets as content hashes with honest states;
- round-trip Markdown↔JSON without loss under the canonicalization rules;
- validate against the JSON Schema at `schema/business-card.schema.json`;
- never place Appendix content (personas, inferred competitors, SWOT) where an agent could quote it as fact.
