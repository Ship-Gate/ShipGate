# Gate Calibration Corpus

This corpus contains implementations for benchmarking and calibrating gate scoring thresholds.

## Structure

- `good/` - 50+ implementations that should pass gate (SHIP)
- `bad/` - 50+ implementations with known violations that should fail gate (NO_SHIP)

Each fixture contains:
- `spec.isl` - ISL specification
- `impl.ts` - Implementation file
- `metadata.json` - Expected verdict and known violations

## Usage

Run the benchmark:

```bash
npx tsx bench/corpus/runner.ts
```

## Extending the Corpus

See [EXTENDING.md](./EXTENDING.md) for guidelines on adding new fixtures.
