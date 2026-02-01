# ISL v1.0 Release Notes

**Release Date:** February 2026  
**Version:** 1.0.0

---

## What is ISL?

ISL (Intent Specification Language) is a declarative language for expressing **what** systems should do. You write contracts, ISL generates tests and types.

```isl
behavior CreateUser {
  input { email: Email, name: String }
  output { success: User, errors { EMAIL_EXISTS, INVALID_EMAIL } }
  
  preconditions { not User.exists(email: input.email) }
  postconditions { success implies User.exists(result.id) }
}
```

This generates TypeScript types, test scaffolds, and a trust score measuring how well your implementation matches the spec.

---

## What's in v1.0

### Core Language
- **Parser**: Full ISL syntax including domains, entities, behaviors, types
- **Type System**: Refinement types, constraints, enums, union types
- **Contracts**: Preconditions, postconditions, invariants
- **Scenarios**: Declarative test cases in the spec itself
- **Effects**: Declare side effects (Database, Email, Logging)

### Toolchain
- **CLI**: `isl check`, `isl gen`, `isl verify`, `isl fmt`, `isl lint`
- **VSCode Extension**: Syntax highlighting, diagnostics, go-to-definition
- **LSP Server**: Language server for any editor

### Code Generation
- **TypeScript types**: Full interface generation from entities/behaviors
- **Test scaffolds**: Vitest/Jest test files from contracts
- **OpenAPI**: Generate OpenAPI specs from behaviors

### Verification
- **Trust Score**: 0-100 weighted score based on test results
- **Evidence Reports**: JSON reports of what passed/failed/partial
- **CI Integration**: Block PRs below trust threshold

---

## What's NOT in v1.0

We're shipping honestly. These are planned but not ready:

| Feature | Status | ETA |
|---------|--------|-----|
| SMT solver integration | Planned | v1.2+ |
| Property-based testing | Pro only | v1.0 |
| Chaos testing | Pro only | v1.0 |
| Full expression evaluator | 70% complete | v1.1 |
| Python/Go codegen | Scaffolds only | v1.1 |
| AI intent-to-ISL | Experimental | v1.2 |

---

## Breaking Changes from Beta

If you used the beta, note these changes:

### Syntax Changes
```isl
# Before (beta)
entity User {
  email: String @unique
}

# After (v1.0)
entity User {
  email: Email [unique]
}
```

### CLI Changes
```bash
# Before
isl compile spec.isl

# After
isl gen spec.isl --target typescript
```

### Config Changes
```json
// Before: .islconfig.json
// After: .islrc.json
```

---

## Installation

```bash
# npm
npm install -g @intentos/isl-cli

# pnpm
pnpm add -g @intentos/isl-cli

# Verify
isl --version
```

---

## Quick Start

```bash
# Initialize project
isl init my-api

# Check spec syntax
isl check spec.isl

# Generate code
isl gen spec.isl --target typescript

# Verify implementation
isl verify spec.isl --impl ./src
```

---

## Known Limitations

### Expression Evaluator Gaps

Some postconditions cannot be fully compiled to tests:

```isl
# ✓ Works - simple equality
postconditions { result.email == input.email }

# ⚠ Partial - needs entity binding
postconditions { User.exists(result.id) }

# ✗ Not yet - needs state snapshot
postconditions { old(User.count) + 1 == User.count }
```

Partial expressions get `PARTIAL` status and contribute 40% to trust score instead of 100%.

### Test Scaffolds Need Completion

Generated tests include TODO comments for complex assertions:

```typescript
it('verifies postconditions', async () => {
  const result = await createUser(input);
  
  expect(result.email).toBe(input.email);  // Generated
  // TODO: verify User.exists(result.id)   // Manual
});
```

### No Concurrency Testing

v1.0 runs single-threaded tests. Race conditions are not detected.

---

## Pro Features (v1.0)

These require ISL Pro ($29/month):

- **Advanced expression evaluation**: More `PASS` vs `PARTIAL` results
- **Property-based testing**: 1000s of random inputs
- **Chaos testing**: Fault injection scenarios
- **Detailed evidence reports**: Full audit trail
- **CI/CD integration**: GitHub Actions, GitLab CI

See [Pro Tier docs](../isl/pro-tier.md) for details.

---

## Migration Guide

### From No Specs
Start with one behavior:
```bash
isl init
# Edit spec.isl
isl check spec.isl
isl gen spec.isl --target typescript
```

### From OpenAPI
```bash
isl import openapi.yaml --output spec.isl
# Review and adjust generated ISL
```

### From Beta
```bash
# Backup first
cp spec.isl spec.isl.backup

# Auto-migrate
isl migrate spec.isl

# Verify
isl check spec.isl
```

---

## Reporting Issues

- **GitHub Issues**: [github.com/intentos/isl/issues](https://github.com/intentos/isl/issues)
- **Discord**: [discord.gg/intentos](https://discord.gg/intentos)
- **Email**: support@intentos.dev

When reporting, include:
1. ISL CLI version (`isl --version`)
2. Minimal reproducing spec
3. Expected vs actual behavior

---

## What's Next

### v1.1 (Planned)
- Complete expression evaluator
- Python codegen
- Import resolution improvements
- Better error messages

### v1.2 (Planned)
- SMT solver integration for simple proofs
- AI-assisted spec generation
- Go codegen
- Mutation testing

---

## Thank You

To everyone who tested the beta, reported bugs, and provided feedback—thank you. ISL v1.0 exists because of your contributions.

This is the start, not the end. Intent-driven development is a new paradigm, and we're building it together.

---

*ISL v1.0 — Specify intent. Generate contracts. Build confidence.*
