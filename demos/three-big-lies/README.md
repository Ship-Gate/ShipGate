# The 3 Biggest Lies AI Tells When Generating Code

A single-video demo showing the most dangerous AI code lies and how ISL catches every one.

## Three ways to run

### 1. Scripted demo (terminal)

```bash
pnpm demo:three-lies
```

### 2. Playwright + ElevenLabs (automated video)

Start the demo UI, open `/three-big-lies`, add your ElevenLabs API key, and hit Play. Or run the recording test:

```bash
pnpm demo:ui          # Start dev server, go to http://localhost:5173/three-big-lies
pnpm demo:three-lies:record   # Playwright runs demo, records video
```

### 3. Live demo (authentic, for video)

Open each session in Cursor, prompt Claude to build, then run the gate. See **[DEMO_SCRIPT.md](DEMO_SCRIPT.md)** for exact prompts and filming steps.

```
live-sessions/
  01-money-transfer/   # Session 1: Money lie
  02-login/            # Session 2: PII lie  
  03-registration/     # Session 3: Validation (app breaks, then gate catches)
```

Per session: `pnpm install` once, then `pnpm gate` after AI generates code.

## The 3 Lies

| Lie | AI Says | The Bug | Consequence |
|-----|---------|---------|-------------|
| **1. Money** | "This handles transfers correctly" | Balance deduction without check | Negative balance → theft |
| **2. Security** | "This handles login securely" | Logs password to console | PII breach, credential leak |
| **3. Validation** | "Input is validated" | No validation on user input | Empty strings, SQLi, XSS |

## Video recording tips

1. **Terminal**: Use a dark theme, large font. Run `pnpm demo:three-lies`.
2. **Script**: The output is your script—each scenario shows the lie, the code, then the gate result.
3. **Pacing**: Pause between scenarios. The summary at the end is the punchline.
4. **Duration**: ~90 seconds total.

## File layout

```
live-sessions/          # For filming - open in Cursor, prompt AI, run gate
  01-money-transfer/
  02-login/
  03-registration/
scenarios/
  01-money-transfer/bad.ts   # Transfer without balance check
  02-login-pii/bad.ts       # Login that logs password
  03-input-validation/bad.ts # Registration with no validation
checker.ts                   # Pattern-based detection (demo gate)
run-demo.ts                  # Video recording runner
```
