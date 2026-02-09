# CLI Smoke & Install Validator — Evidence Log

**Agent:** 01 — CLI Smoke & Install Validator  
**Date:** 2026-02-09  
**Environment:** Windows 10, Node v24.12.0, npm (from project)

---

## 1) Node version (Node 18+)

```
$ node -v
v24.12.0
```

**Result:** ✅ Node 18+

---

## 2) npx (published package)

### `npx -y shipgate --version`

- **From project root:** Command timed out (npm warnings about pnpm config; npx may have been affected by monorepo).
- **From clean temp dir (`%TEMP%\shipgate-smoke`):** Exit code 1, no stdout (output not captured in PowerShell).
- **Root cause (discovered via extracted tarball):** The published CLI binary `dist/cli.cjs` **requires `@opentelemetry/api`** (and related OpenTelemetry packages) at runtime. These are **not bundled** and were **not listed in `dependencies`** in the published package, so when npx runs the extracted package, `node dist/cli.cjs --version` throws:

  ```
  Error: Cannot find module '@opentelemetry/api'
  Require stack: .../dist/cli.cjs
  ```

**Result:** 🔴 **Fail** — CLI exits with code 1 when run via npx (missing runtime deps).

### `npx -y shipgate init`

- Not fully exercised via npx due to above. After fixing runtime deps (see Patch), **init** was verified using the same binary (see § 5).

---

## 3) Global install

### `npm i -g shipgate`

**Output (exact):**

```
npm error code 1
npm error path C:\Users\mevla\AppData\Roaming\npm\node_modules\shipgate
npm error command failed
npm error command C:\Windows\system32\cmd.exe /d /s /c node scripts/postinstall.js || true
npm error node:internal/modules/cjs/loader:1424
  throw err;
  ^
npm error
npm error Error: Cannot find module 'C:\Users\mevla\AppData\Roaming\npm\node_modules\shipgate\scripts\postinstall.js'
...
npm error 'true' is not recognized as an internal or external command,
npm error operable program or batch file.
```

**Root cause:**

1. **Packaging:** The published tarball **does not include `scripts/postinstall.js`**. The `files` array in `package.json` was `["dist/","README.md","LICENSE"]`, so the postinstall script was never shipped.
2. **Windows:** The script was `"postinstall": "node scripts/postinstall.js || true"`. On Windows, `cmd.exe` does not recognize `true`, so the `|| true` part itself throws.

**Result:** 🔴 **Fail** — Global install fails during postinstall (missing script + Windows `|| true`).

### `shipgate --version` / `shipgate init` (after global install)

- Could not be tested because global install did not complete.

---

## 4) Help UX (verified with fixed package)

Using the **published** `dist/cli.cjs` from the 1.0.0 tarball with OpenTelemetry deps installed in the same directory:

### `shipgate --help`

- Full help printed: usage, options (`-V, --version`, `-v, --verbose`, `-q, --quiet`, `--no-color`, `-f, --format`, `-c, --config`), list of commands (parse, check, gen, verify, init, fmt, lint, gate, etc.), examples, JSON output note, exit codes, docs link.

**Result:** ✅ **Pass**

### `shipgate init --help`

- Options shown: `-t, --template`, `-d, --directory`, `--force`, `--no-git`, `--interactive`, `--from-code`, `--from-prompt`, `--ai`, `--api-key`, etc.

**Result:** ✅ **Pass**

---

## 5) Init behavior (verified with fixed package)

**Command:**

```bash
node pkg/dist/cli.cjs init myproject -t minimal --no-git --force
```

**Output:**

```
✓ Project initialized at ...\init-out\myproject

Created files:
  + ...\myproject\src\myproject.isl
  + ...\myproject\isl.config.json
  + ...\myproject\package.json
  + ...\myproject\.gitignore
  + ...\myproject\README.md
```

**Filesystem changes:**

