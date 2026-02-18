# Tier 1 Static Property Provers

This document describes the 4 Tier 1 static provers that complete the static proof bundle for ISL verification.

## Overview

All provers implement the `PropertyProver` interface:

```typescript
interface PropertyProver {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  prove(project: ProjectContext): Promise<PropertyProof>;
}
```

## 1. SecretExposureProver

**ID**: `tier1-secret-exposure`  
**Tier**: 1  
**Method**: Pattern matching + entropy analysis

### What it Checks

- **Pattern Matching**: Detects known secret formats
  - Stripe keys (`sk_live_*`, `pk_live_*`)
  - GitHub tokens (`ghp_*`)
  - AWS access keys (`AKIA*`)
  - Private keys (`-----BEGIN PRIVATE KEY-----`)
  - API keys, connection strings
  
- **Entropy Analysis**: Flags strings with Shannon entropy > 4.5 bits/char and length > 20
  
- **Sensitive Variables**: Detects assignments to:
  - `password`, `secret`, `apiKey`, `token`, `privateKey`, `connectionString`, etc.
  
- **Gitignore Check**: Verifies `.env` is in `.gitignore`
  
- **Client-Side Exposure**: Flags secrets in Next.js client code (app directory without `'use server'`)
  
- **Env Example**: Verifies `process.env` references have corresponding `.env.example` entries

### PROVEN Criteria

- 0 hardcoded secrets detected
- `.env` properly gitignored
- No client-side secret exposure
- All `process.env` references documented

### Example Usage

```typescript
import { SecretExposureProver } from '@isl-lang/isl-verify/proof';

const prover = new SecretExposureProver();
const proof = await prover.prove({
  rootPath: '/path/to/project',
  sourceFiles: ['src/config.ts', 'src/auth.ts'],
  gitignorePath: '/path/to/project/.gitignore',
});

console.log(proof.status); // 'PROVEN' | 'PARTIAL' | 'FAILED'
console.log(proof.findings); // Array of findings with severity
```

## 2. SQLInjectionProver

**ID**: `tier1-sql-injection`  
**Tier**: 1  
**Method**: Pattern matching + ORM detection

### What it Checks

- **ORM Detection**: Identifies ORM in use (Prisma, Drizzle, TypeORM, Knex, pg, mysql2, MongoDB)
  
- **Unsafe Patterns**:
  - Prisma `$queryRaw` / `$executeRaw` with template literals
  - Drizzle `sql.raw()`
  - String concatenation in SQL queries
  - Template literals in `SELECT`, `WHERE`, `UPDATE`, `INSERT`
  - MongoDB `$where` operator
  - MongoDB `$regex` with unescaped user input
  
- **Safe Patterns**:
  - Prisma ORM methods (`findMany`, `create`, etc.)
  - Parameterized queries (`$1`, `$2` style)
  - Drizzle query builder
  - Tagged template literals with proper escaping

### PROVEN Criteria

- All DB access uses parameterized queries or ORM methods
- 0 raw string concatenation in query contexts
- 0 unsafe MongoDB operators with user input

### Example Usage

```typescript
import { SQLInjectionProver } from '@isl-lang/isl-verify/proof';

const prover = new SQLInjectionProver();
const proof = await prover.prove({
  rootPath: '/path/to/project',
  sourceFiles: ['src/db/**/*.ts'],
  packageJson: {
    dependencies: {
      '@prisma/client': '^5.0.0',
    },
  },
});

console.log(proof.summary); // "All 15 DB access points use parameterized queries. ORM: prisma"
```

## 3. ErrorHandlingProver

**ID**: `tier1-error-handling`  
**Tier**: 1  
**Method**: AST analysis + text patterns

### What it Checks

- **Route Handler Coverage**: Express, Fastify, Next.js handlers have try-catch or error middleware
  
- **Try-Catch Quality**:
  - Not empty blocks
  - Not console.log-only
  - No stack trace leaks (`error.stack` in responses)
  - Appropriate HTTP status codes (not 200 for errors)
  
- **Promise Handling**:
  - Promise chains have `.catch()`
  - No floating promises (unawaited)
  
- **Async/Await**: `await` expressions inside try-catch blocks

### PROVEN Criteria

- All route handlers have meaningful error handling
- No stack traces leaked in production error responses
- All promises have rejection handling
- No floating promises

### Example Usage

```typescript
import { ErrorHandlingProver } from '@isl-lang/isl-verify/proof';

const prover = new ErrorHandlingProver();
const proof = await prover.prove({
  rootPath: '/path/to/project',
  sourceFiles: ['src/routes/**/*.ts', 'src/api/**/*.ts'],
});

console.log(proof.evidence.filter(e => e.type === 'try-catch').length);
console.log(proof.findings.filter(f => f.severity === 'error').length);
```

