# ISL Verify Proof Bundle System

Machine-verifiable proof bundles for codebase verification.

## Import Integrity Prover

The **Import Integrity Prover** is the first provable property in ISL Verify's proof bundle system. It definitively verifies that every import in a TypeScript/JavaScript codebase resolves correctly—catching AI hallucinations where imports reference non-existent files, modules, or symbols.

### Features

- ✅ **Zero Config** - Works on any TypeScript or JavaScript project
- ✅ **Comprehensive** - Handles all import types:
  - Relative imports (`./foo`, `../bar`)
  - Path aliases (`@/lib/auth`, `~/utils`)
  - Package imports (`prisma`, `zod`, `@isl-lang/parser`)
  - Dynamic imports (`import('./module')`)
  - Re-exports and barrel files
  - Type-only imports
- ✅ **Fast** - Scans 200+ files in under 3 seconds
- ✅ **Definitive** - Confidence is always "definitive" (imports either resolve or they don't)

### Usage

```typescript
import { ImportIntegrityProver } from '@isl-lang/isl-verify';

// Create prover for a project
const prover = new ImportIntegrityProver('/path/to/project');

// Generate proof
const proof = await prover.prove();

console.log(proof.status);   // 'PROVEN' | 'PARTIAL' | 'FAILED'
console.log(proof.summary);  // "847/847 imports resolve" or "845/847 imports resolve (2 hallucinated)"

// Inspect failures
if (proof.status !== 'PROVEN') {
  for (const finding of proof.findings) {
    console.log(`${finding.file}:${finding.line}`);
    console.log(`  ${finding.severity}: ${finding.message}`);
    if (finding.suggestion) {
      console.log(`  💡 ${finding.suggestion}`);
    }
  }
}
```

### Property Proof Format

```typescript
interface PropertyProof {
  property: 'import-integrity';
  status: 'PROVEN' | 'PARTIAL' | 'FAILED';
  summary: string;
  evidence: ImportEvidence[];
  findings: Finding[];
  method: 'static-ast-analysis';
  confidence: 'definitive';
  duration_ms: number;
}
```

**Status determination:**
- `PROVEN`: All imports resolve (100%)
- `PARTIAL`: 90%+ imports resolve  
- `FAILED`: Less than 90% resolve

### Evidence Format

Each import produces evidence:

```typescript
interface ImportEvidence {
  source: string;              // File containing the import
  line: number;                // Line number
  importPath: string;          // What's being imported
  symbols: string[];           // Named imports
  resolvedTo: string | null;   // Actual file path
  symbolsVerified: boolean;    // All symbols exist in target
  status: 'verified' | 'unresolved_module' | 'unresolved_symbol' | 'missing_types';
}
```

### Finding Format

Failures produce actionable findings:

```typescript
interface Finding {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
  suggestion?: string;
}
```

### Examples

#### All Imports Resolve (PROVEN)

```typescript
// src/utils.ts
export function add(a: number, b: number) { return a + b; }

// src/index.ts
import { add } from './utils';
```

**Proof:**
```json
{
  "property": "import-integrity",
  "status": "PROVEN",
  "summary": "1/1 imports resolve",
  "evidence": [{
    "source": "/project/src/index.ts",
    "line": 1,
    "importPath": "./utils",
    "symbols": ["add"],
    "resolvedTo": "/project/src/utils.ts",
    "symbolsVerified": true,
    "status": "verified"
  }],
  "findings": [],
  "method": "static-ast-analysis",
  "confidence": "definitive",
  "duration_ms": 42
}
```

#### Hallucinated Import (FAILED)

```typescript
// src/index.ts
import { nonExistent } from './missing-file';
```

**Proof:**
```json
{
  "property": "import-integrity",
  "status": "FAILED",
  "summary": "0/1 imports resolve (1 hallucinated)",
  "evidence": [{
    "source": "/project/src/index.ts",
    "line": 1,
    "importPath": "./missing-file",
    "symbols": ["nonExistent"],
    "resolvedTo": null,
    "symbolsVerified": false,
    "status": "unresolved_module"
  }],
  "findings": [{
    "file": "/project/src/index.ts",
    "line": 1,
    "severity": "error",
    "message": "Import './missing-file' cannot be resolved",
    "suggestion": "Check that the file exists and the path is correct"
  }],
  "method": "static-ast-analysis",
  "confidence": "definitive",
  "duration_ms": 38
}
```

#### Missing Symbol in Existing File

```typescript
// src/utils.ts
export function add(a: number, b: number) { return a + b; }

// src/index.ts
import { add, multiply } from './utils';  // multiply doesn't exist
```

**Finding:**
```json
{
  "file": "/project/src/index.ts",
  "line": 1,
  "severity": "error",
  "message": "Symbols [add, multiply] not found in './utils'",
  "suggestion": "Check that the symbols are exported from the target module"
}
```

### Resolution Logic

#### Relative Imports
```typescript
import { foo } from './bar';
import { baz } from '../lib/utils';
```

1. Resolve relative to importing file
2. Try extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.mjs`, `.d.ts`
3. Try index files: `/index.ts`, `/index.tsx`, `/index.js`
4. Verify exported symbols exist

#### Path Aliases
```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/lib/*": ["src/lib/*"],
      "~/utils": ["src/utils"]
    }
  }
}

// src/index.ts
import { auth } from '@/lib/auth';
import { VERSION } from '~/utils';
```

1. Read `tsconfig.json` or `jsconfig.json`
2. Match import path to alias patterns
3. Resolve to actual file paths
4. Verify exported symbols

#### Package Imports
```typescript
import { z } from 'zod';
import express from 'express';
import { Parser } from '@isl-lang/parser';
```

1. Check if `node_modules` exists
2. Locate package directory (handles scoped packages)
3. Read `package.json` for entry point
4. For performance: trust that package type definitions are correct

**Note:** If `node_modules` is missing, status is `missing_types` with suggestion to run `npm install`.

#### Dynamic Imports
```typescript
async function loadModule() {
  const mod = await import('./dynamic-module');
  return mod.data;
}
```

Same resolution as static imports, but detected via AST traversal of `import()` expressions.

#### Re-exports and Barrel Files
```typescript
// src/lib/add.ts
export function add(a: number, b: number) { return a + b; }

// src/lib/index.ts
export { add } from './add';
export * from './multiply';

// src/index.ts
import { add } from './lib';  // Resolves through barrel file
```

1. Detect `export { ... } from '...'` declarations
2. Trace full re-export chain
3. Verify final symbols exist

### Integration with Proof Bundles

The Import Integrity proof can be included in ISL Verify's overall proof bundle:

```typescript
import { ImportIntegrityProver, type PropertyProof } from '@isl-lang/isl-verify';

const proofs: PropertyProof[] = [];

// Run import integrity check
const importProver = new ImportIntegrityProver(projectRoot);
const importProof = await importProver.prove();
proofs.push(importProof);

// Future provers can be added:
// - Authentication coverage
// - Input validation coverage
// - Error handling coverage
// - Test coverage

// Combine into overall proof bundle
const proofBundle = {
  properties: proofs,
  overall_status: proofs.every(p => p.status === 'PROVEN') ? 'PROVEN' : 'PARTIAL',
  generated_at: new Date().toISOString(),
};
```

### Performance

- **200-file project**: < 3 seconds
- **Method**: Static AST analysis (no code execution)
- **Memory**: Efficient streaming parse with ts-morph
- **Caching**: ts-morph maintains internal AST cache

### Edge Cases

#### Missing node_modules
```typescript
import express from 'express';
```
**Result:** `missing_types` status with suggestion to run `npm install`

#### Missing tsconfig.json
Uses default resolution (relative + package imports only). Path aliases won't work without tsconfig.

#### Mixed Extensions
```typescript
// foo.ts exists
import { foo } from './foo';    // ✅ Resolves to foo.ts
import { foo } from './foo.js'; // ✅ Also works
```

#### Barrel File Resolution
```typescript
// lib/index.ts exists
import { util } from './lib';        // ✅ Resolves to lib/index.ts
import { util } from './lib/index';  // ✅ Also works
```

### Why This Matters

AI code generators frequently hallucinate imports:
- Importing from files that don't exist
- Importing symbols that aren't exported
- Using incorrect path aliases
- Referencing uninstalled packages

Import Integrity provides **definitive proof** that generated code imports are valid, eliminating a major source of broken AI-generated code.
