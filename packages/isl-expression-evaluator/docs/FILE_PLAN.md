# ISL Expression Evaluator v1 - File Plan

## Package Structure

```
packages/isl-expression-evaluator/
├── docs/
│   ├── DESIGN.md                 # Architecture and design decisions
│   ├── FILE_PLAN.md              # This file
│   ├── SUPPORTED_EXPRESSIONS.md  # User-facing expression reference
│   └── TEST_CASES.md             # Comprehensive test case matrix
├── src/
│   ├── index.ts                  # Public API exports
│   ├── types.ts                  # Core type definitions
│   ├── evaluator.ts              # Main evaluation engine
│   ├── helpers.ts                # Context/adapter factory helpers
│   ├── operators.ts              # Operator implementations (extract)
│   ├── builtins.ts               # Built-in function implementations
│   ├── provenance.ts             # Provenance tracking utilities
│   └── bench.ts                  # Performance benchmarks
├── tests/
│   ├── evaluator.test.ts         # Core evaluator tests
│   ├── operators.test.ts         # Operator edge cases
│   ├── builtins.test.ts          # Built-in function tests
│   ├── quantifiers.test.ts       # Quantifier tests
│   ├── provenance.test.ts        # Provenance tracking tests
│   └── integration.test.ts       # End-to-end scenarios
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

---

## File Descriptions

### Source Files

#### `src/index.ts`
**Purpose**: Public API surface  
**Exports**:
- `evaluate()` - Main evaluation function
- Type definitions (`TriState`, `EvaluationResult`, `EvaluationContext`, etc.)
- Helper functions (`createContext`, `createAdapter`)
- Utility functions (`triStateAnd`, `triStateOr`, etc.)

```typescript
// Public API
export { evaluate } from './evaluator.js';
export { type TriState, type EvaluationResult, ... } from './types.js';
export { createContext, createAdapter } from './helpers.js';
```

#### `src/types.ts`
**Purpose**: Core type definitions and tri-state logic  
**Contents**:
- `TriState` - Union type for tri-state values
- `Value` - Runtime value representation
- `EvaluationResult` - Result with diagnostics
- `EvaluationContext` - Evaluation environment
- `ExpressionAdapter` - Pluggable domain primitives
- `Provenance` - Value derivation tracking
- `Diagnostic` - Error/warning information
- `EvaluationError` - Error class with source spans
- Tri-state helper functions (`triStateAnd`, `triStateOr`, etc.)

#### `src/evaluator.ts`
**Purpose**: Core evaluation engine  
**Contents**:
- `evaluate()` - Main entry point
- AST node handlers for each expression type
- Depth limiting and recursion protection
- Performance metrics collection

**Key Functions**:
```typescript
export function evaluate(
  expression: Expression,
  context: EvaluationContext
): EvaluationResult;
```

#### `src/helpers.ts`
**Purpose**: Factory functions for common patterns  
**Contents**:
- `createContext()` - Build evaluation context with defaults
- `createAdapter()` - Compose adapter with partial overrides

#### `src/operators.ts` (NEW - Extract)
**Purpose**: Isolated operator implementations  
**Contents**:
- `evalBinary()` - Binary operator handler
- `evalUnary()` - Unary operator handler
- `evalComparison()` - Comparison operations
- `evalEquals()` - Equality with deep comparison

**Rationale**: Extract from `evaluator.ts` for testability and clarity.

#### `src/builtins.ts` (NEW)
**Purpose**: Built-in function implementations  
**Contents**:
- `evalIsValid()` - `is_valid(x)` implementation
- `evalLength()` - `length(x)` implementation
- `evalExists()` - `exists(entity, criteria)` implementation
- `evalRegex()` - `regex(x, pattern)` implementation
- `evalLookup()` - `lookup(entity, criteria)` implementation

```typescript
export function evalIsValid(value: unknown, adapter: ExpressionAdapter): TriState;
export function evalLength(value: unknown, adapter: ExpressionAdapter): number | 'unknown';
export function evalRegex(value: unknown, pattern: string): TriState;
```

#### `src/provenance.ts` (NEW)
**Purpose**: Provenance tracking utilities  
**Contents**:
- `createProvenance()` - Build provenance record
- `mergeProvenance()` - Combine child provenance
- `formatProvenance()` - Human-readable output
- `provenanceToJson()` - Serializable format

```typescript
export function createProvenance(
  source: ProvenanceSource,
  options?: { binding?: string; children?: Provenance[] }
): Provenance;
```

#### `src/bench.ts`
**Purpose**: Performance benchmarks  
**Contents**:
- Micro-benchmarks for operators
- Throughput tests (expressions/second)
- Memory usage analysis
- Regression detection

---

### Test Files

#### `tests/evaluator.test.ts`
**Coverage**: Core evaluation flow
- Literal evaluation
- Variable resolution
- Context binding
- Depth limiting
- Error handling

#### `tests/operators.test.ts` (NEW)
**Coverage**: Operator edge cases
- Comparison operator boundary conditions
- Logical operator truth tables
- Implication edge cases
- Operator precedence

#### `tests/builtins.test.ts` (NEW)
**Coverage**: Built-in functions
- `is_valid()` with all types
- `length()` with strings/arrays
- `exists()` with custom adapters
- `regex()` pattern matching
- Invalid inputs handling

#### `tests/quantifiers.test.ts` (NEW)
**Coverage**: Quantifier expressions
- `all` with empty/non-empty collections
- `any` with various predicates
- Nested quantifiers
- Unknown propagation in quantifiers

#### `tests/provenance.test.ts` (NEW)
**Coverage**: Provenance tracking
- Literal provenance
- Variable binding tracking
- Adapter call recording
- Nested expression provenance

#### `tests/integration.test.ts` (NEW)
**Coverage**: End-to-end scenarios
- Real postcondition expressions
- Real invariant expressions
- Complex nested expressions
- Performance under load

---

## Dependencies

### Runtime Dependencies
```json
{
  "dependencies": {}
}
```
No runtime dependencies - pure TypeScript implementation.

### Dev Dependencies
```json
{
  "devDependencies": {
    "@isl-lang/parser": "workspace:*",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0",
    "tsup": "^8.0.0"
  }
}
```

### Peer Dependencies
```json
{
  "peerDependencies": {
    "@isl-lang/parser": "workspace:*"
  }
}
```

---

## Build Configuration

### tsconfig.json
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["tests/**/*", "dist/**/*"]
}
```

