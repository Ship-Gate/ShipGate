# ISL Pipeline MCP Tools

MCP tools for running the full ISL build and verification pipeline.

## Tools

### `isl_build`

Build ISL specifications from a natural language prompt or ISL source code. Generates spec files, TypeScript types, and runtime verification code.

#### Input Schema

```typescript
interface BuildInput {
  /** Natural language prompt or ISL source code (required) */
  prompt: string;
  
  /** Domain name (default: "Generated") */
  domainName?: string;
  
  /** Version string (default: "1.0.0") */
  version?: string;
  
  /** Workspace root path (default: current directory) */
  workspacePath?: string;
  
  /** Whether to write generated files to disk (default: true) */
  writeFiles?: boolean;
}
```

#### Output Schema

```typescript
interface BuildResult {
  success: boolean;
  
  /** Report summary (no timestamps for stability) */
  report?: {
    domain: string;
    version: string;
    entityCount: number;
    behaviorCount: number;
    entities: string[];
    behaviors: string[];
    parseStatus: 'success' | 'error';
    typeCheckStatus: 'success' | 'error' | 'skipped';
    warningCount: number;
    errorCount: number;
  };
  
  /** Generated file paths */
  files?: Array<{
    path: string;        // Relative path from workspace
    type: 'spec' | 'types' | 'runtime' | 'test' | 'report';
    sizeBytes: number;
  }>;
  
  /** Error info (only on failure) */
  error?: string;
  errorCode?: 'MISSING_LLM_KEY' | 'INVALID_PROMPT' | 'PARSE_ERROR' | 'TYPE_ERROR' | 'CODEGEN_ERROR' | 'FILESYSTEM_ERROR' | 'UNKNOWN_ERROR';
  suggestion?: string;
  
  /** Output paths */
  paths?: {
    vibecheck: string;
    specs: string;
    reports: string;
    runtime?: string;
  };
}
```

#### Example: Direct ISL Source

```json
{
  "prompt": "domain UserAuth version \"1.0.0\"\n\nentity User {\n  id: UUID\n  email: String\n  passwordHash: String\n}\n\nbehavior CreateUser {\n  input { email: String, password: String }\n  output { success: User }\n  pre email.contains(\"@\")\n  post success { User.exists({ id: result.id }) }\n}"
}
```

#### Example: Natural Language (requires LLM key)

```json
{
  "prompt": "A user registration system with email validation and password hashing",
  "domainName": "UserRegistration",
  "version": "1.0.0"
}
```

#### Example Response

```json
{
  "success": true,
  "report": {
    "domain": "UserAuth",
    "version": "1.0.0",
    "entityCount": 1,
    "behaviorCount": 1,
    "entities": ["User"],
    "behaviors": ["CreateUser"],
    "parseStatus": "success",
    "typeCheckStatus": "success",
    "warningCount": 0,
    "errorCount": 0
  },
  "files": [
    { "path": ".vibecheck/specs/userauth.isl", "type": "spec", "sizeBytes": 423 },
    { "path": ".vibecheck/runtime/types.ts", "type": "types", "sizeBytes": 156 },
    { "path": ".vibecheck/runtime/runtime.ts", "type": "runtime", "sizeBytes": 892 }
  ],
  "paths": {
    "vibecheck": "/workspace/.vibecheck",
    "specs": "/workspace/.vibecheck/specs",
    "reports": "/workspace/.vibecheck/reports",
    "runtime": "/workspace/.vibecheck/runtime"
  }
}
```

#### Error Response: Missing LLM Key

```json
{
  "success": false,
  "error": "LLM API keys not configured for prompt-to-spec generation",
  "errorCode": "MISSING_LLM_KEY",
  "suggestion": "Set one of these environment variables: OPENAI_API_KEY, ANTHROPIC_API_KEY. Alternatively, provide valid ISL source code directly."
}
```

---

### `isl_verify`

Verify an implementation against ISL specifications. Runs generated tests and returns a trust score report with category breakdowns.

#### Input Schema

```typescript
interface VerifyInput {
  /** Workspace root path (default: current directory) */
  workspacePath?: string;
  
  /** Path to specs directory (default: .vibecheck/specs) */
  specsPath?: string;
  
  /** Path to implementation files (auto-detected if not provided) */
  implementationPath?: string;
  
  /** Specific behaviors to verify (verifies all if not provided) */
  behaviors?: string[];
  
  /** Test framework to use (default: 'vitest') */
  framework?: 'vitest' | 'jest';
}
```

#### Output Schema

