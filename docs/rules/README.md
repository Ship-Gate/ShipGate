# ISL Semantic Rules Documentation

This directory contains documentation for the semantic rules enforced by the ISL healer.

## Rules Overview

| Rule ID | Severity | Description |
|---------|----------|-------------|
| [intent/audit-required](./audit-required.md) | Critical | Audit must cover ALL exit paths |
| [intent/rate-limit-required](./rate-limit-required.md) | High | Rate limit must be BEFORE body parsing |
| [intent/no-pii-logging](./no-pii-logging.md) | Critical | No PII in logs, no console.* |
| [quality/no-stubbed-handlers](./no-stubbed-handlers.md) | Critical | No "Not implemented" stubs |

## How Rules Work

### Detection

Rules use AST-based analysis to detect violations:

1. **Parse handlers**: Extract exported HTTP method functions (GET, POST, etc.)
2. **Analyze structure**: Find exit paths, audit calls, log statements
3. **Check semantics**: Verify order, coverage, and correctness
4. **Report violations**: Include line numbers, evidence, and fix suggestions

### Fixing

Each rule has a **deterministic fix recipe**:

1. **Same input → same output**: Patches are reproducible
2. **No suppressions**: Recipes fix the actual issue, not hide it
3. **Validates result**: Recipe verifies the patch satisfies the rule
4. **Minimal changes**: Only touches what's necessary

### Verification

After patching, the healer:

1. **Re-runs rules**: Ensures violations are resolved
2. **Type checks**: Verifies patched code compiles
3. **Prevents weakening**: Rejects patches that add suppressions

## Using `rules explain`

To get documentation for a specific rule:

```bash
# CLI
isl rules explain intent/audit-required

# Programmatic
import { explainRule } from '@isl-lang/healer/rules';
const explanation = explainRule('intent/audit-required');
```

## Rule Categories

### Intent Rules (`intent/*`)

These rules enforce intents declared in ISL specifications:

- **audit-required**: Every behavior exit must be audited
- **rate-limit-required**: Rate limiting must be enforced early
- **no-pii-logging**: No PII can leak to logs
- **input-validation**: Input must be validated before use
- **encryption-required**: Sensitive data must be encrypted

### Quality Rules (`quality/*`)

These rules enforce code quality standards:

- **no-stubbed-handlers**: No placeholder implementations
- **validation-before-use**: Validate input before business logic

## Fail → Heal → Pass Cycle

The healer implements a cycle:

```
1. FAIL: Detect violations
   ↓
2. HEAL: Apply fix recipes
   ↓  
3. CHECK: Re-run rules
   ↓
4. REPEAT or PASS
```

**Key principle**: Passing means real enforcement, not "string present."

## Adding New Rules

To add a new rule:

1. **Create rule in** `src/rules/ast-semantic-rules.ts`:
   ```typescript
   export const myRule: SemanticRule = {
     id: 'intent/my-rule',
     description: '...',
     check(code, file) {
       // Return violations
     },
   };
   ```

2. **Create recipe in** `src/rules/deterministic-recipes.ts`:
   ```typescript
   export const myRecipe: FixRecipe = {
     ruleId: 'intent/my-rule',
     description: '...',
     createPatches(violation, ctx) {
       // Return patches
     },
     validate(original, patched, violation) {
       // Return { valid, reason }
     },
     verifyWith: ['gate'],
   };
   ```

3. **Add tests in** `tests/rules/`:
   - FAIL: Code with violation is detected
   - HEAL: Recipe produces correct patches
   - PASS: Healed code passes checks

4. **Document in** `docs/rules/`:
   - Summary
   - Why it matters
   - Detection method
   - Fix recipe
   - Examples (fail and pass)
