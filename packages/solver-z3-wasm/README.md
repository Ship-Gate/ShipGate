# @isl-lang/solver-z3-wasm

Z3 WASM Solver Adapter for ISL - provides SMT solving without external installs.

## Overview

This package provides an SMT solver implementation using Z3 compiled to WebAssembly, allowing SMT verification without requiring external Z3 installation. It implements the `ISMTSolver` interface from `@isl-lang/isl-smt` and can be used as a fallback when native Z3 is not available.

## Features

- ✅ **No external dependencies** - Works without installing Z3 binary
- ✅ **Deterministic execution** - Fixed random seeds for reproducible results
- ✅ **Timeout handling** - Configurable timeouts prevent hanging
- ✅ **Model extraction** - Produces counterexamples for satisfiable formulas
- ✅ **Full SMT-LIB support** - Supports all SMT-LIB features available in Z3

## Installation

```bash
pnpm add @isl-lang/solver-z3-wasm
```

## Usage

### Basic Usage

```typescript
import { createWasmSolver } from '@isl-lang/solver-z3-wasm';
import { Expr, Sort, Decl } from '@isl-lang/prover';

const solver = createWasmSolver({
  timeout: 5000,
  randomSeed: 42, // For deterministic results
});

const result = await solver.checkSat(
  Expr.and(
    Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
    Expr.lt(Expr.var('x', Sort.Int()), Expr.int(10))
  ),
  [Decl.const('x', Sort.Int())]
);

if (result.status === 'sat') {
  console.log('Satisfiable with model:', result.model);
  // { x: 5 } (example)
}
```

### Integration with ISL SMT

The WASM solver is automatically used as a fallback when Z3 is not available:

```typescript
import { createSolver } from '@isl-lang/isl-smt';

// Automatically falls back to WASM if Z3 not installed
const solver = createSolver({
  solver: 'z3', // Will use WASM if native Z3 unavailable
  timeout: 5000,
});

// Or explicitly request WASM
const wasmSolver = createSolver({
  solver: 'z3-wasm',
  timeout: 5000,
});
```

### Deterministic Execution

For reproducible results, use a fixed random seed:

```typescript
const solver = createWasmSolver({
  randomSeed: 42, // Fixed seed ensures same results
  timeout: 5000,
});
```

## API

### `createWasmSolver(options?)`

Creates a WASM solver instance implementing `ISMTSolver`.

**Options:**
- `timeout?: number` - Timeout in milliseconds (default: 5000)
- `produceModels?: boolean` - Produce models on SAT (default: true)
- `verbose?: boolean` - Enable verbose logging (default: false)
- `randomSeed?: number` - Fixed random seed for deterministic execution (default: 0)

**Returns:** `ISMTSolver` instance

### `isZ3WasmAvailable()`

Checks if Z3 WASM is available in the current environment.

**Returns:** `Promise<boolean>`

## Limitations

### Runtime Requirements

- **SharedArrayBuffer**: Requires `SharedArrayBuffer` support
  - Node.js 16+ supports this by default
  - Browsers require COOP/COEP headers:
    ```http
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Embedder-Policy: require-corp
    ```

### Performance

- **Slower than native**: WASM execution is slower than native Z3
  - Typical overhead: 2-5x slower than native Z3
  - Still fast enough for most verification tasks

### Memory

- **WASM heap limits**: Memory usage is constrained by WASM heap size
  - Default heap: ~256MB
  - Large queries may hit memory limits

### Feature Support

- **Full Z3 features**: Supports all SMT-LIB features available in Z3
- **Threading**: Not thread-safe (Z3 WASM uses sequential execution)

## Examples

### Check Precondition Satisfiability

```typescript
import { createWasmSolver } from '@isl-lang/solver-z3-wasm';
import { Expr, Sort } from '@isl-lang/prover';

const solver = createWasmSolver();

const inputVars = new Map([
  ['x', Sort.Int()],
  ['y', Sort.Int()],
]);

const precondition = Expr.and(
  Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0)),
  Expr.lt(Expr.var('y', Sort.Int()), Expr.int(100))
);

const result = await solver.checkPreconditionSat(precondition, inputVars);
if (result.status === 'sat') {
  console.log('Precondition is satisfiable:', result.model);
}
```

### Verify Postcondition Implication

```typescript
const vars = new Map([['x', Sort.Int()]]);

const precondition = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(0));
const postcondition = Expr.gt(Expr.var('x', Sort.Int()), Expr.int(-1));

const result = await solver.checkPostconditionImplication(
  precondition,
  postcondition,
  vars
);

if (result.status === 'unsat') {
  console.log('Postcondition follows from precondition');
} else if (result.status === 'sat') {
  console.log('Counterexample:', result.model);
}
```

## Testing

Run tests:

```bash
pnpm test
```

Note: Tests require `SharedArrayBuffer` support. In Node.js 16+, this is available by default.

## License

MIT

## See Also

- [`@isl-lang/isl-smt`](../isl-smt) - Main SMT integration package
- [`@isl-lang/prover`](../prover) - SMT expression builder
- [Z3 Documentation](https://github.com/Z3Prover/z3)
