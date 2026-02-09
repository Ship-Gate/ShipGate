# The 3 Biggest Lies — Live Demo Script

Film 3 work sessions. Each session: open a fresh project, prompt AI, get bad code, run ISL gate → NO-SHIP. Maximum authenticity.

---

## Setup (before filming)

1. Open **Cursor**
2. Switch to **Claude 4.5 Sonnet** (or latest Claude) as the agent
3. Keep a terminal visible (split pane)

---

## Session 1: Money Transfer

**Folder:** `live-sessions/01-money-transfer/`

### Steps

1. **Open project**  
   File → Open Folder → `demos/three-big-lies/live-sessions/01-money-transfer`

2. **Install deps** (once): `pnpm install`

3. **Prompt 1 (build app):**  
   > Build a simple mobile banking app with accounts and balances. Use a Map to store accounts. Include alice and bob with some starting balance.

4. **Let AI generate** `src/accounts.ts` (or similar)

5. **Prompt 2 (add transfer):**  
   > Add a function to transfer money between two bank accounts.

6. **AI generates transfer** — Often produces:
   ```ts
   sender.balance -= amount;
   receiver.balance += amount;
   return { success: true };
   ```
   No balance check. Compiles. Looks fine.

7. **Run gate:**
   ```bash
   pnpm gate
   ```

8. **Result:** NO-SHIP — "Precondition violated: sender.balance >= amount"

9. **Say:** "The AI said this handles transfers correctly. It doesn't. ISL caught it."

**Fallback:** If the AI generates correct code, copy `.demo/transfer-bad.ts` to `src/transfer.ts` and run gate again.

---

## Session 2: Login / PII

**Folder:** `live-sessions/02-login/`

### Steps

1. **Open project**  
   File → Open Folder → `demos/three-big-lies/live-sessions/02-login`

2. **Install deps** (once): `pnpm install`

3. **Prompt:**  
   > Build a login endpoint that authenticates users with email and password. Return a token on success. Add some logging for debugging.

4. **AI generates login** — Often adds:
   ```ts
   console.log('Login attempt for', email, 'with password:', password);
   ```

5. **Run gate:**
   ```bash
   pnpm gate
   ```

6. **Result:** NO-SHIP — "Password or credentials may be logged - CRITICAL security violation"

7. **Say:** "The AI said this handles login securely. It logs the password. ISL caught it."

**Fallback:** Copy `.demo/login-bad.ts` to `src/login.ts` if needed.

---

## Session 3: Registration (app that ships and breaks)

**Folder:** `live-sessions/03-registration/`

### Steps

1. **Open project**  
   File → Open Folder → `demos/three-big-lies/live-sessions/03-registration`

2. **Install deps** (once): `pnpm install`

3. **Act as dev:**  
   "We're about to deploy. App looks good. Let's ship."

4. **Deploy (simulate):**
   ```bash
   pnpm deploy
   ```

5. **Browser:** Open http://localhost:3113

6. **Break the app:**
   - Register with **empty email** and **empty name** → it "succeeds"
   - Or try name: `'; DROP TABLE users;--` → stored as-is

7. **Say:**  
   "We just shipped. Look — empty email, SQL injection in the name. No validation."

8. **Run gate (retrospective):**
   ```bash
   pnpm gate
   ```

9. **Result:** NO-SHIP — "No input validation - accepts empty strings, invalid email, SQL injection, XSS"

10. **Say:**  
   "If we'd run the gate before deploy, we'd have never shipped this."

---

## Filming tips

- Use **one take per session** for natural flow
- Show **cursor in the prompt**, then **AI generating**, then **terminal with gate**
- Keep each session ~60–90 seconds
- End with: "ISL doesn't trust 'it looks right.' ISL verifies."

---

## Project structure (per session)

```
live-sessions/
  01-money-transfer/   ← Session 1
    specs/transfer.isl
    src/accounts.ts
    run-gate.ts
    .demo/transfer-bad.ts (fallback)
  
  02-login/            ← Session 2
    specs/auth.isl
    src/index.ts
    run-gate.ts
    .demo/login-bad.ts (fallback)
  
  03-registration/     ← Session 3
    specs/registration.isl
    src/register.ts
    server.ts
    run-gate.ts
```
