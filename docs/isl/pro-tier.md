# ISL Pro Tier — $29/month

ISL Pro unlocks advanced verification capabilities, deeper analysis, and team features.

## Free vs Pro Comparison

| Feature | Free | Pro ($29/mo) |
|---------|------|--------------|
| Spec parsing & checking | ✓ | ✓ |
| TypeScript code generation | ✓ | ✓ |
| Basic test generation | ✓ | ✓ |
| Trust score calculation | ✓ | ✓ |
| **Advanced expression evaluation** | — | ✓ |
| **Property-based testing** | — | ✓ |
| **Chaos testing** | — | ✓ |
| **CI/CD integration** | Limited | Full |
| **Evidence reports** | Basic | Detailed |
| **Team workspace** | — | ✓ |
| **Priority support** | — | ✓ |

## What Pro Unlocks

### 1. Advanced Expression Evaluation

The free tier often produces `PARTIAL` results for complex postconditions:

```isl
postconditions {
  old(User.count) + 1 == User.count        # Free: PARTIAL
  sum(Order.amounts) == expected_total     # Free: PARTIAL
  forall(items): item.status == VALID      # Free: PARTIAL
}
```

**Pro** includes enhanced expression compilation that handles:

- `old()` expressions via state snapshot capture
- Aggregate functions (`sum`, `count`, `avg`, `min`, `max`)
- Quantifiers (`forall`, `exists`)
- Custom type method calls

Result: More `PASS`/`FAIL` results instead of `PARTIAL`, giving you higher confidence scores.

### 2. Property-Based Testing

Free tier tests use fixed inputs. Pro generates hundreds of random inputs to find edge cases:

```
Free tier:
  ✓ CreateUser("alice@example.com") → success
  ✓ CreateUser("") → INVALID_EMAIL
  
Pro tier (property-based):
  ✓ CreateUser(email) for 1000 random valid emails
  ✓ CreateUser(email) for 500 random invalid emails
  ✗ Found edge case: CreateUser("a"*256 + "@x.com") crashed
```

Properties tested:

- **Postconditions hold for all valid inputs**
- **Precondition violations always return errors**
- **Invariants maintained after any sequence of operations**
- **Error codes match their "when" conditions**

### 3. Chaos Testing

Pro includes fault injection to test resilience:

```isl
chaos CreateUser {
  chaos "database timeout" {
    inject { database_timeout(probability: 50%) }
    
    then {
      # Either succeeds or returns retriable error
      result is success or result is TEMPORARY_ERROR
    }
  }
  
  chaos "network partition" {
    inject { network_partition(duration: 5s) }
    
    then {
      # System recovers after partition heals
      eventually { User.exists(result.id) or result is FAILED }
    }
  }
}
```

Chaos tests verify:

- Timeout handling
- Retry logic
- Circuit breakers
- Graceful degradation
- Data consistency under failures

### 4. Full CI/CD Integration

Free tier provides basic verification. Pro includes:

**GitHub Actions Integration:**

```yaml
# .github/workflows/isl-verify.yml
name: ISL Verification
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: intentos/isl-verify-action@v1
        with:
          spec: ./specs/*.isl
          impl: ./src
          token: ${{ secrets.ISL_PRO_TOKEN }}
          
      - name: Fail if trust score below threshold
        if: ${{ steps.verify.outputs.trust_score < 85 }}
        run: exit 1
        
      - name: Upload evidence report
        uses: actions/upload-artifact@v4
        with:
          name: isl-evidence
          path: ./isl-evidence-report.json
```

**Features:**

- Block PRs below trust score threshold
- Evidence reports as build artifacts
- Trust score trends over time
- Regression detection

### 5. Detailed Evidence Reports

