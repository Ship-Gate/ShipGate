/**
 * Shadow Spec Generator — Tests
 *
 * Verifies pattern recognizers, ISL assembly, and end-to-end generation
 * using inline sample source files.
 */

import { describe, it, expect } from 'vitest';
import {
  parseSource,
  generateShadowSpec,
  recognizers,
} from '../src/specless/shadow-spec.js';
import type { SourceAST } from '../src/specless/shadow-spec.js';

// ============================================================================
// Sample Source Files
// ============================================================================

const AUTH_LOGIN_SOURCE = `
import { compare } from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function login(email: string, password: string) {
  const user = await findUser(email);
  if (!user) throw new Error('User not found');
  const valid = await compare(password, user.passwordHash);
  if (!valid) throw new Error('Invalid password');
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { token, user: { id: user.id, email: user.email } };
}
`;

const CRUD_SOURCE = `
export async function createUser(data: CreateUserInput) {
  const validated = validateInput(data);
  const user = await db.users.create(validated);
  return user;
}

export async function deleteUser(id: string) {
  const user = await db.users.findById(id);
  if (!user) throw new Error('Not found');
  await db.users.delete(id);
  return { deleted: true };
}

export async function updateProfile(id: string, data: UpdateProfileInput) {
  const validated = validateInput(data);
  const user = await db.users.update(id, validated);
  return user;
}
`;

const PAYMENT_SOURCE = `
import Stripe from 'stripe';

export async function processPayment(amount: number, currency: string, token: string) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const charge = await stripe.charges.create({
    amount,
    currency,
    source: token,
  });
  return charge;
}
`;

const API_ROUTE_SOURCE = `
import express from 'express';
const router = express.Router();

router.post('/users', async (req, res) => {
  const body = req.body;
  const user = await createUser(body);
  res.status(201).json(user);
});

router.post('/upload', async (req, res) => {
  const multer = require('multer');
  const upload = multer({ limits: { fileSize: 5000000 } });
  res.json({ ok: true });
});

router.get('/profile', requireAuth, async (req, res) => {
  res.json(req.user);
});
`;

const SECURITY_SOURCE = `
export function saveUser(email: string, password: string) {
  const query = "INSERT INTO users (email, password) VALUES ('" + email + "', '" + password + "')";
  db.execute(query);
  return { email, password };
}

export function runDynamic(code: string) {
  return eval(code);
}

export async function hashAndStore(password: string) {
  const hashed = await bcrypt.hash(password, 10);
  await db.users.update({ passwordHash: hashed });
  return { success: true };
}
`;

const EMPTY_SOURCE = `
// Just a comment file, no patterns
const x = 42;
`;

// ============================================================================
// Source Parser Tests
// ============================================================================

describe('parseSource', () => {
  it('should extract function declarations', () => {
    const ast = parseSource('test.ts', AUTH_LOGIN_SOURCE);
    const loginFn = ast.functions.find(f => f.name === 'login');
    expect(loginFn).toBeDefined();
    expect(loginFn!.isAsync).toBe(true);
    expect(loginFn!.isExport).toBe(true);
    expect(loginFn!.params).toContain('email');
    expect(loginFn!.params).toContain('password');
  });

  it('should extract multiple functions', () => {
    const ast = parseSource('test.ts', CRUD_SOURCE);
    expect(ast.functions.length).toBeGreaterThanOrEqual(3);
    const names = ast.functions.map(f => f.name);
    expect(names).toContain('createUser');
    expect(names).toContain('deleteUser');
    expect(names).toContain('updateProfile');
  });

  it('should extract arrow functions', () => {
    const source = `
export const handleRequest = async (req: Request, res: Response) => {
  res.json({ ok: true });
};
`;
    const ast = parseSource('test.ts', source);
    const fn = ast.functions.find(f => f.name === 'handleRequest');
    expect(fn).toBeDefined();
    expect(fn!.isAsync).toBe(true);
    expect(fn!.isExport).toBe(true);
  });

  it('should extract imports', () => {
    const ast = parseSource('test.ts', AUTH_LOGIN_SOURCE);
    expect(ast.imports.length).toBeGreaterThanOrEqual(2);
    const modules = ast.imports.map(i => i.module);
    expect(modules).toContain('bcrypt');
    expect(modules).toContain('jsonwebtoken');
  });

  it('should extract named import members', () => {
    const ast = parseSource('test.ts', AUTH_LOGIN_SOURCE);
    const bcryptImport = ast.imports.find(i => i.module === 'bcrypt');
    expect(bcryptImport).toBeDefined();
    expect(bcryptImport!.names).toContain('compare');
  });

  it('should extract route handlers', () => {
    const ast = parseSource('test.ts', API_ROUTE_SOURCE);
    expect(ast.routeHandlers.length).toBeGreaterThanOrEqual(2);
    const postHandlers = ast.routeHandlers.filter(r => r.method === 'POST');
    expect(postHandlers.length).toBe(2);
    expect(postHandlers[0].path).toBe('/users');
  });

  it('should handle empty source', () => {
    const ast = parseSource('test.ts', '');
    expect(ast.functions).toHaveLength(0);
    expect(ast.imports).toHaveLength(0);
    expect(ast.routeHandlers).toHaveLength(0);
  });

  it('should capture function body content', () => {
    const ast = parseSource('test.ts', AUTH_LOGIN_SOURCE);
    const loginFn = ast.functions.find(f => f.name === 'login');
    expect(loginFn!.body).toContain('jwt.sign');
    expect(loginFn!.body).toContain('compare');
  });
});

