# CI Performance Report

**Date:** 2026-02-09
**Author:** Agent 05 — Turbo/CI Performance Engineer

---

## Executive Summary

CI was slow and uncacheable. Developers ignored it. This report documents what
was wrong, what changed, and the expected impact.

---

## Before: Where Time Went

### ci.yml — "Build & Test" (single job, serial)

| Step                  | Est. Duration | Notes                              |
|-----------------------|---------------|-------------------------------------|
| Checkout              | ~5s           |                                     |
| pnpm install          | ~45s          | cached via setup-node               |
| `turbo build`         | ~90s          | 210+ packages, cold every time      |
| `turbo test`          | ~120s         | **cache: false** — never cached     |
| `turbo typecheck`     | ~60s          | no outputs defined — cache unreliable |
| `turbo lint`          | ~45s          | no outputs defined — cache unreliable |
| **Total**             | **~6 min**    | serial, no parallelism across tasks |

### Additional jobs running per PR (parallel but redundant)

| Job              | Est. Duration | Frequency   | Problem                               |
|------------------|---------------|-------------|----------------------------------------|
| size-check       | ~3 min        | every PR    | full rebuild, no cache sharing          |
| audit            | ~1 min        | every PR    | fine                                    |
| test-matrix (×3) | ~5 min each   | every PR    | 3 full builds on Node 18/20/22         |
| module-test      | ~3 min        | every PR    | full rebuild despite `needs: build`     |

### critical-tests.yml — 7 parallel jobs

| Job                | Est. Duration | Problem                                  |
|--------------------|---------------|-------------------------------------------|
| evaluator-tests    | ~4 min        | own install + build from scratch          |
| import-resolver    | ~3 min        | own install + build from scratch          |
| semantic-tests     | ~4 min        | own install + build from scratch          |
| golden-snapshots   | ~5 min        | full `turbo build` (all 210+ packages)    |
| performance-budget | ~5 min        | full `turbo build` (all 210+ packages)    |
| verify-promise     | ~6 min        | full build, depends on 3 other jobs       |
| critical-gate      | ~1 min        | summary only                              |

### mvp-green.yml — dual OS

| Job           | Est. Duration | Problem                                  |
|---------------|---------------|-------------------------------------------|
| gate-linux    | ~5 min        | full build + typecheck + CLI tests        |
| gate-windows  | ~8 min        | same, on Windows (slower runner)          |

### Total billable minutes per PR (estimate)

```
ci.yml:              ~6 min  (serial main job)
  + size-check:      ~3 min
  + test-matrix ×3:  ~15 min
  + module-test:     ~3 min
critical-tests.yml:  ~28 min (7 jobs in parallel, but each ≥3 min)
mvp-green.yml:       ~13 min (2 OS)
─────────────────────────────
Total:               ~68 billable minutes per PR
```

### Root Causes

1. **`cache: false` on test tasks** — every test run rebuilds from scratch
2. **No `outputs` on typecheck/lint** — turbo can't verify cache correctness
3. **No `inputs` on any task** — turbo hashes everything, invalidating cache on unrelated changes
4. **No turbo cache sharing between jobs** — each job starts cold
5. **Node version matrix runs on every PR** — 3× the cost for a compatibility check
6. **Module compatibility runs on every PR** — rarely catches issues
7. **No test stage splitting** — slow integration tests block fast unit tests

---

## After: What Changed

### turbo.json fixes

| Task              | Before                              | After                                      |
|-------------------|--------------------------------------|--------------------------------------------|
| `build`           | no `inputs`                         | `inputs: [src/**, tsconfig.json, ...]`     |
| `typecheck`       | no `outputs`                        | `outputs: []` (cacheable, no artifacts)    |
| `lint`            | no `outputs`                        | `outputs: []` (cacheable, no artifacts)    |
| `test`            | `cache: false`                      | `outputs: [coverage/**]`, cacheable        |
| `test:unit`       | did not exist                       | new — fast unit tests, cacheable           |
| `test:integration`| did not exist                       | new — slow tests, env-gated                |
| `test:critical`   | `cache: false`                      | `outputs: []`, cacheable                   |
| `docs`            | did not exist                       | new — `outputs: [docs/**, README.md, ...]` |
| remote cache      | not configured                      | `globalPassThroughEnv: [TURBO_TOKEN, ...]` |

