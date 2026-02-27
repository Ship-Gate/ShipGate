# ISL Semantic Analysis Passes

This document describes the 8-pass semantic analysis pipeline for ISL (Intent Specification Language).
Each pass is independently testable and produces structured diagnostics.

## Pipeline Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Pass 1    │───▶│   Pass 2    │───▶│   Pass 3    │───▶│   Pass 4    │
│ Import Graph│    │Symbol Table │    │Type Checker │    │   Purity    │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Pass 5    │───▶│   Pass 6    │───▶│   Pass 7    │───▶│   Pass 8    │
│Control Flow │    │  Contract   │    │Exhaustive-  │    │Optimization │
│             │    │Completeness │    │   ness      │    │   Hints     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### Execution Order

Passes run in dependency-aware order:
1. **Import Graph** (priority: 100) - Foundation for all other passes
2. **Symbol Table** (priority: 95) - Required by most subsequent passes
3. **Type Checker** (priority: 90) - Required for type-aware analysis
4. **Purity Constraints** (priority: 85) - Side-effect analysis
5. **Control Flow** (priority: 80) - Reachability analysis
6. **Contract Completeness** (priority: 75) - Pre/post/invariant checks
7. **Exhaustiveness** (priority: 70) - Pattern coverage
8. **Optimization Hints** (priority: 65) - Performance suggestions

---

## Pass 1: Import Graph & Cycle Detection

**ID:** `import-graph`  
**Priority:** 100  
**Dependencies:** None

### Purpose

Builds a directed graph of import relationships between ISL modules and detects:
- Circular import dependencies
- Missing imported modules
- Duplicate imports
- Deterministic import ordering for reproducible analysis

### Inputs

```typescript
interface ImportGraphInput {
  ast: DomainDeclaration;
  filePath: string;
  resolveImport?: (path: string) => DomainDeclaration | null;
}
```

### Outputs

