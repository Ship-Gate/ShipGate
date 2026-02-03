# @isl-lang/isl-smt

SMT (Satisfiability Modulo Theories) solver integration for ISL verification.

## Features

- **Real SMT Solving**: Integration with Z3 and CVC5 solvers
- **Built-in Solver**: Bounded solver for simple cases without external dependencies
- **Cross-Platform**: Automatic solver detection on Windows, Linux, and macOS
- **Strict Timeouts**: No hanging processes - every solve has a hard timeout with process kill
- **Deterministic**: Same query always produces same result (via caching)
- **Proof Bundles**: Solver evidence attached to verification results

## Installation

```bash
npm install @isl-lang/isl-smt
```

For real SMT solving (recommended for production), install Z3:

```bash
# macOS
brew install z3

# Ubuntu/Debian
apt-get install z3

# Windows (with chocolatey)
choco install z3

# Or download from: https://github.com/Z3Prover/z3/releases
```

## Quick Start

```typescript
import { solve, Expr, Sort } from '@isl-lang/isl-smt';

// Check if x > 0 AND x < 10 is satisfiable
const result = await solve(
  Expr.and(
    Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
    Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
  ),
  { timeout: 5000 }
);

if (result.verdict === 'disproved') {
  console.log('Satisfiable with model:', result.model);
  // { x: 5 } (or any value 1-9)
}
```

## Solver Modes

### Builtin Solver (Default)

The builtin solver handles common cases without requiring external solvers:

```typescript
import { solve } from '@isl-lang/isl-smt';

const result = await solve(formula, {
  solver: 'builtin', // default
  timeout: 5000,
});
```

**Capabilities:**
- Boolean SAT solving (up to ~20 variables)
- Linear integer arithmetic (bounded)
- Simple constraint analysis

**Use when:**
- Quick verification without Z3 installation
- Development and testing
- Simple constraints

### Z3 Solver (Recommended for Production)

Full SMT solving with Z3:

```typescript
import { solve, isZ3Available } from '@isl-lang/isl-smt';

if (await isZ3Available()) {
  const result = await solve(formula, {
    solver: 'z3',
    timeout: 10000,
  });
}
```

**Capabilities:**
- All SMT-LIB 2 theories
- Unlimited variable count
- Quantifier support
- Model generation

### CVC5 Solver

Alternative solver with CVC5:

```typescript
import { solve, isCVC5Available } from '@isl-lang/isl-smt';

if (await isCVC5Available()) {
  const result = await solve(formula, {
    solver: 'cvc5',
    timeout: 10000,
  });
}
```

### Auto-Detection

Let the library choose the best available solver:

```typescript
import { getSolverAvailability, solve } from '@isl-lang/isl-smt';

const availability = await getSolverAvailability();
console.log('Best available:', availability.bestAvailable);
// 'z3', 'cvc5', or 'builtin'
```

## Supported Theories

| Theory | Builtin | Z3 | CVC5 |
|--------|---------|-----|------|
| Booleans | Yes | Yes | Yes |
| Integers (bounded) | Yes | Yes | Yes |
| Integers (unbounded) | No | Yes | Yes |
| Reals | Limited | Yes | Yes |
| Strings | No | Yes | Yes |
| Arrays | No | Yes | Yes |
| Bitvectors | No | Yes | Yes |
| Quantifiers | No | Yes | Yes |

### Supported Operations

**Boolean:**
- `and`, `or`, `not`, `implies`, `iff`

**Arithmetic:**
- `+`, `-`, `*`, `div`, `mod`
- `=`, `!=`, `<`, `<=`, `>`, `>=`
- `abs`, `min`, `max`

**Quantifiers (Z3/CVC5 only):**
- `forall`, `exists`

**Arrays (Z3/CVC5 only):**
- `select`, `store`

## Timeout Handling

Every solve operation has a hard timeout to prevent hanging:

```typescript
const result = await solve(formula, { timeout: 5000 }); // 5 seconds

// Result can be:
// - { verdict: 'proved' }           // Formula is valid
// - { verdict: 'disproved', model } // Found counterexample
// - { verdict: 'unknown', reason }  // Could not determine (timeout, etc.)
```

**Guarantees:**
- Process killed if timeout exceeded
- No memory leaks from zombie processes
- Output truncated if too large (1MB default)

## Proof Bundles

For formal verification, attach solver evidence to results:

```typescript
import { verifyFormal } from '@isl-lang/isl-smt';

const { batchResult, proofBundle } = await verifyFormal(domain, {
  solver: 'z3',
  timeout: 10000,
  generateEvidence: true,
});

// Each entry has solver evidence
for (const entry of proofBundle) {
  console.log(`${entry.name}: ${entry.verdict}`);
  if (entry.solverEvidence) {
    console.log(`  Solver: ${entry.solverEvidence.solver}`);
    console.log(`  Status: ${entry.solverEvidence.status}`);
    console.log(`  Duration: ${entry.solverEvidence.durationMs}ms`);
    console.log(`  Query hash: ${entry.solverEvidence.queryHash}`);
  }
}
```