Free tier shows pass/fail counts. Pro shows:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PRO EVIDENCE REPORT                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Trust Score: 92/100                                                     │
│  Confidence: HIGH (based on 847 test executions)                         │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ POSTCONDITIONS (40% weight)                          Score: 95% │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ ✓ CreateUser: User.exists(result.id)            12ms   PASS    │    │
│  │ ✓ CreateUser: result.email == input.email        3ms   PASS    │    │
│  │ ✓ CreateUser: result.status == PENDING           2ms   PASS    │    │
│  │ ⚠ DeleteUser: old(User.count) - 1 == User.count 45ms   PARTIAL │    │
│  │   └─ State snapshot captured but timing uncertain               │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ PROPERTY-BASED TESTING (Pro only)                               │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ ✓ CreateUser: 1000 random valid emails passed                   │    │
│  │ ✓ CreateUser: 500 random invalid emails → error                 │    │
│  │ ✓ Sequence: Create→Complete→Delete (200 random sequences)      │    │
│  │ ✗ Found: CreateUser fails for email with 300+ chars             │    │
│  │   └─ Shrunk to minimal failing case: "a" × 256 + "@x.com"       │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ CHAOS TESTING (Pro only)                                        │    │
│  ├─────────────────────────────────────────────────────────────────┤    │
│  │ ✓ Database timeout: graceful degradation verified               │    │
│  │ ✓ Network partition: eventual consistency maintained            │    │
│  │ ⚠ High load: p99 latency exceeded (350ms vs 200ms target)      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  Assumptions Made:                                                       │
│  • Database responds within 5s timeout                                   │
│  • Clock skew between services < 100ms                                   │
│                                                                          │
│  Open Questions:                                                         │
│  • How should concurrent CreateUser with same email be handled?          │
│  • Should DeleteUser be idempotent?                                      │
│                                                                          │
│  Recommendation: STAGING_RECOMMENDED                                     │
│  • Fix email length validation (max 255 chars)                           │
│  • Review p99 latency under load                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6. Team Workspace

Pro includes team features:

- **Shared specs**: Central repository of ISL specifications
- **Spec ownership**: Assign owners to domain specs
- **Change reviews**: Review spec changes like code
- **Trust score dashboards**: Track verification trends
- **Audit logs**: Who changed what, when

## How Pro Gating Works

Pro features are gated by a license token:

```bash
# Set your Pro token
export ISL_PRO_TOKEN=isl_pro_abc123...

# Or in .islrc.json
{
  "pro": {
    "token": "isl_pro_abc123..."
  }
}
```

When Pro is active, the CLI unlocks additional capabilities:

```bash
# Free tier
$ isl verify spec.isl --impl ./src
Trust Score: 72/100
  (5 PARTIAL results due to expression evaluator limits)

# Pro tier  
$ isl verify spec.isl --impl ./src
Trust Score: 89/100
  (Advanced expression evaluation enabled)
  (Property-based testing: 1000 cases)
  (Chaos testing: 3 scenarios)
```

## Pricing

| Plan | Price | Best For |
|------|-------|----------|
| **Free** | $0 | Individual developers, open source |
| **Pro** | $29/month | Professional developers, small teams |
| **Team** | $99/month | Teams with 5+ members |
| **Enterprise** | Contact us | Large organizations, custom needs |

### What You Get for $29/month

- Advanced expression evaluation
- Property-based testing
- Chaos testing
- Full CI/CD integration
- Detailed evidence reports
- Priority email support
- 10,000 verification runs/month

### Free Tier Limits

The free tier includes:

- Full spec parsing and checking
- Basic TypeScript generation
- Simple test generation
- Trust scores (with PARTIAL limits)
- 100 verification runs/month
- Community support

## Getting Pro

```bash
# Sign up at intentos.dev/pro
# Get your token from the dashboard

# Set token
isl config set pro.token isl_pro_abc123...

# Verify Pro is active
isl status
```

Output:

```
ISL CLI v1.0.0
License: Pro (valid until 2025-02-01)
Features: advanced-expressions, property-testing, chaos-testing
Usage: 847/10000 verifications this month
```

## FAQ

### Is the free tier useful?

Yes. The free tier provides substantial value:

- Full ISL syntax and parsing
- TypeScript type generation
- Basic test scaffolding
- Trust scores for simple postconditions

For many projects, this is enough.

### What if I hit PARTIAL limits?

The free tier marks complex expressions as `PARTIAL` because the expression evaluator can't fully compile them. Options:

1. **Simplify postconditions** to things the free tier can evaluate
2. **Manually complete generated tests** (the TODO comments show what to add)
3. **Upgrade to Pro** for automatic handling

### Can I try Pro before paying?

Yes. Contact us for a 14-day trial token.

### What happens if I downgrade?

Your specs and generated code keep working. You lose:

- Advanced expression evaluation (back to PARTIAL results)
- Property-based and chaos testing
- Detailed evidence reports
- Team features

No lock-in. No data loss.

### Is there a refund policy?

Yes. 30-day money-back guarantee, no questions asked.

---

**Ready to upgrade?** Visit [intentos.dev/pro](https://intentos.dev/pro) or run:

```bash
isl upgrade
```
