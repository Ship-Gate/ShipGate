# Go Resolver — Hallucination Scanner

First-class Go support for ghost import detection and reality-gap scanning.

## Overview

The Go resolver provides the same level of analysis as the existing Rust, Java, and JS/TS resolvers:

- **Parse** Go files using Tree-sitter (with structured fallback parser)
- **Extract** imports correctly, including stdlib vs external vs internal
- **Resolve** modules via `go.mod`
- **Verify** package existence against the Go 1.22 stdlib list and declared dependencies
- **Detect** ghost/hallucinated imports with trust scoring

## Architecture

```
packages/hallucination-scanner/src/go/
├── types.ts          # GoImport, GoFinding, GoModInfo, GoDependencyCheckResult
├── stdlib.ts         # Go 1.22 stdlib package set + isGoStdlib() + hasStdlibPrefix()
└── go-resolver.ts    # Main resolver: resolveGo(), scanGoFile()

packages/isl-firewall/src/go/
├── parser.ts         # Tree-sitter Go import parser (pre-existing)
├── go-mod.ts         # go.mod parser (pre-existing)
└── stdlib.ts         # Go stdlib check (firewall-local copy)
```

## Finding Kinds

| Kind                  | Description                                              | Severity |
|-----------------------|----------------------------------------------------------|----------|
| `unknown_stdlib`      | Looks like stdlib prefix but not in known Go stdlib      | 20 pts   |
| `missing_module`      | External module used but not declared in `go.mod`        | 25 pts   |
| `fake_package`        | Import cannot be verified (no `go.mod` found)            | 30 pts   |
| `unresolved_internal` | Internal package directory does not exist on disk         | 15 pts   |

Trust score = `max(0, 100 - total_penalty)`.

## Import Classification

Every import is classified into one of three categories:

1. **Stdlib** — matched against the full Go 1.22 standard library (160+ packages)
2. **Internal** — import path starts with the module path from `go.mod`
3. **External** — everything else; matched against `require` directives in `go.mod`

## Usage

### Programmatic API

```typescript
import { resolveGo, scanGoFile } from '@isl-lang/hallucination-scanner';

// Full project scan
const result = await resolveGo({ projectRoot: '/path/to/go/project' });

console.log(result.success);       // true if no findings
console.log(result.trustScore);    // 0-100
console.log(result.findings);      // GoFinding[]
console.log(result.missingModules); // string[]

// Single file scan
const fileResult = await scanGoFile('/path/to/main.go', sourceContent);
```

### Firewall Integration

Go is automatically wired into the ISL Firewall pipeline:

- **Claim Extractor** — `.go` files are parsed with Tree-sitter to extract import claims
- **Evidence Resolver** — Go imports are resolved against stdlib + `go.mod` before falling back to filesystem
- **Ghost Import Policy** — Unresolved Go imports trigger `ghost-import` hard blocks

No configuration needed — the firewall detects `.go` files and applies Go-specific resolution.

## Test Fixtures

```
test-fixtures/go/
├── go.mod                          # Module "myapp" with gorilla/mux, logrus
├── valid/
│   ├── main.go                     # All imports valid (stdlib + declared external + internal)
│   └── internal/handler/handler.go # Internal package stub
└── invalid/
    └── ghost-imports.go            # Ghost imports: encoding/jsonx, crypto/quantum,
                                    #   github.com/nonexistent/fakepkg, etc.
```

## Running Tests

```bash
# Unit + integration tests for Go resolver
cd packages/hallucination-scanner
pnpm test -- --grep "go"

# All hallucination-scanner tests
pnpm test
```

## Constraints

- **No regex-only parsing** — Tree-sitter is the primary parser; fallback uses structured block parsing
- **No stubs** — Real `go.mod` parsing, real stdlib list, real import extraction
- **No remote HTTP checks** — Resolution uses `go.mod` + stdlib (sufficient for detecting hallucinations)