### Proof Bundle Entry Format

```typescript
interface ProofBundleEntry {
  id: string;                    // Unique identifier
  kind: 'precondition_satisfiability' | 'postcondition_implication' | 'refinement_constraint';
  name: string;                  // Name of verified item
  expression: string;            // SMT-LIB expression
  verdict: 'proved' | 'disproved' | 'unknown';
  verdictSource: 'runtime_only' | 'solver_only' | 'runtime_then_solver';
  
  // Solver evidence (if generateEvidence: true)
  solverEvidence?: {
    queryHash: string;           // SHA-256 hash for reproducibility
    solver: 'builtin' | 'z3' | 'cvc5';
    status: 'sat' | 'unsat' | 'unknown' | 'timeout' | 'error';
    model?: Record<string, unknown>;
    reason?: string;
    durationMs: number;
    smtLibQuery?: string;        // Raw SMT-LIB for debugging
    timestamp: string;
  };
}
```

## Resolving Unknown Results

When runtime verification returns "unknown", use SMT to resolve:

```typescript
import { resolveUnknown } from '@isl-lang/isl-smt';

// In your verifier, when you get an unknown result:
if (result.triState === 'unknown') {
  const resolution = await resolveUnknown(
    clause.expression,
    clause.inputValues,
    { solver: 'z3', timeout: 5000 }
  );
  
  if (resolution.resolved?.verdict === 'proved') {
    result.triState = true;
    result.reason = 'Proved by SMT solver';
  }
  
  // Attach evidence to proof bundle
  if (resolution.evidence) {
    proofBundle.solverEvidence = resolution.evidence;
  }
}
```

## Caching

Results are cached by query hash for determinism:

```typescript
import { getGlobalCache, resetGlobalCache } from '@isl-lang/isl-smt';

// Get cache statistics
const stats = getGlobalCache().getStats();
console.log('Cache hit rate:', stats.hitRate);

// Clear cache if needed
resetGlobalCache();
```

## Cross-Platform Support

The library automatically detects solver binaries:

| Platform | Search Locations |
|----------|------------------|
| Windows | `z3.exe` in PATH, `C:\Program Files\Z3\bin`, `C:\z3\bin` |
| macOS | `z3` in PATH, `/usr/local/bin`, `/opt/homebrew/bin` |
| Linux | `z3` in PATH, `/usr/bin`, `/usr/local/bin` |

Custom path:

```typescript
import { checkSolverAvailability } from '@isl-lang/isl-smt';

const availability = await checkSolverAvailability('z3', '/custom/path/to/z3');
```

## API Reference

### Solving

- `solve(formula, options)` - High-level solve with tri-state output
- `createSolver(options)` - Create solver instance
- `translate(formula, declarations)` - Generate SMT-LIB string

### Availability

- `isZ3Available()` - Check Z3 availability
- `isCVC5Available()` - Check CVC5 availability
- `getSolverAvailability()` - Get all solver info
- `getBestAvailableSolver()` - Get best available solver

### Verification

- `verifySMT(domain, options)` - Verify ISL domain
- `verifyFormal(domain, options)` - Formal mode with evidence
- `resolveUnknown(expr, values, options)` - Resolve unknown results

### External Solver

- `checkSatExternal(smtlib, config)` - Run external solver directly
- `runSolver(smtlib, config)` - Low-level solver execution

## Example: Full Verification Flow

```typescript
import {
  verifySMT,
  resolveUnknown,
  getSolverAvailability,
} from '@isl-lang/isl-smt';

async function verifyWithSMT(domain) {
  // Check what's available
  const { bestAvailable } = await getSolverAvailability();
  console.log(`Using solver: ${bestAvailable}`);
  
  // Run verification
  const result = await verifySMT(domain, {
    solver: bestAvailable,
    timeout: 10000,
    verbose: true,
  });
  
  console.log('Summary:');
  console.log(`  Total: ${result.summary.total}`);
  console.log(`  SAT: ${result.summary.sat}`);
  console.log(`  UNSAT: ${result.summary.unsat}`);
  console.log(`  Unknown: ${result.summary.unknown}`);
  
  // Try to resolve unknowns
  for (const r of result.results) {
    if (r.result.status === 'unknown') {
      console.log(`Attempting to resolve: ${r.name}`);
      const resolution = await resolveUnknown(
        /* expression from clause */,
        /* input values */,
        { solver: 'z3', timeout: 30000 }
      );
      console.log(`  Result: ${resolution.resolved?.verdict}`);
    }
  }
  
  return result;
}
```

## License

MIT
