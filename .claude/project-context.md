# Claude Desktop - Project Context

## Project: IntentOS

### Quick Reference

| Property | Value |
|----------|-------|
| Framework | Unknown |
| Language | JavaScript |
| Architecture | Flat structure |
| Monorepo | pnpm (214 workspaces) |

### Tech Stack






- **Zustand** - State management
- **Zod** - Validation
- **Clerk** - Authentication

### Key Directories



### Workspaces

- `packages\agent-os` → @isl-lang/agent-os
- `packages\ai-copilot` → @isl-lang/ai-copilot
- `packages\ai-generator` → @isl-lang/ai-generator
- `packages\api-gateway` → @isl-lang/api-gateway
- `packages\api-generator` → @isl-lang/api-generator
- `packages\api-versioning` → @isl-lang/api-versioning
- `packages\audit-viewer` → @isl-lang/audit-viewer
- `packages\autofix` → @isl-lang/autofix
- `packages\build-runner` → @isl-lang/build-runner
- `packages\circuit-breaker` → @isl-lang/circuit-breaker


### Available Commands

- `npm run build`
- `npm run build:production`
- `npm run test`
- `npm run test:production`
- `npm run test:coverage`
- `npm run test:ci`
- `npm run lint`
- `npm run lint:production`
- `npm run clean`
- `npm run typecheck`

### Data Models

None detected

### Custom Hooks

- `useDemoContext`

### Components

None detected

### Environment Variables

- `CI`
- `ISL_AI_ENABLED`
- `ISL_AI_PROVIDER`
- `PORT`
- `STRIPE_CANCEL_URL`
- `STRIPE_PORTAL_RETURN_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_SUCCESS_URL`
- `STRIPE_TEAM_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `VITE_CLERK_PUBLISHABLE_KEY`

### API Routes

- /admin
- /users
- /index
- /generator
- /analytics
- /domains
- /verifications
- /intents
- /search
- /trust
- /cli.d
- /cli
- /documents.d
- /documents
- /features/completion.d

### Rules for AI

1. **Follow existing patterns** - Match the codebase style
2. **Use TypeScript strictly** - No `any` types
3. **Use existing components** - Check list above first
4. **Use existing hooks** - Don't recreate what exists
5. **Validate inputs** - Use Zod for validation
6. **No hardcoded secrets** - Use environment variables
7. **No mock data** - Use real API endpoints

### ⚠️ Avoid These Patterns

- Console statements found in production code
- TODO/FIXME comments found
- Potential hardcoded secrets detected
- Usage of `any` type detected
- Mock data or fake APIs detected


---

*Context Enhanced by shipgate AI*
