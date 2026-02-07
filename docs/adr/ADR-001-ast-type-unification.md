# ADR-001: AST Type Unification

**Status:** Proposed  
**Date:** 2026-02-03  
**Authors:** ISL Team  
**Supersedes:** N/A  

---

## Context

The ISL monorepo has accumulated significant technical debt in the form of duplicate and divergent AST/Domain type definitions across packages. This analysis documents the current state and proposes a unification path.

---

## Part 1: AST/Domain Type Inventory

### 1.1 Primary Type Sources

| Package | File | Primary Types | Base Node | Notes |
|---------|------|---------------|-----------|-------|
| **master_contracts** | `ast.ts` | `Domain`, `Entity`, `Behavior`, etc. | `ASTNode` with `location: SourceLocation` | **Golden reference** (v0.1.0) |
| **@isl-lang/parser** | `src/ast.ts` | Re-exports from master_contracts | Same as above | Has `@deprecated` aliases for old names |
| **@isl-lang/isl-core** | `src/ast/types.ts` | `DomainDeclaration`, `EntityDeclaration`, etc. | `BaseNode` with `span: SourceSpan` | **INCOMPATIBLE** - different shape |

### 1.2 Full AST Copy-Paste Duplicates

These packages contain complete or near-complete copies of the AST types:

| Package | File | Exported Types | Notes |
|---------|------|----------------|-------|
| isl-federation | `src/ast.ts` | `Domain`, `Entity`, `Behavior`, ~60 types | "Local copy for isl-federation package" |
| versioner | `src/ast-types.ts` | `Domain`, `Entity`, `Behavior`, ~55 types | "Minimal subset for change analysis" |
| codegen-go | `src/ast-types.ts` | `Domain`, `Entity`, `Behavior`, ~70 types | "Simplified re-export" |
| codegen-rust | `src/ast-types.ts` | `Domain`, `Entity`, `Behavior`, ~50 types | Full copy |
| codegen-loadtest | `src/ast-types.ts` | `Domain`, `Entity`, `Behavior`, ~40 types | Full copy |
| security-policies | `src/types.ts` | `Domain`, `ASTNode`, `ASTFix`, `ASTPatch` | Includes extra security types |
| core/isl-translator | `corpus-tests/corpusRunner.ts` | `Domain`, `ASTNode`, inline definitions | Test file with local types |

### 1.3 Simplified Domain Types (API/Runtime purposes)

| Package | File | Type Name | Shape | Purpose |
|---------|------|-----------|-------|---------|
| dashboard-web | `src/lib/api.ts` | `Domain` | `{id, name, status, ...}` | API client model |
| dashboard-api | `src/db/types.ts` | `Domain` | `{id, name, projectId, ...}` | Database model |
| codegen-graphql | `src/types.ts` | `Domain` | `{name, version?, entities, behaviors}` | Generation simplified |
| codegen-graphql | `generators/*.ts` | `DomainDeclaration` | `{name, version?, entities}` | Local interface (3 files) |
| codegen-openapi | `src/generator.ts` | `Domain` | `{name, version, ...}` | Local simplified |
| codegen-docs | `src/types.ts` | `Domain` | `{name, version?, ...}` | Docs generation |
| codegen-sdk | `src/types.ts` | `Domain` | `{name, version?, ...}` | SDK generation |
| codegen-python | `src/types.ts` | `Domain` | `{name, description?, ...}` | Python codegen |
| codegen-kubernetes | `src/types.ts` | `Domain` | `{name, description?, ...}` | K8s manifest gen |
| simulator | `src/types.ts` | `Domain` | `{name, version?, ...}` | Simulation runtime |
| repl | `src/types.ts` | `Domain` | `{name, version?, ...}` | REPL runtime |
| playground | `src/lib/compiler.ts` | `Domain` | `{name, description, ...}` | UI playground |
| compliance | `src/types.ts` | `Domain` | `{name, version, ...}` | Compliance checks |
| grafana | `src/generator.ts` | `Domain` | `{name: {value}, behaviors}` | Dashboard gen |
| security-scanner | `src/severity.ts` | `Domain` | `{kind, name: {name}}` | Security analysis |

### 1.4 DomainSpec/DomainDef Variants

| Package | File | Type Name | Notes |
|---------|------|-----------|-------|
| isl-runtime | `src/runtime.ts` | `DomainSpec` | Runtime specification |
| runtime-interpreter | `src/types.ts` | `Domain` | Interpreter runtime |
| runtime | `src/types.ts` | `DomainDef` | Runtime definition |
| contract-testing | `src/tester.ts` | `DomainSpec` | Contract testing |
| db-generator | `src/types.ts` | `DomainSpec` | DB generation |
| sdk-generator | `src/types.ts` | `DomainSpec` | SDK generation |
| api-generator | `src/types.ts` | `DomainSpec` | API generation |
| schema-evolution | `src/types.ts` | `DomainSchema` | Schema migration |
| evaluator | `src/types.ts` | `DomainDef` | Expression evaluation |

