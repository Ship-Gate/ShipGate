# @isl-lang/build-runner

End-to-end build runner for ISL specifications. Performs the complete compilation pipeline and produces deterministic output.

## Features

- **Complete Pipeline**: Parse → Type Check → Import Resolve → Code Generation → Test Generation → Verification
- **Deterministic Output**: Stable file ordering, no timestamps, reproducible builds
- **Evidence Generation**: JSON evidence and HTML reports for verification results
- **Multiple Targets**: TypeScript code generation (more targets planned)
- **Test Framework Support**: Vitest and Jest test generation

## Installation

```bash
pnpm add @isl-lang/build-runner
```

## Usage

```typescript
import { buildRunner } from '@isl-lang/build-runner';

const result = await buildRunner.run({
  specPath: './spec.isl',
  outDir: './generated',
  target: 'typescript',
});

if (result.success) {
  console.log(`Generated ${result.files.length} files`);
  console.log(`Overall score: ${result.evidence?.summary.overallScore}`);
} else {
  console.error('Build failed:', result.errors);
}
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `specPath` | `string` | required | Path to the ISL specification file |
| `outDir` | `string` | required | Output directory for generated files |
| `target` | `'typescript'` | `'typescript'` | Target language for code generation |
| `testFramework` | `'vitest' \| 'jest'` | `'vitest'` | Test framework for generated tests |
| `verify` | `boolean` | `true` | Run verification and generate evidence |
| `htmlReport` | `boolean` | `true` | Generate HTML verification report |
| `includeChaosTests` | `boolean` | `true` | Include chaos/resilience tests |
| `includeHelpers` | `boolean` | `true` | Include test helper files |

## Output Structure

The build runner produces a fixed, deterministic directory structure:

```
<outDir>/
├── manifest.json           # Build manifest with file list and hashes
├── types/                  # Generated TypeScript types
│   └── index.ts
├── tests/                  # Generated test files
│   ├── <Behavior>.test.ts
│   ├── <Behavior>.scenarios.test.ts
│   ├── <Behavior>.chaos.test.ts
│   ├── helpers/
│   │   ├── chaos-controller.ts
│   │   ├── scenario-helpers.ts
│   │   ├── test-utils.ts
│   │   └── <Behavior>.builder.ts
│   └── fixtures/
│       └── index.ts
├── evidence/              # Verification evidence
│   └── evidence.json
└── reports/               # Human-readable reports
    └── report.html
```

## Pipeline Stages

The build runner executes the following stages in order:

1. **Parse**: Lexes and parses the ISL specification into an AST
2. **Check**: Type-checks the AST for semantic errors
3. **Import Resolve**: Resolves `import` statements (stdlib libraries)
4. **Codegen**: Generates TypeScript types and validators
5. **Testgen**: Generates executable test files
6. **Verify**: Runs verification against a mock implementation

Each stage reports timing and errors independently.

## Evidence Format

The evidence JSON contains:

```json
{
  "version": "1.0.0",
  "buildId": "abc123def456",
  "spec": {
    "path": "./spec.isl",
    "hash": "0123456789abcdef"
  },
  "domain": {
    "name": "MyDomain",
    "version": "1.0.0"
  },
  "summary": {
    "totalBehaviors": 3,
    "passedBehaviors": 3,
    "failedBehaviors": 0,
    "totalChecks": 15,
    "passedChecks": 15,
    "failedChecks": 0,
    "overallScore": 100,
    "verdict": "verified"
  },
  "behaviors": [...],
  "timing": {
    "parseMs": 5.2,
    "checkMs": 3.1,
    "importResolveMs": 0.5,
    "codegenMs": 12.3,
    "testgenMs": 8.7,
    "verifyMs": 45.2,
    "totalMs": 75.0
  }
}
```

## Determinism Guarantees

The build runner guarantees deterministic output:

- **File Ordering**: All files are sorted alphabetically by path
- **No Timestamps**: No date/time values in generated content
- **Stable Hashes**: Same input produces same build ID and file hashes
- **Consistent JSON**: Object keys are sorted, arrays are ordered
- **Reproducible**: Running twice produces identical output

## Running Tests

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

## API Reference

### `buildRunner.run(options)`

Main entry point. Runs the complete build pipeline.

**Parameters:**
- `options: BuildOptions` - Build configuration

**Returns:**
- `Promise<BuildResult>` - Build result with files, evidence, and errors

### Pipeline Stages

For advanced usage, individual pipeline stages are exported:

```typescript
import {
  parseStage,
  checkStage,
  importResolveStage,
  codegenStage,
  testgenStage,
  verifyStage,
} from '@isl-lang/build-runner';
```

### Output Utilities

```typescript
import {
  hashContent,
  createDeterministicBuildId,
  sortFilesDeterministically,
  writeOutputFiles,
  cleanOutputDir,
} from '@isl-lang/build-runner';
```

### Evidence Generation

```typescript
import {
  generateEvidenceJson,
  generateEvidenceHtml,
} from '@isl-lang/build-runner';
```

## License

MIT
