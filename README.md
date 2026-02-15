# ShipGate

**ShipGate verifies implementation against ISL specs and produces tamper-proof evidence bundles for every decision.**

## What It Proves

- **Spec compliance** — Implementation satisfies preconditions, postconditions, and invariants defined in your ISL spec
- **Security & policy** — Auth bypass, hardcoded secrets, PII in logs, ghost routes/imports, and 25+ policy rules
- **One verdict** — SHIP or NO_SHIP, with evidence you can audit and attach to PRs

---

## 60-Second Quickstart

```bash
# Clone and install
git clone https://github.com/guardiavault-oss/ISL-LANG.git
cd ISL-LANG
pnpm install
pnpm --filter shipgate build

# Initialize (creates .shipgate.yml, specs, CI workflow)
pnpm exec shipgate init

# Verify implementation against specs
pnpm exec shipgate verify src/

# Gate: SHIP/NO_SHIP (exit 0 = SHIP, 1 = NO_SHIP) — use your spec path
pnpm exec shipgate gate specs/auth.isl -i src/ --ci
```

**From another project** (with ShipGate published):

```bash
npm install -g shipgate
shipgate init
shipgate verify src/
shipgate gate specs/auth.isl -i src/ --ci
```

---

## Files ShipGate Creates

| File / Directory | Purpose |
|------------------|---------|
| `.shipgate.yml` | Config: CI behavior, ignore patterns, specless mode |
| `.shipgate/specs/` | ISL specs (from `shipgate init` or hand-written) |
| `.shipgate/evidence/` | Evidence bundles and reports per run |
| `.shipgate/truthpack/` | Routes, env vars, contracts (for firewall) |
| `.github/workflows/shipgate.yml` | CI workflow (from init) |

---

## Verify vs Gate

| Command | What it does |
|---------|--------------|
| **`shipgate verify`** | Runs full verification: parses spec, generates tests, checks implementation. Outputs detailed results and evidence. Use for debugging and local checks. |
| **`shipgate gate`** | Single SHIP/NO_SHIP decision. Uses verify + firewall. Exit 0 = SHIP, 1 = NO_SHIP. Use in CI to block merges. Add `--ci` for CI mode. |

---

## Links

- [Quickstart](docs/QUICKSTART.md) — 5-minute setup
- [ShipGate without specs](docs/guides/shipgate-without-specs.md) — Firewall-only (no ISL)
- [CI setup](docs/SHIPGATE_CI_SETUP.md) — GitHub Actions and other CI
- [Demo: repo-isl-verified](demos/repo-isl-verified) — Example with ISL spec + workflow
