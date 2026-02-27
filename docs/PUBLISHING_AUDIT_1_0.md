# Publishing & Registry Audit 1.0

**Agent:** 07 — Publishing & Registry Auditor  
**Date:** 2026-02-09  
**Scope:** CLI (shipgate), core packages (@isl-lang/parser, typechecker, evaluator, isl-core).  
**Goal:** Verify what is published, versions, and tarball correctness; prevent broken publishes.

---

## 1. Commands executed and outputs

### 1.1 CLI — shipgate

```bash
npm view shipgate version
```

**Output:**
```
1.0.0
```

```bash
npm view shipgate dist-tags
```

**Output:**
```
{ latest: '1.0.0' }
```

```bash
npm view shipgate dist.tarball
```

**Output:**
```
https://registry.npmjs.org/shipgate/-/shipgate-1.0.0.tgz
```

```bash
npm view shipgate bin
```

**Output:**
```
{ shipgate: 'dist/cli.cjs', isl: 'dist/cli.cjs' }
```

---

### 1.2 Core packages

```bash
npm view @isl-lang/parser version
```

**Output:**
```
0.1.0
```

```bash
npm view @isl-lang/typechecker version
```

**Output:**
```
0.1.0
```

```bash
npm view @isl-lang/evaluator version
```

**Output:**
```
0.1.0
```

```bash
npm view @isl-lang/isl-core version
```

**Output:**
```
npm error code E404
npm error 404 Not Found - GET https://registry.npmjs.org/@isl-lang%2fisl-core - Not found
```

*Note: A separate “Access token expired or revoked” notice may appear; the 404 indicates the package is not found on the public registry (or not accessible with current auth).*

---

### 1.3 Tarball verification (shipgate)

```bash
npm pack shipgate@1.0.0
```

**Output (Tarball contents):**
```
package: shipgate@1.0.0
Tarball Contents:
  1.1kB   LICENSE
  3.8kB   README.md
  3.2MB   dist/cli.cjs
  3.2kB   package.json
Tarball Details:
  name: shipgate
  version: 1.0.0
  filename: shipgate-1.0.0.tgz
  package size: 585.0 kB
  unpacked size: 3.2 MB
  total files: 4
```

**Files in tarball (from listing):**
- `package/LICENSE`
- `package/dist/cli.cjs`
- `package/package.json`
- `package/README.md`

**Bin check:**  
`package.json` declares `"bin": { "shipgate": "./dist/cli.cjs", "isl": "./dist/cli.cjs" }`. The file `dist/cli.cjs` is present in the tarball, so **bin points to a real file** — no fix required.

---

## 2. What’s published now (summary table)

| Package               | Published | Version on npm | Dist-tags | Notes                    |
|-----------------------|-----------|----------------|-----------|--------------------------|
| **shipgate**          | Yes       | 1.0.0          | latest    | CLI; tarball & bin OK    |
| **@isl-lang/parser**   | Yes       | 0.1.0          | latest    | —                        |
| **@isl-lang/typechecker** | Yes   | 0.1.0          | latest    | —                        |
| **@isl-lang/evaluator**   | Yes   | 0.1.0          | latest    | —                        |
| **@isl-lang/isl-core**   | No    | —              | —         | 404; not on public npm   |

---

## 3. Workspace vs registry (core packages)

| Package               | Workspace version | Registry version | Status        |
|-----------------------|-------------------|------------------|---------------|
| shipgate              | 1.0.0             | 1.0.0            | In sync       |
| @isl-lang/parser      | 0.1.0             | 0.1.0            | In sync       |
| @isl-lang/typechecker | 0.1.0             | 0.1.0            | In sync       |
| @isl-lang/evaluator   | 0.1.0             | 0.1.0            | In sync       |
| @isl-lang/isl-core    | 0.1.0             | Not published    | Publish if intended |

---

## 4. @isl-lang/isl-core — publish plan (if it should be public)

- **Workspace version:** 0.1.0  
- **Ready to publish:** Package has `main`, `types`, `exports`, `files`, `prepublishOnly` (build + test).  
- **Dependency:** Depends on `@isl-lang/parser@workspace:*` (0.1.0 is already on npm).

**Recommended publish order and dist-tags:**

1. **@isl-lang/parser** — already 0.1.0 on npm; no action unless bumping.
2. **@isl-lang/isl-core** — publish 0.1.0 with tag `latest`:
   ```bash
   cd packages/isl-core
   pnpm build && pnpm test
   npm publish --access public
   ```
   (Use `npm publish --tag next` or another tag if you want to avoid updating `latest`.)

**If the package is intended to stay private:** No publish; keep using workspace protocol. The CLI (shipgate) uses `@isl-lang/isl-core@workspace:*` and bundles at build time, so it does not require isl-core to be on the public registry.

---

## 5. Required fixes and PR instructions

### 5.1 No blocking issues

- **shipgate:** Published 1.0.0; tarball contains `dist/cli.cjs`; `bin` is correct.  
- **parser, typechecker, evaluator:** Published 0.1.0; in sync with workspace.

### 5.2 Optional / follow-up

1. **@isl-lang/isl-core**
   - **If it should be public:** Follow the publish plan in §4 (build, test, `npm publish --access public` from `packages/isl-core`).  
   - **If it should stay private:** Document in repo that isl-core is workspace-only and not published to npm.

2. **npm auth (if you see “Access token expired or revoked”)**  
   - Run `npm whoami` and, if needed, `npm login` so that scoped packages and private registry access work.  
   - This does not change the 404 for `@isl-lang/isl-core` on the **public** registry; 404 means the package is not published there.

3. **Tarball hygiene**  
   - shipgate tarball has 4 files (LICENSE, README.md, dist/cli.cjs, package.json). No stray or sensitive files observed.  
   - For future releases, keep using `"files": ["dist/", "README.md", "LICENSE"]` (or equivalent) so only intended artifacts are published.

---

## 6. Verification checklist

- [x] `npm view shipgate version` → 1.0.0  
- [x] `npm view shipgate dist-tags` → latest: 1.0.0  
- [x] `npm view @isl-lang/parser version` → 0.1.0  
- [x] `npm view @isl-lang/typechecker version` → 0.1.0  
- [x] `npm view @isl-lang/evaluator version` → 0.1.0  
- [x] `npm view @isl-lang/isl-core version` → 404 (not published)  
- [x] shipgate tarball inspected via `npm pack shipgate@1.0.0`  
- [x] shipgate `bin` points to existing file `dist/cli.cjs`  

---

*End of Publishing Audit 1.0*
