# ISL Expression Evaluator v1 - Test Cases

This document defines 30 test cases covering edge cases, precedence, and tri-state logic.

---

## Test Matrix Overview

| Category | Count | Description |
|----------|-------|-------------|
| Literals | 5 | Basic literal evaluation |
| Comparison Operators | 6 | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Logical Operators | 6 | `and`, `or`, `not`, `implies` |
| Tri-State Propagation | 5 | `unknown` handling |
| Built-in Functions | 5 | `is_valid`, `length`, `exists`, `regex` |
| Quantifiers | 3 | `all`, `any` |
| Edge Cases & Precedence | 5 | Complex expressions |

**Total: 35 test cases**

---

## 1. Literals (5 tests)

### TC-LIT-001: Boolean true literal
```typescript
Expression: true
Expected: 'true'
```

### TC-LIT-002: Boolean false literal
```typescript
Expression: false
Expected: 'false'
```

### TC-LIT-003: Null literal evaluates to false
```typescript
Expression: null
Expected: 'false'
```

### TC-LIT-004: String literal evaluates to true (non-null)
```typescript
Expression: "hello"
Expected: 'true'
```

### TC-LIT-005: Number zero evaluates to true (non-null)
```typescript
Expression: 0
Expected: 'true'
Context: Number 0 is falsy in JS but represents a known value
```

---

## 2. Comparison Operators (6 tests)

### TC-CMP-001: Equality with equal numbers
```typescript
Expression: 5 == 5
Expected: 'true'
```

### TC-CMP-002: Equality with unequal numbers
```typescript
Expression: 5 == 10
Expected: 'false'
```

### TC-CMP-003: Inequality with unequal numbers
```typescript
Expression: 5 != 10
Expected: 'true'
```

### TC-CMP-004: Less than boundary - equal values
```typescript
Expression: 5 < 5
Expected: 'false'
Edge case: Boundary condition at equality
```

### TC-CMP-005: Greater than or equal boundary
```typescript
Expression: 5 >= 5
Expected: 'true'
Edge case: Boundary condition at equality
```

### TC-CMP-006: Mixed type comparison returns unknown
```typescript
Expression: "5" == 5
Expected: 'unknown'
Edge case: Type mismatch (string vs number)
```

---

## 3. Logical Operators (6 tests)

### TC-LOG-001: AND with both true
```typescript
Expression: true and true
Expected: 'true'
```

### TC-LOG-002: AND short-circuits on false
```typescript
Expression: false and <any>
Expected: 'false'
Edge case: Right operand not evaluated when left is false
```

### TC-LOG-003: OR short-circuits on true
```typescript
Expression: true or <any>
Expected: 'true'
Edge case: Right operand not evaluated when left is true
```

### TC-LOG-004: NOT negates true
```typescript
Expression: not true
Expected: 'false'
```

### TC-LOG-005: IMPLIES with false antecedent
```typescript
Expression: false implies false
Expected: 'true'
Edge case: Vacuous truth - false implies anything is true
```

### TC-LOG-006: IMPLIES with true antecedent, false consequent
```typescript
Expression: true implies false
Expected: 'false'
```

---

## 4. Tri-State Propagation (5 tests)

### TC-TRI-001: Unknown variable returns unknown
```typescript
Expression: unknownVar
Context: { variables: {} }
Expected: 'unknown'
```

### TC-TRI-002: AND with unknown and true returns unknown
```typescript
Expression: unknown and true
Expected: 'unknown'
Rationale: Cannot determine result without knowing left operand
```

### TC-TRI-003: AND with unknown and false returns false
```typescript
Expression: unknown and false
Expected: 'false'
Rationale: false AND anything = false (domination rule)
```

### TC-TRI-004: OR with unknown and true returns true
```typescript
Expression: unknown or true
Expected: 'true'
Rationale: true OR anything = true (domination rule)
```

### TC-TRI-005: IMPLIES with false antecedent, unknown consequent
```typescript
Expression: false implies unknown
Expected: 'true'
Rationale: false implies anything = true (vacuous truth)
```

---

## 5. Built-in Functions (5 tests)

### TC-FN-001: is_valid with non-empty string
```typescript
Expression: is_valid("hello")
Expected: 'true'
```

### TC-FN-002: is_valid with empty string
```typescript
Expression: is_valid("")
Expected: 'false'
```

### TC-FN-003: length returns numeric value
```typescript
Expression: length("hello") == 5
Expected: 'true'
```

### TC-FN-004: regex matches valid pattern
```typescript
Expression: regex("test@example.com", "^[^@]+@[^@]+\\.[^@]+$")
Expected: 'true'
```

