# Gate Calibration Summary

## Overview

This corpus provides a benchmark suite for calibrating gate scoring thresholds with measurable false positive/negative rates.

## Structure

```
bench/corpus/
├── README.md              # Overview
├── EXTENDING.md           # How to add fixtures
├── runner.ts              # Benchmark runner
├── generate-fixtures.ts   # Fixture generator
├── package.json           # Scripts
├── good/                  # 50+ good implementations (should SHIP)
│   └── {fixture-id}/
│       ├── spec.isl
│       ├── impl.ts
│       └── metadata.json
└── bad/                   # 50+ bad implementations (should NO_SHIP)
    └── {fixture-id}/
        ├── spec.isl
        ├── impl.ts
        └── metadata.json
```

## Usage

### Generate Fixtures

```bash
npx tsx bench/corpus/generate-fixtures.ts
```

### Run Benchmark

```bash
# Basic run
npx tsx bench/corpus/runner.ts

# With verbose output
npx tsx bench/corpus/runner.ts --verbose

# JSON output
npx tsx bench/corpus/runner.ts --json

# Auto-tune thresholds
npx tsx bench/corpus/runner.ts --tune
```

### CI Integration

The benchmark runs automatically in CI (`.github/workflows/gate-calibration.yml`) and:
- Fails if false positive rate > 5%
- Fails if false negative rate > 10%
- Uploads results as artifacts
- Comments on PRs with metrics

## Metrics

The benchmark outputs:

1. **Confusion Matrix**
   - True Positives (bad → NO_SHIP)
   - True Negatives (good → SHIP)
   - False Positives (good → NO_SHIP)
   - False Negatives (bad → SHIP)

2. **Overall Metrics**
   - Accuracy
   - Precision
   - Recall
   - F1 Score

3. **Per-Rule Metrics**
   - Detection rate per rule
   - False alarm rate
   - Precision/recall per rule

4. **Top Violations**
   - Top false positives (good code incorrectly flagged)
   - Top false negatives (bad code missed)

## Targets

- **False Positive Rate**: < 5% (good code should pass)
- **False Negative Rate**: < 10% (bad code should be caught)

## Threshold Tuning

The `--tune` flag automatically tests thresholds from 50-95 and recommends the best threshold to hit targets.

Current default threshold: **70**

## Extending

See [EXTENDING.md](./EXTENDING.md) for guidelines on adding new fixtures.

## Acceptance Criteria

✅ Benchmark harness implemented
✅ Corpus fixtures (50+ good, 50+ bad)
✅ Confusion matrix and metrics
✅ Per-rule precision/recall
✅ Top false positive/negative analysis
✅ Threshold tuning capability
✅ CI regression test
✅ Documentation
