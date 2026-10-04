# business-card/0.2 — Tier Annex

Status: draft · 2026-10-03

This annex adds access tiers to the Business Card standard. It is written
chain-agnostic: tiers, views, and envelopes are defined abstractly, and
infrastructure *profiles* bind them to concrete systems. The Nostr profile
is the default; the Sui settlement profile is opt-in. No blockchain is
required for a valid 0.2 card.

## 1. Why tiers

business-card/0.1 treats the card as one blob: a card is either draft or
live, and anyone holding it sees everything. That cannot serve the two
jobs the card must do at once:

- **Discovery** — a machine-queryable public surface (the registry) needs a
  stable, readable listing: who the business is, what it offers, how to
  reach it.
- **Operation** — the bound agent and staff need the full control plane:
  binding policies, handoff procedures, internal systems, provenance.

One blob forces a choice between a useless registry entry and leaking the
control plane. Tiers remove the choice: one card, three deterministic views.

## 2. Tier definitions

- **public** — Readable by anyone, no authentication. The discovery surface.
  This is what the registry indexes and what strangers see.
- **authorized** — Readable by staff and bound agents, authenticated by
  keypair. The operations surface. This is everything the card agent needs
  in order to act on the business's behalf.
- **owner** — Readable by the owner and their designated keyholders. The
  control surface: grants, keys, full provenance, non-quotable strategy.

The bound agent is an *authorized* reader by definition. Any tier assignment
that the agent cannot read, the agent cannot use — this constraint decides
the two hard cases below.

## 3. Tier mapping table

| Section | Tier | Rationale |
|---|---|---|
| Identity | public | The listing itself: name, pitch, address, phone, email, timezone. This *is* the registry entry. |
| Voice | public | Anyone rendering the business needs it; tone, samples, don'ts, lexicon contain no secrets. |
| Sound | public | Brand assets are public by nature; `asset` fields are content hashes, never raw bytes. |
| Offer (`offerings`) | public | The storefront. Prices are public when present; null stays null. Per-offering `visibility: authorized` override for quote-only pricing. |
| Operations | **split** (see §4) | Public operational facts are the storefront; internal ops are the control plane. A whole-section assignment either leaks internals or hides the storefront. |
| Policy (`policies`) | **authorized** | Binding on the agent and staff. The agent MUST read the policies it enforces — the compiler embeds them in the system prompt as binding rules. Owner-only would break the agent's function. |
| Handoff | authorized | Operational procedures for staff and agents; not for strangers. |
| Knowledge | authorized | Full KB pointers for operators. Public answers are compiled as quotable subsets (the existing `ragManifest` / minimal-context mechanism), not by publishing the KB. |
| Provenance | owner (summaries authorized) | Full field-level trace is the control plane. The agent works from confidence summaries already embedded in compiled outputs. |
| Changelog | public | Version history is transparency; it contains no secrets. The hash chain is the integrity story. |
| Appendix | owner | Explicitly non-quotable by design: personas, inferred competitors, SWOT. For humans and planners only. |
| Frontmatter (`format`, `id`, `version`, hashes, `organization_id`, `status`) | public | Integrity metadata must be verifiable by anyone. |

### Decision record

- *Policy → authorized (not owner).* An earlier draft placed Policy in
  owner. Rejected: the card agent is a bound agent, and a bound agent that
  cannot read its binding policies cannot act. The compiler's system prompt
  embeds policies as binding rules; owner-only would make every compiled
  agent ungrounded by construction.
- *Operations → split (not whole-section).* Hours, channels, and delivery
  fence are public facts of doing business; what requires human confirm,
  backing systems, and capability grants are internal. See §4.

## 4. Field-level assignments

Sections have a default tier from the table above. The following fields
override the default. Everything not listed follows its section default.

- `operations.hours`, `operations.channels`, `operations.delivery_fence`,
  `operations.catering_lead_time` → **public**
- `operations.requires_human_confirm`, `operations.systems`,
  `operations.capability_grants` → **authorized**
- `knowledge[]` entries with `kind: "faq"` → quotable in public *through
  compiler subsets*; the pointers themselves stay **authorized**
- `offerings[].price` → **public** when present; `null` stays `null`
  (refuse and hand off). `offerings[].visibility` may be set to
  `"authorized"` per offering for quote-only pricing.
- `provenance` / `field_provenance` full trace → **owner**; confidence
  summaries (`source`, `confidence`, `extractor`) → **authorized**
- `identity.*` → **public**, all fields. 0.1 defines no private identity
  fields.
