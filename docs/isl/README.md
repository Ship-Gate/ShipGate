# ISL (Intent Specification Language) Documentation

ISL is a specification language for expressing software intent. It enables contract-first development where you define **what** your system should do before **how** it does it.

## What ISL Actually Does

ISL provides:

1. **A specification language** for defining domains, entities, and behaviors with pre/post conditions
2. **Code generation** for TypeScript types, tests, and implementations
3. **Verification** that runs generated tests against your implementation
4. **Trust scores** that quantify how well your implementation matches the spec

## The Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ISL PIPELINE                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   [1] Input          [2] Parse          [3] Generate        [4] Verify       │
│                                                                              │
│   Plain English  ──▶  ISL Spec     ──▶  TypeScript     ──▶  Trust Score     │
│   or ISL Spec        (AST)             Types + Tests       (0-100)          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Documentation Guide

| Document | Description |
|----------|-------------|
| [Quickstart](./quickstart.md) | Get started with ISL in 5 minutes |
| [Evidence & Proof](./evidence-and-proof.md) | What is proven vs tested, how scoring works |
| [Pro Tier](./pro-tier.md) | Pro features and pricing at $29/month |

## Honesty About Current State

We believe in transparency. Here's the current state of ISL:

| Component | Status | What Works | What Doesn't |
|-----------|--------|------------|--------------|
| Parser | 90% | Full ISL syntax | Import resolution incomplete |
| Type Generator | 85% | Entity/behavior types | Complex generics |
| Test Generator | 70% | Basic test scaffolds | Many assertions are TODOs |
| Verifier | 60% | Runs tests, calculates scores | Expression evaluator incomplete |
| Expression Compiler | 40% | Simple comparisons | Complex postconditions |

### What This Means

When you run `isl verify`, you get:

- **Trust Score**: A number from 0-100 based on test pass rates
- **Category Breakdown**: How postconditions, invariants, scenarios, and temporal checks performed
- **Recommendation**: Whether to ship, review, or block

What you **don't** get (yet):

- Mathematical proof of correctness
- Symbolic execution
- Formal verification (SMT solver integration)

The trust score represents **empirical testing confidence**, not mathematical proof.

## Quick Example

```isl
domain Auth {
  entity User {
    id: UUID [immutable]
    email: Email [unique]
    status: UserStatus
  }
  
  behavior CreateUser {
    input { email: Email }
    output { 
      success: User
      errors { EMAIL_EXISTS }
    }
    
    preconditions {
      not User.exists(email: input.email)
    }
    
    postconditions {
      success implies User.exists(result.id)
    }
  }
}
```

Running `isl verify` generates tests for these conditions and runs them against your implementation.

## Getting Started

```bash
# Install
npm install -g @intentos/isl-cli

# Create spec
isl init my-app

# Check syntax
isl check spec.isl

# Generate code
isl generate spec.isl --target typescript

# Verify implementation
isl verify spec.isl --impl ./src
```

See [Quickstart](./quickstart.md) for a complete walkthrough.
