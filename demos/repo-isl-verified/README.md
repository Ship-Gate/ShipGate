# ISL-Verified Express API

A minimal Express.js API with **ISL (Intent Specification Language)** specs that
verify security, data integrity, and authentication behavior — all checks passing.

---

## What Are ISL Specs?

ISL specs are human-readable contracts that define **what your code must do** — not how.
They live alongside your source code and are verified automatically on every pull request.

Unlike tests that check "does this function return X?", ISL specs verify
**behavioral guarantees**:

- "Passwords must never appear in logs or API responses"
- "Wrong email and wrong password return the **identical** error message"
- "Passwords are hashed before storage — never stored as plaintext"

---

## The API

| Endpoint           | Method | Description                              |
| ------------------ | ------ | ---------------------------------------- |
| `/api/auth/login`  | POST   | Authenticate with email + password → JWT |
| `/api/users`       | POST   | Create a new user account                |
| `/api/users/:id`   | GET    | Retrieve a user profile (requires auth)  |

---

## What Each Spec Verifies

### `src/auth/login.isl` — Security & Anti-Enumeration

| Check | What it verifies |
|-------|-----------------|
| Passwords never leak | `input.password never_appears_in logs` and `never_appears_in response` |
| Anti-enumeration | Wrong email and wrong password return **identical** `"Invalid credentials"` error |
| JWT expiry | Token `expires_in == 3600` (1 hour) |
| Rate limiting | `rate_limit 10 per minute per ip` |
| Performance | Response within 500ms at p95 |

### `src/users/create.isl` — Data Integrity

| Check | What it verifies |
|-------|-----------------|
| Email uniqueness | `DUPLICATE_EMAIL` error when email already exists |
| Password hashing | `input.password never stored in plaintext`, hash differs from raw input |
| Input validation | Email non-empty, name non-empty, password >= 8 characters |
| Idempotent errors | `DUPLICATE_EMAIL implies User.count == old(User.count)` |

### `src/users/get.isl` — Authentication & Privacy

| Check | What it verifies |
|-------|-----------------|
| Auth required | `caller is authenticated` — rejects requests without valid Bearer token |
| No data leaks | `password_hash never_appears_in response` |
| Correct status codes | 404 for unknown ID, 401 for unauthenticated |
| Performance | Response within 100ms at p95 |

---

## Run Verification Locally

```bash
npx shipgate verify src/
```

### Expected Output

```
ShipGate ISL Verify v0.1.0
─────────────────────────────────────────────────────────────────
  src/store.ts                        ✓ PASS           Specless               1.00
  src/middleware.ts                   ✓ PASS           Specless               1.00
  src/index.ts                        ✓ PASS           Specless               1.00
  src/config.ts                       ✓ PASS           Specless               1.00
  src/users/get.ts                    ...              ISL verified           ...
  src/users/create.ts                 ...              ISL verified           ...
  src/auth/login.isl                  ...              ISL verified           ...
─────────────────────────────────────────────────────────────────
Coverage: 3/7 files have ISL specs (43%)
Verdict:  SHIP or NO_SHIP
Score:    0.70+
Mode:     mixed (auto-detected)
```

The command runs verification and reports pass/fail per file. Specless files (no .isl spec) get automatic checks. Files with .isl specs are verified against their behaviors.

---

## CI Integration

Every pull request is automatically verified against ISL specs.
Violations block the merge.

```yaml
# .github/workflows/shipgate.yml
name: ShipGate
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm ci
      - run: npx shipgate verify src/
```

---

## Run the API

```bash
npm install
JWT_SECRET=your-secret-here npx tsx src/index.ts
```

### Example Requests

**Create a user:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice","password":"Str0ng!Pass"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Str0ng!Pass"}'
```

**Get user (with token from login):**
```bash
curl http://localhost:3000/api/users/<user-id> \
  -H "Authorization: Bearer <token>"
```

---

## Project Structure

```
src/
  auth/
    login.ts            POST /api/auth/login
    login.isl           Security & anti-enumeration spec
  users/
    create.ts           POST /api/users
    create.isl          Data integrity spec
    get.ts              GET /api/users/:id
    get.isl             Authentication & privacy spec
  config.ts             Environment configuration
  store.ts              In-memory user storage
  middleware.ts          Auth middleware & rate limiter
  index.ts              Express app entry point
.shipgate.yml          ShipGate configuration
.github/workflows/      CI pipeline
```
