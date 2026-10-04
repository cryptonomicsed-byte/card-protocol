"""card.tier_views — business-card/0.2 tier derivation.

Python mirror of implementations/typescript/src/tiers.ts. The canonical
JSON of each view MUST be byte-identical across implementations (exit
proof for the 0.2 tier annex).
"""
from __future__ import annotations

import hashlib

from canonical import canonical_json

PUBLIC_OPERATION_KEYS = (
    "hours",
    "channels",
    "delivery_fence",
    "catering_lead_time",
)

META_KEYS = (
    "id",
    "version",
    "status",
    "created_at",
    "previous_version",
    "previous_hash",
    "organization_id",
    "hash",
    "acting_hash",
)


def _pick(obj, keys):
    out = {}
    if not isinstance(obj, dict):
        return out
    for k in keys:
        # Mirror TS `!== undefined`: an explicit null/None is kept, a
        # missing key is dropped. canonical_json prunes empties but keeps
        # nulls on both sides.
        if k in obj:
            out[k] = obj[k]
    return out


def _public_offerings(card):
    return [o for o in card.get("offerings", []) or []
            if isinstance(o, dict) and o.get("visibility") != "authorized"]


def _networks_by_visibility(card, want_authorized: bool):
    out = {}
    for k, v in (card.get("networks") or {}).items():
        if not isinstance(v, dict):
            continue
        is_auth = v.get("visibility") == "authorized"
        if is_auth == want_authorized:
            out[k] = v
    return out


def _provenance_summary(card):
    out = {}
    for field, rec in (card.get("field_provenance") or {}).items():
        if not isinstance(rec, dict):
            continue
        out[field] = {
            "sources": rec.get("sources"),
            "confidence": rec.get("confidence"),
            "extractor_agent": rec.get("extractor_agent"),
        }
    return out


def _view_hash(view) -> str:
    return hashlib.sha256(canonical_json(view).encode()).hexdigest()


def tier_views(card: dict) -> dict:
    if not card.get("id"):
        raise ValueError("tier_views: card.id is required")

    public = {
        **_pick(card, META_KEYS),
        **_pick(card, ("identity", "voice", "sound", "changelog")),
        "offerings": _public_offerings(card),
        "operations": _pick(card.get("operations"), PUBLIC_OPERATION_KEYS),
        "networks": _networks_by_visibility(card, False),
    }

    authorized = {
        **public,
        **_pick(card, ("policies", "handoff", "knowledge", "infrastructure")),
        "offerings": card.get("offerings") or [],
        "operations": card.get("operations") or {},
        "networks": {**_networks_by_visibility(card, False),
                      **_networks_by_visibility(card, True)},
        "field_provenance": _provenance_summary(card),
    }

    owner = {
        **authorized,
        **_pick(card, ("appendix",)),
        "field_provenance": card.get("field_provenance") or {},
    }

    return {
        "public": public,
        "authorized": authorized,
        "owner": owner,
        "tier_hashes": {
            "public": _view_hash(public),
            "authorized": _view_hash(authorized),
            "owner": _view_hash(owner),
        },
    }


def verify_tier_hash(view: dict, expected_hash: str) -> bool:
    return _view_hash(view) == expected_hash
