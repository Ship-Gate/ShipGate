# ISL Healer Contract

The ISL Healer is a self-healing pipeline that automatically fixes code to comply with ISL specifications. This document defines the **Honesty Contract** — the inviolable rules that ensure healing is legitimate and not a bypass.

## The Moat: Why This Matters

The entire value proposition of ISL depends on **proof that passing means something**. If the healer could cheat — by removing intents, adding suppressions, or weakening rules — then the gate verdict would be meaningless.

The Honesty Guard is the final line of defense.

---

## What the Healer IS Allowed to Do

✅ **Add missing enforcement**
- Rate limiting checks
- Audit logging calls
- Input validation
- Encryption wrappers

✅ **Add missing intent anchors**
- Insert `// @intent` comments in required places
- Add intent exports for traceability

✅ **Minimal refactoring within touched files**
- Extract functions for clarity
- Add helper utilities
- Restructure for compliance

✅ **Add tests required by the spec**
- Generate test cases from postconditions
- Add coverage for edge cases

---

## What the Healer is NOT Allowed to Do

🚫 **Remove intents from ISL spec**
```isl
// FORBIDDEN: Healer cannot do this
- intent rate-limit-required
```

🚫 **Add suppression directives**
```typescript
// FORBIDDEN: Any of these
// shipgate-ignore rate-limit
// @ts-ignore
// @ts-nocheck
// eslint-disable
// NOSONAR
```

🚫 **Downgrade severity**
```json
// FORBIDDEN: Changing error to warning/off
{
  "severity": "warning"  // was "error"
}
```

🚫 **Disable policy packs**
```json
// FORBIDDEN
{
  "rate-limit": {
    "enabled": false
  }
}
```

🚫 **Weaken allowlists**
```typescript
// FORBIDDEN: Wildcards or permitAll
redirect: '*'
allowedOrigins: ['*']
permitAll()
```

🚫 **Bypass authentication**
```typescript
// FORBIDDEN: Any of these patterns
skipAuth: true
noAuth: true
authRequired: false
const isAuthenticated = true; // hardcoded
```

🚫 **Guess fixes for unknown rules**
- If no recipe exists for a rule, the healer must fail with `unknown_rule`
- It cannot invent fixes or skip violations

---

## Honesty Guard Architecture

### Detection Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      HONESTY GUARD                          │
├─────────────────────────────────────────────────────────────┤
│  1. Patch Inspector     - Pattern-based detection           │
│  2. Strict Mode         - Block ALL ISL spec modifications  │
│  3. Weakening Guard     - Semantic analysis of changes      │
│  4. Healer Validator    - Extra strict for automated fixes  │
└─────────────────────────────────────────────────────────────┘
```

### Forbidden Edit Types

| Type | Description | Severity |
|------|-------------|----------|
| `isl_spec_modification` | Any edit to `.isl` files | Critical |
| `suppression_insertion` | Adding ignore directives | Critical |
| `pack_disable` | Disabling policy packs | Critical |
| `severity_downgrade` | Lowering error to warning/off | Critical |
| `allowlist_weaken` | Wildcard or broad allowlists | High |
| `auth_bypass` | Bypassing authentication | Critical |
| `gate_config_weaken` | Weakening gate configuration | Critical |

---

## Usage

### Pre-Commit Hook

```typescript
import { assertCleanDiff } from '@isl-lang/healer';
import { execSync } from 'child_process';

// Get staged diff
const diff = execSync('git diff --cached').toString();

// Will throw UnsafePatchAttempt if cheating detected
assertCleanDiff(diff);
```

### CI Pipeline Integration

```typescript
import { HonestyGuard } from '@isl-lang/healer';

const diff = await getDiffFromPR();
const result = HonestyGuard.checkDiff(diff);

if (result.verdict === 'UNSAFE_PATCH_ATTEMPT') {
  console.error(result.summary);
  process.exit(1);  // Block the PR
}
```

### Healer Self-Validation

```typescript
import { createHealerPatchValidator } from '@isl-lang/healer';

const validatePatches = createHealerPatchValidator();

// After generating patches, validate them
const result = validatePatches(generatedPatches);

if (result.shouldAbort) {
  throw new Error(`Healer attempted forbidden edit: ${result.summary}`);
}
```

---

## Configuration

### Default Configuration

```typescript
const DEFAULT_HONESTY_CONFIG = {
  // Patterns for ISL spec files (protected)
  islSpecPatterns: [
    '**/*.isl',
    '**/specs/**',
    '**/intent/**',
    '**/contracts/**'
  ],
  
  // Patterns for config files (monitored)
  configPatterns: [
    '**/.islrc*',
    '**/shipgate.config.*',
    '**/gate.config.*'
  ],
  
  // Strict mode: ANY edit to ISL specs is forbidden
  strictMode: true,
  
  // Custom patterns to detect (optional)
  customPatterns: [],
  
  // Allowed suppressions with justification (optional)
  allowedSuppressions: []
};
```

### Allowing Specific Suppressions

In rare cases (legacy code migration), you may need to allow specific suppressions:

```typescript
const config = {
  allowedSuppressions: [
    {
      pattern: 'shipgate-ignore no-console',
      justification: 'Legacy code being refactored - TECH-123',
      expires: '2024-06-01'  // Suppression expires after this date
    }
  ]
};

