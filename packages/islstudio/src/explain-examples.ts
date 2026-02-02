/**
 * ISL Studio - Fix Examples (Bad → Good)
 * 
 * Every rule has before/after code examples.
 */

export interface CodeExample {
  ruleId: string;
  bad: string;
  good: string;
  explanation: string;
}

export const FIX_EXAMPLES: Record<string, CodeExample> = {
  'auth/bypass-detected': {
    ruleId: 'auth/bypass-detected',
    bad: `// ❌ BAD: Auth bypass allows any request through
const skipAuth = process.env.DEBUG === 'true';

app.use((req, res, next) => {
  if (skipAuth) return next(); // DANGER!
  verifyToken(req);
  next();
});`,
    good: `// ✅ GOOD: Always verify authentication
app.use((req, res, next) => {
  verifyToken(req);
  next();
});

// Use feature flags, not auth bypasses
// For testing, use test tokens instead`,
    explanation: 'Remove all auth bypass patterns. Use test tokens for testing, not bypass flags.',
  },

  'auth/hardcoded-credentials': {
    ruleId: 'auth/hardcoded-credentials',
    bad: `// ❌ BAD: Secrets in code
const API_KEY = "sk_live_abc123xyz";
const DB_PASSWORD = "supersecret123";

async function connect() {
  return db.connect({ password: DB_PASSWORD });
}`,
    good: `// ✅ GOOD: Use environment variables
const API_KEY = process.env.API_KEY;
const DB_PASSWORD = process.env.DB_PASSWORD;

if (!API_KEY || !DB_PASSWORD) {
  throw new Error('Missing required environment variables');
}

async function connect() {
  return db.connect({ password: DB_PASSWORD });
}`,
    explanation: 'Move all secrets to environment variables. Never commit credentials.',
  },

  'auth/unprotected-route': {
    ruleId: 'auth/unprotected-route',
    bad: `// ❌ BAD: Admin route without auth
app.get('/admin/users', async (req, res) => {
  const users = await User.find({});
  res.json(users);
});`,
    good: `// ✅ GOOD: Protected with auth middleware
app.get('/admin/users', 
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    const users = await User.find({});
    res.json(users);
  }
);`,
    explanation: 'Add authentication middleware to all sensitive routes.',
  },

  'pii/logged-sensitive-data': {
    ruleId: 'pii/logged-sensitive-data',
    bad: `// ❌ BAD: PII in logs
console.log('User registered:', user);
console.log('Payment:', { card: cardNumber, ssn });
logger.info('Request body:', req.body);`,
    good: `// ✅ GOOD: Redact sensitive data
console.log('User registered:', user.id);
console.log('Payment:', { card: maskCard(cardNumber) });
logger.info('Request:', { 
  path: req.path, 
  userId: req.user?.id 
});

function maskCard(num: string) {
  return '**** **** **** ' + num.slice(-4);
}`,
    explanation: 'Never log full PII. Mask credit cards, SSNs, and personal data.',
  },

  'pii/unmasked-response': {
    ruleId: 'pii/unmasked-response',
    bad: `// ❌ BAD: Full PII in API response
app.get('/api/user/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  res.json(user); // Exposes SSN, full DOB, etc
});`,
    good: `// ✅ GOOD: Only return needed fields
app.get('/api/user/:id', async (req, res) => {
  const user = await User.findById(req.params.id)
    .select('id name email avatar');
  
  res.json({
    id: user.id,
    name: user.name,
    email: maskEmail(user.email),
  });
});`,
    explanation: 'Only return necessary fields. Mask sensitive data in responses.',
  },

  'payments/bypass-detected': {
    ruleId: 'payments/bypass-detected',
    bad: `// ❌ BAD: Skip payment verification
async function processOrder(order) {
  if (order.testMode || order.skipPayment) {
    return { success: true }; // DANGER!
  }
  return await stripe.charges.create(order);
}`,
    good: `// ✅ GOOD: Always verify payment
async function processOrder(order) {
  const charge = await stripe.charges.create({
    amount: order.amount,
    currency: 'usd',
    source: order.paymentToken,
  });
  
  if (charge.status !== 'succeeded') {
    throw new Error('Payment failed');
  }
  
  return { success: true, chargeId: charge.id };
}`,
    explanation: 'Never skip payment verification. Use Stripe test mode for testing.',
  },

  'payments/webhook-signature': {
    ruleId: 'payments/webhook-signature',
    bad: `// ❌ BAD: No webhook signature verification
app.post('/webhooks/stripe', (req, res) => {
  const event = req.body;
  handlePaymentEvent(event); // Anyone can fake this!
  res.sendStatus(200);
});`,
    good: `// ✅ GOOD: Verify webhook signature
app.post('/webhooks/stripe', (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    handlePaymentEvent(event);
    res.sendStatus(200);
  } catch (err) {
    res.status(400).send('Invalid signature');
  }
});`,
    explanation: 'Always verify webhook signatures to prevent forged events.',
  },

  'rate-limit/login-endpoint': {
    ruleId: 'rate-limit/login-endpoint',
    bad: `// ❌ BAD: No rate limiting on login
app.post('/login', async (req, res) => {
  const user = await User.findByEmail(req.body.email);
  if (!user || !await user.checkPassword(req.body.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: generateToken(user) });
});`,
    good: `// ✅ GOOD: Rate limit login attempts
import rateLimit from 'express-rate-limit';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts',
});

app.post('/login', loginLimiter, async (req, res) => {
  // ... same logic
});`,
    explanation: 'Rate limit login endpoints to prevent brute force attacks.',
  },
};

/**
 * Get fix example for a rule
 */
export function getFixExample(ruleId: string): CodeExample | null {
  return FIX_EXAMPLES[ruleId] || null;
}

/**
 * Format fix example as markdown
 */
export function formatFixExampleMarkdown(example: CodeExample): string {
  return `### ${example.ruleId}

${example.explanation}

**Before (Bad):**

\`\`\`typescript
${example.bad}
\`\`\`

**After (Good):**

\`\`\`typescript
${example.good}
\`\`\`
`;
}
