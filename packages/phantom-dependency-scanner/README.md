# Phantom Dependency Scanner

Detect hallucinated packages and missing imports with near-zero false positives.

## Features

- ✅ **Missing Dependency Detection**: Find packages imported but not in `package.json`
- ✅ **Unresolvable Import Detection**: Detect imports that cannot be resolved
- ✅ **Workspace Awareness**: Understands pnpm workspaces and local packages
- ✅ **Optional Registry Checks**: Check npm registry for package existence (cached, rate-limited)
- ✅ **Typo Suggestions**: Suggest fixes for typos in package names
- ✅ **Confidence Scoring**: Each finding includes a confidence score (0-100)

## Installation

```bash
pnpm add -D @isl-lang/phantom-dependency-scanner
```

## Usage

### Basic Usage

```typescript
import { scanDependencies } from '@isl-lang/phantom-dependency-scanner';

const result = await scanDependencies({
  projectRoot: './my-project',
});

console.log(`Found ${result.findings.length} issues`);
for (const finding of result.findings) {
  console.log(`${finding.packageName} in ${finding.file}:${finding.line}`);
  if (finding.suggestions) {
    console.log(`  Suggestions: ${finding.suggestions.join(', ')}`);
  }
}
```

### With Registry Checks

```typescript
const result = await scanDependencies({
  projectRoot: './my-project',
  checkRegistry: true,
  registryTimeout: 5000, // 5 seconds
  maxRegistryChecks: 50,
});
```

### Scan Specific Files

```typescript
const result = await scanDependencies({
  projectRoot: './my-project',
  files: ['./src/index.ts', './src/utils.ts'],
});
```

## API

### `scanDependencies(options: ScannerOptions): Promise<ScanResult>`

Main scanning function.

#### Options

- `projectRoot` (required): Project root directory
- `files` (optional): Specific files to scan (defaults to all TS/JS files)
- `checkRegistry` (optional): Enable npm registry checks (default: `false`)
- `registryTimeout` (optional): Registry check timeout in ms (default: `5000`)
- `cacheDir` (optional): Cache directory for registry checks (default: `.phantom-scanner-cache`)
- `maxRegistryChecks` (optional): Max registry checks per run (default: `50`)
- `suggestTypos` (optional): Enable typo suggestions (default: `true`)

#### Result

- `findings`: Array of findings
- `filesScanned`: Number of files scanned
- `importsChecked`: Number of imports checked
- `registryChecksPerformed`: Whether registry checks were performed
- `registryChecksMade`: Number of registry checks made
- `errors`: Array of errors encountered

### Finding Types

- `MISSING_DEPENDENCY`: Package imported but not in dependencies
- `UNRESOLVABLE_IMPORT`: Import cannot be resolved
- `SYMBOL_NOT_EXPORTED`: Imported symbol not exported (future)
- `PACKAGE_NOT_FOUND`: Package doesn't exist on npm (when registry checks enabled)

## Workspace Support

The scanner automatically detects pnpm workspaces and treats workspace packages as valid dependencies.

## Registry Checks

Registry checks are optional and designed to never block CI:

- **Cached**: Results are cached for 24 hours
- **Rate Limited**: Maximum checks per run (default: 50)
- **Timeout Protected**: Fails fast with timeout (default: 5s)
- **Non-blocking**: Returns `false` on timeout/error instead of throwing

## Typo Detection

The scanner uses Levenshtein distance to suggest typo fixes. Suggestions are ranked by similarity score.

## Confidence Scores

Each finding includes a confidence score (0-100):

- **90-95**: High confidence (missing dependency detected)
- **95-100**: Very high confidence (registry verified or file doesn't exist)

## Examples

### CI Integration

```typescript
import { scanDependencies } from '@isl-lang/phantom-dependency-scanner';

const result = await scanDependencies({
  projectRoot: process.cwd(),
  checkRegistry: false, // Disable in CI to avoid network calls
});

if (result.findings.length > 0) {
  console.error('Found phantom dependencies:');
  for (const finding of result.findings) {
    console.error(`  ${finding.packageName} in ${finding.file}:${finding.line}`);
  }
  process.exit(1);
}
```

### With Registry Checks (Development)

```typescript
const result = await scanDependencies({
  projectRoot: './my-project',
  checkRegistry: true,
  cacheDir: './.cache/phantom-scanner',
});
```

## License

MIT