// ============================================================================
// Individual Recognizer Tests
// ============================================================================

function getRecognizer(name: string) {
  const r = recognizers.find(rec => rec.name === name);
  if (!r) throw new Error(`Recognizer "${name}" not found`);
  return r;
}

describe('auth recognizer', () => {
  it('should match login functions', () => {
    const ast = parseSource('src/auth/login.ts', AUTH_LOGIN_SOURCE);
    const matches = getRecognizer('auth').match(ast);
    const loginMatch = matches.find(m => m.pattern === 'auth-login');
    expect(loginMatch).toBeDefined();
    expect(loginMatch!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(loginMatch!.confidence).toBeLessThanOrEqual(1.0);
    expect(loginMatch!.inferredSpec).toContain('behavior');
    expect(loginMatch!.inferredSpec).toContain('email: String');
    expect(loginMatch!.inferredSpec).toContain('password: String');
  });

  it('should detect JWT creation', () => {
    const ast = parseSource('src/auth/login.ts', AUTH_LOGIN_SOURCE);
    const matches = getRecognizer('auth').match(ast);
    const jwtMatch = matches.find(m => m.pattern === 'auth-jwt');
    expect(jwtMatch).toBeDefined();
    expect(jwtMatch!.inferredSpec).toContain('signed_token');
    expect(jwtMatch!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should fall through to auth-library when no auth functions found', () => {
    const source = `
import bcrypt from 'bcrypt';

export function doSomething() {
  return 42;
}
`;
    const ast = parseSource('test.ts', source);
    const matches = getRecognizer('auth').match(ast);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const libMatch = matches.find(m => m.pattern === 'auth-library');
    expect(libMatch).toBeDefined();
    expect(libMatch!.confidence).toBeLessThan(0.7);
  });

  it('should not match unrelated functions', () => {
    const ast = parseSource('test.ts', EMPTY_SOURCE);
    const matches = getRecognizer('auth').match(ast);
    expect(matches).toHaveLength(0);
  });
});

describe('crud recognizer', () => {
  it('should match create functions', () => {
    const ast = parseSource('test.ts', CRUD_SOURCE);
    const matches = getRecognizer('crud').match(ast);
    const createMatch = matches.find(m => m.pattern === 'crud-create');
    expect(createMatch).toBeDefined();
    expect(createMatch!.inferredSpec).toContain('behavior CreateUser');
    expect(createMatch!.inferredSpec).toContain('input.data != null');
    expect(createMatch!.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should match delete functions', () => {
    const ast = parseSource('test.ts', CRUD_SOURCE);
    const matches = getRecognizer('crud').match(ast);
    const deleteMatch = matches.find(m => m.pattern === 'crud-delete');
    expect(deleteMatch).toBeDefined();
    expect(deleteMatch!.inferredSpec).toContain('behavior DeleteUser');
    expect(deleteMatch!.inferredSpec).toContain('authorization_check');
  });

  it('should match update functions', () => {
    const ast = parseSource('test.ts', CRUD_SOURCE);
    const matches = getRecognizer('crud').match(ast);
    const updateMatch = matches.find(m => m.pattern === 'crud-update');
    expect(updateMatch).toBeDefined();
    expect(updateMatch!.inferredSpec).toContain('behavior UpdateProfile');
    expect(updateMatch!.inferredSpec).toContain('input.data != null');
  });

  it('should detect remove as alias for delete', () => {
    const source = `
export async function removeItem(id: string) {
  await db.items.delete(id);
}
`;
    const ast = parseSource('test.ts', source);
    const matches = getRecognizer('crud').match(ast);
    const deleteMatch = matches.find(m => m.pattern === 'crud-delete');
    expect(deleteMatch).toBeDefined();
    expect(deleteMatch!.inferredSpec).toContain('DeleteItem');
  });
});

describe('payment recognizer', () => {
  it('should match payment functions by name + body', () => {
    const ast = parseSource('test.ts', PAYMENT_SOURCE);
    const matches = getRecognizer('payment').match(ast);
    expect(matches.length).toBeGreaterThanOrEqual(1);
    const paymentMatch = matches.find(m => m.pattern === 'payment-processing');
    expect(paymentMatch).toBeDefined();
    expect(paymentMatch!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(paymentMatch!.inferredSpec).toContain('input.amount > 0');
  });

  it('should detect payment library imports as fallback', () => {
    const source = `
import Stripe from 'stripe';

export function formatCurrency(cents: number) {
  return (cents / 100).toFixed(2);
}
`;
    const ast = parseSource('test.ts', source);
    const matches = getRecognizer('payment').match(ast);
    const libMatch = matches.find(m => m.pattern === 'payment-library');
    expect(libMatch).toBeDefined();
    expect(libMatch!.confidence).toBeLessThan(0.7);
  });
});

describe('api-route recognizer', () => {
  it('should match POST route handlers', () => {
    const ast = parseSource('test.ts', API_ROUTE_SOURCE);
    const matches = getRecognizer('api-route').match(ast);
    const postMatch = matches.find(m => m.pattern === 'api-post-handler');
    expect(postMatch).toBeDefined();
    expect(postMatch!.inferredSpec).toContain('input.body != null');
  });

  it('should detect file upload patterns', () => {
    const ast = parseSource('test.ts', API_ROUTE_SOURCE);
    const matches = getRecognizer('api-route').match(ast);
    const uploadMatch = matches.find(m => m.pattern === 'api-file-upload');
    expect(uploadMatch).toBeDefined();
    expect(uploadMatch!.inferredSpec).toContain('validated_content_type');
  });

  it('should not produce matches for non-route source', () => {
    const ast = parseSource('test.ts', CRUD_SOURCE);
    const matches = getRecognizer('api-route').match(ast);
    expect(matches).toHaveLength(0);
  });
});

describe('security recognizer', () => {
  it('should detect password handling without hashing', () => {
    const ast = parseSource('test.ts', SECURITY_SOURCE);
    const matches = getRecognizer('security').match(ast);
    const plaintext = matches.find(m => m.pattern === 'security-password-plaintext');
    expect(plaintext).toBeDefined();
    expect(plaintext!.confidence).toBeGreaterThanOrEqual(0.8);
    expect(plaintext!.inferredSpec).toContain('hashed_password');
  });

  it('should detect password handling with hashing as positive', () => {
    const ast = parseSource('test.ts', SECURITY_SOURCE);
    const matches = getRecognizer('security').match(ast);
    const hashed = matches.find(m => m.pattern === 'security-password-hashed');
    expect(hashed).toBeDefined();
    expect(hashed!.confidence).toBeGreaterThanOrEqual(0.88);
  });

  it('should detect SQL injection risk', () => {
    const ast = parseSource('test.ts', SECURITY_SOURCE);
    const matches = getRecognizer('security').match(ast);
    const sqlMatch = matches.find(m => m.pattern === 'security-sql-injection');
    expect(sqlMatch).toBeDefined();
    expect(sqlMatch!.confidence).toBeGreaterThanOrEqual(0.85);
    expect(sqlMatch!.inferredSpec).toContain('parameterized_queries');
  });

  it('should flag eval usage as critical risk', () => {
    const ast = parseSource('test.ts', SECURITY_SOURCE);
    const matches = getRecognizer('security').match(ast);
    const evalMatch = matches.find(m => m.pattern === 'security-eval-critical');
    expect(evalMatch).toBeDefined();
    expect(evalMatch!.confidence).toBeGreaterThanOrEqual(0.9);
    expect(evalMatch!.inferredSpec).toContain('no_dynamic_eval');
  });

  it('should not false-positive on safe code', () => {
    const ast = parseSource('test.ts', EMPTY_SOURCE);
    const matches = getRecognizer('security').match(ast);
    expect(matches).toHaveLength(0);
  });
});

// ============================================================================
// End-to-End: generateShadowSpec
// ============================================================================

describe('generateShadowSpec', () => {
  it('should produce a valid shadow spec for auth code', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    expect(spec.filePath).toBe('src/auth/login.ts');
    expect(spec.patterns.length).toBeGreaterThanOrEqual(2);
    expect(spec.confidence).toBeGreaterThan(0);
    expect(spec.confidence).toBeLessThanOrEqual(1);
    expect(spec.islFragment).toContain('domain ShadowSpec_AuthLogin');
    expect(spec.islFragment).toContain('version: "0.0.1"');
    expect(spec.islFragment).toContain('behavior');
    expect(spec.generatedAt).toBeTruthy();
  });

  it('should produce a valid shadow spec for CRUD code', async () => {
    const spec = await generateShadowSpec('src/users/crud.ts', CRUD_SOURCE);

    expect(spec.patterns.length).toBeGreaterThanOrEqual(3);
    expect(spec.islFragment).toContain('domain ShadowSpec_UsersCrud');
    expect(spec.islFragment).toContain('CreateUser');
    expect(spec.islFragment).toContain('DeleteUser');
    expect(spec.islFragment).toContain('UpdateProfile');
  });

  it('should produce a valid shadow spec for payment code', async () => {
    const spec = await generateShadowSpec(
      'src/billing/charge.ts',
      PAYMENT_SOURCE,
    );

    expect(spec.patterns.length).toBeGreaterThanOrEqual(1);
    expect(spec.islFragment).toContain('input.amount > 0');
    expect(spec.confidence).toBeGreaterThan(0.6);
  });

  it('should return empty spec for unmatched code', async () => {
    const spec = await generateShadowSpec('src/utils/math.ts', EMPTY_SOURCE);

    expect(spec.patterns).toHaveLength(0);
    expect(spec.confidence).toBe(0);
    expect(spec.islFragment).toBe('');
    expect(spec.inferredBehaviors).toHaveLength(0);
  });

  it('should boost confidence with matching PR context', async () => {
    const specWithout = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );
    const specWith = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
      { prTitle: 'Add user authentication flow' },
    );

    expect(specWith.confidence).toBeGreaterThan(specWithout.confidence);
  });

  it('should not boost confidence with unrelated PR context', async () => {
    const specWithout = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );
    const specWith = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
      { prTitle: 'Fix CSS styling for button hover states' },
    );

    expect(specWith.confidence).toBe(specWithout.confidence);
  });

  it('should deduplicate behavior names in assembled ISL', async () => {
    // Source that triggers the same behavior name from different recognizers
    const source = `
export function login(email: string, password: string) {
  const token = jwt.sign({ email }, secret);
  return { token };
}
`;
    const spec = await generateShadowSpec('src/auth.ts', source);

    // Count behavior declarations
    const behaviorMatches = spec.islFragment.match(/behavior\s+\w+/g) ?? [];
    const behaviorNames = behaviorMatches.map(m => m.replace('behavior ', ''));
    const uniqueNames = new Set(behaviorNames);
    expect(uniqueNames.size).toBe(behaviorNames.length);
  });
});

