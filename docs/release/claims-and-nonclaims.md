# Claims and Non-Claims

**Internal messaging guide for ISL v1.0**

This document defines exactly what we can claim, what we cannot, and how to talk about "proof" and "verification" without overclaiming.

---

## The Core Distinction

| Term | What It Means | ISL Status |
|------|---------------|------------|
| **Proven** | Mathematically guaranteed for all inputs | ❌ ISL does NOT do this |
| **Verified** | Tested systematically with generated tests | ✅ ISL does this |
| **Trust Score** | Weighted pass rate of generated tests | ✅ ISL does this |

---

## What ISL Actually Does

### ✅ DOES

1. **Parses ISL specifications** into structured AST
2. **Type-checks specs** for syntax errors and type mismatches
3. **Generates TypeScript types** from entities and behaviors
4. **Generates test scaffolds** from contracts (pre/post conditions)
5. **Runs generated tests** against your implementation
6. **Calculates trust score** from test pass rates
7. **Produces evidence reports** documenting what passed/failed

### ❌ DOES NOT

1. **Mathematically prove** correctness (no SMT solver in v1.0)
2. **Test all inputs** (tests specific cases, not exhaustive)
3. **Detect race conditions** (single-threaded testing)
4. **Guarantee security** (no penetration testing)
5. **Verify external systems** (mocks databases, not real ones)

---

## Approved Language

### When Describing ISL

| ✅ SAY | ❌ DON'T SAY |
|--------|--------------|
| "ISL verifies your implementation against the spec" | "ISL proves your code is correct" |
| "Trust score reflects how well tests pass" | "Trust score guarantees correctness" |
| "Generated tests check your contracts" | "Generated tests catch all bugs" |
| "Systematic testing based on your spec" | "Formal verification of your code" |
| "Higher confidence through structured testing" | "Mathematical proof of behavior" |
| "Evidence of correctness" | "Proof of correctness" |

### When Describing Trust Score

| ✅ SAY | ❌ DON'T SAY |
|--------|--------------|
| "Trust score of 95 means 95% of generated tests pass" | "Trust score of 95 means 95% bug-free" |
| "Higher scores indicate better test coverage" | "Higher scores guarantee fewer bugs" |
| "Score reflects spec compliance for tested cases" | "Score measures overall code quality" |
| "PARTIAL means the test couldn't fully verify" | "PARTIAL means it's probably fine" |

### When Describing Verification

| ✅ SAY | ❌ DON'T SAY |
|--------|--------------|
| "Verification runs generated tests" | "Verification proves properties" |
| "Verifies specific scenarios from your spec" | "Verifies all possible scenarios" |
| "Checks postconditions for test inputs" | "Guarantees postconditions always hold" |
| "Empirical verification through testing" | "Formal verification" |

---

## Honest Explanations for Common Questions

### "Is my code proven correct?"

**Answer:** No. ISL runs tests generated from your spec. If tests pass, your code behaves correctly *for the inputs we tested*. It doesn't mathematically prove correctness for all possible inputs.

**Shorter:** "Tested, not proven. High confidence, not certainty."

### "What does Trust Score 95 mean?"

**Answer:** 95% of the generated test clauses passed. This includes precondition checks, postcondition checks, scenario tests, and timing tests. Higher is better, but 100 doesn't mean bug-free.

**Shorter:** "95% of generated tests passed. Good, but not a guarantee."

### "What's the difference from regular unit tests?"

**Answer:** ISL tests are *generated from your spec*, not written manually. They systematically cover contracts you define. You get consistent coverage across all behaviors without writing each test yourself.

**Shorter:** "Tests generated from contracts, not written by hand."

### "Is this formal verification?"

**Answer:** No. Formal verification uses mathematical proofs (SMT solvers, model checkers). ISL uses empirical testing. We plan to add SMT integration in future versions, but v1.0 is testing-based.

**Shorter:** "Testing, not formal verification. Proof features coming later."

### "What about edge cases?"

**Answer:** Free tier tests fixed inputs. Pro tier adds property-based testing (thousands of random inputs) and chaos testing (fault injection). More inputs = more edge cases found.

**Shorter:** "Free tier: fixed inputs. Pro: property-based and chaos testing."

