#!/usr/bin/env python3
"""0.2 tier annex exit proof: TS and Python produce byte-identical tier views.

Builds the TypeScript package, derives tier views in both implementations
from conformance/fixtures/tiered-card.json, and compares the canonical
bytes of each view plus the tier hashes. Exit non-zero on any mismatch.
"""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TS = ROOT / "implementations" / "typescript"
PY = ROOT / "implementations" / "python"
FIXTURE = ROOT / "conformance" / "fixtures" / "tiered-card.json"

TIERS = ("public", "authorized", "owner")


def main() -> int:
    subprocess.run(["npm", "run", "build"], cwd=TS, check=True,
                   capture_output=True)
    node_js = (
        "const { tierViews } = require('./dist/tiers.js');"
        "const { canonicalJson } = require('./dist/business-md.js');"
        f"const card = require('{FIXTURE}');"
        "const out = tierViews(card);"
        "for (const t of ['public','authorized','owner']) {"
        "  require('fs').writeFileSync('/tmp/ts_tier_'+t+'.json', canonicalJson(out[t]));"
        "}"
        "console.log(JSON.stringify(out.tier_hashes));"
    )
    r = subprocess.run(["node", "-e", node_js], cwd=TS, check=True,
                       capture_output=True, text=True)
    ts_hashes = json.loads(r.stdout)

    sys.path.insert(0, str(PY))
    from tiers import tier_views  # noqa: E402
    from canonical import canonical_json  # noqa: E402

    card = json.loads(FIXTURE.read_text())
    py = tier_views(card)

    ok = True
    for t in TIERS:
        ts_bytes = Path(f"/tmp/ts_tier_{t}.json").read_text()
        py_bytes = canonical_json(py[t])
        same = ts_bytes == py_bytes
        h = hashlib.sha256(py_bytes.encode()).hexdigest()
        hash_ok = h == py["tier_hashes"][t] == ts_hashes[t]
        print(f"{t:10s} byte-identical={same} tier_hash_consistent={hash_ok}")
        ok = ok and same and hash_ok
    print("TIER PARITY:", "PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
