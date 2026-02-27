# @isl-lang/security-verifier-enhancer

**Agent 35 — Security Verifier Enhancer**

Detects auth drift: endpoints that require auth per ISL but don't enforce it, and vice versa.

## Features

- ✅ Extracts auth requirements from ISL specifications
- ✅ Detects auth enforcement in route implementations (middleware, guards, decorators)
- ✅ Compares ISL requirements with observed policies
- ✅ Emits claims with route, expected policy, and observed policy
- ✅ Confidence thresholds to avoid over-flagging public endpoints
- ✅ Supports multiple frameworks (Express, Next.js, NestJS, Hono, Fastify)

## Installation

```bash
pnpm add @isl-lang/security-verifier-enhancer
```

## Usage

### Basic Usage

```typescript
import { SecurityVerifierEnhancer } from '@isl-lang/security-verifier-enhancer';

const enhancer = new SecurityVerifierEnhancer('./workspace', {
  minConfidence: 0.5,
  publicEndpointThreshold: 0.7,
});

const result = await enhancer.detectDrift();

console.log(`Found ${result.summary.totalClaims} auth drift claims`);
console.log(`Critical: ${result.summary.criticalCount}`);
console.log(`Warnings: ${result.summary.warningCount}`);
```

### With Specific Files

```typescript
const result = await enhancer.detectDrift(
  ['specs/auth.isl', 'specs/users.isl'],
  ['src/routes/auth.ts', 'src/routes/users.ts']
);
```

### Accessing Claims

```typescript
for (const claim of result.claims) {
  console.log(`Route: ${claim.method} ${claim.route}`);
  console.log(`Drift Type: ${claim.driftType}`);
  console.log(`Severity: ${claim.severity}`);
  console.log(`Description: ${claim.description}`);
  console.log(`Suggestion: ${claim.suggestion}`);
}
```

## Drift Types

- **missing-auth**: ISL requires auth, but route has no enforcement
- **extra-auth**: Route has auth, but ISL marks it as public
- **role-mismatch**: Required roles don't match enforced roles
- **permission-mismatch**: Required permissions don't match enforced permissions

## Configuration

```typescript
interface AuthDriftConfig {
  /** Minimum confidence threshold (0-1) */
  minConfidence?: number;
  
  /** Public endpoint confidence threshold (higher = less likely to flag public endpoints) */
  publicEndpointThreshold?: number;
  
  /** Include code snippets in claims */
  includeSnippets?: boolean;
  
  /** Directories to ignore */
  ignoreDirs?: string[];
  
  /** File extensions to scan */
  includeExtensions?: string[];
}
```

## ISL Auth Requirements

The enhancer extracts auth requirements from ISL files:

```isl
behavior GetUser {
  security {
    requires auth
  }
}

behavior UpdateUser {
  security {
    requires role ADMIN
  }
}

behavior CreatePost {
  security {
    requires permission write:posts
  }
}
```

## Route Detection

The enhancer detects auth enforcement in:

- **Express/Fastify/Hono**: `requireAuth()`, `isAuthenticated()`, middleware patterns
- **Next.js**: `getServerSession()`, `auth()`, `requireAuth`
- **NestJS**: `@UseGuards(AuthGuard)`, `@Roles()`, `@Permissions()`
- **Manual checks**: `req.user`, `ctx.user`, role/permission checks

## Acceptance Criteria

✅ Flags real auth drift in fixtures  
✅ Doesn't over-flag public endpoints (confidence thresholds)  
✅ Detects missing auth, role mismatches, permission mismatches  
✅ Provides actionable suggestions for fixes

## License

MIT
