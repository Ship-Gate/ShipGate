# ISL Safe AI Code Demo

**90-second demo:** The first product that can ship safe AI-generated code.

## Flow

1. **`isl init --from-prompt`** — Generate ISL spec from natural language
2. **`isl init --from-code`** — Generate ISL spec from existing source code
3. **`isl check`** — Validate the spec
4. **`isl verify`** — Verify implementation against spec
5. **`isl gate`** — SHIP/NO-SHIP decision with trust score

## Run the Demo

From the repo root:

```bash
pnpm exec tsx demos/safe-ai-demo/run-demo.ts
```

Or from this directory (after `pnpm install` at root):

```bash
pnpm demo
```

## Recording the 90-Second Demo

1. Start screen recording
2. Open terminal in repo root
3. Run: `pnpm exec tsx demos/safe-ai-demo/run-demo.ts`
4. Walk through:
   - "We start with a prompt: Build me a todo app"
   - "ISL generates a spec — no manual authoring"
   - "We add an implementation (or use AI to generate it)"
   - "isl verify checks the implementation matches the spec"
   - "isl gate gives us SHIP or NO-SHIP — the trust score decides"

## With Real AI (Optional)

For better spec quality, set `ANTHROPIC_API_KEY` and use `--ai`:

```bash
# From prompt with AI
node packages/cli/dist/index.js init my-app --from-prompt "Payment processing with idempotency" --ai -d ./my-app --force

# From code with AI  
node packages/cli/dist/index.js init my-app --from-code ./src/payments.ts --ai -d ./my-app --force
```
