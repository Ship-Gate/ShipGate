# ShipGate Demo — VHS terminal recording
# Render with: vhs docs/launch/demo.tape
# Produces: demo.gif
#
# Storyline:
# 1. Bad AI code passes tsc + eslint
# 2. shipgate init
# 3. shipgate scan finds ghost routes, missing auth, ghost env
# 4. shipgate vibe generates verified project from NL
# 5. shipgate gate --ci → NO_SHIP
# 6. Fix violations → SHIP (score: 94)

Output demo.gif

Set FontSize 15
Set Width 960
Set Height 540
Set Theme "Dracula"
Set TypingSpeed 50ms
Set Padding 16
Set Framerate 24

# ─── Scene 1: AI code looks fine ──────────────────────────────────────

Sleep 500ms

Type "echo '── AI-generated code that passes everything ──'"
Enter
Sleep 800ms

Type `echo '✓ tsc --noEmit: no errors'`
Enter
Sleep 400ms

Type `echo '✓ eslint src/: all clean'`
Enter
Sleep 400ms

Type `echo ''`
Enter

Type `echo 'But hiding inside src/routes/admin.ts:'`
Enter
Sleep 300ms

Type `echo '  • /api/v1/admin/stats → ghost route (not in any spec)'`
Enter
Sleep 200ms
Type `echo '  • No auth middleware on a protected endpoint'`
Enter
Sleep 200ms
Type `echo '  • process.env.ADMIN_SECRET → never configured'`
Enter
Sleep 2s

# ─── Scene 2: shipgate init ──────────────────────────────────────────

Type `echo ''`
Enter
Type `echo '── shipgate init --yes ──'`
Enter
Sleep 600ms

Type `echo '✓ Created .shipgate.yml'`
Enter
Sleep 200ms
Type `echo '✓ Created .shipgate/specs/'`
Enter
Sleep 200ms
Type `echo '✓ Created .shipgate/evidence/'`
Enter
Sleep 200ms
Type `echo '✓ Created .github/workflows/shipgate.yml'`
Enter
Sleep 200ms
Type `echo '✓ ShipGate initialized in 0.4s'`
Enter
Sleep 1.5s

# ─── Scene 3: shipgate scan ──────────────────────────────────────────

Type `echo ''`
Enter
Type "echo '── shipgate scan . ──'"
Enter
Sleep 1s

Type `printf '\n━━━ Project Scan Result ━━━\n\n'`
Enter
Sleep 300ms

Type `echo '  Verdict:         NO_SHIP'`
Enter
Sleep 200ms
Type `echo '  Files scanned:   12'`
Enter
Sleep 150ms
Type `echo '  Specs generated: 4'`
Enter
Sleep 150ms
Type `echo '  Coverage:        33% (4/12)'`
Enter
Sleep 500ms

Type `echo ''`
Enter
Type `echo '  Coverage gaps:'`
Enter
Sleep 200ms
Type `echo '    • Route not covered: /api/v1/admin/stats'`
Enter
Sleep 150ms
Type `echo '    • Route not covered: /api/v1/admin/users'`
Enter
Sleep 500ms

Type `echo ''`
Enter
Type `echo '  Issues:'`
Enter
Sleep 200ms
Type `echo '    ✗ GHOST_ROUTE  /api/v1/admin/stats — not in ISL API spec'`
Enter
Sleep 150ms
Type `echo '    ✗ AUTH_MISSING /api/v1/admin/* — no authentication'`
Enter
Sleep 150ms
Type `echo '    ✗ GHOST_ENV    ADMIN_SECRET — not declared in config'`
Enter
Sleep 2.5s

# ─── Scene 4: shipgate vibe ──────────────────────────────────────────

Type `echo ''`
Enter
Type `echo '── shipgate vibe "add payment processing with Stripe" ──'`
Enter
Sleep 1s

Type `echo '⠋ Stage 1/5: Converting natural language to ISL spec...'`
Enter
Sleep 1.5s

Type `echo '✓ ISL spec generated (confidence: 87%)'`
Enter
Sleep 300ms

Type `echo '⠋ Stage 2/5: Validating ISL specification...'`
Enter
Sleep 800ms

Type `echo '✓ Spec valid — 2 entities, 4 behaviors, 3 invariants'`
Enter
Sleep 300ms

Type `echo '⠋ Stage 3/5: Generating full-stack code...'`
Enter
Sleep 2s

Type `echo '✓ 11 files generated (backend, tests, config)'`
Enter
Sleep 300ms

Type `echo '⠋ Stage 4/5: Running TypeScript check...'`
Enter
Sleep 800ms

Type `echo '✓ Type check passed'`
Enter
Sleep 300ms

Type `echo '⠋ Stage 5/5: Verifying generated code...'`
Enter
Sleep 1.5s

Type `printf '\n\033[32mSHIP\033[0m — Generated 11 files in ./payments/\n'`
Enter
Sleep 300ms

Type `echo ''`
Enter
Type `echo '  Ship Score: 91/100'`
Enter
Sleep 150ms
Type `echo '  Duration:   12.4s'`
Enter
Sleep 2.5s

# ─── Scene 5: gate → NO_SHIP ─────────────────────────────────────────

Type `echo ''`
Enter
Type `echo '── shipgate gate .shipgate/specs/ --impl src/ --ci ──'`
Enter
Sleep 1.5s

Type `printf '\n\033[31mNO_SHIP\033[0m — 3 violation(s) remain\n'`
Enter
Sleep 300ms
Type `echo '  • GHOST_ROUTE: /api/v1/admin/stats not in API spec'`
Enter
Sleep 150ms
Type `echo '  • AUTH_MISSING: /api/v1/admin/stats has no auth middleware'`
Enter
Sleep 150ms
Type `echo '  • GHOST_ENV: ADMIN_SECRET not in ISL config'`
Enter
Sleep 300ms
Type `echo ''`
Enter
Type `echo 'Exit code: 1'`
Enter
Sleep 2s

# ─── Scene 6: fix → SHIP ─────────────────────────────────────────────

Type `echo ''`
Enter
Type `echo '── (fixed: added auth, declared env var, added route to spec) ──'`
Enter
Sleep 1s

Type `echo '── shipgate gate .shipgate/specs/ --impl src/ --ci ──'`
Enter
Sleep 1.5s

Type `printf '\n\033[32mSHIP\033[0m — All verifications passed\n'`
Enter
Sleep 300ms
Type `echo ''`
Enter
Type `echo '  Ship Score:  94/100  ↑'`
Enter
Sleep 150ms
Type `echo '  Trust Score: 96/100'`
Enter
Sleep 150ms
Type `echo '  Evidence:    .shipgate/evidence/2026-02-27-gate.json'`
Enter
Sleep 300ms
Type `echo ''`
Enter
Type `echo 'Exit code: 0'`
Enter
Sleep 2s

# ─── CTA ──────────────────────────────────────────────────────────────

Type `echo ''`
Enter
Type `printf '\033[1mnpm install -g shipgate\033[0m  •  github.com/Ship-Gate/ShipGate\n'`
Enter
Sleep 4s
