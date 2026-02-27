# Coding Standards

## File Naming
- Components: PascalCase (e.g., `Button.tsx`)
- Utilities: camelCase (e.g., `formatDate.ts`)
- Types: `.types.ts` or `.d.ts` suffix

## Import Order
1. React/Next.js imports
2. Third-party libraries
3. Internal components (`@/components/`)
4. Internal utilities (`@/lib/`, `@/utils/`)
5. Types
6. Styles

## Code Style
- JavaScript with JSDoc comments
- Functional components with hooks
- Path aliases (`@/`) for imports

- Zustand for state management
- Zod for validation

## Critical Rules

1. **No hardcoded secrets** - Use environment variables
2. **No `any` types** - Use proper TypeScript types
3. **No mock data in production** - Real API endpoints only
4. **Validate all inputs** - Never trust client data
5. **Use existing components** - Check before creating new ones
6. **Use existing hooks** - useDemoContext...

## ⚠️ Avoid These
- Console statements found in production code: Use a proper logger or remove before production
- TODO/FIXME comments found: Address these items before shipping
- Potential hardcoded secrets detected: Use environment variables for sensitive data
- Usage of `any` type detected: Use proper TypeScript types or `unknown`
- Mock data or fake APIs detected: Replace with real API endpoints before production


## When Creating New Files
1. Check if similar file exists
2. Place in correct directory
3. Follow naming conventions
4. Add proper types
5. Use existing patterns
