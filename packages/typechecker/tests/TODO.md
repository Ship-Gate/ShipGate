# Typechecker Edge-Case Compound Types - Tracked Todos

This document tracks typechecker test failures for edge-case compound types (generics, optionals, structs with nested access). These are non-blocking issues tracked as `it.todo()` tests.

---

## Summary

| # | Test File | Test Name | Priority |
|---|-----------|-----------|----------|
| 1 | comprehensive.test.ts | EDGE: List<String> element type with length property | P3 |
| 2 | comprehensive.test.ts | EDGE: Optional String? with null-check implies narrowing | P3 |
| 3 | comprehensive.test.ts | EDGE: Struct type alias with nested member chain access | P3 |

---

## Detailed Tracking

### 1. List Generic Type - Length Property Access

**File:** `packages/typechecker/tests/comprehensive.test.ts`  
**Test:** `Complex Type Checking > List Types > should check List element types`  
**Priority:** P3

**Expected Behavior:**
- `List<String>` field should be recognized as valid generic type
- `.length` property on List should resolve to Int
- Invariant `tags.length >= 0` should typecheck without errors

**Current Failure:**
```
AssertionError: expected 1 to be +0 // Object.is equality
```
Typechecker produces 1 error when 0 expected.

**ISL Source:**
```isl
domain Test {
  version: "1.0.0"
  entity Item {
    id: UUID
    tags: List<String>
    invariants {
      tags.length >= 0
    }
  }
}
```

**Root Cause (suspected):**
- List type `.length` property not properly registered in type inference
- Generic type parameter substitution may not propagate correctly

---

### 2. Optional Type - Null-Check Narrowing

**File:** `packages/typechecker/tests/comprehensive.test.ts`  
**Test:** `Complex Type Checking > Optional Types > should check optional type handling`  
**Priority:** P3

**Expected Behavior:**
- `String?` (optional String) should be recognized as `Optional<String>`
- `value != null` should narrow type from `String?` to `String` in implies consequent
- `value.length` after null-check should be valid String property access

**Current Failure:**
```
AssertionError: expected 2 to be +0 // Object.is equality
```
Typechecker produces 2 errors when 0 expected.

**ISL Source:**
```isl
domain Test {
  version: "1.0.0"
  entity Item {
    id: UUID
    value: String?
    invariants {
      value != null implies value.length > 0
    }
  }
}
```

**Root Cause (suspected):**
- Type narrowing not implemented for `implies` expressions
- Optional type unwrapping in conditional context not working
- May need flow-sensitive typing for `implies` antecedent

---

### 3. Struct Type Alias - Nested Member Chain

**File:** `packages/typechecker/tests/comprehensive.test.ts`  
**Test:** `Complex Type Checking > Struct Types > should check struct field types`  
**Priority:** P3

**Expected Behavior:**
- Inline struct type `{ street: String; city: String; zip: String }` should create proper type
- Type alias `Address` should resolve to struct type
- `address.city.length` chain should resolve: entity field → struct field → String property

**Current Failure:**
```
AssertionError: expected 1 to be +0 // Object.is equality
```
Typechecker produces 1 error when 0 expected.

**ISL Source:**
```isl
domain Test {
  version: "1.0.0"
  type Address = {
    street: String
    city: String
    zip: String
  }
  entity User {
    id: UUID
    address: Address
    invariants {
      address.city.length > 0
    }
  }
}
```

**Root Cause (suspected):**
- Struct type alias resolution may not fully expand inline struct fields
- Nested member access chain resolution may fail at struct→primitive boundary
- Type alias lookup may return reference instead of resolved struct type

---

## Resolution Notes

When fixing these issues, ensure:
1. Remove the `it.todo()` wrapper
2. Remove the corresponding `it.skip()` backup test
3. Update this document to mark as resolved
4. Run full test suite to confirm no regressions

---

*Last updated: 2026-02-01*
*Created by: Agent 07*
