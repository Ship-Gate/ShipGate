# ISL Parser Fuzzing

## Overview

The ISL parser includes comprehensive fuzzing infrastructure to harden against malicious inputs, ensuring:
- **No hangs**: Timeout protection prevents infinite loops
- **No OOM**: Size limits prevent out-of-memory conditions
- **Graceful errors**: All inputs are handled without crashes

## Architecture

### Components

1. **Fuzz Harness** (`src/fuzz-harness.ts`)
   - Wraps parser with timeout and size checks
   - Detects crashes, hangs, and limit violations
   - Generates detailed reports

2. **Parser Limits** (`src/parser-limits.ts`)
   - Enforces maximum file size, token count, parse depth
   - Configurable limits for different use cases
   - Throws `ParserLimitError` when exceeded

3. **Seed Corpus** (`src/build-corpus.ts`)
   - Collects real `.isl` files from codebase
   - Provides diverse, realistic test inputs
   - Supports corpus persistence and loading

## Performance Guards

### Default Limits

```typescript
{
  maxFileSize: 1MB,           // Maximum input file size
  maxTokens: 100,000,          // Maximum token count
  maxDepth: 1,000,            // Maximum parse recursion depth
  timeoutMs: 5,000,           // Per-parse timeout
  maxStringLength: 100,000,   // Maximum string literal length
  maxIdentifierLength: 10,000 // Maximum identifier length
}
```

### Fuzzing Limits (Stricter)

```typescript
{
  maxFileSize: 1MB,
  maxTokens: 100,000,
  maxDepth: 1,000,
  timeoutMs: 5,000,
  maxStringLength: 100,000,
  maxIdentifierLength: 10,000
}
```

## Usage

### Running Fuzz Tests

```bash
# Quick smoke test (10k iterations)
pnpm --filter @isl-lang/parser test:fuzz:smoke

# Full fuzz test
pnpm --filter @isl-lang/parser test:fuzz
```

### Building Seed Corpus

```bash
pnpm --filter @isl-lang/parser corpus:build
```

This scans the repository for `.isl` files and creates `fuzz-corpus.json`.

### Programmatic Usage

```typescript
import { fuzzParse, batchFuzzParse, generateFuzzReport } from '@isl-lang/parser';

// Fuzz a single input
const result = await fuzzParse(input);
console.log(result.completed, result.timedOut, result.exceededLimits);

// Batch fuzzing
const results = await batchFuzzParse(inputs);
const report = generateFuzzReport(results);
console.log(`Crashes: ${report.crashes.length}, Hangs: ${report.hangs.length}`);
```

## CI Integration

### Smoke Test (Every PR)
- Runs on every push/PR
- 10k iterations
- 10 minute timeout
- Fast feedback

### Full Test (Nightly)
- Runs nightly at 04:00 UTC
- 100k iterations
- 60 minute timeout
- Comprehensive coverage

## Acceptance Criteria

The fuzzer must pass these criteria:

1. **No Crashes**: All inputs handled without uncaught exceptions
2. **No Hangs**: All inputs complete or timeout within limits
3. **Graceful Rejection**: Pathological inputs rejected with clear errors
4. **10k Iterations**: Smoke test completes 10k iterations successfully

## Test Strategy

### Input Categories

1. **Valid Inputs**: Real ISL specifications from corpus
2. **Edge Cases**: Empty files, minimal syntax, deep nesting
3. **Malicious Inputs**: 
   - Extremely long strings/identifiers
   - Deep nesting attacks
   - Null bytes and control characters
   - Injection attempts
   - Pathological whitespace

### Mutation Strategy

- Random mutations of valid inputs
- Boundary value testing
- Structure-preserving mutations
- Coverage-guided fuzzing

## Reporting

Fuzz reports include:
- Total iterations
- Completed vs timed out vs exceeded limits
- Crash details (input, error, stack)
- Hang details (input, duration)
- Limit violations

## Limits Documentation

### Why These Limits?

- **maxFileSize (1MB)**: Prevents memory exhaustion from huge inputs
- **maxTokens (100k)**: Prevents excessive tokenization overhead
- **maxDepth (1k)**: Prevents stack overflow from deep recursion
- **timeoutMs (5s)**: Prevents hangs from infinite loops
- **maxStringLength (100k)**: Prevents memory issues from huge strings
- **maxIdentifierLength (10k)**: Prevents pathological identifier parsing

### Adjusting Limits

Limits can be adjusted per-use-case:

```typescript
import { DEFAULT_FUZZ_LIMITS } from '@isl-lang/parser';

const customLimits = {
  ...DEFAULT_FUZZ_LIMITS,
  maxFileSize: 10 * 1024 * 1024, // 10MB for trusted inputs
  timeoutMs: 30000, // 30s for complex files
};
```

## Security Considerations

The fuzzer specifically tests for:
- **DoS attacks**: Huge inputs causing OOM
- **Hang attacks**: Infinite loops or excessive recursion
- **Injection attacks**: Malicious code in strings
- **Parser bugs**: Edge cases causing crashes

All findings are documented and fixed before release.
