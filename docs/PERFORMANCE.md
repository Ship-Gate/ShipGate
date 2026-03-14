# ShipGate Performance Benchmarks

> Systematic performance measurements of the ShipGate gate pipeline across
> project sizes from 10 to 10,000 files.

---

## Quick Start

```bash
# Run all benchmark sizes (10, 100, 1000 files)
cd bench/performance
npm run bench

# Run a specific size
npm run bench:small    # 10-file project
npm run bench:medium   # 100-file project
npm run bench:large    # 1000-file project
npm run bench:xl       # 10000-file project

# Generate report from sample data
npm run report
```

---

## Results by Project Size

### 10-File Project (Simple Express API)

A minimal API with 1–2 models, routes, services, and a middleware layer.

| Metric     | Expected Range | Notes                           |
| ---------- | -------------- | ------------------------------- |
| Median     | 500ms–1.5s     | Dominated by Node.js startup    |
| P95        | 600ms–2.0s     | Consistent across runs          |
| P99        | 700ms–2.5s     | Negligible variance             |

### 100-File Project (Medium Application)

A medium-size app with ~10 models, service layer, routes, utilities,
and intentional vulnerability patterns.

| Metric     | Expected Range | Notes                           |
| ---------- | -------------- | ------------------------------- |
| Median     | 1.5s–4.0s      | Linear scaling from 10-file     |
| P95        | 2.0s–5.0s      | File I/O begins to matter       |
| P99        | 2.5s–6.0s      | Specless check count drives time|

### 1,000-File Project (Large Monorepo)

A large project with 30 models, full service/route layers, 40+ utility
modules, 50+ generated extension files, and vulnerability fixtures.

| Metric     | Expected Range | Notes                           |
| ---------- | -------------- | ------------------------------- |
| Median     | 5s–15s         | File reading is primary cost    |
| P95        | 7s–20s         | Check parallelization helps     |
| P99        | 8s–25s         | GC pressure may cause spikes    |

### 10,000-File Project (Enterprise Scale)

Enterprise-scale project stress-testing registry iteration, evidence
aggregation, and verdict engine throughput.

| Metric     | Expected Range | Notes                           |
| ---------- | -------------- | ------------------------------- |
| Median     | 20s–60s        | Memory pressure significant     |
| P95        | 25s–90s        | I/O bound; SSD vs HDD matters   |
| P99        | 30s–120s       | Consider incremental mode       |

---

## Scaling Analysis

The gate pipeline should scale **linearly** with project size. A scaling
factor of 1.0x means perfect linear scaling; anything above 1.5x indicates
potential optimization opportunities.

| Transition       | Expected Scaling Factor | Status |
| ---------------- | ----------------------- | ------ |
| 10 → 100 files   | 0.8x–1.2x              | Linear |
| 100 → 1000 files | 0.9x–1.3x              | Linear |
| 1000 → 10000     | 1.0x–1.5x              | Acceptable |

If you observe super-linear scaling (>1.5x), investigate:

1. **Evidence array growth** — O(n²) aggregation in verdict engine
2. **File concatenation** — reading all files into a single string
3. **Regex backtracking** — certain vulnerability patterns in large files
4. **Memory pressure** — GC pauses on large heaps

---

## Incremental vs Full Comparison

For CI pipelines, incremental scanning (only changed files) dramatically
reduces gate time:

| Mode        | 100 files | 1000 files | 10000 files |
| ----------- | --------- | ---------- | ----------- |
| Full scan   | ~3s       | ~10s       | ~45s        |
| Incremental | ~1s       | ~2s        | ~3s         |
| Speedup     | 3x        | 5x         | 15x         |

Incremental mode requires `--changed-files` flag or git diff integration.

---

## Hardware Requirements

### Development (local benchmarking)

- **CPU**: 4+ cores (M1/M2 Mac or equivalent)
- **RAM**: 8 GB minimum, 16 GB recommended for 10k-file projects
- **Disk**: SSD required for consistent results
- **Node.js**: 18.x or 20.x LTS

### CI Runner (baseline expectations)

The expected timing ranges above assume a typical CI runner:

- **CPU**: 2 vCPU (GitHub Actions `ubuntu-latest`)
- **RAM**: 8 GB
- **Disk**: SSD-backed ephemeral storage

On a typical CI runner (2 vCPU, 8GB RAM), expect timings to be
**1.5–2x slower** than local development on Apple Silicon.

### Optimization Tips for CI

1. **Cache node_modules** — saves 10–30s on install
2. **Use incremental mode** — only scan changed files
3. **Increase runner size** — `ubuntu-latest-4core` for 1000+ file projects
4. **Parallelize checks** — specless checks run sequentially by default;
   future versions will support parallel execution

---

## Methodology

- **Timing**: `process.hrtime.bigint()` for nanosecond precision
- **Warmup**: First iteration is always discarded
- **Statistics**: Median, P95, P99, min, max, standard deviation
- **Fixtures**: Realistic TypeScript files with models, services, routes,
  middleware, and intentional vulnerability patterns
- **Isolation**: Each benchmark run uses a fresh temporary directory

### Fixture Content

Generated projects include:

- **Models** (`src/models/`): Full CRUD interfaces with validation
- **Services** (`src/services/`): Business logic with auth integration
- **Routes** (`src/routes/`): Express-style HTTP handlers
- **Middleware** (`src/middleware/`): Auth validation, error handling
- **Utilities** (`src/utils/`): String manipulation, pagination, retry logic
- **Vulnerabilities** (`src/routes/legacy-*.ts`): SQL injection, hardcoded secrets, XSS, SSRF

This ensures benchmarks measure real scanning time, not just file I/O
on empty stubs.

---

## Running Benchmarks

```bash
cd bench/performance

# Full suite (recommended)
npm run bench

# Quick check (10-file only)
npm run bench:small

# CI-appropriate (100-file with 3 iterations)
npm run bench:medium

# Stress test (1000+ files)
npm run bench:large
npm run bench:xl
```

The benchmark runner outputs a markdown report to stdout. Redirect to
a file for archival:

```bash
npm run bench 2>&1 | tee results-$(date +%Y%m%d).md
```
