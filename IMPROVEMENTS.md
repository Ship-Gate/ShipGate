# IntentOS Improvement Plan

## Priority 1: Critical (Blocks Core Functionality)

### 1.1 Complete Expression Evaluator
**Status:** 🔴 Incomplete  
**Impact:** Verification doesn't actually verify

```typescript
// CURRENT: Postconditions become TODO comments
postconditions {
  success implies User.exists(result.id)
}
// Generated test: expect(/* User.exists(result.id) */).toBe(true)

// NEEDED: Actually evaluate the expression
// Generated test: expect(await userRepo.exists(result.id)).toBe(true)
```

**Fix:** Complete `packages/verifier-runtime/src/expressions.ts`

### 1.2 Import Resolution
**Status:** 🔴 Not implemented  
**Impact:** Can't use stdlib libraries

```isl
// CURRENT: This parses but doesn't resolve
use stdlib-auth  // ← What entities/behaviors does this add?

// NEEDED: Load and merge the stdlib definitions
```

**Fix:** Add import resolver to parser/compiler

### 1.3 Semantic Analysis (Type Checking)
**Status:** 🔴 Missing  
**Impact:** Invalid specs aren't caught

```isl
// CURRENT: This parses successfully (shouldn't!)
entity User {
  status: NonExistentType  // ← Should error
}
```

**Fix:** Add type checker pass after parsing

---

## Priority 2: High (Major UX Issues)

### 2.1 Executable Test Generation
**Status:** 🟡 Partial  
**Impact:** Tests need manual completion

```typescript
// CURRENT
it('validates precondition: email.is_valid', async () => {
  // TODO: Implement test
});

// NEEDED
it('validates precondition: email.is_valid', async () => {
  const invalidInput = { email: 'not-an-email', password: 'validpass123' };
  const result = await login(invalidInput);
  expect(result.success).toBe(false);
});
```

### 2.2 Watch Mode
**Status:** 🟡 Missing  
**Impact:** Poor development experience

```bash
# CURRENT: Must re-run manually
isl build spec.isl

# NEEDED: Auto-rebuild on change
isl build spec.isl --watch
```

### 2.3 Better Error Messages
**Status:** 🟡 Basic  
**Impact:** Hard to debug issues

```
# CURRENT
Error: Unexpected token at line 15

# NEEDED
Error: Unexpected token 'implies' at line 15:28
  
  postconditions {
    success implies {
            ^^^^^^^
  
  Hint: Did you mean to use 'implies' inside a postcondition block?
  See: https://intentos.dev/docs/postconditions
```

---

## Priority 3: Medium (Nice to Have)

### 3.1 AI Implementation Generator
Connect to LangChain agents for generating actual implementations

### 3.2 Incremental Builds
Only rebuild what changed

### 3.3 Configuration File
`isl.config.json` for project settings

### 3.4 VS Code Extension Improvements
Real-time error highlighting, autocomplete

---

## Priority 4: Future (Roadmap)

### 4.1 Formal Verification
Integration with TLA+, Alloy, or Z3 for mathematical proofs

### 4.2 Mutation Testing
Test the quality of tests themselves

### 4.3 Property-Based Testing
Generate random inputs to find edge cases

### 4.4 Multi-Language Support
Generate Go, Rust, Python implementations

---

## Quick Wins (Can Fix Today)

1. **Add import stubs** - Make `use stdlib-*` work by bundling stdlib ISL files
2. **Improve error messages** - Add line/column context to errors
3. **Add watch mode** - Simple file watcher for CLI
4. **Complete common expressions** - Handle `==`, `!=`, `.exists()`, `.length`

---

## Effort Estimates

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Expression evaluator (basic) | 2-3 days | High |
| Import resolution | 1-2 days | High |
| Type checker (basic) | 3-5 days | High |
| Executable tests | 2-3 days | High |
| Watch mode | 1 day | Medium |
| Better errors | 1-2 days | Medium |
| AI generator integration | 1 week | High |
| Formal verification | 2+ weeks | Medium |
