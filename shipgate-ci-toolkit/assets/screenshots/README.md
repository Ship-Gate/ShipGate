# Screenshots Guide

Capture these 5 screenshots for the Gumroad listing. Use a dark terminal theme (Dracula or One Dark recommended). Font: JetBrains Mono 14pt. Terminal width: 100 columns.

---

## Screenshot 1 — Verdict Screen (SHIP)

**Command to run:**
```bash
shipgate gate examples/demo-repo/specs/user-service.isl \
  --impl examples/demo-repo/src \
  --threshold 90
```

**Capture:** Full terminal output showing the green `✓ SHIP` banner, trust score, confidence, tests passed line, and "Verified by Shipgate ✓" footer.

**Filename:** `01-verdict-ship.png`  
**Dimensions:** 1600×900

---

## Screenshot 2 — JSON Output

**Command to run:**
```bash
cat .shipgate/report.json | jq '{verdict, score, summary, findings}'
```

**Capture:** Terminal showing the structured JSON with verdict, score, summary object, and empty findings array.

**Filename:** `02-json-output.png`  
**Dimensions:** 1600×900

---

## Screenshot 3 — CI Pass (GitHub Actions)

**Capture:** GitHub Actions workflow run page showing:
- Green checkmark on the "ShipGate Quality Gate" workflow
- Step summary showing "ShipGate: PASS (score: 97/100, blockers: 0)"
- Report artifact available for download

**Filename:** `03-ci-pass.png`  
**Dimensions:** 1600×900

---

## Screenshot 4 — Config Preset

**Capture:** VS Code (or terminal `cat`) showing `configs/presets/strict.json` with gate weights visible. Optionally show the VS Code extension sidebar with the Actions tab.

**Filename:** `04-config-preset.png`  
**Dimensions:** 1600×900

---

## Screenshot 5 — Findings List (NO-SHIP)

**Setup:** Temporarily break the demo implementation to trigger findings:
- Comment out the auth check in `getUser`
- Add `return null` to `registerUser`

**Command to run:**
```bash
shipgate gate examples/demo-repo/specs/user-service.isl \
  --impl examples/demo-repo/src \
  --threshold 90
```

**Capture:** Terminal showing the red `✗ NO-SHIP` banner followed by 2–3 blocking findings with file paths, line numbers, and recommendations.

**Filename:** `05-findings-noship.png`  
**Dimensions:** 1600×900

---

## Demo GIF

See storyboard in `GUMROAD_COPY.md`. Recommended tool: [Asciinema](https://asciinema.org/) for terminal recording, then convert to GIF with [agg](https://github.com/asciinema/agg).

```bash
asciinema rec demo.cast
# run the demo commands
# Ctrl+D to stop
agg demo.cast demo.gif --theme dracula --font-size 16
```
