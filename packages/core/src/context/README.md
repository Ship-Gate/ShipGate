# Context Extractor

Extracts context from a repository to provide relevant information to the ISL translator.

## Usage

```typescript
import { extractContext } from '@isl-lang/core/context';

const context = await extractContext('/path/to/workspace');

console.log(context.stack);
// { language: 'typescript', runtime: 'node', frameworks: ['next'], ... }

console.log(context.detectedEntities);
// [{ name: 'User', source: 'prisma', fields: [...] }, ...]

console.log(context.keyFiles);
// [{ path: 'prisma/schema.prisma', category: 'database', ... }, ...]
```

## What Gets Detected

### Stack Detection

- **Language**: TypeScript, JavaScript, Python, Go, Rust, Java, C#
- **Runtime**: Node.js, Deno, Bun
- **Package Manager**: npm, pnpm, yarn, bun
- **Monorepo**: Detects pnpm workspaces, Lerna, Nx, Turborepo

### Framework Detection

| Category | Frameworks |
|----------|-----------|
| Node.js  | Next.js, Express, Fastify, Koa, Hono, NestJS |
| React    | Next.js, Remix |
| Vue      | Nuxt |
| Svelte   | SvelteKit |
| Python   | Django, Flask, FastAPI |
| Go       | Gin, Fiber |
| Java     | Spring |
| .NET     | ASP.NET |

### Database Detection

| Category | Technologies |
|----------|-------------|
| ORMs     | Prisma, Drizzle, TypeORM, Sequelize, Mongoose, Knex |
| Databases| PostgreSQL, MySQL, MongoDB, SQLite, Redis |

### Auth Detection

| Approach | Libraries |
|----------|-----------|
| Managed  | NextAuth, Clerk, Auth0, Supabase Auth, Firebase Auth |
| Custom   | Passport, Lucia, JWT, Session |
| OAuth    | OAuth 2.0 libraries |

### Entity Extraction

Extracts entities from:
- **Prisma**: `prisma/schema.prisma`
- **Mongoose**: Model files in `/models`
- **TypeORM**: Entity files with `@Entity()` decorator

### Key Files

Identifies important files:
- **Routes**: API routes, controllers
- **Auth**: Authentication configuration
- **Database**: Schema files, migrations, connections
- **Config**: Environment files, framework configs

## Options

```typescript
interface ExtractContextOptions {
  maxDepth?: number;        // Default: 10
  ignoreDirs?: string[];    // Default: ['node_modules', '.git', ...]
  ignorePatterns?: string[]; // Default: ['*.min.js', ...]
  extractFields?: boolean;   // Default: true
  timeoutMs?: number;        // Default: 30000
}
```

## Quick Extraction

For faster extraction with reduced depth:

```typescript
import { extractContextQuick } from '@isl-lang/core/context';

const context = await extractContextQuick('/path/to/workspace');
```

## Conservative Approach

The extractor follows a conservative approach:
- Only reports what it can confidently detect
- Marks detections with confidence levels (`high`, `medium`, `low`)
- Leaves fields blank rather than guessing
- Reports warnings for any issues encountered

## Policy Suggestions

Based on detected stack, the extractor suggests relevant policies:

```typescript
context.policySuggestions
// [
//   { policyId: 'AUTH-001', enabled: true, reason: 'Auth detected...' },
//   { policyId: 'PII-001', enabled: true, reason: 'User data likely...' },
// ]
```

## Architecture

```
context/
├── contextTypes.ts      # Type definitions
├── extractContext.ts    # Main extraction logic
├── index.ts             # Module exports
├── README.md            # This file
└── detectors/
    ├── stackDetector.ts     # Language, runtime, monorepo
    ├── frameworkDetector.ts # Web frameworks
    ├── databaseDetector.ts  # Databases, ORMs, entities
    ├── authDetector.ts      # Authentication patterns
    ├── keyFilesDetector.ts  # Important files
    └── index.ts             # Detector exports
```

## Example Output

```json
{
  "workspacePath": "/Users/dev/my-app",
  "extractedAt": "2024-01-15T10:30:00.000Z",
  "stack": {
    "language": "typescript",
    "runtime": "node",
    "frameworks": ["next"],
    "databases": ["prisma", "postgres"],
    "auth": ["nextauth"],
    "packageManager": "pnpm",
    "hasTypeScript": true,
    "isMonorepo": false
  },
  "detectedEntities": [
    {
      "name": "User",
      "source": "prisma",
      "sourceFile": "prisma/schema.prisma",
      "fields": [
        { "name": "id", "type": "String", "isId": true },
        { "name": "email", "type": "String", "isUnique": true },
        { "name": "createdAt", "type": "DateTime", "isTimestamp": true }
      ],
      "confidence": "high"
    }
  ],
  "keyFiles": [
    { "path": "prisma/schema.prisma", "category": "database", "reason": "Prisma schema" },
    { "path": "app/api/auth/[...nextauth]/route.ts", "category": "auth", "reason": "NextAuth route" }
  ],
  "policySuggestions": [
    { "policyId": "AUTH-001", "enabled": true, "reason": "Auth detected (nextauth)" }
  ],
  "warnings": [],
  "metadata": {
    "durationMs": 245,
    "filesScanned": 156,
    "extractorVersion": "0.1.0"
  }
}
```