- `sound.*` → **public**, all fields (briefs describe public artifacts;
  assets are content hashes).

## 5. View derivation rules

From one card, three deterministic views are derived:

- `public_view` — public fields only.
- `authorized_view` — public + authorized fields.
- `owner_view` — all fields.

Rules:

1. **Monotonicity is structural.** `public_view ⊆ authorized_view ⊆
   owner_view` as sets of fields. A field appears in exactly the tiers at
   or above its assignment — never duplicated, never omitted upward.
2. **Deterministic.** Same card → byte-identical views, in every
   implementation. Canonicalization follows the 0.1 rules (sort keys,
   prune empties bottom-up, normalize integral floats).
3. **Draft cards derive tiers too**, but draft = untrusted (existing 0.1
   rule). Owner confirmation promotes the whole card; tiers do not carry
   independent status.
4. **Null stays null across tiers.** A null price in the owner view is null
   in the public view. Tiers never fill gaps by inference.
5. **Published views are envelopes.** When a view leaves the owner's
   infrastructure, the authorized and owner views travel as encrypted
   envelopes (envelope format is defined in the next section of this
   annex). The public view travels in clear.

## 6. Hash coverage

Each view is canonicalized independently and hashed over its **plaintext**
canonical JSON bytes:

- `public_hash`, `authorized_hash`, `owner_hash` — SHA-256 over the
  canonical JSON of each view *as plaintext*.

For `public` the plaintext and the published bytes are the same thing.
For `authorized` and `owner` they diverge: the published bytes are the
encrypted envelope (§9). The frontmatter commits the plaintext hashes;
ciphertext hashes live in the envelope as retrieval addresses.

### Decision record

*Hash the plaintext view, not the ciphertext.* Publishing
`SHA-256(plaintext)` in public frontmatter leaks nothing (preimage
resistance) and buys verifiability at every tier without decryption:
an authorized reader decrypts the envelope and checks the plaintext
against `tier_hashes.authorized`, proving the envelope they received is
the *same* view the card commits to — not a substituted plaintext under
a valid envelope. Had the frontmatter committed only ciphertext hashes,
content verification would require decryption first and a malicious
publisher could serve validly-encrypted wrong plaintext undetected.

The card's hash chain commits to all three: the 0.2 frontmatter carries

```yaml
tier_hashes:
  public: "sha256:<hex>"
  authorized: "sha256:<hex>"
  owner: "sha256:<hex>"
```

and the card `hash` is computed over canonical JSON that includes
`tier_hashes`. Any mutation to any tier changes the card hash; the
`previous_hash` lineage is preserved. A verifier can check a single view
against its hash without seeing the other tiers.

## 7. Envelope format

When an `authorized` or `owner` view leaves the owner's infrastructure, it
travels as an encrypted envelope. The envelope is a JSON object; its own
content-address is the SHA-256 of its canonical bytes (computed with the
0.1 canonicalization rules).

```jsonc
{
  "format": "card-envelope/0.2",
  "card_id": "dna_<id>",
  "card_version": 3,
  "tier": "authorized",          // "authorized" | "owner"
  "view_hash": "sha256:<hex>",   // plaintext canonical view hash;
                                 // MUST equal tier_hashes[tier] — the
                                 // envelope is self-verifying
  "scheme": "nip44",             // "nip44" | "xchacha20poly1305" | "seal-sui"
  "scheme_params": { "...": "..." },
  "recipients": ["<pubkey>", "..."],
  "wraps": [                     // per-recipient wrapped content keys
    { "recipient": "<pubkey>", "wrapped_key": "<base64>" }
  ],
  "created_at": "2026-10-03T00:00:00Z",
  "ciphertext": "<base64>"       // inline mode, OR:
  // "blob": {
  //   "hash": "sha256:<hex>",   // content-address of the external
  //                             // ciphertext blob, for retrieval
  //   "uris": ["wss://relay.example", "ipfs://<cid>", "https://…"]
  // }
}
```

Rules:

1. **Two modes, one format.** Small views embed `ciphertext` inline.
   Large views store the ciphertext as an external blob and carry `blob`
   with its content hash and retrieval URIs. Never both.
2. **`view_hash` is mandatory** and MUST equal the card frontmatter's
   `tier_hashes[tier]`. A reader verifies this *after* decryption, without
   consulting the card.
3. **Multi-recipient via key wrapping.** A random content key encrypts the
   payload; the content key is wrapped once per recipient with that
   recipient's public key. Adding a recipient = one more wrap, no
   re-encryption of the payload.