### 1.5 Specialized Domain Types (Different Concepts)

| Package | File | Type Name | Concept |
|---------|------|-----------|---------|
| event-sourcing | `src/types.ts`, `src/aggregate.ts` | `DomainEvent<T>` | Event sourcing events |
| distributed | `src/types.ts` | `DomainEvent<TPayload>` | Distributed events |
| stdlib-events | `implementations/typescript/events.ts` | `DomainEvent<TData>` | Standard library events |
| verifier-security | `src/types.ts` | `DomainSecurityRule` | Security rule type |
| codegen-pipelines | `src/generator.ts` | `DomainAnalysis` | Pipeline analysis |
| opentelemetry | `src/metrics/coverage.ts` | `DomainCoverageReport` | Coverage metrics |
| core/isl-diff | `diffTypes.ts` | `DomainDiff` | Diff tracking |
| migrations | `src/types.ts` | `DomainDiff` | Migration diff |
| api-versioning | `src/types.ts` | `DomainDiff` | Version diff |

### 1.6 ASTNode Duplicates

| Package | File | Notes |
|---------|------|-------|
| parser | `src/ast.ts` | Canonical |
| isl-core | `src/ast/types.ts` | Different base (`BaseNode`) |
| isl-federation | `src/ast.ts` | Copy |
| versioner | `src/ast-types.ts` | Copy |
| security-policies | `src/types.ts` | Copy |
| evaluator | `src/types.ts` | Re-definition |
| typechecker | `src/types.ts` | Re-definition |
| codegen-graphql | `src/types.ts` | `AST`, `ASTDomain`, `ASTEntity`, etc. |
| isl-lsp | `src/services/language-service.ts` | Minimal definition |
| core/isl-lint-v2 | `types.ts` | `ASTPatch` variants |
| import-resolver | `src/module-graph.ts` | `ASTCacheEntry` |

---

## Part 2: Duplicate Clusters

### Cluster A: Full Parser AST Copies
**Same concept, identical shape, code duplication**

```
master_contracts/ast.ts (CANONICAL)
    ├── @isl-lang/parser/src/ast.ts (re-export with aliases)
    ├── isl-federation/src/ast.ts (COPY)
    ├── versioner/src/ast-types.ts (COPY)
    ├── codegen-go/src/ast-types.ts (COPY)
    ├── codegen-rust/src/ast-types.ts (COPY)
    ├── codegen-loadtest/src/ast-types.ts (COPY)
    └── security-policies/src/types.ts (PARTIAL COPY)
```

**Impact:** 6 packages with ~400 lines of duplicated type definitions each.

### Cluster B: isl-core Divergent AST
**Same concept, different shape**

```
@isl-lang/isl-core/src/ast/types.ts
    Uses: DomainDeclaration, EntityDeclaration, BehaviorDeclaration
    Base: BaseNode with span: SourceSpan
    
vs.

@isl-lang/parser/src/ast.ts
    Uses: Domain, Entity, Behavior
    Base: ASTNode with location: SourceLocation
```

**Key Differences:**
| Aspect | isl-core | parser |
|--------|----------|--------|
| Domain type name | `DomainDeclaration` | `Domain` |
| Kind value | `'DomainDeclaration'` | `'Domain'` |
| Base node | `BaseNode` | `ASTNode` |
| Location field | `span: SourceSpan` | `location: SourceLocation` |
| Version field | `version?: StringLiteral` | `version: StringLiteral` |
| Uses imports | `uses: UseStatement[]` | `imports: Import[]` |

### Cluster C: Simplified Domain for Codegen
**Same concept, simplified shape**

```
codegen-graphql, codegen-docs, codegen-sdk, codegen-python,
codegen-kubernetes, codegen-openapi
    All define local Domain interface with {name, version?, entities?, behaviors?}
```

### Cluster D: Runtime Domain Specs
**Same concept, runtime-specific shape**

```
isl-runtime, runtime-interpreter, runtime, contract-testing,
db-generator, sdk-generator, api-generator
    All define DomainSpec/DomainDef with {name, version, ...runtime fields}
```

### Cluster E: DomainEvent (Different Concept)
**Different concept, not duplicates - should NOT be unified**

```
event-sourcing, distributed, stdlib-events
    DomainEvent<T> for event-sourcing pattern (NOT AST related)
```

---

## Part 3: Dependency Graph

### Packages Importing from @isl-lang/parser or @isl-lang/isl-core

**277 files** import from parser or isl-core across **266 packages**.

Key dependency chains:

```
@isl-lang/parser (CANONICAL AST)
    ↓
├── @isl-lang/typechecker
├── @isl-lang/evaluator  
├── @isl-lang/isl-expression-evaluator
├── @isl-lang/isl-semantic-analysis
├── @isl-lang/verifier-runtime
├── @isl-lang/test-generator
├── @isl-lang/codegen-* (many)
├── @isl-lang/lsp-*
├── @isl-lang/cli
└── (200+ more)

@isl-lang/isl-core (DIVERGENT AST)
    ↓
├── @isl-lang/isl-expression-evaluator (ALSO imports parser!)
├── @isl-lang/isl-proof
├── Some internal modules
└── Limited adoption
```

