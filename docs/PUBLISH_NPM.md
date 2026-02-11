# Publishing Shipgate to npm

Phase 1.2 — Publish the Shipgate CLI and related packages to npm.

## Prerequisites

1. **npm account** — Create at [npmjs.com](https://www.npmjs.com/signup)
2. **Login** — `npm login`
3. **Build** — Full monorepo build must pass: `pnpm build`

## Packages to Publish

| Package | Location | Command |
|---------|----------|---------|
| `shipgate` | `packages/cli` | `npx shipgate init`, `npx shipgate gate` |
| `@shipgate/sdk` | `packages/sdk` | Programmatic API (requires parser, gate, core on npm first) |

## 1. Publish shipgate CLI

The CLI is self-contained (bundles core ISL packages). No prior publishes needed.

```bash
# From repo root
cd packages/cli

# Verify pack contents
npm pack --dry-run

# Publish (requires npm login)
pnpm publish --access public
# or: npm publish --access public
```

**Verify after publish:**
```bash
npx shipgate --help
npx shipgate init --help
```

## 2. Publish @shipgate/sdk (Phase 1.3+)

The SDK depends on `@isl-lang/parser`, `@isl-lang/gate`, `@isl-lang/core`. These must be published first (see `scripts/publish.ts` PUBLISH_ORDER), or the SDK must bundle them.

**Current status:** SDK uses workspace deps. Options:
- **A)** Publish parser, core, gate to npm first, then SDK with `@isl-lang/*` as dependencies
- **B)** Bundle parser, core, gate into SDK (larger package, self-contained)

## 3. GitHub Action (shipgate/gate-action@v1)

GitHub Actions are published from a **repository**, not npm.

1. Create repo `shipgate/gate-action` (or use existing)
2. Copy `packages/github-action-gate/` contents:
   - `action.yml`
   - `dist/` (built)
   - `README.md`
3. Tag `v1` for user reference: `shipgate/gate-action@v1`

**Usage in workflow:**
```yaml
- uses: shipgate/gate-action@v1
  with:
    threshold: 80
    mode: enforce
```

**Note:** The action currently imports `@isl-lang/gate`. For standalone publish, either:
- Bundle gate + deps with `ncc` (already in isl-gate-action)
- Or refactor to run `npx shipgate gate` and parse JSON output

## Quick Reference

```bash
# Publish shipgate CLI only
pnpm --filter shipgate publish --access public

# Dry run (no publish)
pnpm --filter shipgate publish --access public --dry-run
```

## ROADMAP Checkpoint

- [x] shipgate CLI builds and packs
- [ ] shipgate published to npm
- [ ] @shipgate/sdk published (blocked by @isl-lang deps)
- [ ] shipgate/gate-action@v1 available on GitHub