4. **Algorithm agility.** `scheme` names the mechanism; unknown schemes
   MUST be rejected, not guessed. New schemes are added by annex revision,
   never by silent extension.
5. **No plaintext in the envelope besides `view_hash`.** Hashes don't leak
   content.

### Schemes

- **`nip44`** (default). NIP-44 v2 conversation encryption for the
  per-recipient key wraps; payload encrypted with XChaCha20-Poly1305 under
  the random content key. `scheme_params` carries the NIP-44 version.
- **`xchacha20poly1305`**. Raw symmetric encryption for keys distributed
  out-of-band (e.g., the owner tier kept in the owner's vault, where the
  key never leaves owner infrastructure). `recipients` carries key
  identifiers rather than pubkeys.
- **`seal-sui`** (settlement profile). The content key is sealed under a
  Sui Seal access-policy object; `scheme_params` carries the policy
  object id. Defined fully in §11.

## 8. Nostr default profile

The default infrastructure profile. No blockchain, no gas, no new
keypairs: the card agent already holds a Nostr keypair for memory
(minipae), and it is reused here.

- **Identity.** The card's Nostr identity is a dedicated card keypair
  (recommended) or the agent's existing keypair. The owner tier is
  encrypted to the owner's keypair.
- **Public view** → published as an addressable (replaceable) Nostr
  event: `d` tag = `card_id`, content = canonical public view JSON.
  The event id is itself a content hash. Exact event kind number is TBD
  pending NIP registration; it MUST be in the addressable range
  (30000–39999).
- **Envelopes** → published as Nostr events carrying the envelope JSON
  (inline mode), or as events referencing a Blossom blob (referenced
  mode). Blossom is the Nostr-adjacent content-addressed blob store;
  `blob.uris` may also list IPFS or HTTPS mirrors.
- **Relay strategy.** Publish to N operator-configured relays; readers
  query relays and verify against `tier_hashes`. Relay availability is
  the weak point — mitigate with multiple relays plus a local copy.
  The card hash makes any copy verifiable, so availability never affects
  integrity.
- **Registry.** The machine-queryable registry (Phase 4) indexes public
  view events by kind and `d` tag. No separate index build is required
  for the MVP.

## 9. Key rotation and revocation

- **Rotation** = re-encrypt the view to the new recipient set and publish
  a new envelope. The card version does NOT need to bump for a pure
  re-encryption (content unchanged); the envelope's `created_at`
  distinguishes generations. If recipients are part of card policy,
  bump the version per the 0.1 mutation rules.
- **Revocation** = rotation without the revoked key. A revoked recipient
  keeps whatever they already decrypted — decrypted plaintext cannot be
  un-seen, regardless of mechanism. This limitation is inherent and
  identical under Seal; no profile claims otherwise.
- **Compromise response.** If a recipient key is compromised, rotate
  immediately and treat all envelopes ever encrypted to it as public
  to that holder.

## 10. Sui settlement profile (opt-in)

For businesses that want on-chain guarantees. This profile is *not*
required for a valid 0.2 card; it is the Phase 5 settlement layer.

- **Seal.** `scheme: "seal-sui"` seals the envelope content key under a
  Seal access-policy object. Policies are programmable and auditable
  on-chain (time-bounded access, paid access, role-based) — the one
  thing Nostr's cryptographic access control cannot express.
- **Walrus.** Envelopes and ciphertext blobs stored as Walrus blobs;
  content-addressed natively, so `blob.hash` is the Walrus blob id.
- **Anchoring.** Card hash and `tier_hashes` anchored as Sui objects for
  the reputation layer. Anchoring a card does not change the card;
  the chain attests, it does not author.

## 11. Next in this annex

Networks and infrastructure extension maps.

## 12. Networks map