```typescript
interface ImportGraphOutput {
  graph: Map<string, Set<string>>;  // module → dependencies
  order: string[];                   // topologically sorted
  cycles: string[][];                // detected cycles
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0100 | error | Circular import detected |
| E0101 | error | Import not found |
| E0102 | warning | Duplicate import |
| E0103 | hint | Import order suggestion |

### Example

```isl
// Error: Circular import detected: A → B → C → A
import A from "./a.isl"  // E0100
```

---

## Pass 2: Symbol Table & Name Resolution

**ID:** `symbol-resolver`  
**Priority:** 95  
**Dependencies:** `import-graph`

### Purpose

Builds a scoped symbol table and resolves all name references:
- Entities, types, behaviors, enums
- Fields within entities
- Parameters within behaviors
- Scoped variables (quantifiers, lambdas)
- Cross-module references

### Inputs

```typescript
interface SymbolResolverInput {
  ast: DomainDeclaration;
  importGraph: ImportGraphOutput;
}
```

### Outputs

```typescript
interface SymbolTable {
  symbols: Map<string, Symbol>;
  scopes: Map<string, Scope>;
  references: Map<ASTNode, Symbol>;
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0200 | error | Undefined symbol |
| E0201 | error | Undefined type |
| E0202 | error | Undefined field |
| E0203 | error | Undefined behavior |
| E0204 | error | Undefined enum variant |
| E0210 | warning | Shadowed declaration |
| E0211 | hint | Similar name suggestion |

### Example

```isl
entity User {
  profile: Profiel  // E0201: Type 'Profiel' not defined. Did you mean 'Profile'?
}
```

---

## Pass 3: Type Checking & Inference

**ID:** `type-checker`  
**Priority:** 90  
**Dependencies:** `symbol-resolver`

### Purpose

Performs type checking and completes type inference:
- Expression type inference
- Assignment compatibility
- Generic type parameter resolution
- Constraint validation (min, max, pattern)
- Return type checking

### Inputs

```typescript
interface TypeCheckerInput {
  ast: DomainDeclaration;
  symbolTable: SymbolTable;
}
```

### Outputs

```typescript
interface TypeEnvironment {
  expressionTypes: Map<Expression, ResolvedType>;
  inferredTypes: Map<Symbol, ResolvedType>;
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0300 | error | Type mismatch |
| E0301 | error | Cannot infer type |
| E0302 | error | Generic parameter mismatch |
| E0303 | error | Constraint violation |
| E0304 | error | Invalid use of `old()` |
| E0305 | error | Invalid use of `result` |
| E0310 | warning | Implicit type conversion |
| E0311 | warning | Nullable access without check |

### Example

```isl
behavior Calculate {
  input { value: String }
  preconditions {
    value > 10  // E0300: Cannot compare String with Int
  }
}
```

---

## Pass 4: Purity & Side-Effect Constraints

**ID:** `purity-constraints`  
**Priority:** 85  
**Dependencies:** `type-checker`

### Purpose

Analyzes purity and side effects:
- Marks pure vs impure expressions
- Detects state mutations in preconditions (forbidden)
- Validates `old()` usage in postconditions
- Identifies non-deterministic calls

### Inputs

```typescript
interface PurityInput {
  ast: DomainDeclaration;
  typeEnv: TypeEnvironment;
}
```

### Outputs

```typescript
interface PurityAnalysis {
  pureExpressions: Set<Expression>;
  impureCalls: Map<Expression, ImpurityReason>;
  mutations: Map<Expression, MutationTarget>;
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0400 | error | Side effect in precondition |
| E0401 | error | Mutation in invariant |
| E0402 | warning | Non-deterministic in postcondition |
| E0403 | hint | Could be marked @pure |
| E0410 | warning | Impure call in pure context |

### Example

```isl
behavior Transfer {
  preconditions {
    account.withdraw(amount)  // E0400: Side effect in precondition
  }
}
```

---

## Pass 5: Control Flow & Reachability

**ID:** `control-flow`  
**Priority:** 80  
**Dependencies:** `purity-constraints`

### Purpose

Builds control flow graph and analyzes reachability:
- Unreachable code detection
- Impossible guard combinations
- Dead branches after returns/throws
- Condition dominance analysis

### Inputs

```typescript
interface ControlFlowInput {
  ast: DomainDeclaration;
  symbolTable: SymbolTable;
  typeEnv: TypeEnvironment;
}
```

### Outputs

```typescript
interface ControlFlowGraph {
  nodes: Map<ASTNode, CFGNode>;
  edges: Map<CFGNode, CFGEdge[]>;
  dominators: Map<CFGNode, Set<CFGNode>>;
  reachable: Set<CFGNode>;
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0500 | error | Unreachable code |
| E0501 | error | Contradictory guards |
| E0502 | warning | Always-true condition |
| E0503 | warning | Always-false condition |
| E0504 | hint | Redundant guard |

### Example

```isl
behavior Process {
  preconditions {
    when status == "active" {
      amount > 0
    }
    when status == "active" and status == "inactive" {  // E0501: Impossible
      amount < 0
    }
  }
}
```

---

## Pass 6: Contract Completeness

**ID:** `contract-completeness`  
**Priority:** 75  
**Dependencies:** `control-flow`

### Purpose

Validates contract specifications are complete and consistent:
- Pre/post condition coverage
- Invariant preservation
- Error handler completeness
- Missing postconditions for success/error cases

### Inputs

```typescript
interface ContractInput {
  ast: DomainDeclaration;
  cfg: ControlFlowGraph;
  typeEnv: TypeEnvironment;
}
```

### Outputs

```typescript
interface ContractAnalysis {
  coverage: Map<Behavior, ContractCoverage>;
  invariantViolations: InvariantViolation[];
  missingHandlers: ErrorCase[];
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0600 | error | Postcondition missing for error case |
| E0601 | error | Invariant not preserved |
| E0602 | warning | Weak postcondition |
| E0603 | warning | Unused precondition variable |
| E0604 | hint | Could strengthen contract |

### Example

```isl
behavior Withdraw {
  output { success: Balance, errors: [InsufficientFunds, AccountLocked] }
  postconditions {
    when success {
      result.balance == old(account.balance) - amount
    }
    // E0600: Missing postcondition for error 'AccountLocked'
  }
}
```

---

## Pass 7: Exhaustiveness & Pattern Coverage

**ID:** `exhaustiveness`  
**Priority:** 70  
**Dependencies:** `contract-completeness`

### Purpose

Checks that pattern matching and conditional logic is exhaustive:
- Enum variant coverage
- Union type handling
- Guard completeness
- Default/else branch requirements

### Inputs

```typescript
interface ExhaustivenessInput {
  ast: DomainDeclaration;
  typeEnv: TypeEnvironment;
  symbolTable: SymbolTable;
}
```

### Outputs

```typescript
interface ExhaustivenessAnalysis {
  uncoveredPatterns: Map<Expression, Pattern[]>;
  redundantPatterns: Map<Expression, Pattern[]>;
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| E0700 | error | Non-exhaustive pattern match |
| E0701 | error | Missing enum variant handler |
| E0702 | warning | Redundant pattern |
| E0703 | warning | Unreachable default branch |
| E0704 | hint | Could use exhaustive match |

### Example

```isl
enum Status { Active, Inactive, Pending, Suspended }

behavior Process {
  preconditions {
    when input.status == Status.Active { ... }
    when input.status == Status.Inactive { ... }
    // E0701: Missing handlers for Pending, Suspended
  }
}
```

---

## Pass 8: Optimization Hints

**ID:** `optimization-hints`  
**Priority:** 65  
**Dependencies:** `exhaustiveness`

### Purpose

Identifies optimization opportunities:
- Constant folding candidates
- Dead code elimination
- Redundant conditions
- Performance anti-patterns

### Inputs

```typescript
interface OptimizationInput {
  ast: DomainDeclaration;
  cfg: ControlFlowGraph;
  typeEnv: TypeEnvironment;
}
```

### Outputs

```typescript
interface OptimizationHints {
  constantFolding: ConstantFoldCandidate[];
  deadCode: ASTNode[];
  redundantConditions: Expression[];
  suggestions: OptimizationSuggestion[];
}
```

### Diagnostics Produced

| Code | Severity | Description |
|------|----------|-------------|
| H0800 | hint | Can fold constant expression |
| H0801 | hint | Dead code can be removed |
| H0802 | hint | Redundant condition |
| H0803 | hint | Expensive operation in loop |
| H0804 | hint | Consider caching result |

### Example

```isl
entity Config {
  timeout: Int [min: 60 * 60]  // H0800: Can fold to 3600
}

behavior Calculate {
  preconditions {
    1 + 1 == 2  // H0801: Always true, can remove
  }
}
```

---

## Diagnostic Format

All passes produce diagnostics in this format:

```typescript
interface Diagnostic {
  code: string;           // E0XXX, W0XXX, H0XXX
  category: 'semantic';
  severity: 'error' | 'warning' | 'hint';
  message: string;
  location: SourceLocation;
  source: 'verifier';
  notes?: string[];       // Additional context
  help?: string[];        // Suggested fixes
  fix?: CodeFix;          // Auto-fix if available
  tags?: DiagnosticTag[]; // 'unnecessary', 'deprecated'
  relatedInformation?: RelatedInformation[];
}
```

## Running the Pipeline

### CLI Command

```bash
# Run all passes
isl check --semantic src/domain.isl

# Run specific passes
isl check --semantic --passes=import-graph,symbol-resolver src/domain.isl

# Skip specific passes
isl check --semantic --skip=optimization-hints src/domain.isl

# Output as JSON
isl check --semantic --format=json src/domain.isl
```

### Programmatic API

```typescript
import { PassRunner, builtinPasses } from '@isl-lang/semantic-analysis';

const runner = new PassRunner({
  enablePasses: ['import-graph', 'symbol-resolver', 'type-checker'],
  includeHints: true,
});

runner.registerAll(builtinPasses);

const result = runner.run(ast, sourceCode, filePath);
console.log(result.diagnostics);
```

## Pass Registration

To add a custom pass:

```typescript
import { SemanticPass, PassContext } from '@isl-lang/semantic-analysis';

const myPass: SemanticPass = {
  id: 'my-custom-pass',
  name: 'My Custom Pass',
  description: 'Checks custom constraints',
  dependencies: ['symbol-resolver'],
  priority: 50,
  enabledByDefault: true,
  
  run(ctx: PassContext): Diagnostic[] {
    // Implementation
    return [];
  }
};

runner.register(myPass);
```

## Testing Strategy

Each pass has three categories of tests:

1. **Happy Path**: Valid ISL with no diagnostics
2. **Error Path**: Invalid ISL with expected diagnostics
3. **Edge Cases**: Boundary conditions, empty inputs, nested structures

Test fixtures are in `tests/fixtures/` with naming convention:
- `pass-name-valid.isl` - Should produce no diagnostics
- `pass-name-error-EXXX.isl` - Should produce specific error
- `pass-name-edge-case.isl` - Edge case scenarios

## Version History

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial 8-pass pipeline |
