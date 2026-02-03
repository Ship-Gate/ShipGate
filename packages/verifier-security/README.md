# @isl-lang/verifier-security

Security verifier for detecting timing attacks, insecure password comparisons, token entropy issues, and other security vulnerabilities in TypeScript code.

## Installation

```bash
pnpm add @isl-lang/verifier-security
```

## Invariants Verified

### Constant-Time Password Comparison

**Invariant:** `password comparison is constant-time`

The security verifier enforces that password and hash comparisons use constant-time functions to prevent timing attacks.

## Usage

### Basic Verification

```typescript
import { runSecurityRules } from '@isl-lang/verifier-security';

const codeMap = new Map([
  ['auth/login.ts', `
    async function login(password: string, storedHash: string) {
      return password === storedHash; // VIOLATION: timing attack!
    }
  `],
]);

const violations = runSecurityRules(codeMap);

console.log(violations);
// [{ ruleId: 'security/constant-time-compare', severity: 'critical', ... }]
```

### Using the Verifier Class

```typescript
import { SecurityVerifier } from '@isl-lang/verifier-security';

const verifier = new SecurityVerifier({
  config: {
    skipPatterns: ['*.fixture.ts'],
  },
});

const result = verifier.verify(codeMap);
console.log(result.verdict); // 'secure' | 'risky' | 'insecure'
console.log(result.score);   // 0-100
```

## Constant-Time Comparison Rules

### security/constant-time-compare

**Description:** Password and secret comparison must use constant-time functions to prevent timing attacks.

**Detects:**
- Direct equality comparisons (`===`, `!==`, `==`, `!=`) of password/hash variables
- `Buffer.equals()` for hash comparison (NOT constant-time!)
- String methods like `startsWith()`, `includes()`, `indexOf()` for secrets
- `localeCompare()` for password strings

**Approved helpers (no violation when using these):**
- `crypto.timingSafeEqual()` (Node.js)
- `bcrypt.compare()` / `bcrypt.compareSync()`
- `bcryptjs.compare()` / `bcryptjs.compareSync()`
- `argon2.verify()`
- `scrypt.verify()`
- `safeCompare()`, `constantTimeCompare()`, `secureCompare()`, `timingSafeCompare()`

**Example violations:**

```typescript
// ❌ VIOLATION: Direct equality comparison
if (inputHash === storedHash) {
  return true;
}

// ❌ VIOLATION: Buffer.equals is NOT constant-time
if (inputBuffer.equals(storedBuffer)) {
  return true;
}

// ❌ VIOLATION: String methods leak timing
if (password.startsWith(prefix)) {
  return true;
}
```

**Correct usage:**

```typescript
// ✅ CORRECT: Using crypto.timingSafeEqual
import { timingSafeEqual } from 'crypto';

const inputBuf = Buffer.from(inputHash);
const storedBuf = Buffer.from(storedHash);

if (inputBuf.length !== storedBuf.length) {
  return false;
}
return timingSafeEqual(inputBuf, storedBuf);

// ✅ CORRECT: Using bcrypt.compare
import bcrypt from 'bcrypt';
const isValid = await bcrypt.compare(password, storedHash);
```

### security/no-early-return-on-hash-mismatch

**Description:** Do not return early on hash comparison mismatches, as this creates a timing oracle.

**Example violations:**

```typescript
// ❌ VIOLATION: Early return creates timing oracle
if (inputHash !== storedHash) return false;
return true;

// ❌ VIOLATION: Ternary with early throw
return hash !== expected ? throw new Error() : true;
```

**Correct usage:**

```typescript
// ✅ CORRECT: Single branch after constant-time comparison
const isValid = timingSafeEqual(inputBuf, storedBuf);
if (!isValid) {
  return false;
}
return true;
```

## Configuration

```typescript
interface SecurityRuleConfig {
  /** File patterns to skip (e.g., ['*.test.ts', 'fixtures/']) */
  skipPatterns?: string[];
  
  /** Minimum token length in characters (default: 64 for 256-bit) */
  minTokenLength?: number;
  
  /** Minimum entropy bits required (default: 256) */
  minEntropyBits?: number;
}
```

## Verification Result

```typescript
interface SecurityVerifyResult {
  success: boolean;
  verdict: 'secure' | 'risky' | 'insecure';
  score: number; // 0-100
  staticViolations: SecurityViolation[];
  runtimeChecks: RuntimeTokenCheckResult[];
  coverage: SecurityCoverageInfo;
  timing: SecurityTimingInfo;
}
```

## Why Constant-Time Comparison Matters

Regular string comparison (`===`) compares characters one by one and returns `false` as soon as a mismatch is found. This means:

- If passwords differ at character 1, comparison returns faster
- If passwords differ at character 10, comparison takes longer
- Attackers can measure timing differences to guess passwords character by character

This is called a **timing attack**. Constant-time comparison functions always take the same amount of time regardless of where characters differ, preventing this attack vector.

## References

- [Timing Attacks on Password Hashes](https://codahale.com/a-lesson-in-timing-attacks/)
- [Node.js crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [CWE-208: Observable Timing Discrepancy](https://cwe.mitre.org/data/definitions/208.html)

## License

MIT
