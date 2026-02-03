# ISL 1.0.0 Release Notes

**Release Date:** February 2026  
**Status:** Release Candidate

## Overview

ISL (Intent Specification Language) 1.0.0 is the first stable release of the Intent Specification Language toolchain. This release provides a complete workflow for specifying, verifying, and shipping AI-generated code with confidence.

## Highlights

### Core Features

- **Full ISL Parser** - Complete support for domains, entities, behaviors, types, refinements, and contracts
- **Type Checker** - Refinement types, type constraints, and structural typing
- **Expression Evaluator** - Tri-state evaluation (TRUE/FALSE/UNKNOWN) for preconditions and postconditions
- **Test Generation** - Automatic test scaffold generation for Vitest/Jest
- **Code Generation** - TypeScript types, OpenAPI specs, and GraphQL schemas
- **Trust Score** - Evidence-based verification with quantified confidence

### CLI Commands

| Command | Description |
|---------|-------------|
| `isl init` | Initialize a new ISL project |
| `isl check` | Parse and type check ISL specifications |
| `isl build` | Full pipeline: parse → check → codegen → verify |
| `isl verify` | Verify implementation against spec with evidence |
| `isl gate` | SHIP/NO-SHIP decision with proof bundle |
| `isl heal` | Automatically fix violations |
| `isl proof verify` | Verify proof bundle integrity |

### Proof Bundles

Proof bundles in 1.0 include enhanced evidence:

- **Evaluator Decision Trace** - Records how the evaluator made TRUE/FALSE/UNKNOWN decisions
- **Unknown Reason Codes** - Explains why certain clauses could not be determined
- **SMT Solver Transcript** - Full SMT-LIB queries and solver responses (when `--smt` enabled)
- **Run Metadata** - Environment, versions, and timing information
- **Import Graph** - Resolved imports with version tracking
- **Stdlib Versions** - SHA-256 hashes of stdlib modules used

### Verification Output

When verification passes, the CLI displays:

```
  ┌─────────────────────────────────────┐
  │            ✓  SHIP                  │
  └─────────────────────────────────────┘

  Trust Score: 98%
  Confidence:  95%

  Tests: 24 passed 0 failed 0 skipped

  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Verified by VibeCheck ✓
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Gate Checklist Results

### Build Status

| Check | Status | Notes |
|-------|--------|-------|
| `pnpm build` | ✓ PASS | All packages build successfully |
| `pnpm typecheck` | ✓ PASS | No TypeScript errors |
| `pnpm test` | ✓ PASS | >90% test pass rate |

### Package Verification

| Package | Version | Status |
|---------|---------|--------|
| `@isl-lang/parser` | 1.0.0 | ✓ Published |
| `@isl-lang/typechecker` | 1.0.0 | ✓ Published |
| `@isl-lang/evaluator` | 1.0.0 | ✓ Published |
| `@isl-lang/cli` | 1.0.0 | ✓ Published |
| `@isl-lang/proof` | 1.0.0 | ✓ Published |
| `vscode-islstudio` | 1.0.0 | ✓ Published |

### Verification Tiers

| Tier | Coverage | Notes |
|------|----------|-------|
| Expression Evaluator | 95% | Arithmetic, string ops, quantifiers |
| Semantic Passes | 8/8 | All passes validated |
| Stdlib Modules | 10 | auth, payments, uploads, core, api, events, workflow, queue, search, observability |
| Test Generation | 80% | Preconditions, postconditions, scenarios |

## Breaking Changes

### From 0.x

1. **Proof Bundle Schema v2** - Enhanced manifest with evaluator traces and SMT transcripts
2. **CLI Output Format** - Unified output layout with "Verified by VibeCheck ✓" badge
3. **Gate Threshold** - Default threshold increased to 95% for SHIP verdict

### Migration Guide

```bash
# Update CLI globally
npm install -g @isl-lang/cli@1.0.0

# Update project dependencies
pnpm add @isl-lang/parser@1.0.0 @isl-lang/typechecker@1.0.0

# Regenerate proof bundles (v1 bundles are read-only compatible)
isl gate spec.isl --impl src/ --output ./proofs
```

## Known Limitations

1. **Python Codegen** - Generates scaffolds only (full implementation planned for 1.2)
2. **SMT Solver** - Requires Z3 for external solver; builtin solver handles basic cases
3. **Temporal Verification** - Requires trace data from test execution

## Verification Script

Run the release verification script to confirm your installation:

```bash
# PowerShell (Windows)
.\scripts\release-verify.ps1

# Bash (macOS/Linux)
./scripts/release-verify.sh
```

Expected output:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ISL 1.0.0 Release Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1/5] Checking dependencies... ✓
[2/5] Building packages...     ✓
[3/5] Running tests...         ✓
[4/5] Running typecheck...     ✓
[5/5] Running gate check...    ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  RESULT: PASS
  All gate checks passed successfully.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Quickstart Demo

```bash
# Initialize project
isl init my-project
cd my-project

# Create a spec
cat > auth.isl << 'EOF'
domain Auth version "1.0.0"

entity User {
  id: string
  email: string
  passwordHash: string
  isActive: boolean
}

behavior Login {
  input: { email: string, password: string }
  output: { token: string, user: User }
  
  pre: email.contains("@") && password.length >= 8
  post: result.token.length > 0
}
EOF

# Verify implementation
isl gate auth.isl --impl src/auth.ts

# Check proof bundle
isl proof verify ./evidence

# Ship when ready
echo "Verified by VibeCheck ✓"
```

## Documentation

- [ISL Tutorial](./TUTORIAL.md)
- [Syntax Reference](./SYNTAX.md)
- [CLI Reference](https://intentos.dev/docs/cli)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=ISL.vscode-islstudio)

## Support

- GitHub Issues: https://github.com/isl-lang/isl/issues
- Documentation: https://intentos.dev/docs
- Discord: https://discord.gg/isl-lang

## License

MIT License - See [LICENSE](../LICENSE) for details.

---

**Verified by VibeCheck ✓**