### tsup.config.ts
```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/bench.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
```

---

## Migration Path

### Phase 1: Current State (Done)
- Basic evaluator in `evaluator.ts`
- Types in `types.ts`
- Helpers in `helpers.ts`
- Tests in `evaluator.test.ts`

### Phase 2: Extract Operators (v1.1)
1. Create `src/operators.ts`
2. Move operator functions from `evaluator.ts`
3. Create `tests/operators.test.ts`
4. Update imports in `evaluator.ts`

### Phase 3: Add Builtins (v1.2)
1. Create `src/builtins.ts`
2. Add `regex()` implementation
3. Create `tests/builtins.test.ts`
4. Add `tests/quantifiers.test.ts`

### Phase 4: Provenance Tracking (v1.3)
1. Create `src/provenance.ts`
2. Integrate with evaluator
3. Create `tests/provenance.test.ts`
4. Add `tests/integration.test.ts`

---

## API Surface

### Exported Types
```typescript
// Core types
export type TriState = 'true' | 'false' | 'unknown';
export type MaybeUnknown<T> = T | 'unknown';
export type Value = string | number | boolean | null | undefined | Value[] | { [key: string]: Value } | 'unknown';

// Result types
export interface EvaluationResult { ... }
export interface EvaluationContext { ... }
export interface Diagnostic { ... }
export interface Provenance { ... }

// Adapter interface
export interface ExpressionAdapter { ... }

// Error class
export class EvaluationError extends Error { ... }
```

### Exported Functions
```typescript
// Main API
export function evaluate(expression: Expression, context: EvaluationContext): EvaluationResult;

// Context creation
export function createContext(options?: ContextOptions): EvaluationContext;
export function createAdapter(overrides?: Partial<ExpressionAdapter>): ExpressionAdapter;

// Tri-state operations
export function triStateAnd(a: TriState, b: TriState): TriState;
export function triStateOr(a: TriState, b: TriState): TriState;
export function triStateNot(a: TriState): TriState;
export function triStateImplies(a: TriState, b: TriState): TriState;
export function triStateToBoolean(tri: TriState, strict?: boolean): boolean;

// Value utilities
export function isUnknown(value: unknown): value is 'unknown';
export function wrapValue(value: unknown): Value;
```

### Exported Classes
```typescript
export class DefaultAdapter implements ExpressionAdapter { ... }
export class EvaluationError extends Error { ... }
```