The `networks` map records how the outside world reaches the card's agent.
It is keyed by purpose and extensible by annex revision. This section
defines the map and the `voice` entry; the shape below is not a new
design — it mirrors the verified Meshenger contact JSON
(`{"name","public_key","addresses"}`, validated against the Meshenger
Android app's own `Contact.fromJSON` parser rules), minus the redundant
`name`.

```yaml
networks:
  voice:
    protocol: "meshenger"      # "meshenger" is the defined protocol
    public_key: "<hex ed25519>" # identity proof — public by design
    addresses: ["<ip>", "..."]  # dialable addresses (TCP 10001)
```

Rules:

1. **The public key is the identity proof; the private key never appears
   in the card.** Key custody is a vault matter (`0600` key files in
   existing deployments). Any card containing a private key is invalid.
2. **`protocol: "meshenger"` is the 0.2-defined voice protocol.** New
   protocols (SIP, WebRTC-direct, …) are added by annex revision with
   their own verified shapes — never invented inline.
3. **Tier: `networks.voice` is public.** It is the customer-facing
   pointer: the QR encodes this entry, and the QR is a stable pointer —
   card mutations change what the agent knows, never the QR.
4. **Default tier for future entries is public** (a network entry is a
   way to *reach* the business); an entry may declare
   `visibility: authorized` for operator-only channels.
5. Network entries land in tier views per their visibility:
   `networks.voice` is part of the `public_view` and its hash.

## 13. Infrastructure map

The `infrastructure` map records where the card's agent *runs*. It exists
for the operator path (fleet management, Paperclip) — not for customers.
No compiler emits this yet; the shape below is minimal by design and
grows by revision.

```yaml
infrastructure:
  deployments:
    - id: "prod-1"
      provider: "hostinger"     # free-form operator label
      sandbox: "docker+gvisor" # "docker+gvisor" | "openshell" | …
      region: "us-east"         # optional
```

Rules:

1. **Tier: authorized (default).** Deployment topology is operator
   knowledge — staff and bound agents need it, the public does not.
   (Self-hosted deployments make this load-bearing: publishing the map
   would leak the business's network layout.)
2. **`sandbox` is a free-form label**, not an enum. The sandbox substrate
   is an operator decision (Docker+gVisor now, OpenShell candidate);
   the spec records it, it does not bless it.
3. **No secrets.** Credentials, keys, and tokens never appear here —
   the vault holds them; the card holds grant+scope only (standing rule).
4. Infrastructure entries are part of the `authorized_view` and its hash.

## 14. Annex status

Tier table (§2–§6), envelope format (§7), Nostr default profile (§8),
key rotation (§9), Sui settlement profile (§10), networks (§12), and
infrastructure (§13) are drafted. 0.1 errata resolutions follow (§15).

## 15. business-card/0.1 errata — resolved in 0.2

### R1. Acting-layer key set — locked to seven keys

Normative 0.2 acting set: `identity`, `voice`, `offerings`, `operations`,
`policies`, `handoff`, `knowledge`. `sound` and `field_provenance` remain
excluded.

Adopted rationale: sound asset states flip during rendering without
changing what the agent may quote, and provenance is metadata *about*
claims rather than quotable claims themselves.

Discrepancy note: the ground-truth field list supplied for this resolution
named six keys, omitting `handoff`. The implementations compute seven,
including `handoff`, and the seven-key set is locked: handoff changes
(when, channel, after-hours behavior) must trigger agent reload, so
`handoff` stays in the acting set.

`strategy`, `customers`, `competitors`, `insights` are not in the acting
set. They are appendix-grade content; the acting hash covers what the
agent's behavior depends on, nothing more.

### R2. JSON names are normative; Markdown headers are display names

The CARD.md section headers (`## Offer`, `## Policy`, `## Provenance`) are
display names only and carry no normative weight. The JSON field names are
the canonical identifiers, locked as implemented:

- `offerings` (array of `{name, …}`), not `offer`
- `policies` (array of `{topic, rule}`), not `policy`
- `field_provenance` (object keyed by dot-path), not a `provenance` array
- `identity.elevator_pitch`, not `identity.pitch`
- `voice.sample_phrases`, not `voice.samples`
- `created_at` — the round-trip-stable timestamp key
- `previous_version` — always present; `null` on v1, never absent
  (`null` is not pruned, only empty arrays/objects are)

The emitter maps display names to JSON keys on parse; verifiers check the
JSON form.

### R3. Acting scope and tiers are orthogonal by design

`acting_hash` scope determines **reload triggers**: what the agent's
behavior depends on. Tiers determine **read access**: who may see.
`knowledge` and `handoff` are in the acting set *and* in the
authorized tier — coherent, because the card agent is a bound agent and
therefore an authorized reader. The 0.1 prose calling the acting layer
"quotable" is clarified: quotability *to the public* goes through
compiler subsets (§3), never through tier violation. Inclusion in the
acting hash is intentional, not a leak.

### R4. Hash prefix convention — settled

In JSON, `hash`, `acting_hash`, and `previous_hash` are bare 64-char hex,
no prefix. The `sha256:` prefix exists only in Markdown frontmatter as a
presentation affordance (emitter adds, parser strips). Verifiers recompute
against the bare-hex JSON form. Carried forward unchanged into 0.2.

### R5. `format` is frontmatter-only — carried forward

`format: business-card/0.2` appears in frontmatter. It is not a JSON key;
the parser does not restore it into JSON.
