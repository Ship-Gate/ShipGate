# GitHub Copilot Instructions - IntentOS

## Project Overview

This is a **JavaScript** project using **JavaScript**.
Architecture: Flat structure
Monorepo: pnpm with 214 workspaces

## Tech Stack






- State Management: Zustand
- Validation: Zod
- Authentication: Clerk

- Testing: Vitest, Jest, React Testing Library, Playwright

## Project Structure

```

```

## Workspaces

- `packages\agent-os` - @isl-lang/agent-os
- `packages\ai-copilot` - @isl-lang/ai-copilot
- `packages\ai-generator` - @isl-lang/ai-generator
- `packages\api-gateway` - @isl-lang/api-gateway
- `packages\api-generator` - @isl-lang/api-generator
- `packages\api-versioning` - @isl-lang/api-versioning
- `packages\audit-viewer` - @isl-lang/audit-viewer
- `packages\autofix` - @isl-lang/autofix


## Existing Components

When generating UI code, prefer using these existing components:
None detected

## Custom Hooks

Use these existing hooks instead of creating new ones:
- `useDemoContext`


## API Routes

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



## Environment Variables

Required variables:
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


## Code Conventions

### File Naming
- Components: PascalCase (e.g., `Button.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: PascalCase with `.types.ts` suffix

### Import Aliases
- Use `@/` for src imports (e.g., `@/components/Button`)
- Never use deep relative imports like `../../../`

### TypeScript
- Use JSDoc comments for type hints

## Critical Rules

1. **Security**: Never hardcode API keys, secrets, or credentials
2. **Types**: Use JSDoc for type hints
3. **Components**: Check existing components before creating new ones
4. **Hooks**: Use existing custom hooks when available
5. **Validation**: Always validate input with Zod
6. **Styling**: Follow existing styling patterns
7. **State**: Use Zustand for global state

## Anti-Patterns to Avoid

- ❌ Console statements found in production code → Use a proper logger or remove before production
- ❌ TODO/FIXME comments found → Address these items before shipping
- ❌ Potential hardcoded secrets detected → Use environment variables for sensitive data
- ❌ Usage of `any` type detected → Use proper TypeScript types or `unknown`
- ❌ Mock data or fake APIs detected → Replace with real API endpoints before production


## When Writing Code

1. Follow existing patterns in the codebase
2. Use TypeScript strict types
3. Add proper error handling
4. Use existing utilities and helpers
5. Keep functions small and focused
6. Write self-documenting code

---

*Context Enhanced by vibecheck AI*