// ============================================================================
// ISL Fragment Validity
// ============================================================================

describe('ISL fragment structure', () => {
  it('should contain domain with version', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );
    expect(spec.islFragment).toMatch(/domain\s+\w+\s*\{/);
    expect(spec.islFragment).toMatch(/version:\s*"0\.0\.1"/);
  });

  it('should produce valid behavior blocks', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    // Every behavior should have matching braces
    const behaviors = spec.inferredBehaviors;
    for (const behavior of behaviors) {
      expect(behavior).toMatch(/behavior\s+\w+\s*\{/);
      const openBraces = (behavior.match(/\{/g) ?? []).length;
      const closeBraces = (behavior.match(/\}/g) ?? []).length;
      expect(openBraces).toBe(closeBraces);
    }
  });

  it('should produce valid postcondition blocks', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    // Postconditions should use 'success implies { ... }'
    for (const behavior of spec.inferredBehaviors) {
      if (behavior.includes('postconditions')) {
        expect(behavior).toMatch(/success\s+implies\s*\{/);
      }
    }
  });

  it('should produce valid security blocks', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    for (const behavior of spec.inferredBehaviors) {
      if (behavior.includes('security')) {
        expect(behavior).toMatch(/security\s*\{/);
        // Should contain requires or rate_limit
        expect(behavior).toMatch(/requires\s+\w+|rate_limit\s+\d+/);
      }
    }
  });

  it('should have comment header with metadata', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    expect(spec.islFragment).toContain('// Auto-generated shadow spec');
    expect(spec.islFragment).toContain('// Confidence:');
    expect(spec.islFragment).toContain('// Review and commit:');
  });

  it('should use valid ISL identifier names (no reserved words)', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    // Extract behavior names
    const behaviorMatches = spec.islFragment.match(/behavior\s+(\w+)/g) ?? [];
    const reserved = new Set([
      'domain', 'entity', 'behavior', 'type', 'enum',
      'input', 'output', 'preconditions', 'postconditions',
      'true', 'false', 'null', 'result', 'success',
    ]);
    for (const bm of behaviorMatches) {
      const name = bm.replace('behavior ', '');
      expect(reserved.has(name.toLowerCase())).toBe(false);
    }
  });
});