## 4. TypeSafetyProver

**ID**: `tier1-type-safety`  
**Tier**: 1  
**Method**: tsc validation + type coverage analysis

### What it Checks

- **TypeScript Compiler**: Runs `tsc --noEmit --strict` programmatically
  
- **Type Coverage**:
  - Total functions vs explicitly typed functions
  - Public/exported functions without return types
  - `any` type usage
  
- **Type Escape Hatches**:
  - `@ts-ignore` comments
  - `@ts-expect-error` comments
  - `as any` casts
  - Type assertions
  
- **JavaScript Projects**: Reports as NOT VERIFIED with suggestion to migrate

### PROVEN Criteria

- `tsc --strict` passes with 0 errors
- 0 implicit `any` on public functions
- 0 `@ts-ignore` suppressions
- All exported functions have explicit return types

### PARTIAL Criteria

- `tsc` passes but has type assertions or suppressions

### Example Usage

```typescript
import { TypeSafetyProver } from '@isl-lang/isl-verify/proof';

const prover = new TypeSafetyProver();
const proof = await prover.prove({
  rootPath: '/path/to/project',
  sourceFiles: ['src/**/*.ts', 'src/**/*.tsx'],
  tsconfigPath: '/path/to/project/tsconfig.json',
});

console.log(proof.status); // 'PROVEN' | 'PARTIAL' | 'FAILED'
console.log(proof.summary); // "TypeScript strict mode passes. 42/45 functions typed."
```

## Running All Provers

```typescript
import {
  SecretExposureProver,
  SQLInjectionProver,
  ErrorHandlingProver,
  TypeSafetyProver,
  type ProjectContext,
  type PropertyProof,
} from '@isl-lang/isl-verify/proof';

const provers = [
  new SecretExposureProver(),
  new SQLInjectionProver(),
  new ErrorHandlingProver(),
  new TypeSafetyProver(),
];

const context: ProjectContext = {
  rootPath: '/path/to/project',
  sourceFiles: glob.sync('src/**/*.{ts,tsx}'),
  packageJson: JSON.parse(fs.readFileSync('package.json', 'utf-8')),
  gitignorePath: '/path/to/project/.gitignore',
  tsconfigPath: '/path/to/project/tsconfig.json',
};

const proofs = await Promise.all(
  provers.map(prover => prover.prove(context))
);

const allPassed = proofs.every(p => p.status === 'PROVEN');
const criticalIssues = proofs.flatMap(p => p.findings.filter(f => f.severity === 'error'));

console.log(`Overall: ${allPassed ? 'PASS' : 'FAIL'}`);
console.log(`Critical issues: ${criticalIssues.length}`);
```

## Evidence Types

Each prover produces typed evidence:

```typescript
type SecretEvidence = {
  file: string;
  line: number;
  pattern: string;
  entropy?: number;
  variableName?: string;
  context: string;
};

type SQLEvidence = {
  file: string;
  line: number;
  orm: string | null;
  queryMethod: string;
  safetyLevel: 'safe' | 'parameterized' | 'unsafe';
  context: string;
};

type ErrorHandlingEvidence = {
  file: string;
  line: number;
  handler: string;
  type: 'try-catch' | 'error-middleware' | 'promise-catch' | 'missing';
  hasStackLeak: boolean;
  hasMeaningfulHandler: boolean;
  context: string;
};

type TypeSafetyEvidence = {
  file: string;
  totalFunctions: number;
  typedFunctions: number;
  anyUsages: number;
  tsIgnores: number;
  typeAssertions: number;
  tscResult: 'pass' | 'fail' | 'not-typescript';
  errors: string[];
};
```

## Test Coverage

Each prover has comprehensive tests:

- **SecretExposureProver**: 10+ test scenarios covering pattern matching, entropy, gitignore, client-side exposure
- **SQLInjectionProver**: 12+ test scenarios covering ORM detection, unsafe patterns, safe patterns, MongoDB
- **ErrorHandlingProver**: 15+ test scenarios covering route handlers, try-catch quality, promise chains, async/await
- **TypeSafetyProver**: 12+ test scenarios covering tsc validation, type coverage, escape hatches, JavaScript projects

Run tests:
```bash
cd packages/isl-verify
npm test -- secret-exposure-prover
npm test -- sql-injection-prover
npm test -- error-handling-prover
npm test -- type-safety-prover
```

## Integration

These provers complement the existing verification pipeline:

1. **Tier 1 (Static)**: Import integrity, auth coverage, **secret exposure**, **SQL injection**, **error handling**, **type safety**
2. **Tier 2 (Dynamic)**: Runtime verification, test execution
3. **Tier 3 (AI-Assisted)**: Property inference, spec generation

Together they provide comprehensive proof that code meets security and quality requirements.
