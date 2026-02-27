# Phase 0: Parser Decision — Evidence and Recommendation

**Date:** 2025-02-08  
**Goal:** Pick one parser (parser vs isl-core) so Phase 1 consolidation can proceed.

---

## 1. Downstream dependents

### Packages that **import from `@isl-lang/parser`** (parse + Domain / AST types)

| Package | Uses |
|--------|------|
| **core** | Domain, pipeline, isl-lint, isl-migrate, isl-repair, isl-agent |
| **interpreter** | Domain, Expression, scenarios — tree-walking runtime |
| **evaluator** | (internal AST types aligned with parser) — **consumes parser-style AST** |
| **isl-pbt** | Domain, AST — property-based tests, postcondition evaluator |
| **verifier-runtime** | Domain, AST — runtime checks |
| **isl-verify** | Domain |
| **isl-semantic-analysis** | Domain, re-exports from parser, passes use parser AST |
| **import-resolver** | parse(), AST — module graph, bundler |
| **typechecker** | parse() |
| **test-generator** | parse(), AST |
| **codegen-tests** | AST (Domain-shaped) |
| **expression-compiler** | Expression, AST |
| **isl-expression-evaluator** | Expression (tri-state evaluator) |
| **docs-advanced** | AST |
| **lsp-server** | Domain, Behavior, Entity, TypeDeclaration, Expression |
| **mcp-server** | parse(), Domain |
| **build-runner** | parse(), DomainDeclaration (alias from parser) |
| **cli** | parse() from parser; some commands use DomainDeclaration from isl-core |

**Unique packages:** 18+ (core, interpreter, evaluator, isl-pbt, verifier-runtime, isl-verify, isl-semantic-analysis, import-resolver, typechecker, test-generator, codegen-tests, expression-compiler, isl-expression-evaluator, docs-advanced, lsp-server, mcp-server, build-runner, cli).

### Packages that **import from `@isl-lang/isl-core`** (DomainDeclaration / parseISL / AST types only)

| Package | Uses |
|--------|------|
| **verifier-chaos** | DomainDeclaration (types only) |
| **isl-verify-pipeline** | DomainDeclaration, BehaviorDeclaration |
| **isl-smt** | DomainDeclaration, ConditionStatement, TypeConstraint from isl-core/ast |
| **spec-reviewer** | DomainDeclaration, BehaviorDeclaration, EntityDeclaration, etc. |
| **codegen-*** (mocks, types, edge, client, validators, db, grpc, migrations, pipelines) | DomainDeclaration, AST types |
| **ai-generator** | DomainDeclaration, BehaviorDeclaration |
| **api-gateway** | parseISL, DomainDeclaration |
| **autofix** | DomainDeclaration |
| **contract-testing** | parseISL, DomainDeclaration |
| **dependency-analyzer** | parseISL, DomainDeclaration |
| **runtime-sdk** | parseISL, DomainDeclaration |
| **isl-pipeline** | parseISL, DomainDeclaration |
| **isl-proof** | DomainDeclaration; **parse from isl-core/parser** in proof-verify |
| **isl-cli** | parseISL, DomainDeclaration |
| **isl-ai** | DomainDeclaration, AST types |
| **generator-sdk** | parseISL, DomainDeclaration, AST |
| **comparator** | DomainDeclaration |
| **migrations** | DomainDeclaration, AST |
| **lsp** | DomainDeclaration, SourceSpan, etc. |
| **codegen-ui** | isl-core/ast/types |
| **isl-compiler** (tests) | parseISL from isl-core in core-loop.test |
| **isl-semantic-analysis** (some passes) | isl-core types in unused-symbols, purity, import-graph, etc. |

**Unique packages:** 30+ (many codegen-*, spec-reviewer, verifier-chaos, isl-verify-pipeline, isl-smt, api-gateway, autofix, ai-generator, migrations, lsp, isl-proof, isl-cli, isl-pipeline, etc.).

**Summary:** More packages *reference* isl-core **types** (DomainDeclaration). The **parse()** entry point and the **verification loop** (evaluator, typechecker, interpreter, isl-pbt, postcondition codegen) use **parser** and **Domain**. So: parser wins on “who drives the core loop”; isl-core wins on “who has more type-only dependents.”

---

## 2. AST richness (proxy: node kinds)

### packages/parser (single file `ast.ts`)