```typescript
interface VerifyResult {
  success: boolean;
  
  /** Verification report */
  report?: {
    /** Overall trust score (0-100) */
    trustScore: number;
    
    /** Confidence level (0-100) */
    confidence: number;
    
    /** Deployment recommendation */
    recommendation: 'production_ready' | 'staging_recommended' | 'shadow_mode' | 'not_ready' | 'critical_issues';
    
    /** Score breakdown by category */
    breakdown: {
      postconditions: { score: number; passed: number; failed: number; total: number };
      invariants: { score: number; passed: number; failed: number; total: number };
      scenarios: { score: number; passed: number; failed: number; total: number };
      temporal: { score: number; passed: number; failed: number; total: number };
    };
    
    /** Test counts */
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    
    /** Detailed failures */
    failures: Array<{
      category: 'postconditions' | 'invariants' | 'scenarios' | 'temporal' | 'chaos';
      name: string;
      impact: 'critical' | 'high' | 'medium' | 'low';
      error?: string;
    }>;
  };
  
  /** Error info (only on failure) */
  error?: string;
  errorCode?: 'NO_SPECS_FOUND' | 'NO_IMPLEMENTATION_FOUND' | 'PARSE_ERROR' | 'TEST_RUNNER_ERROR' | 'FILESYSTEM_ERROR' | 'UNKNOWN_ERROR';
  suggestion?: string;
  
  /** Path to full report file */
  reportPath?: string;
}
```

#### Example: Basic Usage

```json
{}
```

Uses current directory as workspace, auto-detects specs and implementation.

#### Example: Custom Paths

```json
{
  "workspacePath": "/home/user/my-project",
  "specsPath": "/home/user/my-project/contracts",
  "implementationPath": "/home/user/my-project/src",
  "framework": "vitest"
}
```

#### Example: Verify Specific Behaviors

```json
{
  "behaviors": ["CreateUser", "UpdateUser"]
}
```

#### Example Response: Success

```json
{
  "success": true,
  "report": {
    "trustScore": 95,
    "confidence": 87,
    "recommendation": "production_ready",
    "breakdown": {
      "postconditions": { "score": 100, "passed": 5, "failed": 0, "total": 5 },
      "invariants": { "score": 100, "passed": 3, "failed": 0, "total": 3 },
      "scenarios": { "score": 90, "passed": 9, "failed": 1, "total": 10 },
      "temporal": { "score": 100, "passed": 2, "failed": 0, "total": 2 }
    },
    "totalTests": 20,
    "passed": 19,
    "failed": 1,
    "skipped": 0,
    "failures": [
      {
        "category": "scenarios",
        "name": "handles concurrent updates",
        "impact": "low",
        "error": "Expected sequential consistency"
      }
    ]
  },
  "reportPath": ".vibecheck/reports/verify-report.json"
}
```

#### Example Response: Failure

```json
{
  "success": false,
  "error": "No ISL specification files found",
  "errorCode": "NO_SPECS_FOUND",
  "suggestion": "Create .isl files in .vibecheck/specs or run isl_build first"
}
```

---

## Local Workspace Runner Helper

The `initWorkspace` function provides a consistent way to initialize and resolve workspace paths:

```typescript
import { initWorkspace } from './pipeline-tools';

const workspace = await initWorkspace('/path/to/project');
// Returns:
// {
//   root: '/path/to/project',
//   paths: {
//     vibecheck: '/path/to/project/.vibecheck',
//     specs: '/path/to/project/.vibecheck/specs',
//     reports: '/path/to/project/.vibecheck/reports',
//     runtime: '/path/to/project/.vibecheck/runtime'
//   }
// }
```

The helper:
- Resolves workspace path (defaults to `process.cwd()`)
- Creates `.vibecheck/reports` if missing
- Creates `.vibecheck/specs` if missing
- Returns consistent output shape for MCP tools

---

## Output Stability

All outputs are designed for stability:
- **No timestamps** in reports or filenames
- Deterministic file naming based on domain/behavior names
- Sorted arrays where order doesn't matter semantically

This ensures consistent outputs for:
- Caching
- Testing
- Diffing reports

---

## Error Handling

Both tools return structured errors with:
- `errorCode` - Machine-readable error type
- `error` - Human-readable message
- `suggestion` - Actionable fix suggestion

### Error Codes

**Build Errors:**
| Code | Description |
|------|-------------|
| `MISSING_LLM_KEY` | LLM API key required but not configured |
| `INVALID_PROMPT` | Empty or invalid prompt |
| `PARSE_ERROR` | ISL syntax error |
| `TYPE_ERROR` | Type checking failed |
| `CODEGEN_ERROR` | Code generation failed |
| `FILESYSTEM_ERROR` | File system operation failed |
| `UNKNOWN_ERROR` | Unexpected error |

**Verify Errors:**
| Code | Description |
|------|-------------|
| `NO_SPECS_FOUND` | No .isl files in specs directory |
| `NO_IMPLEMENTATION_FOUND` | No implementation files found |
| `PARSE_ERROR` | ISL spec parsing failed |
| `TEST_RUNNER_ERROR` | Test execution failed |
| `FILESYSTEM_ERROR` | File system operation failed |
| `UNKNOWN_ERROR` | Unexpected error |

---

## Directory Structure

After running the tools, your workspace will have:

```
.vibecheck/
├── specs/           # ISL specification files
│   └── domain.isl
├── reports/         # Build and verification reports
│   ├── domain-build.json
│   └── verify-report.json
└── runtime/         # Generated runtime code
    ├── types.ts
    └── runtime.ts
```
