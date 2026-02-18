# Project Generation Guide

This document provides the exact prompts and tools used to generate each benchmark project.

## Project Generation Workflow

For each project:

1. **Generate with AI tool** using the documented prompt
2. **Manual audit** - Run all 4 tools (ISL Verify, ESLint, tsc, Semgrep) and note findings
3. **Create ground truth** - Document all real issues found
4. **Plant additional issues** - Add 5 issues per category that AI didn't make but could have
5. **Verify ground truth** - Ensure line numbers are accurate

## Project Templates

### P1: Next.js Todo App ✅ COMPLETE
- **Tool**: Cursor Composer v0.43.0 (claude-3.5-sonnet)
- **Prompt**: "Build a Next.js 14 todo app with App Router. Use TypeScript, Tailwind CSS, and local state management. Include create, read, update, delete operations. No database needed, just in-memory state."
- **Status**: Full source code + ground truth complete
- **Issues**: 15 total (6 natural, 9 planted)

### P2: Express REST API
- **Tool**: GitHub Copilot Chat (GPT-4)
- **Prompt**: "Create an Express.js REST API for a blog platform. Include endpoints for posts, comments, and users. Use TypeScript, MongoDB with Mongoose, JWT auth, and input validation with Joi. Add error handling middleware."
- **Target Issues**: 
  - Hallucinations: phantom Mongoose methods, non-existent middleware packages
  - Security: missing auth on DELETE, SQL injection in raw queries, hardcoded secrets
  - Quality: unused imports, any types, missing error handling
- **Expected**: ~18-20 issues

### P3: Next.js E-commerce
- **Tool**: Claude 3.5 Sonnet (via Cursor)
- **Prompt**: "Build a Next.js 14 e-commerce site with product listing, cart, and checkout. Use App Router, TypeScript, Tailwind, Prisma with PostgreSQL, Stripe integration, and NextAuth for authentication."
- **Target Issues**:
  - Hallucinations: fake Stripe API methods, phantom Prisma relations
  - Security: PCI compliance violations, unencrypted payment data, missing CSRF
  - Quality: race conditions in cart updates, placeholder TODO comments
- **Expected**: ~25-28 issues

### P4: Fastify Microservice
- **Tool**: Cursor Composer (claude-3.5-sonnet)
- **Prompt**: "Create a Fastify microservice for order processing. Include REST endpoints, request validation with Zod, PostgreSQL with Drizzle ORM, Redis for caching, and Prometheus metrics. Use TypeScript."
- **Target Issues**:
  - Hallucinations: non-existent Drizzle helpers, phantom Redis commands
  - Security: missing rate limiting, exposed internal endpoints
  - Quality: memory leaks in event listeners, unhandled promise rejections
- **Expected**: ~16-18 issues

### P5: Next.js Dashboard
- **Tool**: v0.dev (Vercel AI)
- **Prompt**: "Build an admin dashboard with Next.js 14 App Router. Include charts (Recharts), data tables, user management, and real-time updates. Use TypeScript, Tailwind, shadcn/ui components, and tRPC for API."
- **Target Issues**:
  - Hallucinations: phantom tRPC procedures, fake chart data transformers
  - Security: admin routes without role checks, XSS in user-generated content
  - Quality: infinite re-renders, unused state variables
- **Expected**: ~20-22 issues

### P6: Express + MongoDB API
- **Tool**: GitHub Copilot (GPT-4)
- **Prompt**: "Build an Express API for a task management system. Use MongoDB with native driver (not Mongoose), TypeScript, JWT authentication, WebSocket for real-time updates, and Jest for tests."
- **Target Issues**:
  - Hallucinations: phantom MongoDB collection methods, fake Socket.IO events
  - Security: NoSQL injection, missing auth on WebSocket, weak JWT secrets
  - Quality: connection pool exhaustion, test files with no assertions
- **Expected**: ~17-19 issues

### P7: Next.js SaaS with Stripe
- **Tool**: Claude 3.5 Sonnet (via API)
- **Prompt**: "Create a SaaS boilerplate with Next.js 14. Include user auth (NextAuth), Stripe subscription billing, customer portal, usage metering, webhook handling, Prisma + PostgreSQL, and email (Resend). TypeScript required."
- **Target Issues**:
  - Hallucinations: non-existent Stripe webhook events, phantom Prisma middleware
  - Security: webhook signature verification missing, subscription bypass, PII in logs
  - Quality: async race conditions in billing, untested webhook handlers
