# Success Criteria: Login Self-Heals to SHIP with Proof

## Scenario

Given:
- Natural language prompt: "Build a login endpoint with rate limiting, audit logging, and no PII in logs"
- Generated ISL spec with intents: `rate-limit-required`, `audit-required`, `no-pii-logging`
- Initial code generation with deliberate violations

The healer MUST:
1. Detect all violations
2. Apply appropriate fixes
3. Reach SHIP verdict
4. Produce auditable proof

---

## Acceptance Checklist

### Phase 1: Setup
- [ ] **ISL Spec Locked**: ISL spec is frozen after translation (hash recorded)
- [ ] **Initial Code Generated**: Route file(s) created with known violations
- [ ] **Violations Seeded**: Code contains `console.log`, missing rate limit, missing audit

### Phase 2: Gate Detection
- [ ] **Gate Runs**: Initial gate check executes without error
- [ ] **Violations Detected**: At least 3 violations identified:
  - [ ] `intent/rate-limit-required` (missing rate limiting)
  - [ ] `intent/audit-required` (missing audit calls)
  - [ ] `intent/no-pii-logging` or `pii/console-in-production` (console.log found)
- [ ] **Score Calculated**: Score < 80 (NO_SHIP condition)
- [ ] **Fingerprint Generated**: Deterministic fingerprint computed

### Phase 3: Healing Loop
- [ ] **Recipes Found**: All violation rule IDs have registered recipes
- [ ] **No Unknown Rules**: `findUnknownRules()` returns empty array
- [ ] **Patches Generated**: For each violation:
  - [ ] Rate limit: import + middleware check added
  - [ ] Audit: import + audit calls on success/error paths
  - [ ] PII: console.log statements removed
- [ ] **Weakening Guard**: No patches blocked (no suppressions added)
- [ ] **Patches Applied**: All patches successfully applied to code
- [ ] **Iteration Recorded**: Snapshot saved with:
  - [ ] Violation count
  - [ ] Patches applied
  - [ ] Code state hash
  - [ ] Duration

### Phase 4: Re-Gate
- [ ] **Gate Re-runs**: Second gate check after patches
- [ ] **Violations Resolved**: All 3 original violations gone
- [ ] **Score Improved**: Score ≥ 80
- [ ] **Verdict SHIP**: Gate returns `verdict: 'SHIP'`

### Phase 5: Proof Bundle
- [ ] **ProofBundleV2 Created**: Bundle has `version: '2.0.0'`
- [ ] **Source Recorded**: ISL spec hash, domain, version included
- [ ] **Healing History Included**: `healing.history` has ≥ 1 iteration
- [ ] **Evidence Linked**: Each ISL intent has `ClauseEvidence`:
  - [ ] `rate-limit-required` → code location with rate limit check
  - [ ] `audit-required` → code locations with audit calls
  - [ ] `no-pii-logging` → status: 'healed', no console.log
- [ ] **Gate Result Included**: Final gate result in `gate` field
- [ ] **Chain Integrity**: Proof chain has entries: `init → gate → patch → validate → finalize`
- [ ] **Bundle ID Deterministic**: Same input produces same `bundleId`

### Phase 6: Invariants Verified
- [ ] **INV-1**: ISL AST unchanged (hash matches original)
- [ ] **INV-2**: No suppression patterns in final code
- [ ] **INV-3**: No severity downgrades occurred
- [ ] **INV-4**: No unknown rules encountered
- [ ] **INV-5**: All iterations have complete snapshots
- [ ] **INV-6**: Iterations ≤ maxIterations
- [ ] **INV-7**: Running heal again produces identical result

---

## Test Cases

### TC-01: Happy Path - Login Heals to SHIP

