# ISL Verify Benchmark — AI-Generated Code Analysis

This benchmark proves ISL Verify's value by comparing it against industry-standard tools (ESLint, TypeScript, Semgrep) on real AI-generated projects.

## Methodology

### Test Projects (10 total)

Each project is:
1. **Generated using an AI tool** (Cursor, Copilot, Claude, v0) with documented prompts
2. **Manually audited** to establish ground truth for all real issues
3. **Enhanced with planted issues** (5 per category) to test detection breadth

### Ground Truth Categories

- **Hallucination**: Non-existent APIs, phantom packages, made-up functions
- **Security**: Missing auth, unvalidated input, secret exposure, SQL injection
- **Quality**: Dead code, type errors, unreachable code, placeholder stubs
- **Dead Code**: Unused imports, unreferenced functions, orphaned files
- **Type Errors**: Any/unknown abuse, missing types, type mismatches

### Competing Tools

1. **ISL Verify** (Tier 1 pipeline)
2. **ESLint** (recommended config)
3. **TypeScript** (strict mode, `tsc --noEmit --strict`)
4. **Semgrep** (auto config)

### Metrics

- **Precision**: True positives / (True positives + False positives)
- **Recall**: True positives / (True positives + False negatives)
- **F1 Score**: Harmonic mean of precision and recall
- **Unique Catches**: Issues found ONLY by ISL Verify

## Running the Benchmark

```bash
# Full benchmark (all 10 projects, all 4 tools)
npm run benchmark

# Single project
npm run benchmark -- --project p1-nextjs-todo

# Specific tool comparison
npm run benchmark -- --tools isl-verify,eslint

# Generate report only (no re-run)
npm run benchmark:report
```

## Directory Structure

```
bench/ai-verify-benchmark/
├── projects/              # 10 test projects
│   ├── p1-nextjs-todo/
│   │   ├── src/          # AI-generated code
│   │   ├── ground-truth.json
│   │   └── generation-metadata.json
│   ├── p2-express-api/
│   └── ...
├── tools/                # Tool runners
│   ├── run-isl-verify.ts
│   ├── run-eslint.ts
│   ├── run-tsc.ts
│   └── run-semgrep.ts
├── matcher/              # Finding → ground truth matcher
├── metrics/              # Precision/recall calculator
├── reporter/             # Markdown report generator
├── runner.ts             # Main benchmark orchestrator
└── types.ts
```

## Results

See `BENCHMARK_RESULTS.md` for latest run.

## Reproducibility

All projects are committed with:
- Exact AI tool version
- Full prompt used
- Generation timestamp
- Manually verified ground truth

Re-running `npm run benchmark` will produce identical metrics (tool versions may vary).