const guard = new HonestyGuard(config);
```

**Note:** The healer itself NEVER uses allowed suppressions. This is only for human-authored code during migration periods.

---

## Verdicts

### CLEAN

The patch set contains no forbidden edits.

```typescript
{
  verdict: 'CLEAN',
  shouldAbort: false,
  exitCode: 0,
  summary: '✓ Patch set is clean (5 files inspected)'
}
```

### UNSAFE_PATCH_ATTEMPT

One or more forbidden edits were detected.

```typescript
{
  verdict: 'UNSAFE_PATCH_ATTEMPT',
  shouldAbort: true,
  exitCode: 1,
  summary: `
╔════════════════════════════════════════════════════════════════╗
║           🛡️  HONESTY GUARD: UNSAFE PATCH DETECTED            ║
╠════════════════════════════════════════════════════════════════╣
║ 🚫 SUPPRESSION DIRECTIVE (1)
║   • src/api/auth.ts:15
║     Suppression directive detected: Shipgate suppression
║ ...
╚════════════════════════════════════════════════════════════════╝
`
}
```

---

## Heal Reasons

When the healer terminates, it provides a reason:

| Reason | Success | Description |
|--------|---------|-------------|
| `ship` | ✅ | All violations resolved, SHIP achieved |
| `stuck` | ❌ | Same fingerprint repeated (no progress) |
| `unknown_rule` | ❌ | No recipe exists for a rule ID |
| `max_iterations` | ❌ | Hit iteration limit without SHIP |
| `weakening_detected` | ❌ | Patch would weaken intent |
| `build_failed` | ❌ | Code no longer compiles after patch |
| `test_failed` | ❌ | Required tests fail after patch |

---

## Testing the Guard

### Unit Test Example

```typescript
import { HonestyGuard, parseDiff } from '@isl-lang/healer';

describe('Honesty Guard', () => {
  it('should reject suppression insertion', () => {
    const diff = `diff --git a/src/api.ts b/src/api.ts
+  // shipgate-ignore rate-limit`;
    
    const result = HonestyGuard.checkDiff(diff);
    
    expect(result.verdict).toBe('UNSAFE_PATCH_ATTEMPT');
    expect(result.inspection.edits[0].type).toBe('suppression_insertion');
  });
  
  it('should allow clean patches', () => {
    const diff = `diff --git a/src/api.ts b/src/api.ts
+  const result = await rateLimit(request);`;
    
    const result = HonestyGuard.checkDiff(diff);
    
    expect(result.verdict).toBe('CLEAN');
  });
});
```

---

## FAQ

### Q: Can the healer ever modify ISL specs?

**No.** ISL specifications are immutable once created. The healer's job is to make code comply with the spec, not to change the spec to match the code.

### Q: What if I need to update an ISL spec?

Update it through your normal development process (human-authored PR). The Honesty Guard only blocks automated/healer modifications. You can also disable strict mode for human commits if needed.

### Q: Why block @ts-ignore if it's for a legitimate type issue?

The healer should fix the type issue, not suppress it. Suppressions hide problems; the healer should solve them. If TypeScript can't understand the code, the code should be clarified.

### Q: What about test files?

Test files are inspected like any other file. If your tests need suppressions, that's usually a sign the test or the code under test needs improvement.

### Q: Can I disable the Honesty Guard?

You can configure it (e.g., disable strict mode), but you cannot fully disable it for healer patches. The guard is fundamental to the ISL trust model.

---

## Security Considerations

The Honesty Guard is a defense-in-depth measure. It assumes:

1. **Attackers may try to bypass the gate** by modifying specs or adding suppressions
2. **Automated tools (including AI) may hallucinate bypasses** that look legitimate
3. **Human error may introduce weakening** during refactoring

The guard catches all these scenarios by inspecting the actual bytes being committed.

### Threat Model

| Threat | Mitigation |
|--------|------------|
| Remove intent from spec | Strict mode blocks all ISL edits |
| Add suppression comment | Pattern matching on all suppressions |
| Disable policy pack | Config file monitoring |
| Weaken allowlist | Wildcard and permitAll detection |
| Auth bypass | Authentication pattern matching |
| Novel bypass technique | Extensible custom patterns |

---

## Related Documentation

- [ISL Syntax Reference](./SYNTAX.md)
- [Policy Packs](./packages/isl-policy-packs/README.md)
- [Gate System](./packages/shipgate/README.md)
- [Proof Bundle Format](./packages/isl-healer/ARCHITECTURE.md)