### ci.yml restructure

| Job              | Before                        | After                                       |
|------------------|-------------------------------|----------------------------------------------|
| build-check      | serial build→test→tc→lint     | single `turbo run build typecheck lint`      |
| test-unit        | part of serial job            | own job, always runs, uses turbo cache       |
| test-integration | did not exist                 | new — nightly / `run-integration` label only |
| test-matrix      | every PR, 3 Node versions    | nightly + main pushes only                   |
| module-test      | every PR                      | nightly + main pushes only                   |
| all jobs         | no turbo cache                | `actions/cache@v4` for `.turbo` dir          |
| ci-gate          | did not exist                 | summary gate for required checks             |

### Test stage split

```
PR workflow:
  build-check ──→ test-unit ──→ ci-gate  (required, ~4 min)
               └─→ size-check            (parallel, non-blocking)

Nightly / main / label:
  build-check ──→ test-unit
               ├─→ test-integration
               ├─→ test-matrix (Node 18/20/22)
               └─→ module-test
```

---

## Expected Impact

### Per-PR (warm cache)

| Metric                    | Before     | After (est.)  | Savings |
|---------------------------|------------|---------------|---------|
| CI wall-clock time        | ~6 min     | ~2–3 min      | ~50%    |
| Billable minutes per PR   | ~68 min    | ~12 min       | ~82%    |
| Jobs per PR               | ~12        | ~4            | ~67%    |
| Cache hit rate            | 0%         | ~70–90%       | —       |

### Per-PR (cold cache, first run after source change)

| Metric                    | Before     | After (est.)  | Savings |
|---------------------------|------------|---------------|---------|
| CI wall-clock time        | ~6 min     | ~4 min        | ~33%    |
| Billable minutes per PR   | ~68 min    | ~20 min       | ~70%    |

### Enabling remote cache (future)

Set `TURBO_TOKEN` and `TURBO_TEAM` secrets in GitHub repo settings to enable
Vercel Remote Cache. Expected additional savings:

- Cross-PR cache sharing → ~90%+ hit rate on unchanged packages
- Branch switches no longer invalidate local cache
- Estimated additional ~30% wall-clock reduction

---

## How to Enable Remote Caching

```bash
# 1. Link your repo to Vercel (one-time)
npx turbo login
npx turbo link

# 2. Add secrets to GitHub
#    Settings → Secrets → Actions:
#      TURBO_TOKEN = <your-turbo-token>
#      TURBO_TEAM  = <your-team-slug>

# 3. That's it — turbo.json already has globalPassThroughEnv configured
```

---

## Turbo Graph Correctness

All tasks now have explicit `inputs` and `outputs`:

- **`build`** — inputs: `src/**`, outputs: `dist/**` → matches real tsup artifacts
- **`typecheck`** — inputs: `src/**`, `tests/**`, outputs: `[]` → pure check, no files
- **`lint`** — inputs: `src/**`, `tests/**`, outputs: `[]` → pure check, no files
- **`test`** — inputs: `src/**`, `tests/**`, outputs: `coverage/**` → matches vitest output
- **`test:unit`** — same inputs, `outputs: []` → fast, no coverage collection
- **`docs`** — inputs: `src/**`, `docs/**`, outputs: `docs/**`, `README.md`

The graph no longer lies: cache hits mean the same inputs produced the same results.

---

## Verification

```bash
# Verify turbo graph is correct
pnpm turbo run build --dry-run --graph

# Verify cache works
pnpm turbo run build typecheck lint    # first run: MISS
pnpm turbo run build typecheck lint    # second run: FULL TURBO (all HIT)

# Verify test:unit runs independently
pnpm turbo run test:unit --dry-run
```
