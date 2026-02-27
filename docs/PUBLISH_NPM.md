# Publishing Shipgate to npm

Phase 1.2 — Publish the Shipgate CLI and related packages to npm.

## Prerequisites

1. **npm account** — Create at [npmjs.com](https://www.npmjs.com/signup)
2. **Login** — `npm login`
3. **Build** — Full monorepo build must pass: `pnpm build`

---

## Publish EVERYTHING (full monorepo)

To publish all ~80+ public packages in dependency order:

```bash
# 1. Login to npm
npm login

# 2. (Optional) Dry run — verify without publishing
pnpm publish-packages -- --dry-run

# 3. Full publish
pnpm publish-packages

# If you have 2FA enabled, pass your OTP (expires every ~30s):
pnpm publish-packages -- --otp=123456

# Or use an npm Automation token (recommended for 80+ packages):
# Create at npmjs.com → Access Tokens → Generate → Automation (bypasses 2FA)
export NPM_TOKEN=your_automation_token
```

This runs `scripts/publish.ts` which:
- Verifies npm login
- Builds all target packages (`pnpm turbo build`)
- Publishes in dependency order (parser → core → gate → … → shipgate)
- Skips private packages
- Creates git tag

**Note:** First run may take 30–60 minutes. Some packages may fail if they have build issues; the script continues and reports failures at the end.

---

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
