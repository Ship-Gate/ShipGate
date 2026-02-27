# Pre-Commit Hook

## Checks to Run
1. **Lint Check** - Run ESLint/Prettier
2. **Type Check** - Run TypeScript compiler
3. **Test Check** - Run affected tests
4. **Secret Scan** - Check for exposed secrets

## Blocking Conditions
- Any lint errors
- TypeScript errors
- Test failures
- Detected secrets

## Commands
```bash
npm run lint
npm run typecheck
npm run test:affected
```