// ============================================================================
// Confidence Score Sanity
// ============================================================================

describe('confidence scores', () => {
  it('should never exceed 1.0', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
      { prTitle: 'auth login jwt token session' },
    );

    for (const match of spec.patterns) {
      expect(match.confidence).toBeLessThanOrEqual(1.0);
    }
    expect(spec.confidence).toBeLessThanOrEqual(1.0);
  });

  it('should never be negative', async () => {
    const spec = await generateShadowSpec(
      'src/auth/login.ts',
      AUTH_LOGIN_SOURCE,
    );

    for (const match of spec.patterns) {
      expect(match.confidence).toBeGreaterThanOrEqual(0);
    }
    expect(spec.confidence).toBeGreaterThanOrEqual(0);
  });

  it('should vary across different pattern types', async () => {
    const authSpec = await generateShadowSpec('auth.ts', AUTH_LOGIN_SOURCE);
    const crudSpec = await generateShadowSpec('crud.ts', CRUD_SOURCE);
    const secSpec = await generateShadowSpec('sec.ts', SECURITY_SOURCE);

    // They should not all be the same confidence
    const confidences = [authSpec.confidence, crudSpec.confidence, secSpec.confidence];
    const unique = new Set(confidences.map(c => c.toFixed(4)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('should have higher confidence for strong signals', async () => {
    // eval is a very strong security signal → high confidence
    const secSpec = await generateShadowSpec('sec.ts', SECURITY_SOURCE);
    const evalMatch = secSpec.patterns.find(
      m => m.pattern === 'security-eval-critical',
    );
    expect(evalMatch).toBeDefined();
    expect(evalMatch!.confidence).toBeGreaterThanOrEqual(0.9);

    // Payment with both name + body → higher than name-only
    const paySpec = await generateShadowSpec('pay.ts', PAYMENT_SOURCE);
    const payMatch = paySpec.patterns.find(
      m => m.pattern === 'payment-processing',
    );
    expect(payMatch).toBeDefined();
    expect(payMatch!.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ============================================================================
// Recognizer Registry
// ============================================================================

describe('recognizer registry', () => {
  it('should have at least 5 recognizers', () => {
    expect(recognizers.length).toBeGreaterThanOrEqual(5);
  });

  it('should have unique recognizer names', () => {
    const names = recognizers.map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('should include all required categories', () => {
    const names = recognizers.map(r => r.name);
    expect(names).toContain('auth');
    expect(names).toContain('crud');
    expect(names).toContain('payment');
    expect(names).toContain('api-route');
    expect(names).toContain('security');
  });
});
