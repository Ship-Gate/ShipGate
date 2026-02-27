# Solver Availability Matrix

This document describes how Z3 and CVC5 are detected and used across platforms, and how to obtain the availability matrix programmatically.

## Programmatic API

```ts
import { getSolverAvailabilityMatrix, checkAllSolvers } from '@isl-lang/isl-smt';

// Full matrix (platform, arch, both solvers, best available, timestamp)
const matrix = await getSolverAvailabilityMatrix();
// matrix.platform, matrix.arch, matrix.solvers.z3, matrix.solvers.cvc5, matrix.bestAvailable

// Per-solver availability
const { z3, cvc5 } = await checkAllSolvers();
```

## Detection Strategy (Cross-Platform)

| Step | Windows | macOS | Linux |
|------|---------|--------|--------|
| 1 | Env: `Z3_PATH` / `CVC5_PATH` | Same | Same |
| 2 | `where z3` / `where cvc5` | `which z3` / `which cvc5` | Same as macOS |
| 3 | Spawn `z3 --version` in PATH | Same | Same |
| 4 | Search: Program Files, Chocolatey, Scoop, WinGet | Homebrew, MacPorts, Nix | /usr/bin, /usr/local, snap, nix |

## Binary Names

| Solver | Windows | macOS | Linux |
|--------|---------|--------|--------|
| Z3 | `z3.exe`, `z3` | `z3` | `z3` |
| CVC5 | `cvc5.exe`, `cvc5`, `cvc5-Win64-static.exe` | `cvc5`, `cvc5-macOS-arm64-static`, `cvc5-macOS-static` | `cvc5`, `cvc5-Linux-static`, `cvc5-Linux-x86_64-static` |

## Verified SAT/UNSAT Behavior

The test suite verifies:

- **SAT**: simple integers, exact value (e.g. x=42), booleans, negative integers, multi-variable linear constraints.
- **UNSAT**: contradiction (x>10 ∧ x<5), boolean contradiction (a ∧ ¬a), impossible equality (x=1 ∧ x=2), tautology negation, ordering impossibility.
- **Cross-solver parity**: For the same SMT-LIB query, Z3 and CVC5 are expected to agree on sat/unsat when both are available (see `tests/external-solver.test.ts`).

## Reliability Features

- **Retry on crash**: Configurable `maxRetries` (default 2) with exponential backoff.
- **Solver fallback**: If the primary solver fails, the adapter tries the other (z3 → cvc5 or cvc5 → z3).
- **Timeout**: Hard process kill (taskkill on Windows, SIGTERM/SIGKILL on Unix); no hanging processes.
- **Custom path**: If `solverPath` is set, it is checked for executability before use; invalid paths return `available: false`.
