# Demo: ISL Violation Blocked

> **These specs define the security contract for authentication.
> The code violates the contract in subtle but critical ways.
> ShipGate blocked this from shipping.**

This repository demonstrates what happens when source code **violates** its
co-located ISL specs. The gate catches both violations, returns `NO_SHIP`,
and blocks the deploy before the broken code reaches production.

---

## The Specs

Two ISL files define the security contract:

| Spec | What it requires |
|------|-----------------|
| `src/auth/login.isl` | Return **identical** error messages for wrong-email and wrong-password (prevents user enumeration) |
| `src/users/create.isl` | Hash passwords with **bcrypt or argon2** (encoding is not hashing) |

Both are clear, readable, and map to OWASP best practices.

## The Violations

The code breaks the contract in ways that **look reasonable** on a code review
but are real security vulnerabilities:

### 1. Login: User Enumeration (login.ts)

```
POST /auth/login { email: "unknown@x.com", password: "anything" }
→ 401 { error: "User not found" }          ← leaks that email is NOT registered

POST /auth/login { email: "alice@example.com", password: "wrong" }
→ 401 { error: "Invalid password" }         ← leaks that email IS registered
```

An attacker can enumerate every valid email address by watching which error
comes back. The spec requires a single, identical error:
`"Invalid email or password"`.

### 2. Registration: Fake Hashing (create.ts)

```typescript
const passwordHash = Buffer.from(password).toString("base64");
```

This **looks** like it transforms the password into something safe, but base64
is trivially reversible:

```
Buffer.from("c2VjcmV0MTIz", "base64").toString()   →   "secret123"
```

If the database leaks, every password is instantly recoverable. The spec
requires bcrypt or argon2 — real, slow, one-way hash functions.

---

## Running the Gate

```bash
npx shipgate verify src/
```

### Expected Output

```
src/auth/login.ts     ✗ FAIL  ISL violation: error messages differ       0.12s
  Spec: "return identical error for wrong email or password"
  Found: error("User not found") vs error("Invalid password")

src/users/create.ts   ✗ FAIL  ISL violation: password not hashed         0.08s
  Spec: "must hash password with bcrypt or argon2"
  Found: uses Buffer.from(password).toString('base64')

Verdict: NO_SHIP (2 spec violations)
```

Both violations are caught with clear explanations of **what the spec says**
and **what the code actually does**.

---

## The Fix

The `fixed/` directory contains corrected versions that satisfy both specs:

| File | Fix applied |
|------|------------|
| `fixed/auth/login.ts` | Returns `"Invalid email or password"` for both cases |
| `fixed/users/create.ts` | Uses `scrypt` (Node built-in) for password hashing |

```bash
npx shipgate verify fixed/
```

```
fixed/auth/login.ts     ✓ PASS                                          0.11s
fixed/users/create.ts   ✓ PASS                                          0.07s

Verdict: SHIP (0 violations)
```

---

## PR Gate in Action

When a PR is opened that contains these violations, the GitHub Action posts:

```
## 🛑 ShipGate: NO_SHIP

**2 spec violation(s) found:**

| File                  | Result  | Violation                    | Time  |
|-----------------------|---------|------------------------------|-------|
| `src/auth/login.ts`   | ✗ FAIL | ISL violation: error messages differ  | 0.12s |
| `src/users/create.ts` | ✗ FAIL | ISL violation: password not hashed    | 0.08s |

**Verdict: NO_SHIP** — fix the violations above and push again.

---
*Powered by [ShipGate](https://github.com/isl-lang/isl)*
```

The merge is blocked until the code satisfies its specs.

---

## File Structure

```
repo-isl-violation/
├── src/
│   ├── auth/
│   │   ├── login.isl           # Spec: identical errors
│   │   └── login.ts            # 🛑 VIOLATES — different errors
│   └── users/
│       ├── create.isl          # Spec: bcrypt/argon2 hashing
│       └── create.ts           # 🛑 VIOLATES — base64 encoding
├── fixed/
│   ├── auth/
│   │   └── login.ts            # ✅ Same error for both cases
│   └── users/
│       └── create.ts           # ✅ scrypt hashing
├── .shipgate.yml              # ShipGate configuration
├── .github/workflows/
│   └── shipgate.yml           # CI gate workflow
├── package.json
└── README.md
```

## Why This Matters

These aren't hypothetical bugs — they're the exact vulnerabilities that
appear in real production codebases:

- **User enumeration** via login error messages is [OWASP A07:2021](https://owasp.org/Top10/A07_2021-Identification_and_Authentication_Failures/)
- **Reversible password storage** is [OWASP A02:2021](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)

ISL specs make security requirements **explicit and machine-verifiable**.
ShipGate enforces them on every PR, before code reaches production.