### TC-FN-005: regex returns false for non-match
```typescript
Expression: regex("invalid", "^[0-9]+$")
Expected: 'false'
```

---

## 6. Quantifiers (3 tests)

### TC-QNT-001: all with all elements satisfying predicate
```typescript
Expression: all x in [1, 2, 3]: x > 0
Expected: 'true'
```

### TC-QNT-002: all with one element failing predicate
```typescript
Expression: all x in [1, -2, 3]: x > 0
Expected: 'false'
```

### TC-QNT-003: any with empty collection
```typescript
Expression: any x in []: x > 0
Expected: 'false'
Edge case: any on empty is false (no element satisfies)
```

---

## 7. Edge Cases & Precedence (5 tests)

### TC-EDGE-001: Operator precedence - AND before OR
```typescript
Expression: true or false and false
Parsed as: true or (false and false)
Expected: 'true'
```

### TC-EDGE-002: Parentheses override precedence
```typescript
Expression: (true or false) and false
Expected: 'false'
```

### TC-EDGE-003: Nested member access
```typescript
Expression: user.profile.email != null
Context: { variables: { user: { profile: { email: "a@b.com" } } } }
Expected: 'true'
```

### TC-EDGE-004: Missing intermediate property returns unknown
```typescript
Expression: user.profile.email
Context: { variables: { user: {} } }
Expected: 'unknown'
Edge case: user.profile is undefined
```

### TC-EDGE-005: Max depth exceeded
```typescript
Expression: <deeply nested expression, 1001 levels>
Context: { maxDepth: 1000 }
Expected: EvaluationError thrown
Edge case: Infinite recursion protection
```

---

## Additional Edge Cases (5 bonus tests)

### TC-EXTRA-001: Chained comparisons with AND
```typescript
Expression: x > 0 and x < 10
Context: { variables: { x: 5 } }
Expected: 'true'
```

### TC-EXTRA-002: IMPLIES chain
```typescript
Expression: a implies b implies c
Context: { variables: { a: true, b: true, c: false } }
Parsed as: a implies (b implies c)
Expected: 'false'
```

### TC-EXTRA-003: Quantifier with unknown element
```typescript
Expression: all x in [1, unknown, 3]: x > 0
Expected: 'unknown'
Rationale: Cannot determine if unknown element satisfies predicate
```

### TC-EXTRA-004: exists with adapter returning unknown
```typescript
Expression: exists("User", { id: "123" })
Context: { adapter: { exists: () => 'unknown' } }
Expected: 'unknown'
```

### TC-EXTRA-005: Complex postcondition expression
```typescript
Expression: result.success implies (result.data != null and length(result.data.items) > 0)
Context: { result: { success: true, data: { items: [1, 2, 3] } } }
Expected: 'true'
```

---

## Implementation Notes

### Test Helpers

```typescript
// Create expression helper
function bin(op: string, left: Expression, right: Expression): Expression;
function unary(op: string, operand: Expression): Expression;
function call(name: string, args: Expression[]): Expression;
function member(obj: Expression, prop: string): Expression;
function quantifier(q: 'all' | 'any', v: string, col: Expression, pred: Expression): Expression;

// Create context helper
function ctx(vars?: Record<string, unknown>, input?: Record<string, unknown>): EvaluationContext;
```

### Coverage Goals

| Metric | Target |
|--------|--------|
| Line coverage | 90% |
| Branch coverage | 85% |
| Function coverage | 90% |

### Test Categories Breakdown

```
┌─────────────────────────────────────────────────────┐
│                  TEST COVERAGE MAP                  │
├─────────────────────────────────────────────────────┤
│ Literals           ████████████░░░░░░░░░░  14%     │
│ Comparisons        ████████████████░░░░░░  17%     │
│ Logical Ops        ████████████████░░░░░░  17%     │
│ Tri-State          ██████████████░░░░░░░░  14%     │
│ Built-ins          ██████████████░░░░░░░░  14%     │
│ Quantifiers        ████████░░░░░░░░░░░░░░  9%      │
│ Edge Cases         ██████████████░░░░░░░░  14%     │
└─────────────────────────────────────────────────────┘
```

---

## Test Execution

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test --coverage

# Run specific category
pnpm test --grep "TC-LOG"

# Run in watch mode
pnpm test --watch
```

---

## Regression Tests

Add these tests when bugs are found:

| Bug ID | Description | Test Case |
|--------|-------------|-----------|
| (template) | (description) | (test name) |

---

## Performance Benchmarks

| Benchmark | Target | Actual |
|-----------|--------|--------|
| 1000 simple comparisons | < 100ms | TBD |
| 100 quantifiers (10 items each) | < 200ms | TBD |
| Deeply nested (100 levels) | < 50ms | TBD |
