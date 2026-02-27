# ISL Expression Evaluator - Tri-State Logic Truth Tables

This document provides comprehensive truth tables for the tri-state logic used in the ISL Expression Evaluator. The evaluator uses three states:

- **`true`**: Expression definitely evaluates to true
- **`false`**: Expression definitely evaluates to false
- **`unknown`**: Expression cannot be determined (missing data, runtime dependency)

## Rationale for Tri-State Logic

In contract verification, we often encounter situations where:
1. Input values may not be fully known at analysis time
2. Runtime dependencies (database lookups, external services) cannot be resolved statically
3. Some paths through the code may have conditions that cannot be evaluated

Rather than fail-fast or make assumptions, the tri-state approach:
- **Preserves correctness** by explicitly tracking uncertainty
- **Enables partial evaluation** where known values can short-circuit
- **Provides provenance** so users understand why something is unknown

---

## Boolean Operations

### AND (`&&` / `and`)

AND returns `false` if either operand is `false` (false dominates unknown).

| A       | B       | A && B  |
|---------|---------|---------|
| true    | true    | true    |
| true    | false   | false   |
| true    | unknown | unknown |
| false   | true    | false   |
| false   | false   | false   |
| **false** | **unknown** | **false** | ← false dominates |
| unknown | true    | unknown |
| **unknown** | **false** | **false** | ← false dominates |
| unknown | unknown | unknown |

**Key insight**: If we know one operand is `false`, the entire AND is `false` regardless of the other operand.

```typescript
function triAnd(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'false' || b === 'false') return 'false';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'true';
}
```

---

### OR (`||` / `or`)

OR returns `true` if either operand is `true` (true dominates unknown).

| A       | B       | A \|\| B |
|---------|---------|----------|
| true    | true    | true     |
| true    | false   | true     |
| **true** | **unknown** | **true** | ← true dominates |
| false   | true    | true     |
| false   | false   | false    |
| false   | unknown | unknown  |
| **unknown** | **true** | **true** | ← true dominates |
| unknown | false   | unknown  |
| unknown | unknown | unknown  |

**Key insight**: If we know one operand is `true`, the entire OR is `true` regardless of the other operand.

```typescript
function triOr(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'true' || b === 'true') return 'true';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'false';
}
```

---

### NOT (`!` / `not`)

NOT inverts `true` ↔ `false` but preserves `unknown`.

| A       | !A      |
|---------|---------|
| true    | false   |
| false   | true    |
| unknown | unknown |

**Key insight**: If we don't know the input, we can't know its negation.

```typescript
function triNot(a: EvalKind): EvalKind {
  if (a === 'true') return 'false';
  if (a === 'false') return 'true';
  return 'unknown';
}
```

---

### IMPLIES (`implies`)

Implication is defined as `!A || B` (if A then B).

| A       | B       | !A      | A implies B |
|---------|---------|---------|-------------|
| true    | true    | false   | true        |
| true    | false   | false   | false       |
| true    | unknown | false   | unknown     |
| **false** | **true** | **true** | **true** | ← vacuous truth |
| **false** | **false** | **true** | **true** | ← vacuous truth |
| **false** | **unknown** | **true** | **true** | ← vacuous truth |
| unknown | true    | unknown | **true** | ← true dominates in OR |
| unknown | false   | unknown | unknown     |
| unknown | unknown | unknown | unknown     |

**Key insights**:
1. **Vacuous truth**: If the antecedent (A) is `false`, the implication is always `true`. This is standard logical behavior: "if pigs fly, then I'm the queen" is true because pigs don't fly.
2. When A is `unknown` but B is `true`, the result is `true` because `!unknown || true = true` (true dominates in OR).

```typescript
function triImplies(a: EvalKind, b: EvalKind): EvalKind {
  return triOr(triNot(a), b);
}
```

---

## Comparison Operators

### Equality (`==`)

