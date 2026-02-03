/**
 * ISL Policy Packs - Rule Explanations
 * 
 * Deterministic, actionable fix guidance for each rule.
 * No LLM vibes - just facts.
 * 
 * @module @isl-lang/policy-packs
 */

/**
 * Rule explanation structure
 */
export interface RuleExplanation {
  /** Rule ID */
  ruleId: string;
  /** Why this rule exists */
  why: string;
  /** What triggers it */
  triggers: string[];
  /** Minimal safe fix patterns */
  fixes: FixPattern[];
  /** Code examples */
  examples: CodeExample[];
  /** Documentation links */
  docs: string[];
  /** Related rules */
  related: string[];
}

/**
 * A fix pattern
 */
export interface FixPattern {
  /** Pattern name */
  name: string;
  /** Pattern description */
  description: string;
  /** Code snippet */
  code?: string;
}

/**
 * Code example (before/after)
 */
export interface CodeExample {
  /** Example title */
  title: string;
  /** Bad code (what triggered the rule) */
  bad: string;
  /** Good code (how to fix) */
  good: string;
}

// ============================================================================
// Rule Explanations Database
// ============================================================================

const EXPLANATIONS: Record<string, RuleExplanation> = {
  // INTENT RULES
  'intent/audit-required': {
    ruleId: 'intent/audit-required',
    why: 'Audit trails are legally required for compliance (SOC2, HIPAA, PCI-DSS) and essential for incident response. Missing audit on ANY exit path creates blind spots that attackers exploit and auditors flag.',
    triggers: [
      'HTTP exit path (return NextResponse.json/res.json) without preceding audit call',
      'Rate limit (429) response without audit({ success: false, reason: "rate_limited" })',
      'Validation error (400) without audit({ success: false, reason: "validation_failed" })',
      'Auth error (401/403) without audit({ success: false, reason: "unauthorized" })',
      'Audit payload missing required fields: action, success, timestamp',
      'Audit payload missing requestId/correlationId for tracing',
      'Audit with success:true on error paths (must be success:false)',
      'Failure audit missing "reason" field',
      'PII (email, password, token, etc.) in audit payload',
    ],
    fixes: [
      {
        name: 'Add audit before every return',
        description: 'Each exit path must have an audit call capturing the outcome',
        code: `// Success path
await auditAttempt({
  action: "user_login",
  success: true,
  timestamp: Date.now(),
  requestId: req.headers.get("x-request-id"),
});
return NextResponse.json({ user });

// Failure path (always include reason)
await auditAttempt({
  action: "user_login",
  success: false,
  reason: "invalid_credentials",
  timestamp: Date.now(),
  requestId,
});
return NextResponse.json({ error: "Invalid" }, { status: 401 });`,
      },
      {
        name: 'Use auditAttempt helper for consistency',
        description: 'Create a shared helper that ensures correct fields',
        code: `async function auditAttempt(payload: {
  action: string;
  success: boolean;
  reason?: string; // Required when success: false
  timestamp: number;
  requestId?: string;
  // NO PII allowed: email, password, token, ssn, etc.
}) {
  await audit(payload);
}`,
      },
      {
        name: 'Audit all exit path types',
        description: 'Each type of failure needs specific handling',
        code: `// Rate limit (429)
await auditAttempt({ action, success: false, reason: "rate_limited", timestamp, requestId });
return NextResponse.json({ error: "Too many requests" }, { status: 429 });

// Validation (400)
await auditAttempt({ action, success: false, reason: "validation_failed", timestamp, requestId });
return NextResponse.json({ error: result.error.message }, { status: 400 });

// Auth (401/403)
await auditAttempt({ action, success: false, reason: "unauthorized", timestamp, requestId });
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// Success (2xx)
await auditAttempt({ action, success: true, timestamp, requestId });
return NextResponse.json({ data });`,
      },
    ],
    examples: [
      {
        title: 'Audit all exit paths in login handler',
        bad: `export async function POST(req: Request) {
  const { email, password } = await req.json();
  
  // Rate limit check - NO AUDIT!
  if (isRateLimited(email)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  
  // Validation - NO AUDIT!
  if (!email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  
  const user = await authenticate(email, password);
  if (!user) {
    // Auth failure - NO AUDIT!
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  
  // Only success is audited
  await audit({ action: "login", success: true });
  return NextResponse.json({ user });
}`,
        good: `export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const action = "user_login";
  const { email, password } = await req.json();
  
  // Rate limit - AUDITED
  if (isRateLimited(email)) {
    await auditAttempt({ action, success: false, reason: "rate_limited", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }
  
  // Validation - AUDITED
  if (!email || !password) {
    await auditAttempt({ action, success: false, reason: "validation_failed", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  
  const user = await authenticate(email, password);
  if (!user) {
    // Auth failure - AUDITED
    await auditAttempt({ action, success: false, reason: "invalid_credentials", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  
  // Success - AUDITED
  await auditAttempt({ action, success: true, timestamp: Date.now(), requestId });
  return NextResponse.json({ user });
}`,
      },
      {
        title: 'No PII in audit payload',
        bad: `await audit({
  action: "login",
  success: true,
  email: user.email,      // PII!
  password: password,     // PII!
  token: session.token,   // PII!
});`,
        good: `await audit({
  action: "login",
  success: true,
  userId: user.id,        // Safe - ID only
  timestamp: Date.now(),
  requestId,
});`,
      },
    ],
    docs: [
      'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
      'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/11-Client-side_Testing/10-Testing_for_Insufficient_Logging_and_Monitoring',
    ],
    related: ['intent/rate-limit-required', 'intent/no-pii-logging', 'pii/logged-sensitive-data'],
  },

  // AUTH RULES
  'auth/bypass-detected': {
    ruleId: 'auth/bypass-detected',
    why: 'Auth bypass patterns allow attackers to skip authentication entirely. Even "debug" bypasses in production can be exploited.',
    triggers: [
      'auth = false',
      'skipAuth',
      'noAuth',
      'bypassAuth',
      'requireAuth: false',
      'isPublic: true (on protected routes)',
    ],
    fixes: [
      {
        name: 'Remove bypass pattern',
        description: 'Delete the bypass code entirely',
        code: '// Delete: const skipAuth = true;',
      },
      {
        name: 'Use proper auth middleware',
        description: 'Replace bypass with real authentication',
        code: 'router.post("/admin", requireAuth, requireRole("admin"), handler);',
      },
    ],
    examples: [
      {
        title: 'Remove debug bypass',
        bad: `if (req.query.debug === 'true') {
  return res.json({ token: 'debug-token' });
}`,
        good: `// Remove debug bypass entirely
// All requests must authenticate properly`,
      },
    ],
    docs: [
      'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/04-Testing_for_Bypassing_Authentication_Schema',
    ],
    related: ['auth/unprotected-route', 'auth/drift-detected'],
  },

  'auth/hardcoded-credentials': {
    ruleId: 'auth/hardcoded-credentials',
    why: 'Hardcoded secrets in code get committed to version control, leaked in logs, and exposed in compiled artifacts.',
    triggers: [
      'password = "..."',
      'api_key = "..."',
      'secret = "..."',
      'token = "..."',
      'private_key = "..."',
    ],
    fixes: [
      {
        name: 'Use environment variables',
        description: 'Read secrets from environment at runtime',
        code: 'const apiKey = process.env.API_KEY;',
      },
      {
        name: 'Use a secrets manager',
        description: 'For production, use AWS Secrets Manager, Vault, etc.',
        code: 'const secret = await secretsManager.getSecret("my-api-key");',
      },
    ],
    examples: [
      {
        title: 'Move API key to environment',
        bad: `const stripe = new Stripe("sk_live_abc123...");`,
        good: `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);`,
      },
    ],
    docs: [
      'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html',
    ],
    related: ['auth/bypass-detected'],
  },

  'auth/unprotected-route': {
    ruleId: 'auth/unprotected-route',
    why: 'Unprotected admin/sensitive routes allow anyone to access privileged functionality.',
    triggers: [
      'Admin routes without auth middleware',
      'Protected path patterns without requireAuth',
      'Routes marked as requiring auth but missing middleware',
    ],
    fixes: [
      {
        name: 'Add auth middleware',
        description: 'Add requireAuth to the route',
        code: 'router.get("/admin", requireAuth, handler);',
      },
      {
        name: 'Add role check',
        description: 'Require specific roles for sensitive routes',
        code: 'router.get("/admin", requireAuth, requireRole("admin"), handler);',
      },
    ],
    examples: [
      {
        title: 'Protect admin dashboard',
        bad: `router.get("/admin/dashboard", (req, res) => {
  res.json({ users: getAllUsers() });
});`,
        good: `router.get("/admin/dashboard", requireAuth, requireRole("admin"), (req, res) => {
  res.json({ users: getAllUsers() });
});`,
      },
    ],
    docs: [
      'https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html',
    ],
    related: ['auth/missing-role-check', 'rate-limit/auth-endpoint'],
  },

  // PII RULES
  'pii/logged-sensitive-data': {
    ruleId: 'pii/logged-sensitive-data',
    why: 'PII in logs violates privacy regulations (GDPR, CCPA) and creates data breach liability. Logs are often stored unencrypted and retained for long periods.',
    triggers: [
      'console.log with email, phone, ssn',
      'logger.info with PII fields',
      'Logging user objects with sensitive data',
    ],
    fixes: [
      {
        name: 'Redact PII before logging',
        description: 'Mask or remove sensitive fields',
        code: 'logger.info("User accessed", { userId: user.id }); // NOT user.email',
      },
      {
        name: 'Use structured logging with redaction',
        description: 'Configure logger to auto-redact sensitive fields',
        code: `const logger = createLogger({
  redact: ['email', 'ssn', 'password', 'token']
});`,
      },
    ],
    examples: [
      {
        title: 'Log user ID, not email',
        bad: `console.log("User login:", user.email, user.password);`,
        good: `logger.info("User login", { userId: user.id, action: "login" });`,
      },
    ],
    docs: [
      'https://gdpr.eu/article-32-security-of-processing/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html',
    ],
    related: ['pii/unmasked-response', 'pii/console-in-production'],
  },

  'pii/unmasked-response': {
    ruleId: 'pii/unmasked-response',
    why: 'Exposing full PII in API responses increases breach impact and violates data minimization principles.',
    triggers: [
      'SSN in API response',
      'Full credit card number returned',
      'Unmasked phone numbers',
      'Full date of birth exposed',
    ],
    fixes: [
      {
        name: 'Mask sensitive fields',
        description: 'Return only partial data',
        code: 'ssn: "***-**-" + user.ssn.slice(-4)',
      },
      {
        name: 'Omit sensitive fields',
        description: "Don't return fields that aren't needed",
        code: 'const { ssn, ...safeUser } = user; res.json(safeUser);',
      },
    ],
    examples: [
      {
        title: 'Mask SSN in response',
        bad: `res.json({ ssn: user.ssn }); // "123-45-6789"`,
        good: `res.json({ ssn: "***-**-" + user.ssn.slice(-4) }); // "***-**-6789"`,
      },
    ],
    docs: [
      'https://gdpr.eu/article-5-how-to-process-personal-data/',
    ],
    related: ['pii/logged-sensitive-data', 'pii/missing-encryption'],
  },

  // RATE LIMIT RULES
  'rate-limit/auth-endpoint': {
    ruleId: 'rate-limit/auth-endpoint',
    why: 'Authentication endpoints without rate limiting are vulnerable to brute force attacks. Attackers can try thousands of passwords per second.',
    triggers: [
      'Login endpoint without rateLimit middleware',
      'Password reset without throttling',
      'OTP/2FA endpoints unprotected',
    ],
    fixes: [
      {
        name: 'Add rate limiting middleware',
        description: 'Limit attempts per IP/user',
        code: `const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: "Too many login attempts"
});
router.post("/login", loginLimiter, handler);`,
      },
      {
        name: 'Add account lockout',
        description: 'Lock account after N failures',
        code: 'if (failedAttempts >= 5) { lockAccount(userId); }',
      },
    ],
    examples: [
      {
        title: 'Rate limit login endpoint',
        bad: `router.post("/login", async (req, res) => {
  // No rate limiting!
  const user = await authenticate(req.body);
});`,
        good: `const loginLimiter = rateLimit({ windowMs: 900000, max: 5 });
router.post("/login", loginLimiter, async (req, res) => {
  const user = await authenticate(req.body);
});`,
      },
    ],
    docs: [
      'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#account-lockout',
      'https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks',
    ],
    related: ['rate-limit/missing', 'auth/bypass-detected'],
  },

  // PAYMENTS RULES
  'payments/bypass-detected': {
    ruleId: 'payments/bypass-detected',
    why: 'Payment bypass patterns allow users to get products/services without paying. Even amount=0 can be exploited.',
    triggers: [
      'amount: 0',
      'price: 0',
      'skipPayment',
      'bypassPayment',
      'testMode: true in production',
    ],
    fixes: [
      {
        name: 'Remove bypass patterns',
        description: 'Delete any code that skips payment',
      },
      {
        name: 'Server-side price validation',
        description: 'Always calculate price on server, never trust client',
        code: 'const price = await calculatePrice(items); // Server-side only',
      },
    ],
    examples: [
      {
        title: 'Remove test mode bypass',
        bad: `if (process.env.TEST_MODE) {
  return { success: true }; // Skip payment
}`,
        good: `// Remove test bypass from production code
// Use Stripe test mode with test API keys instead`,
      },
    ],
    docs: [
      'https://stripe.com/docs/testing',
    ],
    related: ['payments/client-side-price', 'payments/webhook-signature'],
  },

  'payments/webhook-signature': {
    ruleId: 'payments/webhook-signature',
    why: 'Unsigned webhooks can be spoofed by attackers to fake payments, trigger refunds, or manipulate order status.',
    triggers: [
      'Webhook handler without signature verification',
      'Missing stripe-signature header check',
      'Missing constructEvent call',
    ],
    fixes: [
      {
        name: 'Verify webhook signature',
        description: 'Use Stripe constructEvent to verify',
        code: `const event = stripe.webhooks.constructEvent(
  req.body,
  req.headers['stripe-signature'],
  process.env.STRIPE_WEBHOOK_SECRET
);`,
      },
    ],
    examples: [
      {
        title: 'Add signature verification',
        bad: `app.post("/webhook", (req, res) => {
  const event = req.body; // Trusting unverified data!
  handleEvent(event);
});`,
        good: `app.post("/webhook", (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, secret);
  handleEvent(event);
});`,
      },
    ],
    docs: [
      'https://stripe.com/docs/webhooks/signatures',
    ],
    related: ['payments/bypass-detected'],
  },

  // QUALITY RULES
  'quality/no-stubbed-handlers': {
    ruleId: 'quality/no-stubbed-handlers',
    why: 'Stubbed handlers and placeholder code indicate incomplete implementation. Shipping code that throws "Not implemented" or has TODO postconditions means the feature is broken in production. This is a ship blocker.',
    triggers: [
      'throw new Error("Not implemented")',
      'throw new Error("TODO")',
      'throw new Error("STUB") or "PLACEHOLDER"',
      'TODO markers under "ISL postconditions to satisfy"',
      'Function bodies with only "// TODO: implement"',
      'Handler functions (like userLogin) that throw instead of implementing',
      'Placeholder comments like "// Implementation goes here"',
    ],
    fixes: [
      {
        name: 'Implement the handler logic',
        description: 'Replace stub with actual business logic',
        code: `// Before: stub
export async function userLogin(email: string, password: string) {
  throw new Error('Not implemented');
}

// After: implemented
export async function userLogin(email: string, password: string) {
  const user = await db.users.findByEmail(email);
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    throw new UnauthorizedError('Invalid credentials');
  }
  return createSession(user);
}`,
      },
      {
        name: 'Satisfy all postconditions',
        description: 'Implement each TODO marked in postconditions section',
        code: `// ISL postconditions to satisfy:
// ✓ User credentials validated against database
// ✓ Session token created on success
// ✓ Failed attempts audited

// All postconditions now implemented in code above`,
      },
      {
        name: 'Move to allowlist if intentional stub',
        description: 'If stub is for testing, move to __mocks__ or fixtures directory',
        code: `// Move stub to: src/__mocks__/auth.ts
// Or: test-fixtures/stubs.ts
// These paths are in the default allowlist`,
      },
    ],
    examples: [
      {
        title: 'Replace Not implemented error',
        bad: `export async function processPayment(amount: number, card: CardDetails) {
  throw new Error('Not implemented');
}`,
        good: `export async function processPayment(amount: number, card: CardDetails) {
  const validated = PaymentSchema.parse({ amount, card });
  const result = await stripe.charges.create({
    amount: validated.amount,
    currency: 'usd',
    source: validated.card.token,
  });
  await auditAttempt({ action: 'payment', success: true, amount });
  return result;
}`,
      },
      {
        title: 'Complete postconditions',
        bad: `// ISL postconditions to satisfy:
// - TODO: Validate input schema
// - TODO: Check user permissions
// - TODO: Audit the action

export function updateUser(id: string, data: unknown) {
  return db.users.update(id, data);
}`,
        good: `// ISL postconditions to satisfy:
// ✓ Validate input schema
// ✓ Check user permissions
// ✓ Audit the action

export async function updateUser(id: string, data: unknown, ctx: Context) {
  const validated = UserUpdateSchema.parse(data);
  await requirePermission(ctx.user, 'users:update', id);
  const result = await db.users.update(id, validated);
  await auditAttempt({ action: 'user_update', userId: id, success: true });
  return result;
}`,
      },
      {
        title: 'Move test stubs to proper location',
        bad: `// src/auth/login.ts (production code)
export function mockLogin() {
  throw new Error('Not implemented - test stub');
}`,
        good: `// src/__mocks__/auth.ts (allowlisted)
export function mockLogin() {
  return { userId: 'test-123', token: 'mock-token' };
}`,
      },
    ],
    docs: [
      'https://wiki.c2.com/?StubObject',
    ],
    related: ['quality/no-todo-comments', 'quality/no-debug-code'],
  },

  'quality/no-todo-comments': {
    ruleId: 'quality/no-todo-comments',
    why: 'TODOs indicate incomplete work. Critical TODOs (TODO: CRITICAL, FIXME: BLOCKER) must be resolved before shipping. High TODO counts suggest rushed development.',
    triggers: [
      'TODO: CRITICAL in code',
      'FIXME: BLOCKER comments',
      'XXX: markers (urgent issues)',
      'More than 5 TODO/FIXME comments in a file',
    ],
    fixes: [
      {
        name: 'Resolve critical TODOs',
        description: 'Critical TODOs must be fixed before ship',
        code: `// Before
// TODO: CRITICAL - fix SQL injection vulnerability
const query = \`SELECT * FROM users WHERE id = \${id}\`;

// After
const [user] = await db.query('SELECT * FROM users WHERE id = ?', [id]);`,
      },
      {
        name: 'Convert to tracked issues',
        description: 'Move non-critical TODOs to issue tracker',
        code: `// Before
// TODO: refactor this to use async/await

// After (create GitHub issue, remove comment)
// Or add issue reference: // See: #1234`,
      },
    ],
    examples: [
      {
        title: 'Fix critical TODO',
        bad: `// TODO: CRITICAL - user can bypass payment
if (user.isAdmin) {
  return { success: true };
}`,
        good: `// Fixed - admin still needs to pay
const charge = await processPayment(user, amount);
return { success: charge.paid };`,
      },
    ],
    docs: [],
    related: ['quality/no-stubbed-handlers'],
  },

  'quality/no-debug-code': {
    ruleId: 'quality/no-debug-code',
    why: 'debugger statements and debug flags left in production code can expose internals, slow execution, and create security vulnerabilities.',
    triggers: [
      'debugger; statement',
      'DEBUG = true flags',
      'ENABLE_DEBUG flags',
      'IS_DEBUG = true',
    ],
    fixes: [
      {
        name: 'Remove debugger statements',
        description: 'Delete all debugger; lines',
        code: `// Before
function process() {
  debugger;
  return data;
}

// After
function process() {
  return data;
}`,
      },
      {
        name: 'Use environment variables for debug flags',
        description: 'Read debug state from environment, default to false',
        code: `// Before
const DEBUG = true;

// After
const DEBUG = process.env.DEBUG === 'true';`,
      },
    ],
    examples: [
      {
        title: 'Remove debugger statement',
        bad: `export function calculateTotal(items) {
  debugger;
  return items.reduce((sum, i) => sum + i.price, 0);
}`,
        good: `export function calculateTotal(items) {
  return items.reduce((sum, i) => sum + i.price, 0);
}`,
      },
    ],
    docs: [
      'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/debugger',
    ],
    related: ['quality/no-stubbed-handlers', 'pii/console-in-production'],
  },
};