```typescript
describe('Login self-heals to SHIP', () => {
  it('heals violations and produces proof', async () => {
    // Given
    const prompt = 'Build a login endpoint with rate limiting, audit logging, and no PII in logs';
    const ast = await translate(prompt);
    const initialCode = await generate(ast);
    
    // Inject known violations
    const codeWithViolations = new Map(initialCode);
    codeWithViolations.set('app/api/login/route.ts', `
      export async function POST(request: Request) {
        const body = await request.json();
        console.log('Login attempt:', body); // PII violation
        // No rate limit
        // No audit
        return Response.json({ success: true });
      }
    `);
    
    // When
    const result = await healUntilShip(ast, codeWithViolations, {
      maxIterations: 8,
      verbose: true,
    });
    
    // Then
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('ship');
    expect(result.gate.verdict).toBe('SHIP');
    expect(result.iterations).toBeLessThanOrEqual(3);
    
    // Proof bundle checks
    expect(result.proof.version).toBe('2.0.0');
    expect(result.proof.healing.performed).toBe(true);
    expect(result.proof.healing.history.length).toBeGreaterThan(0);
    expect(result.proof.verdict).toBe('HEALED');
    
    // Code checks
    const finalCode = result.finalCode.get('app/api/login/route.ts')!;
    expect(finalCode).toContain('rateLimit');
    expect(finalCode).toContain('audit');
    expect(finalCode).not.toContain('console.log');
  });
});
```

### TC-02: Unknown Rule Aborts

```typescript
it('aborts on unknown rule', async () => {
  // Given: A violation with unregistered rule ID
  const violations: Violation[] = [{
    ruleId: 'unknown/made-up-rule',
    file: 'app/api/login/route.ts',
    span: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
    message: 'Unknown violation',
    severity: 'high',
    evidence: {},
  }];
  
  // When
  const result = await healer.heal();
  
  // Then
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('unknown_rule');
  expect(result.unknownRules).toContain('unknown/made-up-rule');
});
```

### TC-03: Weakening Blocked

```typescript
it('blocks patches that add suppressions', async () => {
  // Given: A malicious recipe that tries to add @ts-ignore
  const maliciousRecipe: FixRecipe = {
    ruleId: 'test/suppression',
    name: 'Suppression Adder',
    description: 'Tries to add @ts-ignore',
    priority: 1,
    match: { textPattern: /.*/ },
    locate: { type: 'violation_span' },
    createPatches: () => [{
      type: 'insert',
      file: 'test.ts',
      content: '// @ts-ignore\n',
      description: 'Add suppression',
    }],
    validations: [],
    rerunChecks: ['gate'],
  };
  
  registry.register(maliciousRecipe);
  
  // When
  const result = await healer.heal();
  
  // Then
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('weakening_detected');
});
```

### TC-04: Stuck Detection

```typescript
it('detects stuck loop', async () => {
  // Given: A recipe that doesn't actually fix the violation
  const brokenRecipe: FixRecipe = {
    ruleId: 'test/stuck',
    name: 'Broken Recipe',
    description: 'Does nothing',
    priority: 1,
    match: { textPattern: /.*/ },
    locate: { type: 'violation_span' },
    createPatches: () => [], // No patches = same fingerprint
    validations: [],
    rerunChecks: ['gate'],
  };
  
  // When
  const result = await healer.heal();
  
  // Then
  expect(result.ok).toBe(false);
  expect(result.reason).toBe('stuck');
});
```

### TC-05: Determinism

```typescript
it('produces identical results for same input', async () => {
  // When: Run healer twice with same input
  const result1 = await healUntilShip(ast, code, options);
  const result2 = await healUntilShip(ast, code, options);
  
  // Then
  expect(result1.proof.bundleId).toBe(result2.proof.bundleId);
  expect(result1.gate.fingerprint).toBe(result2.gate.fingerprint);
  expect(result1.iterations).toBe(result2.iterations);
});
```

---

## Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Healing Success Rate | ≥ 95% | % of known violations healed |
| Average Iterations | ≤ 3 | Mean iterations to SHIP |
| False Positives | 0 | Patches that introduce new violations |
| Weakening Attempts Blocked | 100% | All suppression patterns caught |
| Unknown Rule Detection | 100% | All unknown rules abort correctly |
| Proof Completeness | 100% | All SHIP results have valid proof |
| Determinism | 100% | Same input → same output |

---

## Definition of Done

The feature is complete when:

1. **All test cases pass** in CI
2. **Login scenario** heals to SHIP in ≤ 3 iterations
3. **ProofBundleV2** contains complete healing history
4. **No regressions** in existing healer tests
5. **Documentation** updated (README, API docs)
6. **Code review** approved by 2 reviewers
7. **Demo script** works end-to-end
