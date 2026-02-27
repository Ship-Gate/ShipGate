# Shipgate CI Setup (Another Project)

How to run Shipgate in GitHub Actions (or any CI) on a **different repo** from this monorepo.

---

## Option 1: CLI in GitHub Actions (recommended for testing)

Use the Shipgate CLI with `--ci` in a workflow. Works whether the CLI is published to npm or you install from this repo.

### 1. Add the workflow file

In your **other project**, create:

**`.github/workflows/shipgate.yml`**

```yaml
name: Shipgate
on:
  pull_request:
    branches: [main, master]
  push:
    branches: [main, master]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      # --- Choose A or B below ---

      # A) If @isl-lang/cli is published to npm:
      - name: Install Shipgate CLI
        run: pnpm add -g @isl-lang/cli
      # Or: npm install -g @isl-lang/cli

      # B) If using this monorepo (IntentOS) as source — install from repo
      # - name: Install Shipgate CLI from IntentOS
      #   run: |
      #     git clone --depth 1 https://github.com/YOUR_ORG/IntentOS.git shipgate-src
      #     cd shipgate-src && pnpm install --frozen-lockfile
      #     pnpm --filter @isl-lang/cli build
      #     pnpm config set global-bin-dir $HOME/.local/bin
      #     pnpm add -g @isl-lang/cli --dir .

      - name: Find ISL spec
        id: spec
        run: |
          SPEC=$(find . -name "*.isl" -type f -not -path "./node_modules/*" 2>/dev/null | head -1)
          if [ -n "$SPEC" ]; then echo "path=$SPEC" >> $GITHUB_OUTPUT; else echo "path=" >> $GITHUB_OUTPUT; fi

      - name: Run Shipgate gate
        id: gate
        run: |
          SPEC="${{ steps.spec.outputs.path }}"
          if [ -z "$SPEC" ]; then
            echo "No .isl spec found — skipping gate"
            exit 0
          fi
          mkdir -p evidence
          isl gate "$SPEC" --impl . --ci --output ./evidence
          # --ci exits 1 on NO_SHIP, so job fails automatically

      - name: Upload evidence
        if: success() || failure()
        uses: actions/upload-artifact@v4
        with:
          name: shipgate-evidence-${{ github.sha }}
          path: evidence/
          retention-days: 30
          if-no-files-found: ignore
```

**Simpler variant (no jq, just fail on NO_SHIP):**

```yaml
name: Shipgate
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Shipgate CLI
        run: npm install -g @isl-lang/cli

      - name: Find spec and run gate
        run: |
          SPEC=$(find . -name "*.isl" -type f -not -path "./node_modules/*" | head -1)
          if [ -z "$SPEC" ]; then echo "No .isl file found"; exit 0; fi
          isl gate "$SPEC" --impl . --ci
        # exit code 1 from isl = NO_SHIP → workflow fails
```

---

## Option 2: Use the Shipgate Action (after publishing)

Once the action in this repo (`packages/isl-gate-action`) is published (e.g. to `your-org/shipgate-action` or GitHub Marketplace), your **other project** only needs:

**`.github/workflows/shipgate.yml`**

```yaml
name: Shipgate
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: your-org/shipgate-action@v1   # or shipgate/isl-verify@v1
        with:
          spec: "specs/auth.isl"             # optional; auto-discovers if omitted
          implementation: "."
          threshold: "70"
          fail-on-no-ship: "true"
          comment-on-pr: "true"
```

To **publish** the action from this repo:

1. Create a new repo (e.g. `shipgate-action` or use this one).
2. In that repo, add a workflow that builds `packages/isl-gate-action` (e.g. with `ncc`) and tags releases.
3. In your other project, reference it: `uses: your-org/shipgate-action@v1`.

---

## Option 3: Other CI (GitLab, Jenkins, etc.)

Same idea: install the CLI and run with `--ci`.

**GitLab CI (`.gitlab-ci.yml`):**

```yaml
shipgate:
  stage: test
  image: node:20
  before_script:
    - npm install -g @isl-lang/cli
  script:
    - SPEC=$(find . -name "*.isl" -type f | head -1)
    - if [ -n "$SPEC" ]; then isl gate "$SPEC" --impl . --ci; else echo "No spec"; exit 0; fi
```

**Generic (any CI):**

```bash
npm install -g @isl-lang/cli
isl gate specs/main.isl --impl src/ --ci
# Exit 0 = SHIP, 1 = NO_SHIP
```

---

## What your other project needs

| You have | What to do |
|----------|------------|
| No ISL spec yet | Create one: `isl init` in this repo generates example specs. Copy a minimal `.isl` into the other project, or run gate with no spec (firewall-only if you use the full action). |
| Already have `.isl` files | Put path in workflow (e.g. `specs/auth.isl`) or leave empty to auto-discover. |
| Implementation path | Usually `.` (repo root) or `src/`. Gate runs verification and/or firewall on changed files. |

---

## Testing locally (other project)

```bash
# From your other project’s directory
# CLI uses workspace: deps — run from IntentOS: pnpm gate:external -- <spec> --impl <dir> --ci

# Example (from IntentOS root after pnpm install && pnpm --filter @isl-lang/cli build):
# pnpm gate:external -- "C:/path/to/MevGuard/specs/mevguard.isl" --impl "C:/path/to/MevGuard" --ci
# Or: npm install -g ./packages/cli then run isl gate ... from any dir
```

- **stdout**: full JSON result  
- **stderr**: one line, e.g. `Shipgate: SHIP (score: 87/100)`  
- **Exit code**: 0 = SHIP, 1 = NO_SHIP  

Use this to confirm behavior before relying on CI.
