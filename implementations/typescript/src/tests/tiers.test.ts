/**
 * business-card/0.2 tier derivation tests. Run: npm test
 *
 * Covers tier-annex-0.2 §2–§6: tier mapping, field-level splits,
 * monotonicity, hash verification, determinism.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("fs");
const { join } = require("path");
const { tierViews, verifyTierHash } = require("../tiers");
export {}; // module scope: avoid const-redeclare collisions with other test scripts
const { canonicalJson } = require("../business-md");

const card = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "..", "conformance", "fixtures", "tiered-card.json"), "utf8")
);

test("three views derive with monotonicity", () => {
  const { public: pub, authorized: auth, owner } = tierViews(card);
  for (const k of Object.keys(pub)) assert.ok(k in auth, `public key ${k} missing in authorized`);
  for (const k of Object.keys(auth)) assert.ok(k in owner, `authorized key ${k} missing in owner`);
  assert.ok(!("policies" in pub) && "policies" in auth);
  assert.ok(!("appendix" in auth) && "appendix" in owner);
  assert.ok(!("infrastructure" in pub) && "infrastructure" in auth);
});

test("operations split: public facts vs internal ops", () => {
  const { public: pub, authorized: auth } = tierViews(card);
  assert.deepEqual(Object.keys(pub.operations).sort(), [
    "catering_lead_time", "channels", "delivery_fence", "hours",
  ]);
  assert.ok("requires_human_confirm" in auth.operations);
  assert.ok("systems" in auth.operations);
});

test("offerings: null price stays null, authorized visibility excluded from public", () => {
  const { public: pub, authorized: auth } = tierViews(card);
  assert.equal(pub.offerings.length, 2);
  assert.equal(auth.offerings.length, 3);
  const pie = pub.offerings.find((o: any) => o.name === "Mystery pie");
  assert.equal(pie.price, null);
  assert.ok(!pub.offerings.some((o: any) => o.name === "Catering quote"));
});

test("provenance: summary authorized, full trace owner", () => {
  const { public: pub, authorized: auth, owner } = tierViews(card);
  assert.ok(!("field_provenance" in pub));
  assert.deepEqual(Object.keys(auth.field_provenance["identity.name"]).sort(), [
    "confidence", "extractor_agent", "sources",
  ]);
  assert.ok("extracted_at" in owner.field_provenance["identity.name"]);
});

test("networks.voice is public, no private keys anywhere", () => {
  const { public: pub } = tierViews(card);
  assert.equal(pub.networks.voice.protocol, "meshenger");
  assert.ok(!JSON.stringify(tierViews(card)).includes("private_key"));
});

test("tier_hashes verify and are self-consistent", () => {
  const { tier_hashes, public: pub, authorized: auth, owner } = tierViews(card);
  assert.ok(verifyTierHash("public", pub, tier_hashes.public));
  assert.ok(verifyTierHash("authorized", auth, tier_hashes.authorized));
  assert.ok(verifyTierHash("owner", owner, tier_hashes.owner));
  assert.ok(!verifyTierHash("public", auth, tier_hashes.public));
});

test("deterministic: same card, byte-identical views", () => {
  const a = tierViews(card);
  const b = tierViews(JSON.parse(JSON.stringify(card)));
  for (const t of ["public", "authorized", "owner"]) {
    assert.equal(canonicalJson(a[t]), canonicalJson(b[t]));
    assert.equal(a.tier_hashes[t], b.tier_hashes[t]);
  }
});

test("missing id throws", () => {
  assert.throws(() => tierViews({}), /card\.id is required/);
});
