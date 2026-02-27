# Audit Engine V2

Enhanced audit engine for detecting likely implementations in a codebase and generating evidence-like audit reports.

## Features

- **Multi-framework Detection**: Supports Next.js (App Router & Pages), Express, Fastify, Hono, NestJS, and more
- **Behavior Categories**: Routes, Auth, Database, Webhooks, Handlers, Services
- **Risk Flagging**: Detects common security issues:
  - Routes without authentication
  - Auth handlers without rate limiting
  - Webhooks without signature verification
  - SQL injection risks in raw queries
  - Hardcoded secrets
  - Missing input validation
- **Evidence-like Reports**: Structured output with candidates, mappings, and risk flags

## Usage

```typescript
import { auditWorkspaceV2, getAuditSummaryTextV2 } from '@isl-lang/core/audit-v2';

const report = await auditWorkspaceV2({
  workspacePath: '/path/to/project',
  minConfidence: 0.5,
  includeSnippets: true,
});

// Get text summary
console.log(getAuditSummaryTextV2(report));

// Access structured data
console.log(`Found ${report.summary.totalCandidates} candidates`);
console.log(`Risk flags: ${report.summary.totalRiskFlags}`);
console.log(`Health score: ${report.summary.healthScore}/100`);
```

## Report Structure

```typescript
interface AuditReportV2 {
  version: '2.0';
  reportId: string;
  workspacePath: string;
  auditedAt: string;
  durationMs: number;
  summary: AuditSummaryV2;
  behaviorMappings: BehaviorMapping[];
  candidates: DetectedCandidate[];
  riskFlags: RiskFlag[];
  warnings: string[];
  metadata: { ... };
}
```

## Detected Categories

| Category | Description |
|----------|-------------|
| `route` | HTTP endpoints (GET, POST, etc.) |
| `auth` | Authentication/authorization logic |
| `database` | Database operations (Prisma, Drizzle, etc.) |
| `webhook` | Webhook handlers (Stripe, GitHub, etc.) |
| `handler` | Business logic handlers |
| `service` | Service classes |
| `middleware` | Middleware functions |

## Risk Flag Categories

| Category | Severity | Description |
|----------|----------|-------------|
| `route-without-auth` | warning | Endpoint has no visible auth check |
| `route-without-validation` | info | Endpoint has no input validation |
| `auth-without-rate-limit` | warning | Auth handler lacks rate limiting |
| `webhook-without-signature` | critical | Webhook handler lacks signature verification |
| `sql-injection-risk` | critical | Raw SQL with string concatenation |
| `hardcoded-secret` | critical | Possible hardcoded credentials |
| `db-without-transaction` | info | Multiple DB ops without transaction |
| `unhandled-error` | info | DB operation may have unhandled errors |

## Configuration

```typescript
interface AuditOptionsV2 {
  maxDepth?: number;          // Max directory depth (default: 15)
  ignoreDirs?: string[];      // Directories to skip
  includeExtensions?: string[]; // File extensions to scan
  minConfidence?: number;     // Detection threshold (0-1)
  includeSnippets?: boolean;  // Include code snippets
  maxSnippetLines?: number;   // Max lines per snippet
}
```

## Framework Detection

The engine automatically detects frameworks based on:
- File paths (e.g., `/app/api/` for Next.js App Router)
- Import statements
- Decorators and patterns

Supported frameworks:
- Next.js (App Router & Pages API)
- Express
- Fastify
- Hono
- NestJS
- Koa

## Individual Detectors

For advanced usage, individual detectors can be used directly:

```typescript
import { detectRoutes, detectAuth, detectDatabase, detectWebhooks } from '@isl-lang/core/audit-v2';

const routeResult = detectRoutes(fileContent, filePath, options);
const authResult = detectAuth(fileContent, filePath, options);
```

Each detector returns:
```typescript
interface DetectorResult {
  candidates: DetectedCandidate[];
  riskFlags: RiskFlag[];
  frameworkHints: FrameworkHint[];
}
```
