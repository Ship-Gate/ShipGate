# ISL 90-Second Demo Script

**Total Time:** 90 seconds  
**Format:** Screen recording with voiceover  
**Audience:** Developers evaluating ISL

---

## Setup Before Recording

- Terminal open with ISL installed
- VSCode with ISL extension
- Empty directory `demo-api/`
- No distractions on screen

---

## Script

### [0:00-0:10] Hook

**SCREEN:** Terminal, empty directory

**VOICE:**
> "You write specs. ISL writes your tests. Let me show you."

**ACTION:**
```bash
mkdir demo-api && cd demo-api
```

---

### [0:10-0:25] Write the Spec

**SCREEN:** VSCode opens, create `auth.isl`

**VOICE:**
> "Here's a CreateUser behavior. Email input, returns a User or an error. Precondition: email can't exist. Postcondition: user gets created."

**ACTION:** Type (or paste) quickly:

```isl
domain Auth {
  entity User {
    id: UUID [immutable]
    email: Email [unique]
    status: Status
  }

  behavior CreateUser {
    input { email: Email }
    output { 
      success: User
      errors { EMAIL_EXISTS }
    }
    preconditions { not User.exists(email: input.email) }
    postconditions { success implies User.exists(result.id) }
  }
}
```

**NOTE:** Keep typing fluid. Don't pause. If needed, paste and talk through it.

---

### [0:25-0:35] Check the Spec

**SCREEN:** Terminal

**VOICE:**
> "Check the spec for errors."

**ACTION:**
```bash
isl check auth.isl
```

**EXPECTED OUTPUT:**
```
✓ auth.isl: Valid (1 entity, 1 behavior)
```

**VOICE:**
> "Clean."

---

### [0:35-0:50] Generate Code

**SCREEN:** Terminal, then VSCode

**VOICE:**
> "Now generate TypeScript types and tests."

**ACTION:**
```bash
isl gen auth.isl --target typescript --output ./generated
```

**EXPECTED OUTPUT:**
```
Generated:
  → generated/auth.types.ts (42 lines)
  → generated/auth.spec.ts (67 lines)
```

**ACTION:** Open `generated/auth.types.ts` briefly in VSCode

**VOICE:**
> "Types for your entity and behavior—input, output, errors. All from the spec."

**ACTION:** Open `generated/auth.spec.ts`

**VOICE:**
> "And tests. Precondition checks, postcondition checks, error handling. Generated, not written."

---

### [0:50-1:05] Run Verification

**SCREEN:** Terminal

**VOICE:**
> "I have an implementation. Let's verify it."

**ACTION:**
```bash
isl verify auth.isl --impl ./src/auth.ts
```

**EXPECTED OUTPUT:**
```
Verifying auth.isl against ./src/auth.ts...

Trust Score: 87/100

┌─────────────────────────────────────────────┐
│ CreateUser                                  │
├─────────────────────────────────────────────┤
│ ✓ Precondition: email not exists    PASS   │
│ ✓ Postcondition: user created       PASS   │
│ ✓ Error: EMAIL_EXISTS               PASS   │
│ ⚠ Postcondition: User.exists()      PARTIAL│
└─────────────────────────────────────────────┘

Recommendation: SHIP (staging recommended)
```

**VOICE:**
> "Trust score 87. Three tests passed, one partial—that's a complex expression we couldn't fully automate. Still, high confidence."

---

### [1:05-1:20] Explain Value

**SCREEN:** Keep terminal visible

**VOICE:**
> "What did we get? Types generated from the spec—no drift. Tests generated from contracts—no gaps. A trust score showing how well the implementation matches. All from one source of truth."

---

### [1:20-1:30] Call to Action

**SCREEN:** Terminal or website

**VOICE:**
> "ISL. Spec-first, test-generated, trust-scored. Install with npm, get started in five minutes."

**ACTION:**
```bash
npm install -g @intentos/isl-cli
```

**VOICE:**
> "Link in the description."

**SCREEN:** Fade to logo or URL

---

## Alternative Endings (Choose One)

### For Pro Pitch
> "Free tier gets you this. Pro at $29/month adds property-based testing—thousands of random inputs—and chaos testing for fault injection. Higher confidence, same workflow."

### For Enterprise Pitch
> "For teams, ISL integrates with your CI pipeline. Block PRs below your trust threshold. Ship with evidence."

### For Open Source Pitch
> "ISL is open source. Star us on GitHub, join the Discord, and let's build intent-driven development together."

---

## Technical Notes for Recording

### Terminal Commands (Copy-Paste Ready)

```bash
# Setup
mkdir demo-api && cd demo-api

# Check
isl check auth.isl

# Generate
isl gen auth.isl --target typescript --output ./generated

# Verify
isl verify auth.isl --impl ./src/auth.ts
```

### Pre-Record Requirements

1. Have a working `src/auth.ts` implementation (can be simple mock)
2. ISL CLI installed and working
3. VSCode ISL extension installed for syntax highlighting
4. Test the full flow before recording to avoid surprises

### Pacing Tips

- Don't rush typing—paste if needed
- Pause briefly (1 sec) before showing output
- Keep voice calm and confident, not salesy
- Let the output speak—don't over-explain

### If Something Fails

- Have a backup recording ready
- Or: "Let me show you what this looks like when it works..." cut to working version
- Don't try to debug on camera

---

## Key Messages to Hit

1. **Spec → Types → Tests** (one source of truth)
2. **Generated, not written** (systematic, not ad-hoc)
3. **Trust score** (quantified confidence)
4. **Fast** (under 90 seconds, start to verify)

---

## What NOT to Say

- ❌ "Proves your code is correct"
- ❌ "Catches all bugs"
- ❌ "Formal verification"
- ❌ "Never ship bugs again"

Keep it honest. The demo is impressive on its own merits.
