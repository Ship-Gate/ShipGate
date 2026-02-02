# ISL MCP Server

Model Context Protocol server that exposes ISL tools to AI assistants (Cursor, Claude, custom agents).

## The SHIP/NO-SHIP Gate

The core value proposition: **Every AI-generated code change gets a deterministic gate decision with evidence.**

```
Agent → isl_gate → SHIP (exit 0) + evidence bundle
                 → NO-SHIP (exit 1) + why it failed
```

## Tools

### Core Tools

| Tool | Description |
|------|-------------|
| `isl_check` | Parse and type-check an ISL spec |
| `isl_generate` | Generate TypeScript code from spec |
| `isl_constraints` | Extract pre/postconditions from behavior |
| `isl_suggest` | Suggest fixes for verification failures |

### Pipeline Tools (SHIP/NO-SHIP)

| Tool | Description |
|------|-------------|
| `isl_build` | Build ISL specs from prompt → code + tests |
| `isl_verify` | Run verification → collect evidence |
| `isl_gate` | **SHIP/NO-SHIP decision with evidence bundle** ⭐ |

## Usage

### Quick Start (Cursor)

The server is already configured in `.cursor/mcp.json`. Just build and use:

```bash
cd packages/mcp-server
pnpm build
```

### The Gate Workflow

```typescript
// 1. Agent generates code from intent
const spec = await isl_build({ prompt: "User authentication with rate limiting" });

// 2. Verify against spec
const result = await isl_gate({
  spec: specSource,
  implementation: codeSource,
  threshold: 95  // Must score 95%+ to SHIP
});

// 3. Act on decision
if (result.decision === 'SHIP') {
  // Safe to merge - evidence bundle proves it
  console.log(`Trust score: ${result.trustScore}%`);
  console.log(`Evidence: ${result.bundlePath}`);
} else {
  // Block merge - fix the issues first
  console.log(`Blockers: ${result.results.blockers.map(b => b.clause).join(', ')}`);
}
```

### Evidence Bundle Output

When you run `isl_gate`, it produces:

```
evidence/
  manifest.json    # Deterministic fingerprint, input hashes, versions
  results.json     # Clause-by-clause pass/fail
  report.html      # Human-readable report
  artifacts/
    spec.isl       # The spec that was verified
```

### CI Integration

```yaml
# .github/workflows/verify.yml
- name: ISL Gate
  run: |
    npx isl-mcp isl_gate \
      --spec ./specs/auth.isl \
      --implementation ./src/auth.ts
    # Exit code 0 = SHIP, 1 = NO-SHIP
```

## Tool Reference

### `isl_gate`

The core decision maker. Returns SHIP or NO-SHIP with evidence.

**Input:**
```typescript
{
  spec: string;           // ISL source or file path
  implementation: string; // Code source or file path
  threshold?: number;     // Min trust score (default: 95)
  writeBundle?: boolean;  // Write evidence to disk (default: true)
  config?: {
    framework?: 'vitest' | 'jest';
    timeout?: number;
    allowSkipped?: boolean;
  }
}
```

**Output:**
```typescript
{
  decision: 'SHIP' | 'NO-SHIP';
  exitCode: 0 | 1;              // For CI
  trustScore: number;           // 0-100
  confidence: number;           // 0-100
  summary: string;              // Human readable
  bundlePath?: string;          // Path to evidence bundle
  manifest?: EvidenceManifest;  // Fingerprint + hashes
  results?: EvidenceResults;    // Clause-by-clause
  suggestion?: string;          // How to fix (if NO-SHIP)
}
```

### `isl_build`

Build specs from natural language or ISL source.

**Input:**
```typescript
{
  prompt: string;         // Natural language or ISL source
  domainName?: string;    // Domain name (default: 'Generated')
  version?: string;       // Version (default: '1.0.0')
  workspacePath?: string; // Output directory
  writeFiles?: boolean;   // Write to disk (default: true)
}
```

### `isl_verify`

Run verification and collect evidence.

**Input:**
```typescript
{
  workspacePath?: string;       // Workspace root
  specsPath?: string;           // Path to specs (default: .vibecheck/specs)
  implementationPath?: string;  // Path to impl (auto-detected)
  behaviors?: string[];         // Specific behaviors to verify
  framework?: 'vitest' | 'jest';
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        MCP Server                           │
├─────────────────────────────────────────────────────────────┤
│  isl_check   │  isl_build   │  isl_verify   │  isl_gate    │
│  (parse)     │  (gen spec)  │  (run tests)  │  (SHIP/NO)   │
├─────────────────────────────────────────────────────────────┤
│                     @isl-lang/parser                        │
│                   @isl-lang/typechecker                     │
│                  @isl-lang/codegen-runtime                  │
│                    @isl-lang/isl-verify                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    evidence/manifest.json
                    evidence/results.json
                    evidence/report.html
```

## Why This Matters

1. **Deterministic** - Same inputs always produce same fingerprint
2. **Auditable** - Evidence bundle proves what was verified
3. **CI-native** - Exit code gates merge/deploy
4. **Agent-friendly** - Any MCP-compatible agent can call it

## License

MIT
