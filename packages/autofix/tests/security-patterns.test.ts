/**
 * Security Pattern Detector Tests
 *
 * Verifies each of the 7 pattern-based fix detectors.
 */

import { describe, it, expect } from 'vitest';
import {
  runAllPatternDetectors,
  getDetector,
  ALL_DETECTORS,
} from '../src/security-patterns.js';
import type { FixSuggestion } from '../src/fix-suggestion.js';

// ============================================================================
// Helper
// ============================================================================

function detect(file: string, source: string): FixSuggestion[] {
  return runAllPatternDetectors(file, source);
}

// ============================================================================
// 1. Different Error Messages
// ============================================================================

describe('different-error-messages detector', () => {
  const detector = getDetector('different-error-messages')!;

  it('detects user-not-found vs wrong-password leaking', () => {
    const source = `
async function login(email, password) {
  const user = await db.users.findByEmail(email);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  if (!validPassword) {
    return res.status(401).json({ error: "Wrong password" });
  }
}`;
    const fixes = detector.detect({ file: 'login.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('different-error-messages');
    expect(fixes[0]!.suggestedCode).toContain('Invalid credentials');
    expect(fixes[0]!.confidence).toBeGreaterThan(0.8);
    expect(fixes[0]!.breaking).toBe(false);
  });

  it('does not flag when messages are identical', () => {
    const source = `
if (!user) {
  return res.status(401).json({ error: "Invalid credentials" });
}
if (!validPassword) {
  return res.status(401).json({ error: "Invalid credentials" });
}`;
    const fixes = detector.detect({ file: 'login.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 2. Missing Password Hashing
// ============================================================================

describe('missing-password-hashing detector', () => {
  const detector = getDetector('missing-password-hashing')!;

  it('detects direct password assignment', () => {
    const source = `user.password = input.password;`;
    const fixes = detector.detect({ file: 'user.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('missing-password-hashing');
    expect(fixes[0]!.suggestedCode).toContain('bcrypt.hash');
  });

  it('detects password in object literal', () => {
    const source = `const data = { password: input.password };`;
    const fixes = detector.detect({ file: 'user.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.suggestedCode).toContain('bcrypt.hash');
  });

  it('ignores lines that already hash', () => {
    const source = `user.password = await bcrypt.hash(input.password, 12);`;
    const fixes = detector.detect({ file: 'user.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 3. No Rate Limiting
// ============================================================================

describe('no-rate-limiting detector', () => {
  const detector = getDetector('no-rate-limiting')!;

  it('detects login endpoint without rate limit', () => {
    const source = `router.post('/login', loginHandler);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('no-rate-limiting');
    expect(fixes[0]!.suggestedCode).toContain('rateLimit');
  });

  it('detects register endpoint without rate limit', () => {
    const source = `router.post('/register', registerHandler);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
  });

  it('ignores endpoint that already has rate limit', () => {
    const source = `router.post('/login', rateLimit({ max: 5 }), loginHandler);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes).toHaveLength(0);
  });

  it('ignores non-sensitive endpoints', () => {
    const source = `router.get('/products', listProducts);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 4. Missing Input Validation
// ============================================================================

describe('missing-input-validation detector', () => {
  const detector = getDetector('missing-input-validation')!;

  it('detects destructured req.body without validation', () => {
    const source = `const { email, password } = req.body;`;
    const fixes = detector.detect({ file: 'handler.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('missing-input-validation');
    expect(fixes[0]!.suggestedCode).toContain('z.object');
    expect(fixes[0]!.suggestedCode).toContain('email');
    expect(fixes[0]!.suggestedCode).toContain('.parse(req.body)');
  });

  it('generates proper zod types for common fields', () => {
    const source = `const { email, password, name, id, amount } = req.body;`;
    const fixes = detector.detect({ file: 'handler.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    const code = fixes[0]!.suggestedCode;
    expect(code).toContain('z.string().email()');
    expect(code).toContain('z.string().min(8)');
    expect(code).toContain('z.string().min(1)');
    expect(code).toContain('z.string().uuid()');
    expect(code).toContain('z.number().positive()');
  });

  it('ignores if schema validation is present nearby', () => {
    const source = `
const validated = schema.parse(req.body);
const { email, password } = req.body;`;
    const fixes = detector.detect({ file: 'handler.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 5. Token Without Expiry
// ============================================================================

describe('token-without-expiry detector', () => {
  const detector = getDetector('token-without-expiry')!;

  it('detects jwt.sign without options', () => {
    const source = `const token = jwt.sign(payload, secret);`;
    const fixes = detector.detect({ file: 'auth.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('token-without-expiry');
    expect(fixes[0]!.suggestedCode).toContain("expiresIn: '1h'");
  });

  it('ignores jwt.sign that already has expiresIn', () => {
    const source = `const token = jwt.sign(payload, secret, { expiresIn: '1h' });`;
    const fixes = detector.detect({ file: 'auth.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 6. Plaintext Password Storage (via ORM)
// ============================================================================

describe('plaintext-password-storage detector', () => {
  const detector = getDetector('plaintext-password-storage')!;

  it('detects password field in .create() call', () => {
    const source = `
await db.users.create({
  email: input.email,
  password: input.password,
});`;
    const fixes = detector.detect({ file: 'user.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('plaintext-password-storage');
    expect(fixes[0]!.suggestedCode).toContain('bcrypt.hash');
  });

  it('ignores if hashing is already present', () => {
    const source = `
await db.users.create({
  email: input.email,
  password: await bcrypt.hash(input.password, 12),
});`;
    const fixes = detector.detect({ file: 'user.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// 7. Missing Auth Check
// ============================================================================

describe('missing-auth-check detector', () => {
  const detector = getDetector('missing-auth-check')!;

  it('detects protected route without auth middleware', () => {
    const source = `router.get('/profile', getProfile);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes.length).toBeGreaterThanOrEqual(1);
    expect(fixes[0]!.patternId).toBe('missing-auth-check');
    expect(fixes[0]!.suggestedCode).toContain('requireAuth');
    expect(fixes[0]!.breaking).toBe(true);
  });

  it('ignores route that already has auth middleware', () => {
    const source = `router.get('/profile', requireAuth, getProfile);`;
    const fixes = detector.detect({ file: 'routes.ts', source });
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// Registry Tests
// ============================================================================

describe('ALL_DETECTORS registry', () => {
  it('contains at least 5 detectors', () => {
    expect(ALL_DETECTORS.length).toBeGreaterThanOrEqual(5);
  });

  it('each detector has unique id', () => {
    const ids = ALL_DETECTORS.map((d) => d.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('each detector has a name and tags', () => {
    for (const d of ALL_DETECTORS) {
      expect(d.name.length).toBeGreaterThan(0);
      expect(d.tags.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Integration: runAllPatternDetectors
// ============================================================================

describe('runAllPatternDetectors', () => {
  it('collects suggestions from multiple detectors', () => {
    const source = `
async function login(email, password) {
  const { email, password } = req.body;
  user.password = input.password;
  const token = jwt.sign(payload, secret);
  router.post('/login', loginHandler);
}`;
    const fixes = detect('mixed.ts', source);
    // Should find at least 3 issues from different detectors
    expect(fixes.length).toBeGreaterThanOrEqual(3);

    const patternIds = new Set(fixes.map((f) => f.patternId));
    // Should be from at least 2 different detectors
    expect(patternIds.size).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for clean code', () => {
    const source = `
async function login(email: string, password: string) {
  const bodySchema = z.object({ email: z.string().email(), password: z.string().min(8) });
  const { email: validEmail, password: validPass } = bodySchema.parse(req.body);
  const user = await db.users.findByEmail(validEmail);
  if (!user || !(await bcrypt.compare(validPass, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: '1h' });
  return res.json({ token });
}`;
    const fixes = detect('clean.ts', source);
    expect(fixes).toHaveLength(0);
  });
});

// ============================================================================
// FixSuggestion shape
// ============================================================================

describe('FixSuggestion output shape', () => {
  it('all suggestions have required fields', () => {
    const source = `
const token = jwt.sign(payload, secret);
user.password = input.password;
`;
    const fixes = detect('shape.ts', source);
    expect(fixes.length).toBeGreaterThan(0);

    for (const fix of fixes) {
      expect(typeof fix.violation).toBe('string');
      expect(typeof fix.file).toBe('string');
      expect(typeof fix.location.line).toBe('number');
      expect(typeof fix.location.column).toBe('number');
      expect(typeof fix.currentCode).toBe('string');
      expect(typeof fix.suggestedCode).toBe('string');
      expect(typeof fix.explanation).toBe('string');
      expect(fix.confidence).toBeGreaterThanOrEqual(0);
      expect(fix.confidence).toBeLessThanOrEqual(1);
      expect(typeof fix.breaking).toBe('boolean');
      expect(typeof fix.diff).toBe('string');
      expect(Array.isArray(fix.tags)).toBe(true);
    }
  });
});