---

## PARTIAL Results Explained

When you see `PARTIAL` in results, it means:

> The test structure was generated, but the expression couldn't be fully compiled. The test ran with limited verification.

### Why PARTIAL Happens

```isl
postconditions {
  result.email == input.email    # → PASS/FAIL (compilable)
  User.exists(result.id)         # → PARTIAL (needs entity binding)
  old(User.count) + 1 == count   # → PARTIAL (needs state snapshot)
}
```

### How PARTIAL Affects Score

- `PASS` = 1.0 weight
- `PARTIAL` = 0.4 weight  
- `FAIL` = 0.0 weight

A spec with 5 PARTIAL results and 5 PASS results scores ~70%, not 50%.

### What To Tell Users

"PARTIAL means we generated the test but couldn't fully automate the check. The expression is evaluated with limited runtime support. Pro tier improves this with advanced expression evaluation."

---

## Marketing Copy Guidelines

### Headlines

| ✅ APPROVED | ❌ REJECTED |
|-------------|-------------|
| "Contract-driven development" | "Bug-free development" |
| "Test generation from specs" | "Automatic proof generation" |
| "Higher confidence, faster" | "Guaranteed correctness" |
| "Verify what you build" | "Prove what you build" |
| "Systematic testing at scale" | "Eliminate all bugs" |

### Feature Descriptions

| Feature | ✅ DESCRIPTION |
|---------|----------------|
| Trust Score | "A 0-100 score based on how many generated tests pass. Higher = better spec compliance." |
| Verification | "Runs tests generated from your contracts. Reports what passed, failed, or couldn't be fully checked." |
| Evidence Reports | "JSON documentation of every test result, for audit trails and CI integration." |
| Pro Testing | "Property-based (random inputs) and chaos testing (fault injection) for deeper coverage." |

### Comparison Claims

When comparing to alternatives:

| ✅ SAY | ❌ DON'T SAY |
|--------|--------------|
| "More systematic than ad-hoc testing" | "Better than all other testing" |
| "Structured contracts vs scattered tests" | "Replaces all your tests" |
| "Spec-first development workflow" | "The only testing you need" |

---

## Internal Terminology

Use these terms consistently across docs, UI, and support:

| Term | Definition |
|------|------------|
| **Spec** | An ISL specification file (.isl) |
| **Contract** | Pre/postconditions + invariants for a behavior |
| **Trust Score** | 0-100 weighted test pass rate |
| **Evidence Report** | JSON output documenting verification results |
| **Clause** | A single testable statement (precondition, postcondition, etc.) |
| **PASS** | Clause tested and passed |
| **PARTIAL** | Clause tested with limited verification |
| **FAIL** | Clause tested and failed |
| **Ship Decision** | Recommendation based on score and failures |

---

## Red Lines (Never Cross)

These claims will damage credibility. Never make them:

1. ❌ "ISL eliminates bugs"
2. ❌ "Mathematically proven correct"
3. ❌ "Formal verification included"
4. ❌ "100% coverage guaranteed"
5. ❌ "No need for other testing"
6. ❌ "Production-safe after verification"
7. ❌ "Trust score = reliability percentage"

---

## Approved Elevator Pitch

> ISL is a specification language for APIs. You write contracts—what inputs are valid, what outputs should look like, what errors can happen. ISL generates TypeScript types and test scaffolds, then runs those tests against your implementation. The result is a trust score showing how well your code matches the spec. It's not proof, but it's systematic confidence you can't get from ad-hoc testing.

---

## Summary

| Claim Type | Our Position |
|------------|--------------|
| "Generates tests from specs" | ✅ Yes, fully supported |
| "Systematic verification" | ✅ Yes, through generated tests |
| "Trust score for confidence" | ✅ Yes, based on test pass rates |
| "Formal proof of correctness" | ❌ No, not in v1.0 |
| "Catches all bugs" | ❌ No, catches tested cases |
| "Replaces manual testing" | ⚠️ Augments, doesn't replace |

**The honest pitch:** ISL gives you structured, spec-driven testing that's better than nothing and more systematic than manual tests. It's not magic. It's disciplined engineering.
