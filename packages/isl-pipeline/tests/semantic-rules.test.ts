/**
 * ISL Pipeline - Semantic Rules Tests
 * 
 * Tests for intent/audit-required rule with exit path analysis
 */

import { describe, it, expect } from 'vitest';
import { SEMANTIC_RULES, runSemanticRules } from '../src/semantic-rules.js';

// ============================================================================
// Test Helpers
// ============================================================================

function getAuditRule() {
  return SEMANTIC_RULES.find(r => r.id === 'intent/audit-required')!;
}

function checkRule(code: string, file: string = 'api/route.ts') {
  const rule = getAuditRule();
  return rule.check(code, file);
}

// ============================================================================
// intent/audit-required - Exit Path Coverage Tests
// ============================================================================

describe('intent/audit-required - Exit Path Coverage', () => {
  it('should pass when all exit paths are audited', () => {
    const code = `
export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id");
  
  // Rate limit path - audited
  if (isRateLimited()) {
    await auditAttempt({ action: "login", success: false, reason: "rate_limited", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  
  // Validation path - audited
  const body = await req.json();
  if (!body.email) {
    await auditAttempt({ action: "login", success: false, reason: "validation_failed", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  
  // Success path - audited
  const user = await authenticate(body);
  await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations).toHaveLength(0);
  });

  it('should fail when rate limit path is not audited', () => {
    const code = `
export async function POST(req: Request) {
  // Rate limit path - NOT audited!
  if (isRateLimited()) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  
  // Success path - audited
  await auditAttempt({ action: "login", success: true, timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations.length).toBeGreaterThan(0);
  });

  it('should fail when validation path is not audited', () => {
    const code = `
export async function POST(req: Request) {
  const body = await req.json();
  
  // Validation path - NOT audited!
  if (!body.email) {
    return NextResponse.json({ error: "Missing email" }, { status: 400 });
  }
  
  // Success path - audited
  await auditAttempt({ action: "login", success: true, timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations.length).toBeGreaterThan(0);
  });

  it('should fail when auth error path is not audited', () => {
    const code = `
export async function POST(req: Request) {
  const user = await authenticate();
  
  // Auth failure path - NOT audited!
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  // Success path - audited
  await auditAttempt({ action: "login", success: true, timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations.length).toBeGreaterThan(0);
  });

  it('should fail when success path is not audited', () => {
    const code = `
export async function POST(req: Request) {
  // Error path - audited
  if (isError()) {
    await auditAttempt({ action: "login", success: false, reason: "error", timestamp: Date.now(), requestId: "123" });
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
  
  // Do some processing
  const result = await doSomething();
  const processedData = processResult(result);
  const finalOutput = transform(processedData);
  const moreProcessing = await asyncOp(finalOutput);
  const evenMoreSteps = validate(moreProcessing);
  const lastStep = format(evenMoreSteps);
  
  // Success path - NOT audited! (well separated from error path above)
  return NextResponse.json({ user: lastStep }, { status: 200 });
}`;
    
    const violations = checkRule(code);
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// intent/audit-required - Required Fields Tests
// ============================================================================

describe('intent/audit-required - Required Fields', () => {
  it('should fail when action field is missing', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ success: true, timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const fieldViolations = violations.filter(v => v.message.includes('missing required field: action'));
    expect(fieldViolations.length).toBeGreaterThan(0);
  });

  it('should fail when success field is missing', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const fieldViolations = violations.filter(v => v.message.includes('missing required field: success'));
    expect(fieldViolations.length).toBeGreaterThan(0);
  });

  it('should fail when timestamp field is missing', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", success: true });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const fieldViolations = violations.filter(v => v.message.includes('missing required field: timestamp'));
    expect(fieldViolations.length).toBeGreaterThan(0);
  });

  it('should warn when requestId/correlationId is missing', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", success: true, timestamp: Date.now() });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const fieldViolations = violations.filter(v => v.message.includes('missing recommended field: requestId'));
    expect(fieldViolations.length).toBeGreaterThan(0);
    expect(fieldViolations[0].severity).toBe('medium');
  });

  it('should pass when correlationId is used instead of requestId', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", success: true, timestamp: Date.now(), correlationId: "123" });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const fieldViolations = violations.filter(v => v.message.includes('missing recommended field: requestId'));
    expect(fieldViolations).toHaveLength(0);
  });

  it('should fail when reason is missing on failure path', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", success: false, timestamp: Date.now(), requestId: "123" });
  return NextResponse.json({ error: "Failed" }, { status: 400 });
}`;
    
    const violations = checkRule(code);
    const reasonViolations = violations.filter(v => v.message.includes('missing "reason" field'));
    expect(reasonViolations.length).toBeGreaterThan(0);
  });

  it('should pass when all required fields are present on failure path', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ action: "login", success: false, reason: "validation_failed", timestamp: Date.now(), requestId: "123" });
  return NextResponse.json({ error: "Failed" }, { status: 400 });
}`;
    
    const violations = checkRule(code);
    const reasonViolations = violations.filter(v => v.message.includes('missing "reason" field'));
    expect(reasonViolations).toHaveLength(0);
  });
});

// ============================================================================
// intent/audit-required - Success Boolean Correctness Tests
// ============================================================================

describe('intent/audit-required - Success Boolean Correctness', () => {
  it('should fail when success:true is used on 429 rate limit path', () => {
    const code = `
export async function POST(req: Request) {
  if (isRateLimited()) {
    // WRONG: success should be false!
    await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId: "123" });
    return NextResponse.json({ error: "Too many" }, { status: 429 });
  }
  return NextResponse.json({ ok: true });
}`;
    
    const violations = checkRule(code);
    // Look for any violation about success:true being wrong
    const wrongSuccessViolations = violations.filter(v => 
      v.message.includes('success:true') && v.message.includes('must be success:false')
    );
    expect(wrongSuccessViolations.length).toBeGreaterThan(0);
    expect(wrongSuccessViolations[0].severity).toBe('critical');
  });

  it('should fail when success:true is used on 401 auth error path', () => {
    const code = `
export async function POST(req: Request) {
  if (!isAuthenticated()) {
    // WRONG: success should be false!
    await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId: "123" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}`;
    
    const violations = checkRule(code);
    const wrongSuccessViolations = violations.filter(v => 
      v.message.includes('success:true') && v.message.includes('must be success:false')
    );
    expect(wrongSuccessViolations.length).toBeGreaterThan(0);
  });

  it('should fail when success:true is used on 400 validation error path', () => {
    const code = `
export async function POST(req: Request) {
  if (!isValid()) {
    // WRONG: success should be false!
    await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId: "123" });
    return NextResponse.json({ error: "Invalid" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}`;
    
    const violations = checkRule(code);
    const wrongSuccessViolations = violations.filter(v => 
      v.message.includes('success:true') && v.message.includes('must be success:false')
    );
    expect(wrongSuccessViolations.length).toBeGreaterThan(0);
  });

  it('should pass when success:false is correctly used on error paths', () => {
    const code = `
export async function POST(req: Request) {
  if (isRateLimited()) {
    await auditAttempt({ action: "login", success: false, reason: "rate_limited", timestamp: Date.now(), requestId: "123" });
    return NextResponse.json({ error: "Too many" }, { status: 429 });
  }
  
  // Do some processing
  const result = await processRequest();
  const data = transformData(result);
  const response = formatResponse(data);
  
  // Success path - well separated from error path above
  await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId: "123" });
  return NextResponse.json({ user: response }, { status: 200 });
}`;
    
    const violations = checkRule(code);
    // Should not flag correct usage - success:true is on the success path (200), not error path
    const wrongSuccessViolations = violations.filter(v => 
      v.message.includes('success:true') && v.message.includes('must be success:false')
    );
    expect(wrongSuccessViolations).toHaveLength(0);
  });
});

// ============================================================================
// intent/audit-required - PII Detection Tests
// ============================================================================

describe('intent/audit-required - PII Detection', () => {
  it('should fail when email is in audit payload', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ 
    action: "login", 
    success: true, 
    timestamp: Date.now(),
    email: user.email  // PII!
  });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const piiViolations = violations.filter(v => v.message.includes('PII') && v.message.includes('email'));
    expect(piiViolations.length).toBeGreaterThan(0);
    expect(piiViolations[0].severity).toBe('critical');
  });

  it('should fail when password is in audit payload', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ 
    action: "login", 
    success: true, 
    timestamp: Date.now(),
    password: body.password  // PII!
  });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const piiViolations = violations.filter(v => v.message.includes('PII') && v.message.includes('password'));
    expect(piiViolations.length).toBeGreaterThan(0);
  });

  it('should fail when token is in audit payload', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ 
    action: "login", 
    success: true, 
    timestamp: Date.now(),
    token: session.token  // PII!
  });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const piiViolations = violations.filter(v => v.message.includes('PII') && v.message.includes('token'));
    expect(piiViolations.length).toBeGreaterThan(0);
  });

  it('should fail when user.email is directly referenced', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ 
    action: "login", 
    success: true, 
    timestamp: Date.now(),
    userEmail: user.email  // PII via user object!
  });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const piiViolations = violations.filter(v => v.message.includes('PII'));
    expect(piiViolations.length).toBeGreaterThan(0);
  });

  it('should pass when only safe fields are in audit payload', () => {
    const code = `
export async function POST(req: Request) {
  await auditAttempt({ 
    action: "login", 
    success: true, 
    timestamp: Date.now(),
    requestId: "123",
    userId: user.id,  // Safe - just an ID
    method: "POST"
  });
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code);
    const piiViolations = violations.filter(v => v.message.includes('PII'));
    expect(piiViolations).toHaveLength(0);
  });
});

// ============================================================================
// intent/audit-required - File Type Skip Tests
// ============================================================================

describe('intent/audit-required - File Type Handling', () => {
  it('should skip test files', () => {
    const code = `
export async function POST(req: Request) {
  return NextResponse.json({ user }); // No audit - but it's a test file
}`;
    
    const violations = checkRule(code, 'api/route.test.ts');
    expect(violations).toHaveLength(0);
  });

  it('should skip type files', () => {
    const code = `
export async function POST(req: Request) {
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code, 'api/route.types.ts');
    expect(violations).toHaveLength(0);
  });

  it('should skip schema files', () => {
    const code = `
export async function POST(req: Request) {
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code, 'api/route.schema.ts');
    expect(violations).toHaveLength(0);
  });

  it('should check regular route files', () => {
    const code = `
export async function POST(req: Request) {
  return NextResponse.json({ user });
}`;
    
    const violations = checkRule(code, 'api/route.ts');
    expect(violations.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// intent/audit-required - Express Handler Tests
// ============================================================================

describe('intent/audit-required - Express Handlers', () => {
  it('should detect Express handlers and require audit', () => {
    const code = `
router.post('/login', async (req, res) => {
  // No audit!
  return res.json({ user });
});`;
    
    const violations = checkRule(code, 'routes/auth.ts');
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations.length).toBeGreaterThan(0);
  });

  it('should pass Express handler with proper audit', () => {
    const code = `
router.post('/login', async (req, res) => {
  await auditAttempt({ action: "login", success: true, timestamp: Date.now(), requestId: req.id });
  return res.json({ user });
});`;
    
    const violations = checkRule(code, 'routes/auth.ts');
    const missingAuditViolations = violations.filter(v => v.message.includes('Missing audit'));
    expect(missingAuditViolations).toHaveLength(0);
  });
});

// ============================================================================
// intent/audit-required - Integration Tests
// ============================================================================

describe('intent/audit-required - Integration', () => {
  it('should run via runSemanticRules', () => {
    const codeMap = new Map([
      ['api/login/route.ts', `
export async function POST(req: Request) {
  return NextResponse.json({ user }); // No audit
}`],
    ]);
    
    const violations = runSemanticRules(codeMap);
    const auditViolations = violations.filter(v => v.ruleId === 'intent/audit-required');
    expect(auditViolations.length).toBeGreaterThan(0);
  });

  it('should work with complete passing handler', () => {
    const code = `
export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  const actionName = "user_login";

  // Rate limit check
  const rateLimitResult = await rateLimit(req);
  if (!rateLimitResult.allowed) {
    await auditAttempt({ action: actionName, success: false, reason: "rate_limited", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Parse request body
  const body = await req.json();
  
  // Validate input
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    await auditAttempt({ action: actionName, success: false, reason: "validation_failed", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: result.error.message }, { status: 400 });
  }

  // Authenticate user
  const credentials = result.data;
  const user = await authenticate(credentials.userLogin, credentials.userPass);
  if (!user) {
    await auditAttempt({ action: actionName, success: false, reason: "invalid_credentials", timestamp: Date.now(), requestId });
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Create session
  const session = await createSession(user.id);
  
  // Build response
  const responseData = { 
    userId: user.id, 
    displayName: user.name,
    sessionId: session.id 
  };

  // Audit and return success
  await auditAttempt({ action: actionName, success: true, timestamp: Date.now(), requestId });
  return NextResponse.json({ data: responseData });
}`;
    
    const violations = checkRule(code, 'app/api/login/route.ts');
    
    // Should have no critical or high violations
    const criticalOrHigh = violations.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    );
    expect(criticalOrHigh).toHaveLength(0);
  });
});
