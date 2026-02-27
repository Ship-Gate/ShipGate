# Evaluator test coverage

## Target: ≥95%

Coverage thresholds are set in `vitest.config.ts` (lines, functions, branches, statements ≥ 95%). Run:

```bash
pnpm --filter @isl-lang/verifier-runtime run test:coverage
```

If coverage fails with `ERR_MODULE_NOT_FOUND` (e.g. `istanbul-reports`), run a full workspace install from the repo root: `pnpm install`, then retry.

## Test summary

- **228 tests** across 3 files; **192** in `evaluator.test.ts` for the expression evaluator.

### Covered areas

| Area | Description |
|------|-------------|
| **Arithmetic** | `+`, `-`, `*`, `/`, `%` (literals, variables, input, comparisons); unary `-`; division/modulo by zero; string concatenation with `+`. |
| **String ops** | `contains`, `startsWith`, `endsWith`, `concat`, `length` (call + property), `is_valid`; on literals and input fields. |
| **Collection ops** | `length`, `sum`, `count`, `contains`, `isEmpty`, `index` (in-bounds, out-of-bounds, non-number); `IndexExpr` on arrays/objects. |
| **Membership / logic** | `in` (array, string); `iff` (all combinations). |
| **Tri-state** | `triStateAnd`, `triStateOr`, `triStateNot`, `triStateImplies`. |
| **Literals** | String, number, boolean, null. |
| **Comparisons** | `==`, `!=`, `<`, `<=`, `>`, `>=`. |
| **Logical** | `and`, `or`, `implies`, `not`; short-circuit; precedence. |
| **Property / index** | MemberExpr, IndexExpr, nested access. |
| **Calls** | Member calls (entity, string, collection), builtins; failure reasons. |
| **Quantifiers** | `all`, `any` on lists; predicate with arithmetic. |
| **Special** | Conditional, ListExpr, ResultExpr, InputExpr, OldExpr, QualifiedName; depth limit; unsupported kinds; DefaultAdapter; E2E scenarios. |

### Files under coverage

- `src/evaluator.ts` – main evaluator (arithmetic, string, collection, tri-state, recursion, extractValue, etc.).