// ============================================================================
// API
// ============================================================================

/**
 * Get explanation for a rule
 */
export function explainRule(ruleId: string): RuleExplanation | null {
  return EXPLANATIONS[ruleId] ?? null;
}

/**
 * Get all available explanations
 */
export function getAllExplanations(): RuleExplanation[] {
  return Object.values(EXPLANATIONS);
}

/**
 * Format explanation as markdown
 */
export function formatExplanationMarkdown(explanation: RuleExplanation): string {
  const lines: string[] = [];

  lines.push(`## ${explanation.ruleId}`);
  lines.push('');
  lines.push(`### Why This Matters`);
  lines.push(explanation.why);
  lines.push('');

  lines.push(`### What Triggers This Rule`);
  for (const trigger of explanation.triggers) {
    lines.push(`- ${trigger}`);
  }
  lines.push('');

  lines.push(`### How to Fix`);
  for (const fix of explanation.fixes) {
    lines.push(`**${fix.name}**: ${fix.description}`);
    if (fix.code) {
      lines.push('```typescript');
      lines.push(fix.code);
      lines.push('```');
    }
    lines.push('');
  }

  if (explanation.examples.length > 0) {
    lines.push(`### Examples`);
    for (const example of explanation.examples) {
      lines.push(`**${example.title}**`);
      lines.push('');
      lines.push('❌ Bad:');
      lines.push('```typescript');
      lines.push(example.bad);
      lines.push('```');
      lines.push('');
      lines.push('✅ Good:');
      lines.push('```typescript');
      lines.push(example.good);
      lines.push('```');
      lines.push('');
    }
  }

  if (explanation.docs.length > 0) {
    lines.push(`### Documentation`);
    for (const doc of explanation.docs) {
      lines.push(`- ${doc}`);
    }
    lines.push('');
  }

  if (explanation.related.length > 0) {
    lines.push(`### Related Rules`);
    lines.push(explanation.related.map(r => `\`${r}\``).join(', '));
  }

  return lines.join('\n');
}

/**
 * Format explanation for terminal output
 */
export function formatExplanationTerminal(explanation: RuleExplanation): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(`━━━ ${explanation.ruleId} ━━━`);
  lines.push('');
  lines.push(`📖 WHY: ${explanation.why}`);
  lines.push('');
  
  lines.push('🎯 TRIGGERS:');
  for (const trigger of explanation.triggers.slice(0, 3)) {
    lines.push(`   • ${trigger}`);
  }
  lines.push('');

  lines.push('🔧 FIX:');
  const fix = explanation.fixes[0];
  if (fix) {
    lines.push(`   ${fix.name}: ${fix.description}`);
    if (fix.code) {
      lines.push('');
      lines.push('   ' + fix.code.split('\n').join('\n   '));
    }
  }
  lines.push('');

  if (explanation.docs.length > 0) {
    lines.push(`📚 DOCS: ${explanation.docs[0]}`);
  }

  return lines.join('\n');
}
