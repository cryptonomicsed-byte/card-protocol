/**
 * card.tierViews — business-card/0.2 tier derivation.
 *
 * From one card, three deterministic views: public, authorized, owner.
 * Implements tier-annex-0.2 §2–§6:
 *   - Section → tier mapping (§3) with field-level overrides (§4)
 *   - Monotonicity: public ⊆ authorized ⊆ owner
 *   - Each view canonicalized independently; tier_hashes committed by the card
 *
 * Tiers answer "who may read"; acting_hash scope answers "when the agent
 * reloads" — orthogonal dimensions (§15 R3).
 */
import { createHash } from "crypto";
import { canonicalJson } from "./business-md";

export type TierName = "public" | "authorized" | "owner";

/** Operations keys that are public storefront facts (§4). The rest are authorized. */
const PUBLIC_OPERATION_KEYS = [
  "hours",
  "channels",
  "delivery_fence",
  "catering_lead_time",
] as const;

/** Frontmatter/integrity fields: public in every view. */
const META_KEYS = [
  "id",
  "version",
  "status",
  "created_at",
  "previous_version",
  "previous_hash",
  "organization_id",
  "hash",
  "acting_hash",
] as const;

function pick(obj: any, keys: readonly string[]): any {
  const out: any = {};
  if (obj == null || typeof obj !== "object") return out;
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

function pickMeta(card: any): any {
  return pick(card, META_KEYS);
}

/** Offerings visible in the public view: all except visibility:"authorized". */
function publicOfferings(card: any): any[] {
  return (card.offerings ?? []).filter((o: any) => o?.visibility !== "authorized");
}

function publicNetworks(card: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(card.networks ?? {})) {
    if ((v as any)?.visibility !== "authorized") out[k] = v;
  }
  return out;
}

function authorizedNetworks(card: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(card.networks ?? {})) {
    if ((v as any)?.visibility === "authorized") out[k] = v;
  }
  return out;
}

/**
 * Confidence summaries for the authorized tier (§4): per-field
 * {sources, confidence, extractor_agent}. The full trace (including
 * extracted_at and any other trace metadata) is owner-only.
 */
function provenanceSummary(card: any): any {
  const out: any = {};
  for (const [field, rec] of Object.entries(card.field_provenance ?? {})) {
    const r = rec as any;
    out[field] = {
      sources: r.sources,
      confidence: r.confidence,
      extractor_agent: r.extractor_agent,
    };
  }
  return out;
}

function viewHash(view: any): string {
  return createHash("sha256").update(canonicalJson(view), "utf8").digest("hex");
}

export interface TierViews {
  public: any;
  authorized: any;
  owner: any;
  tier_hashes: { public: string; authorized: string; owner: string };
}

export function tierViews(card: any): TierViews {
  if (!card?.id) throw new Error("tierViews: card.id is required");

  // Public view: discovery surface.
  const pubView: any = {
    ...pickMeta(card),
    ...pick(card, ["identity", "voice", "sound", "changelog"]),
    offerings: publicOfferings(card),
    operations: pick(card.operations, PUBLIC_OPERATION_KEYS),
    networks: publicNetworks(card),
  };

  // Authorized view: public + operations surface. The agent is a bound
  // agent and therefore an authorized reader.
  const authView: any = {
    ...pubView,
    ...pick(card, ["policies", "handoff", "knowledge", "infrastructure"]),
    offerings: card.offerings ?? [],
    operations: card.operations ?? {},
    networks: { ...publicNetworks(card), ...authorizedNetworks(card) },
    field_provenance: provenanceSummary(card),
  };

  // Owner view: everything. Full provenance replaces the summary.
  const ownerView: any = {
    ...authView,
    ...pick(card, ["appendix"]),
    field_provenance: card.field_provenance ?? {},
  };

  const tier_hashes = {
    public: viewHash(pubView),
    authorized: viewHash(authView),
    owner: viewHash(ownerView),
  };

  return { public: pubView, authorized: authView, owner: ownerView, tier_hashes };
}

/**
 * Verify a decrypted view against the card's committed tier hash.
 * This is the check §6's decision record requires: it closes the
 * "validly-encrypted wrong plaintext" attack.
 */
export function verifyTierHash(
  tier: TierName,
  view: any,
  expectedHash: string
): boolean {
  return viewHash(view) === expectedHash;
}