- **Top-level:** Domain, Import, ImportItem, TypeDeclaration, PrimitiveType, ConstrainedType, EnumType, StructType, Field, UnionType, ListType, MapType, OptionalType, ReferenceType, Annotation, Entity, LifecycleSpec, LifecycleTransition, Behavior, ActorSpec, InputSpec, OutputSpec, ErrorSpec, PostconditionBlock, TemporalSpec, SecuritySpec, ComplianceSpec, ObservabilitySpec, MetricSpec, TraceSpec, LogSpec, InvariantBlock, Policy, PolicyTarget, PolicyRule, View, ViewField, ConsistencySpec, CacheSpec, **ScenarioBlock, Scenario, ChaosBlock, ChaosScenario, Injection, InjectionParam**.
- **Expressions:** Identifier, QualifiedName, Literal, StringLiteral, NumberLiteral, BooleanLiteral, NullLiteral, DurationLiteral, RegexLiteral, BinaryExpr, UnaryExpr, CallExpr, MemberExpr, IndexExpr, QuantifierExpr, ConditionalExpr, **OldExpr, ResultExpr, InputExpr**, LambdaExpr, ListExpr, MapExpr, MapEntry.
- **Statements (scenarios):** AssignmentStmt, CallStmt, LoopStmt, Composition, CompositionStep, Compensation.

**Approx. count:** ~80+ `kind:` / interface-extends-ASTNode in one file.

### packages/isl-core (ast/types.ts + builders)

- **Top-level:** DomainDeclaration, UseStatement, ImportDeclaration, EntityDeclaration, TypeDeclaration, EnumDeclaration, FieldDeclaration, BehaviorDeclaration, ActorsBlock, ActorDeclaration, InputBlock, OutputBlock, ErrorDeclaration, ConditionBlock, Condition, ConditionStatement, InvariantsBlock, InvariantStatement, TemporalBlock, TemporalRequirement, SecurityBlock, SecurityRequirement, ComplianceBlock, ComplianceStandard, ComplianceRequirement, **ChaosBlock, ChaosScenario, ChaosInjection, ChaosExpectation, ChaosArgument, ChaosWithClause**, LifecycleBlock, LifecycleTransition, **UIBlueprintDeclaration, UITokenBlock, UIToken, UISection, UILayout, UIResponsive, UIContentBlock, UIBlockProperty, UIConstraintBlock, UIConstraint**, SimpleType, GenericType, UnionType, TypeVariant, ObjectType, ArrayType, TypeConstraint, Annotation.
- **Expressions:** Identifier, StringLiteral, NumberLiteral, BooleanLiteral, NullLiteral, DurationLiteral, BinaryExpression, UnaryExpression, MemberExpression, CallExpression, ComparisonExpression, LogicalExpression, QuantifiedExpression, OldExpression.

**Summary:** Parser has richer **expression** and **statement** AST (OldExpr, ResultExpr, InputExpr, LambdaExpr, ListExpr, MapExpr, AssignmentStmt, CallStmt, LoopStmt, Composition) required by the evaluator. isl-core has **UI blueprints** and more **granular chaos** (ChaosInjection, ChaosExpectation, ChaosWithClause) and **UseStatement**.

---

## 3. Error recovery and diagnostics

### packages/parser

- **errors.ts:** Structured codes (e.g. L001–L006, P001–P019), message formatting, **findSimilar()** with Levenshtein distance, **ISL_KEYWORDS** for “did you mean?”.
- **ParseResult:** success, errors[], domain (when success), tokens.
- Designed for **usable diagnostics** on malformed input.

### packages/isl-core

- Parser returns `{ ast: DomainDeclaration | null; errors: ParseError[] }`.
- **ParseError** with message; **no** structured suggestion list or keyword hints in the same way.
- Collects multiple errors but less recovery/suggestion machinery.

**Conclusion:** Parser has better error recovery and diagnostics.

---

## 4. Scenario and chaos parsing

### packages/parser

- **Grammar:** `ScenarioBlock`, `Scenario` (given/when/then); `ChaosBlock`, `ChaosScenario` (inject/when/then). Present in both:
  - **Hand-written parser** (`parser.ts`): `parseScenarioBlock()`, `parseScenario()`, `parseChaosBlock()`, `parseChaosScenario()`.
  - **Peggy grammar** (`grammar/isl.peggy`): `ScenarioBlock`, `ScenarioItem`, `ChaosBlock`, `ChaosScenarioItem`.
- AST: `ScenarioBlock`, `Scenario`, `ChaosBlock`, `ChaosScenario`, `Injection`, `InjectionParam`.
- This is the parser that was “at 87%” with scenario/chaos as the main gap (presumably edge cases).

### packages/isl-core

