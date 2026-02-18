# Next Steps to Complete the Benchmark

## Current Status

✅ **Complete Infrastructure** (All core systems built)
- Type definitions
- 4 tool runners (ISL Verify, ESLint, tsc, Semgrep)
- Matcher with fuzzy matching
- Metrics calculator (precision, recall, F1, unique catches)
- Report generator
- Main orchestrator with CLI

✅ **P1 Project Complete**
- 11 source files with intentional issues
- 15 documented issues (6 natural + 9 planted)
- Ground truth JSON verified
- All 5 categories represented

🔄 **Remaining Work**
- Generate 9 more projects (P2-P10)
- Run full benchmark
- Generate final report

## Immediate Action Items

### Option A: Quick Validation (Recommended First Step)

Test the benchmark with P1 to ensure everything works:

```bash
cd bench/ai-verify-benchmark
npm install

# Test on P1 only
npm run benchmark -- --project p1-nextjs-todo --verbose
```

Expected output:
- ISL Verify findings from P1
- ESLint findings from P1
- TSC findings from P1
- Semgrep findings from P1
- Matched results with TP/FP/FN counts
- Report saved to BENCHMARK_RESULTS.md

### Option B: Complete All 10 Projects

Follow `PROJECT_GENERATION_GUIDE.md` for each project:

#### P2: Express REST API
```bash
# Use GitHub Copilot Chat
# Prompt: "Create an Express.js REST API for a blog platform..."
# Then manual audit + plant issues
```

#### P3-P10: Similar Process
1. Generate with documented AI tool + prompt
2. Run all 4 tools manually
3. Document findings in ground-truth.json
4. Plant 5 additional issues per category
5. Verify line numbers

### Option C: Generate Synthetic Ground Truth

For faster validation, create smaller synthetic projects:

```typescript
// Create minimal test files with known issues
// Skip full AI generation for now
// Focus on proving the benchmark infrastructure works
```

## Testing Checklist

Before running full benchmark:

- [ ] P1 compiles with tsc
- [ ] P1 has valid package.json
- [ ] ESLint config exists (.eslintrc.json)
- [ ] Ground truth line numbers are accurate
- [ ] At least one issue per category exists
- [ ] Runner executes without errors
- [ ] Matcher produces sensible results
- [ ] Report generates valid markdown

## Quick Start Commands

```bash
# Install dependencies
cd bench/ai-verify-benchmark
npm install

# Run single project test
npm run benchmark -- --project p1-nextjs-todo

# Run with verbose output
npm run benchmark -- --project p1-nextjs-todo --verbose

# Run specific tools only
npm run benchmark -- --project p1-nextjs-todo --tools isl-verify,eslint

# Generate report from existing results (if cached)
npm run benchmark:report
```

## Expected Timeline

### Fast Track (Testing Infrastructure)
- P1 validation: 30 minutes
- Fix any bugs: 1-2 hours
- Generate synthetic P2-P3: 1 hour
- Run benchmark on 3 projects: 30 minutes
- **Total: 4-5 hours**

### Full Implementation
- Generate 9 projects: 4-6 hours
- Manual audits: 8-10 hours
- Plant issues: 4-6 hours
- Validation: 2-3 hours
- **Total: 18-25 hours**

## Success Metrics

After running benchmark, validate:

1. **ISL Verify recall > 60%** - Finding most real issues
2. **ISL Verify precision > 75%** - Low false positive rate
3. **Unique catches ≥ 10%** - ISL finds issues others miss
4. **F1 score > competitors** - Best overall performance

## Troubleshooting

### If ISL Verify returns no results:
- Check CLI path in `tools/run-isl-verify.ts`
- Ensure ISL Verify is built (`pnpm build` in project root)
- Run manually: `node packages/cli/dist/cli.cjs verify bench/ai-verify-benchmark/projects/p1-nextjs-todo`

### If matching produces no TPs:
- Verify ground truth file paths are relative
- Check line numbers are accurate (±5 tolerance exists)
- Review matcher scoring threshold in `matcher/match-findings.ts`

### If TypeScript fails:
- Ensure project has valid tsconfig.json
- Check `@/*` path alias is configured
- Verify all imports can resolve

## Files to Review

Before running benchmark, review these files:

1. `projects/p1-nextjs-todo/ground-truth.json` - Accurate line numbers?
2. `tools/run-isl-verify.ts` - Correct CLI path?
3. `runner.ts` - Project paths correct?
4. `matcher/match-findings.ts` - Matching threshold reasonable?

## Recommended Next Step

**Start with P1 validation:**

```bash
cd bench/ai-verify-benchmark
npm install
npm run benchmark -- --project p1-nextjs-todo --verbose
```

Review the output and fix any issues before proceeding to generate more projects.
