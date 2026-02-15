# Shipgate - 60 Second Demo Script

## Setup (before recording)

1. Clone the demo repo:
   ```bash
   git clone https://github.com/ISL-Studio/shipgate-hello-gate
   cd shipgate-hello-gate
   ```

2. Have two browser tabs ready:
   - PR #1 (NO_SHIP): https://github.com/ISL-Studio/shipgate-hello-gate/pull/1
   - PR #2 (SHIP): https://github.com/ISL-Studio/shipgate-hello-gate/pull/2

---

## Script

### Opening (5 sec)

"Shipgate blocks risky code before it ships. Let me show you."

### Show Bad PR (15 sec)

*Open PR #1*

"This PR has auth bypass patterns and PII logging."

*Scroll to comment showing NO_SHIP*

"Shipgate blocked it. Score: 0/100. Here are the violations."

*Point to violations list*

### Show Fixed PR (15 sec)

*Open PR #2*

"After fixing those issues..."

*Scroll to comment showing SHIP*

"Clean code passes. Score: 95/100. Evidence fingerprint included."

### Show Setup (15 sec)

*Switch to terminal*

"Setting this up? One command."

```bash
npx shipgate init
```

*Show output*

"Creates config, adds GitHub workflow. Commit and push."

### Closing (10 sec)

"25 rules for auth, PII, payments, rate limits. Zero config to start."

*Show rules list briefly*

"Link in description. Try it on your repo."

---

## Key Points to Hit

1. **Before/After** - Show the contrast
2. **Zero Config** - One command setup
3. **Evidence** - Fingerprint = tamper-proof
4. **Scale** - 25 rules, 5 packs

## Don't Say

- "Just a linter" (it's a gate with evidence)
- "Catches all bugs" (it's security-focused)
- Complex technical details

## Do Say

- "Blocks risky code"
- "Evidence for every decision"
- "Zero config"
- "Baseline for legacy code"

---

## Longer Demo (3 min version)

Add these segments:

### Local Run (30 sec)

```bash
npx shipgate gate --explain
```

Show violations with fix guidance.

### Rules Exploration (30 sec)

```bash
npx shipgate rules list
npx shipgate rules explain auth/bypass-detected
```

### Baseline (30 sec)

```bash
npx shipgate baseline create
```

"Captures existing issues. New PRs only fail on new violations."

---

## Screen Recording Tips

1. **Terminal**: Use a clean terminal, large font (18pt+)
2. **Browser**: Zoom to 125%, hide bookmarks bar
3. **Speed**: Don't rush, pause on key moments
4. **Cursor**: Use a visible cursor highlighter
5. **Audio**: Record in quiet room, normalize audio

## Thumbnail Ideas

- Split screen: 🛑 NO_SHIP vs ✅ SHIP
- Terminal showing `npx shipgate init`
- PR comment with violations

## Title Options

- "Block Risky PRs in 60 Seconds"
- "Zero-Config Security Gate for GitHub"
- "Shipgate: Ship with Receipts"
