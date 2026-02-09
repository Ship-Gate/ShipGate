# Stamp Conflicts Report

Generated: 2026-02-09

## Summary

After stamping **all 217 packages**, only **8 residual issues** remain.
All are missing `src/index.ts` barrel exports where other `.ts` files already exist.
The stamp tool intentionally skips these to avoid overwriting real source code.

## Manual Action Required

Each package below needs a `src/index.ts` that re-exports its public API:

### 1. `@isl-lang/diff-viewer`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 2. `@isl-lang/docs`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 3. `@isl-lang/stdlib-time`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 4. `@isl-lang/trace-viewer`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 5. `@isl-lang/ui-generator`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 6. `@isl-lang/visual-editor`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 7. `shipgate-isl`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

### 8. `vscode-islstudio`
- **Issue:** `src/index.ts` missing — other `.ts` files exist in `src/`
- **Action:** Create `src/index.ts` with barrel exports for the package's public API

## Resolution

For each package, inspect `src/*.ts` and create an `index.ts` like:

```typescript
export * from './module-a';
export * from './module-b';
// ... etc
```

Then re-run `pnpm stamp:dry-run` to confirm zero issues remain.
