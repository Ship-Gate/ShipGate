# GitHub Copilot Instructions - 01-money-transfer

## Project Overview

This is a **JavaScript** project using **JavaScript**.
Architecture: Standard src/ layout


## Tech Stack












## Project Structure

```
src/
```



## Existing Components

When generating UI code, prefer using these existing components:
None detected



## API Routes

None detected





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
5. **Validation**: Always validate user input
6. **Styling**: Follow existing styling patterns
7. **State**: Keep state minimal and local

## Anti-Patterns to Avoid

- ❌ Console statements found in production code → Use a proper logger or remove before production


## When Writing Code

1. Follow existing patterns in the codebase
2. Use TypeScript strict types
3. Add proper error handling
4. Use existing utilities and helpers
5. Keep functions small and focused
6. Write self-documenting code

---

*Context Enhanced by shipgate AI*