| Path (under project dir) | Description |
|--------------------------|-------------|
| `src/myproject.isl`      | Minimal ISL spec file |
| `isl.config.json`        | ShipGate/ISL config |
| `package.json`           | Project package.json |
| `.gitignore`             | Git ignore rules |
| `README.md`              | Project readme |

**Result:** ✅ **Pass** (once runtime deps and postinstall are fixed)

---

## 6) Published tarball contents (npm pack shipgate@1.0.0 --dry-run)

```
npm notice Tarball Contents
npm notice 1.1kB LICENSE
npm notice 3.8kB README.md
npm notice 3.2MB dist/cli.cjs
npm notice 3.2kB package.json
npm notice total files: 4
```

- **Missing from tarball:** `scripts/postinstall.js` (was not in `files`).
- **Missing from package.json:** Runtime `dependencies` for `@opentelemetry/*` (bundled build marks them external but they were not declared as dependencies).

---

## Summary: Root causes and fixes

| # | Issue | Root cause | Fix applied |
|---|--------|------------|-------------|
| 1 | Global install fails | `scripts/postinstall.js` not in `files`; postinstall fails with MODULE_NOT_FOUND | Add `"scripts/postinstall.js"` to `files` in `packages/cli/package.json` |
| 2 | Windows postinstall error | `"node scripts/postinstall.js \|\| true"` — `true` not a command on Windows | Change to `"node scripts/postinstall.js"` (script is try/catch, so no need for `\|\| true`) |
| 3 | npx / CLI exits 1 | `dist/cli.cjs` requires `@opentelemetry/api` (and siblings); not bundled and not in `dependencies` | Add `dependencies` in `packages/cli/package.json`: `@opentelemetry/api`, `@opentelemetry/resources`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/sdk-trace-node`, `@opentelemetry/semantic-conventions` (versions ^1.8.0 / ^1.22.0 to match observability package) |

---

## Verification with fixed package (simulated)

- Patched the **extracted** 1.0.0 tarball: added the five OpenTelemetry deps to `package.json`, removed devDependencies (to avoid workspace:*), ran `npm install`, then:
  - `node dist/cli.cjs --version` → `1.0.0` ✅
  - `node dist/cli.cjs --help` → full help ✅
  - `node dist/cli.cjs init --help` → init options ✅
  - `node dist/cli.cjs init myproject -t minimal --no-git --force` → project created with expected files ✅

---

## Final status

**Status:** 🔴 **Fail** (for **currently published** `shipgate@1.0.0`)

**Single biggest blocker:** **Missing runtime dependencies** — the published CLI binary expects `@opentelemetry/api` (and related packages) at runtime but they are not declared in `dependencies`, so both **npx** and **global install + run** fail when invoking the CLI. Secondary blockers: **postinstall script missing from tarball** and **Windows-incompatible `|| true`** in postinstall, which break `npm i -g shipgate`.

**After applying the patch below and republishing:** npx, global install, `shipgate --version`, `shipgate init`, and help UX should all pass.

---

## Patch (exact changes)

**File:** `packages/cli/package.json`

1. **Include postinstall in `files`:**
   - In the `"files"` array, add: `"scripts/postinstall.js"`.

2. **Postinstall script (Windows-safe):**
   - Replace: `"postinstall": "node scripts/postinstall.js || true"`
   - With: `"postinstall": "node scripts/postinstall.js"`

3. **Add runtime dependencies** (new `"dependencies"` section before `"devDependencies"`):
   ```json
   "dependencies": {
     "@opentelemetry/api": "^1.8.0",
     "@opentelemetry/resources": "^1.22.0",
     "@opentelemetry/sdk-trace-base": "^1.22.0",
     "@opentelemetry/sdk-trace-node": "^1.22.0",
     "@opentelemetry/semantic-conventions": "^1.22.0"
   },
   ```

These edits have been applied in the repo. **Next step:** Bump version if desired, then republish (e.g. `npm publish --access public` from `packages/cli`).
