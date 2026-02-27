# Agent 29 - Env Reality Owner

Detect invented env vars and missing env definitions with precision.

## Mission

This package analyzes your codebase to find:
- **Used-but-undefined**: Environment variables used in code but not defined anywhere
- **Defined-but-unused**: Environment variables defined but never used
- **Renamed drift**: Variables that may have been renamed (similar names detected)
- **Type mismatches**: Type inconsistencies between definitions and usage

## Features

### Definition Sources
- `.env*` files (`.env`, `.env.example`, `.env.local`, etc.)
- Zod schemas (`z.object({ VAR_NAME: z.string() })`)
- Joi schemas (planned)
- Kubernetes manifests (`env:` sections)
- Dockerfiles (`ENV` directives)
- Terraform variables (planned)
- Helm charts (planned)

### Usage Detection
- `process.env.VAR_NAME`
- `process.env['VAR_NAME']`
- `Deno.env.get('VAR_NAME')`
- `import.meta.env.VAR_NAME` (Vite/Next.js)
- `Bun.env.VAR_NAME`

## Usage

```typescript
import { checkEnvReality, formatReport } from '@isl-lang/env-reality-checker';

const result = await checkEnvReality({
  projectRoot: process.cwd(),
  sourcePatterns: ['**/*.{ts,tsx,js,jsx}'],
  envFilePatterns: ['.env*'],
  schemaPatterns: ['**/*schema*.ts'],
});

// Get human-readable report
console.log(formatReport(result));

// Or access structured data
console.log(`Found ${result.summary.totalClaims} issues`);
for (const claim of result.claims) {
  console.log(`[${claim.severity}] ${claim.variable}: ${claim.message}`);
  console.log(`  Remediation: ${claim.remediation.join(', ')}`);
}
```

## Remediation Actions

Each claim includes suggested remediation actions:

- `add-to-schema`: Add to Zod/Joi schema
- `add-to-env-file`: Add to `.env.example`
- `add-to-docs`: Add to documentation
- `remove-usage`: Remove unused code
- `add-default`: Add default value
- `fix-type`: Fix type mismatch
- `rename-usage`: Update usage to new name

## Example Output

```
════════════════════════════════════════════════════════════════════════════════
ENVIRONMENT VARIABLE REALITY CHECK REPORT
════════════════════════════════════════════════════════════════════════════════

SUMMARY
────────────────────────────────────────────────────────────────────────────────
Total Definitions: 25
Total Usages: 30
Total Issues: 5
  - Used but Undefined: 2
  - Defined but Unused: 2
  - Renamed Drift: 1
  - Type Mismatches: 0

ERRORS
────────────────────────────────────────────────────────────────────────────────
[used-but-undefined] MISSING_API_KEY
  Environment variable "MISSING_API_KEY" is used but not defined in any .env file, schema, or deployment manifest
  Usage: src/config.ts:42
  Remediation: add-to-schema, add-to-env-file, add-to-docs
```

## Acceptance Criteria

✅ Fixtures show correct detection  
✅ Minimal false positives in common patterns  
✅ Handles all major env var patterns  
✅ Provides actionable remediation suggestions

## License

MIT