### Packages with Local AST Definitions (No Import)

These packages define AST types locally and don't import from canonical sources:

- `isl-federation`
- `versioner`
- `codegen-go`
- `codegen-rust`
- `codegen-loadtest`
- `dashboard-web`
- `dashboard-api`
- `playground`
- Most `codegen-*` experimental packages

---

## Decision

### Canonical Type Source

**`@isl-lang/parser`** is the canonical source for all AST types.

The types are defined in `master_contracts/ast.ts` and re-exported through `@isl-lang/parser`.

### Rationale

1. **`@isl-lang/parser` is already the most widely imported** (277 import sites)
2. **`master_contracts/ast.ts` is the golden reference** with proper versioning
3. **`@isl-lang/parser` already has deprecation aliases** for backward compatibility
4. **`@isl-lang/isl-core` has a fundamentally different structure** that would require broader changes

### What About @isl-lang/isl-core?

`@isl-lang/isl-core` defines a different AST structure (`DomainDeclaration` with `BaseNode`/`span`). We have two options:

**Option A (Recommended): Adapter Pattern**
- Keep `@isl-lang/isl-core` types for internal use
- Create `DomainDeclaration → Domain` adapter in isl-core
- Consumers that need the isl-core format use the adapter

**Option B: Full Migration**
- Migrate isl-core to use parser types
- This is more work but results in cleaner architecture

We recommend **Option A** for the migration, with Option B as future cleanup.

---

## Migration Plan

### Phase 1: Establish Import Rule
1. Add ESLint rule: `@isl-lang/no-duplicate-ast-imports`
2. Rule forbids importing Domain/ASTNode from non-canonical sources
3. Whitelist current violations for gradual migration

### Phase 2: Delete Copy-Paste Duplicates
Replace local copies with imports from `@isl-lang/parser`:

| Package | Action |
|---------|--------|
| isl-federation | Delete `src/ast.ts`, import from parser |
| versioner | Delete `src/ast-types.ts`, import from parser |
| codegen-go | Delete `src/ast-types.ts`, import from parser |
| codegen-rust | Delete `src/ast-types.ts`, import from parser |
| codegen-loadtest | Delete `src/ast-types.ts`, import from parser |
| security-policies | Delete AST copies from `src/types.ts`, import from parser |

### Phase 3: Build Adapter for isl-core
```typescript
// @isl-lang/isl-core/src/adapters/domain-adapter.ts
import type { Domain } from '@isl-lang/parser';
import type { DomainDeclaration } from '../ast/types.js';

export function domainDeclarationToDomain(decl: DomainDeclaration): Domain { ... }
export function domainToDomainDeclaration(domain: Domain): DomainDeclaration { ... }
```

### Phase 4: Simplify Codegen Types
For packages needing simplified types, create type utilities:

```typescript
// @isl-lang/parser/src/simplified.ts
import type { Domain } from './ast.js';

export type SimpleDomain = Pick<Domain, 'name' | 'version' | 'entities' | 'behaviors'>;
```

### Phase 5: Clean Up Experimental Packages
- Many experimental packages have local types because they're shells
- As packages are promoted, require canonical imports
- Add build-time check for duplicate type definitions

---

## Acceptance Criteria

1. **Single Import Path:** All production packages import AST types from `@isl-lang/parser`
2. **No Copy-Paste Types:** Zero full AST type copies in the codebase
3. **Enforced by Lint:** ESLint rule prevents new violations
4. **Adapter Available:** `@isl-lang/isl-core` provides adapter functions
5. **Tests Pass:** Full test suite passes after migration
6. **Build Passes:** `pnpm -r build` succeeds with no type errors

---

## Alternatives Rejected

### Alternative 1: Make isl-core Canonical
**Rejected because:**
- isl-core has fewer importers
- Different `kind` values would break runtime type guards
- `span` vs `location` naming inconsistency

### Alternative 2: Create New @isl-lang/ast Package
**Rejected because:**
- Adds another package to maintain
- parser is already the natural home
- Would require migrating all 277 import sites

### Alternative 3: Leave As-Is
**Rejected because:**
- Type drift causes runtime bugs
- Maintenance burden of 6+ copies
- Confusing for contributors

---

## Appendix: Files to Touch

### Phase 2 Deletions (6 files)
```
packages/isl-federation/src/ast.ts
packages/versioner/src/ast-types.ts
packages/codegen-go/src/ast-types.ts
packages/codegen-rust/src/ast-types.ts
packages/codegen-loadtest/src/ast-types.ts
packages/security-policies/src/types.ts (partial)
```

### Phase 2 Import Updates (~50 files)
All files that import from the deleted sources above.

### Phase 4 Simplified Types (create)
```
packages/parser/src/simplified.ts (new)
```

### Phase 5 Experimental Package Updates (~30 packages)
When promoted from experimental, update imports.