- **Expected**: ~28-30 issues

### P8: React + tRPC Full-stack
- **Tool**: Cursor Composer (claude-3.5-sonnet)
- **Prompt**: "Build a full-stack app with React (Vite), tRPC, Prisma, PostgreSQL, and TanStack Query. Include authentication, CRUD operations for a note-taking app, real-time collaboration, and E2E tests with Playwright. TypeScript."
- **Target Issues**:
  - Hallucinations: fake tRPC middleware, phantom Prisma extensions
  - Security: missing input sanitization, exposed database credentials
  - Quality: memory leaks in subscriptions, flaky E2E tests
- **Expected**: ~22-24 issues

### P9: Next.js Blog with Auth
- **Tool**: Mixed (Copilot for backend, v0 for frontend, Claude for auth)
- **Prompt**: Multiple prompts - "Create Next.js blog backend with Prisma", "Design blog post list UI", "Add OAuth login with GitHub and Google"
- **Target Issues**:
  - Hallucinations: phantom OAuth scopes, fake Next.js API helpers
  - Security: CSRF on OAuth callback, session fixation, open redirects
  - Quality: inconsistent code style across AI-generated parts, type conflicts
- **Expected**: ~19-21 issues

### P10: Express + Prisma REST API
- **Tool**: Mixed (Copilot + Claude)
- **Prompt**: "Build an Express API for a bookstore. Include books, authors, orders. Use Prisma with SQLite, TypeScript, Zod validation, JWT auth, and Swagger docs."
- **Target Issues**:
  - Hallucinations: non-existent Swagger decorators, phantom Zod transforms
  - Security: mass assignment vulnerabilities, JWT without expiry
  - Quality: N+1 queries, missing database indexes, dead code
- **Expected**: ~15-17 issues

## Issue Planting Guidelines

For each category, plant issues that are:
1. **Realistic** - Could plausibly be made by an AI
2. **Detectable** - ISL Verify should catch them
3. **Diverse** - Cover different subcategories

### Hallucination Issues (5 per project)
- Phantom package imports (non-existent packages)
- Fake API methods (methods that don't exist on real APIs)
- Non-existent language features
- Made-up configuration options
- Fictional environment variables

### Security Issues (5 per project)
- Missing authentication on endpoints
- Unvalidated user input
- SQL/NoSQL injection vulnerabilities
- Hardcoded secrets or weak crypto
- Missing CSRF/XSS protection

### Quality Issues (5 per project)
- Dead code (unused functions/imports)
- Placeholder TODOs in production code
- Missing error handling
- Race conditions
- Memory leaks

### Dead Code (5 per project)
- Unused imports
- Unreferenced functions
- Orphaned files
- Unreachable code paths
- Commented-out code blocks

### Type Errors (5 per project)
- Any/unknown abuse
- Missing type annotations
- Type mismatches across boundaries
- Invalid generic constraints
- Missing null checks

## Verification Checklist

Before committing a project:

- [ ] All source files created and compile
- [ ] Ground truth JSON has accurate line numbers
- [ ] At least 15 issues documented
- [ ] Mix of natural (40%) and planted (60%) issues
- [ ] All 5 categories represented
- [ ] generation-metadata.json complete
- [ ] package.json with correct dependencies
- [ ] tsconfig.json present

## Ground Truth Format

```json
{
  "project": "p{N}-{name}",
  "generatedWith": {
    "tool": "Tool Name",
    "prompt": "Exact prompt used",
    "date": "2026-02-17T16:25:00Z"
  },
  "issues": [
    {
      "file": "relative/path/to/file.ts",
      "line": 42,
      "category": "hallucination | security | quality | dead-code | type-error",
      "subcategory": "specific-type",
      "description": "Clear description of the issue",
      "severity": "critical | high | medium | low",
      "planted": false
    }
  ]
}
```

## Next Steps

1. Generate all 10 projects using documented prompts
2. Run manual audit on each
3. Create ground truth files
4. Plant additional issues
5. Verify all line numbers are accurate
6. Run full benchmark suite
7. Generate marketing report