- **Parser** (`parser/parser.ts`): `parseChaos()`, `parseChaosScenario()`, `parseChaosInjection()`, `parseChaosExpectation()`, `parseChaosWithClause()`.
- AST: `ChaosBlock`, `ChaosScenario`, `ChaosInjection`, `ChaosExpectation`, `ChaosArgument`, `ChaosWithClause` (more granular).
- **No** dedicated `ScenarioBlock` / `Scenario` at top level; scenarios appear in behavior context in chaos.

**Conclusion:** Both support chaos. Parser has explicit scenario + chaos blocks and is the one that was driven to 87%. isl-core has finer-grained chaos nodes; these can be merged into parser’s AST in Phase 1 if needed.

---

## 5. Expression parsing and evaluator compatibility

- **packages/evaluator** (tree-walking interpreter): Uses AST shapes that match **parser** — `Domain`, `location`, `OldExpr`, `ResultExpr`, etc. Comment in code: “AST TYPE INTERFACES (for compatibility with @isl-lang/parser)”.
- **packages/isl-expression-evaluator** (tri-state): Imports **Expression** and related types from **@isl-lang/parser**.
- Parser’s **Expression** union and statement types are what the evaluators actually walk.

**Conclusion:** The expression AST the evaluator can walk is **parser’s**; isl-core’s expression set is a different shape and not what the current evaluator uses.

---

## 6. Existing bridge: isl-core adapter

- **packages/isl-core/src/adapters/domain-adapter.ts** converts **parser’s Domain → isl-core’s DomainDeclaration**.
- So the intended design is: **parser** is the producer; **DomainDeclaration** is an alternative view for consumers that want that shape.
- **parser** already exports **backward-compatibility aliases** (`DomainDeclaration = Domain`, `EntityDeclaration = Entity`, etc.) in `ast.ts`; those are the **parser** AST shape, not isl-core’s full DomainDeclaration shape (which has `uses`, `ImportDeclaration`, etc.).

---

## 7. Recommendation: **Pick packages/parser**

| Criterion | Winner | Reason |
|-----------|--------|--------|
| Core loop (evaluator, typechecker, codegen, postconditions) | **parser** | They already use parser’s parse() and Domain. |
| AST richness for evaluation | **parser** | OldExpr, ResultExpr, InputExpr, statements, composition. |
| Expression AST evaluator can walk | **parser** | evaluator and isl-expression-evaluator are built for parser’s Expression. |
| Error recovery | **parser** | Structured codes, findSimilar, keyword suggestions. |
| Scenario + chaos parsing | **parser** | Explicit ScenarioBlock/ChaosBlock; was at 87%. |
| Formal grammar | **parser** | Has `grammar/isl.peggy` alongside hand-written parser. |
| More type-only dependents | isl-core | Many codegen/spec-reviewer packages use DomainDeclaration types; can be served via adapter or re-exports. |

**Decision:** Use **packages/parser** as the single parser. Treat **packages/isl-core** parser as deprecated; keep isl-core’s **AST types** (or a subset) only if we want to preserve DomainDeclaration as a view, and feed it via **parser parse() + adapter** (or by extending parser’s AST and re-exporting from parser).

---

## 8. Phase 1 implications (brief)

1. **Kill or deprecate isl-core’s parser** (and its `parseISL` that returns DomainDeclaration). All call sites should use `parse()` from `@isl-lang/parser`.
2. **DomainDeclaration consumers:** Either (a) use parser’s `Domain` and the existing aliases where they match, or (b) use `parse()` + `adapters.domainToDeclaration(domain)` from isl-core until AST is fully unified.
3. **Preserve isl-core concepts to merge:** UseStatement, UI blueprints, granular chaos (ChaosInjection, ChaosExpectation, ChaosWithClause) can be added to parser’s AST in Phase 1 so one AST has everything.
4. **Single parse entry point:** Everything goes through `@isl-lang/parser`’s `parse()`; isl-core re-exports or wraps it and the adapter instead of maintaining a second parser.

---

## 9. Commands used (for reproducibility)

```bash
# Which packages import from which parser?
grep -r "from.*isl-core" packages/*/src --include="*.ts" -l
grep -r "from.*@isl-lang/parser" packages/*/src --include="*.ts" -l

# AST node counts (manual count from ast.ts / ast/types.ts)
# parser: ~80+ kind/interface in ast.ts
# isl-core: types.ts + builders.ts, similar order of magnitude; different shape
```

(Exact counts were derived from reading `packages/parser/src/ast.ts` and `packages/isl-core/src/ast/types.ts` and related files.)

---

*Phase 0 complete. Proceed to Phase 1 (consolidate) with parser as the single parser.*