| Left    | Right   | Left == Right |
|---------|---------|---------------|
| known   | known   | true/false based on deep equality |
| known   | unknown | unknown       |
| unknown | known   | unknown       |
| unknown | unknown | unknown       |

### Inequality (`!=`)

Inequality is the negation of equality.

| Left    | Right   | Left != Right |
|---------|---------|---------------|
| known   | known   | true/false based on deep inequality |
| known   | unknown | unknown       |
| unknown | known   | unknown       |
| unknown | unknown | unknown       |

### Relational (`<`, `<=`, `>`, `>=`)

| Left    | Right   | Comparison Result |
|---------|---------|-------------------|
| number  | number  | true/false based on comparison |
| number  | unknown | unknown           |
| unknown | number  | unknown           |
| unknown | unknown | unknown           |
| non-num | any     | false (type error)|

---

## Unknown Propagation Rules

### Short-Circuit Evaluation

The evaluator uses short-circuit evaluation for efficiency:

```
false && <anything> = false   // Don't evaluate right side
true || <anything> = true     // Don't evaluate right side
false implies <anything> = true // Vacuous truth
```

### Propagation Priority

1. **Known values dominate when logically sufficient**
   - `false && unknown = false`
   - `true || unknown = true`

2. **Unknown propagates otherwise**
   - `true && unknown = unknown`
   - `false || unknown = unknown`

3. **In comparisons, any unknown operand yields unknown**
   - `x == unknown = unknown`
   - `unknown < 5 = unknown`

---

## Quantifiers

### ALL (∀)

| Collection | Predicate Results | all(x: collection, predicate(x)) |
|------------|-------------------|----------------------------------|
| []         | N/A               | true (vacuously true)            |
| [...]      | all true          | true                             |
| [...]      | any false         | false                            |
| [...]      | any unknown, no false | unknown                      |

### ANY (∃)

| Collection | Predicate Results | any(x: collection, predicate(x)) |
|------------|-------------------|----------------------------------|
| []         | N/A               | false (empty collection)         |
| [...]      | any true          | true                             |
| [...]      | all false         | false                            |
| [...]      | any unknown, no true | unknown                       |

---

## Special Cases

### Null/Undefined Values

| Value     | is_valid | As Boolean |
|-----------|----------|------------|
| null      | false    | false      |
| undefined | false    | false      |
| ''        | false    | true (exists but empty) |
| 0         | true     | depends on context |
| []        | false    | true (exists but empty) |
| {}        | true     | true       |

### The 'unknown' Marker

The special string `'unknown'` is used as a sentinel value in contexts:

```typescript
// Unknown propagates through property access
obj.prop where obj is unknown → unknown
obj.prop where prop doesn't exist → unknown

// Unknown propagates through function calls
is_valid(unknown) → unknown
length(unknown) → unknown
```

---

## Implementation Reference

```typescript
// Core tri-state functions
export function triAnd(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'false' || b === 'false') return 'false';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'true';
}

export function triOr(a: EvalKind, b: EvalKind): EvalKind {
  if (a === 'true' || b === 'true') return 'true';
  if (a === 'unknown' || b === 'unknown') return 'unknown';
  return 'false';
}

export function triNot(a: EvalKind): EvalKind {
  if (a === 'true') return 'false';
  if (a === 'false') return 'true';
  return 'unknown';
}

export function triImplies(a: EvalKind, b: EvalKind): EvalKind {
  return triOr(triNot(a), b);
}
```

---

## Usage Examples

### Postcondition: Session Validation

```
success implies result.session.status == ACTIVE
```

| success | result.session.status | Result |
|---------|----------------------|--------|
| true    | ACTIVE               | true   |
| true    | INACTIVE             | false  |
| true    | unknown              | unknown|
| false   | any                  | true (vacuous) |
| unknown | ACTIVE               | true   |
| unknown | unknown              | unknown|

### Invariant: Password Security

```
not contains(logs, input.password)
```

| contains(logs, password) | Result |
|-------------------------|--------|
| true                    | false (violation!) |
| false                   | true   |
| unknown                 | unknown|
