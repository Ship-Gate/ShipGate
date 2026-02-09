# Mock Detector

Behavior-based detection of mock data and placeholder code. Distinguishes mock-like naming from actual mock behavior.

## Features

- **Behavior-based detection**: Detects actual mock behavior patterns, not just naming
- **Allowlisting**: Automatically allows test, mock, fixture, and story files
- **Precision tests**: 20 "should not flag" and 20 "should flag" fixtures for validation
- **Claim integration**: Integrates with the claim graph system for tracking

## Detection Patterns

### Hardcoded Success Responses
- `return { success: true }` without error handling
- `Promise.resolve({ success: true })`
- Hardcoded status codes (200, 201) without conditionals

### Placeholder Arrays
- Arrays with sentinel values (placeholder, example, test, dummy)
- Sequential IDs (1, 2, 3...) suggesting mock data
- Empty arrays with TODO comments

### TODO/Fake Patterns
- `// TODO: Replace with real API`
- `// FIXME: Fake data`
- Conditional fake data without proper environment gating

## Usage

```typescript
import { scanFile } from '@isl-lang/mock-detector';

const findings = scanFile({
  filePath: 'src/api/users.ts',
  content: sourceCode,
  config: {
    allowlist: [],
    checkDevPaths: true,
    minConfidence: 0.5,
  },
});

findings.forEach(finding => {
  console.log(`${finding.type}: ${finding.reason}`);
  console.log(`  Location: ${finding.location.file}:${finding.location.line}`);
  console.log(`  Confidence: ${finding.confidence}`);
});
```

## Configuration

```typescript
interface MockDetectorConfig {
  allowlist: string[];           // Custom allowlist patterns
  checkDevPaths: boolean;        // Check dev-only build paths
  minConfidence: number;          // Minimum confidence threshold (0-1)
  customPatterns?: MockPattern[]; // Custom detection patterns
}
```

## Allowlisting

Files are automatically allowlisted if they match:
- `**/tests/**`, `**/test/**`, `**/__tests__/**`
- `**/mocks/**`, `**/mock/**`
- `**/fixtures/**`, `**/fixture/**`
- `**/stories/**`, `**/storybook/**`
- `*.test.ts`, `*.spec.ts`, `*.mock.ts`
- `**/dev/**`, `**/development/**`, `**/demo/**`

## Claim Integration

```typescript
import { findingsToClaims } from '@isl-lang/mock-detector';

const claims = findingsToClaims(findings);
// Use claims with @isl-lang/claims-verifier
```

## Precision Tests

Run precision tests to measure detection accuracy:

```bash
npm test
```

Tests include:
- 20 fixtures that should NOT be flagged (legitimate code)
- 20 fixtures that SHOULD be flagged (mock behavior)

## License

MIT
