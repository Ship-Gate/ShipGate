# Shipgate Without Specs — Quickstart

You can use Shipgate's **firewall** to guard AI-generated code without writing any ISL specs. The firewall validates against your project's truthpack (routes, env vars, imports) and policy packs (auth, PII, payments, rate-limit).

## 1. Install

```bash
pnpm install
pnpm shipgate:setup   # Optional: git hooks
```

## 2. Generate Truthpack

Ensure your project has a truthpack. Shipgate/VibeCheck uses:

- `.guardrail/truthpack/` or `.vibecheck/truthpack/` or `.shipgate/truthpack/`
- `routes.json` — API routes
- `env.json` — environment variables
- `contracts.json` — types

If you use VibeCheck or Shipgate's tooling, truthpack is typically auto-generated. Otherwise, create minimal JSON files:

```json
// .vibecheck/truthpack/routes.json
{ "routes": ["/api/users", "/api/auth/login"] }
```

```json
// .vibecheck/truthpack/env.json
{ "vars": ["DATABASE_URL", "API_KEY"] }
```

## 3. Run the Gate

```bash
# Gate on staged files
pnpm shipgate:gate

# Gate on specific files
pnpm exec tsx packages/isl-firewall/src/cli.ts gate src/api/*.ts --explain

# Gate on all changed files
pnpm exec tsx packages/isl-firewall/src/cli.ts gate --changed-only
```

## 4. In CI

Add the firewall to your CI pipeline:

```yaml
# .github/workflows/gate.yml
- run: pnpm install
- run: pnpm exec tsx packages/isl-firewall/src/cli.ts gate --changed-only --ci
```

## 5. In the IDE (Cursor)

The rule `.cursor/rules/ai-code-safety.mdc` instructs the AI to run the firewall on every edit. Ensure the MCP server with `firewall_quick_check` / `firewall_evaluate` is configured.

## 6. When Blocked

- **Violations** include `suggestion` and `quickFixes`
- Run `isl heal ./src` to auto-fix many policy violations
- For ghost routes/env: use MCP `firewall_apply_allowlist` (type: route, value: /api/users/) or add to truthpack
- Export metrics: `pnpm shipgate:evidence:export`

## Summary

| Step | Command / Action |
|------|------------------|
| Setup | `pnpm shipgate:setup` |
| Truthpack | Ensure `.vibecheck/truthpack` or `.guardrail/truthpack` exists |
| Gate | `pnpm shipgate:gate` |
| Heal | `isl heal ./src` |
| CI | Add firewall gate step |

No ISL specs required.
