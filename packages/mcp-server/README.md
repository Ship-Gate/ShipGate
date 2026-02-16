# ISL MCP Server v0.2.0

[![npm version](https://badge.fury.io/js/@isl-lang%2Fmcp-server.svg)](https://badge.fury.io/js/@isl-lang%2Fmcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)

> **Model Context Protocol server that exposes ISL tools to AI assistants (Cursor, Claude, custom agents).**

The ISL MCP Server brings **behavioral verification** directly to your AI assistant. Through the Model Context Protocol, AI agents can now run SHIP/NO-SHIP gates, generate code from specifications, and verify implementations against formal intent specifications.

## 🎯 The SHIP/NO-SHIP Gate

The core value proposition: **Every AI-generated code change gets a deterministic gate decision with evidence.**

```
Agent → isl_gate → SHIP (exit 0) + evidence bundle
                 → NO-SHIP (exit 1) + why it failed
```

### Why This Matters

1. **Deterministic** - Same inputs always produce the same fingerprint
2. **Auditable** - Evidence bundle proves what was verified  
3. **CI-native** - Exit code gates merge/deploy
4. **Agent-friendly** - Any MCP-compatible agent can call it

## 🛠️ Tool Suite

### Core Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `isl_check` | Parse and type-check ISL spec | Validate syntax & types |
| `isl_generate` | Generate TypeScript from spec | Code generation |
| `isl_constraints` | Extract pre/postconditions | Contract analysis |
| `isl_suggest` | Suggest fixes for violations | Auto-healing |

### Pipeline Tools (SHIP/NO-SHIP)

| Tool | Description | Criticality |
|------|-------------|-------------|
| `isl_build` | Build ISL specs from prompt → code + tests | ⭐ Build phase |
| `isl_verify` | Run verification → collect evidence | ⭐ Verify phase |
| `isl_gate` | **SHIP/NO-SHIP decision with evidence bundle** | ⭐⭐⭐ Gate decision |

## 🚀 Quick Start

### Installation

```bash
# Install globally
npm install -g @isl-lang/mcp-server

# Or install in your project
npm install @isl-lang/mcp-server
```

### Cursor Integration

The server is already configured in `.cursor/mcp.json`. Just build and use:

```bash
cd packages/mcp-server
pnpm build
```

### Claude Desktop Integration

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "isl": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## 🔄 The Gate Workflow

### Complete AI Assistant Workflow

```typescript
// 1. Agent generates code from intent
const spec = await isl_build({ 
  prompt: "User authentication with rate limiting" 
});

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

When you run `isl_gate`, it produces a comprehensive evidence bundle:

```
evidence/
├── manifest.json    # Deterministic fingerprint, input hashes, versions
├── results.json     # Clause-by-clause pass/fail
├── report.html      # Human-readable report
└── artifacts/
    ├── spec.isl       # The spec that was verified
    ├── tests/         # Test results
    └── coverage/      # Coverage metrics
```

## 📋 Tool Reference

### `isl_gate` ⭐

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

Build specifications from natural language or ISL source.

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

**Output:**
```typescript
{
  spec: string;           // Generated ISL specification
  tests: string[];        // Generated test files
  workspace: string;       // Workspace path
  success: boolean;
  errors?: string[];
}
```

### `isl_verify`

Run verification and collect evidence.

**Input:**
```typescript
{
  workspacePath?: string;       // Workspace root
  specsPath?: string;           // Path to specs (default: .shipgate/specs)
  implementationPath?: string;  // Path to impl (auto-detected)
  behaviors?: string[];         // Specific behaviors to verify
  framework?: 'vitest' | 'jest';
}
```

**Output:**
```typescript
{
  results: VerificationResult[];
  coverage: CoverageReport;
  violations: Violation[];
  trustScore: number;
  evidence: EvidenceBundle;
}
```

### `isl_check`

Parse and type-check ISL specifications.

**Input:**
```typescript
{
  spec: string;           // ISL source or file path
  strict?: boolean;       // Strict mode (default: false)
}
```

**Output:**
```typescript
{
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  ast?: ISLNode;          // Abstract syntax tree
}
```

### `isl_generate`

Generate code from ISL specifications.

**Input:**
```typescript
{
  spec: string;           // ISL source or file path
  target: 'typescript' | 'python' | 'rust' | 'go';
  output?: string;        // Output directory
  options?: {
    includeTests?: boolean;
    includeDocs?: boolean;
  }
}
```

**Output:**
```typescript
{
  generated: GeneratedFile[];
  success: boolean;
  errors?: string[];
}
```

## 🏗️ Architecture

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

## 🔗 CI/CD Integration

### GitHub Actions

```yaml
name: ISL Gate
on: [push, pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install ISL MCP Server
        run: npm install @isl-lang/mcp-server
      
      - name: Run ISL Gate
        run: |
          npx isl-mcp isl_gate \
            --spec ./specs/auth.isl \
            --implementation ./src/auth.ts
        # Exit code 0 = SHIP, 1 = NO-SHIP
      
      - name: Upload Evidence
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: evidence-bundle
          path: evidence/
```

### GitLab CI

```yaml
isl_gate:
  stage: test
  image: node:18
  script:
    - npm install @isl-lang/mcp-server
    - npx isl-mcp isl_gate --spec specs/ --impl src/
  artifacts:
    reports:
      junit: evidence/results.json
    paths:
      - evidence/
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## 🎛️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ISL_MCP_DEBUG` | Enable debug logging | `false` |
| `ISL_MCP_TIMEOUT` | Request timeout (ms) | `30000` |
| `ISL_MCP_EVIDENCE_DIR` | Evidence output directory | `./evidence` |
| `ISL_MCP_STRICT` | Strict mode for all tools | `false` |

### Server Configuration

```json
{
  "tools": {
    "isl_gate": {
      "defaultThreshold": 95,
      "writeEvidence": true,
      "framework": "vitest"
    },
    "isl_verify": {
      "timeout": 30000,
      "parallel": true
    }
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## 📊 Usage Examples

### Example 1: Authentication Flow

```typescript
// Agent prompt: "Add user authentication with rate limiting"
const authSpec = await isl_build({
  prompt: "User authentication with rate limiting",
  domainName: "Auth"
});

// Generate implementation
const authCode = await isl_generate({
  spec: authSpec.spec,
  target: "typescript"
});

// Verify and gate
const result = await isl_gate({
  spec: authSpec.spec,
  implementation: authCode.generated[0].content,
  threshold: 95
});

if (result.decision === 'SHIP') {
  console.log('✅ Authentication flow approved for deployment');
} else {
  console.log('❌ Issues found:', result.results.blockers);
}
```

### Example 2: API Endpoint

```typescript
// Verify existing implementation
const apiResult = await isl_gate({
  spec: "./specs/payment-api.isl",
  implementation: "./src/payment.ts",
  threshold: 90
});

// Generate evidence badge
if (apiResult.bundlePath) {
  const badge = await isl_proof_badge({
    bundlePath: apiResult.bundlePath,
    format: "svg",
    output: "./badge.svg"
  });
}
```

## 🔧 Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/isl-lang/isl.git
cd isl/packages/mcp-server

# Install dependencies
pnpm install

# Build
pnpm run build

# Run in development
pnpm run dev
```

### Testing

```bash
# Run tests
pnpm run test

# Run integration tests
pnpm run test:integration

# Run with coverage
pnpm run test:coverage
```

### Debugging

```bash
# Enable debug logging
ISL_MCP_DEBUG=1 pnpm run dev

# Run with specific tool
echo '{"tool": "isl_check", "arguments": {"spec": "test.isl"}}' | \
  node dist/index.js
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for details.

### Adding New Tools

1. Implement tool in `src/tools/`
2. Add tool definition in `src/index.ts`
3. Write tests in `tests/`
4. Update documentation

## 📚 Resources

- **ISL Documentation**: https://shipgate.dev/docs
- **MCP Specification**: https://modelcontextprotocol.io
- **GitHub Repository**: https://github.com/isl-lang/isl
- **Discord Community**: https://discord.gg/isl
- **Issues**: https://github.com/isl-lang/isl/issues

## 📄 License

MIT License - see [LICENSE](../../LICENSE) file for details.

---

**ISL MCP Server v0.2.0** - Behavioral verification for AI assistants.

> *"Every AI-generated code change gets a deterministic gate decision with evidence."*

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
  specsPath?: string;           // Path to specs (default: .shipgate/specs)
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
