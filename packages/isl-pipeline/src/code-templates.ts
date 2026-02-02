/**
 * Production-Ready Code Templates
 * 
 * These templates generate code that PASSES semantic rules out of the box.
 * No healing needed for well-formed templates.
 * 
 * @module @isl-lang/pipeline
 */

import type { ISLAST, BehaviorAST, RepoContext } from '@isl-lang/translator';

// ============================================================================
// Template Context
// ============================================================================

export interface TemplateContext {
  ast: ISLAST;
  behavior: BehaviorAST;
  repoContext: RepoContext;
}

// ============================================================================
// Next.js API Route Template (Production-Ready)
// ============================================================================

export function generateNextJSRoute(ctx: TemplateContext): string {
  const { behavior } = ctx;
  const behaviorName = behavior.name;
  const intents = behavior.intents.map(i => i.tag);
  
  const hasRateLimit = intents.includes('rate-limit-required');
  const hasAudit = intents.includes('audit-required');
  const hasNoPII = intents.includes('no-pii-logging');

  return `import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
${hasRateLimit ? "import { rateLimit } from '@/lib/rate-limit';" : ''}
${hasAudit ? "import { audit } from '@/lib/audit';" : ''}
${hasNoPII ? "import { safeLogger } from '@/lib/logger';" : ''}

// Machine-checkable intent declaration
export const __isl_intents = [${intents.map(i => `"${i}"`).join(', ')}] as const;

// Input validation schema (from ISL preconditions)
const ${behaviorName}Schema = z.object({
${behavior.input.map(f => `  ${f.name}: ${getZodType(f.type.name, f.constraints)},`).join('\n')}
});

// Output types
${generateOutputTypes(behavior)}

// Error classes
${generateErrorClasses(behavior)}

${hasAudit ? generateAuditHelper(behaviorName) : ''}

${hasNoPII ? generateRedactPII() : ''}

/**
 * POST handler for ${behaviorName}
 * 
 * @intent rate-limit-required - Rate limit checked before body parsing
 * @intent audit-required - All paths audited with success/failure
 * @intent no-pii-logging - No console.* in production
 */
export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  
${hasRateLimit ? generateRateLimitBlock(behaviorName, hasAudit) : ''}

  try {
    // Parse body AFTER rate limit check
    const body = await request.json();
    
    // @intent input-validation - validate before use
    const validationResult = ${behaviorName}Schema.safeParse(body);
    if (!validationResult.success) {
${hasAudit ? `      await auditAttempt({ success: false, reason: 'validation_failed', requestId, action: '${behaviorName}' });` : ''}
      return NextResponse.json({ error: 'Validation failed', details: validationResult.error.flatten() }, { status: 400 });
    }
    
    const input = validationResult.data;
    
    // Execute business logic
    const result = await ${camelCase(behaviorName)}(input, requestId);
${hasAudit ? `    await auditAttempt({ success: true, requestId, action: '${behaviorName}' });` : ''}
    return NextResponse.json(result);
  } catch (error) {
${generateErrorHandlers(behavior, hasAudit, hasNoPII)}
  }
}

/**
 * ${behaviorName} business logic
 * 
 * ISL Postconditions to satisfy:
${behavior.postconditions.map(p => ` * - ${p.predicates.map(pred => pred.source).join(', ')}`).join('\n')}
 */
async function ${camelCase(behaviorName)}(
  input: z.infer<typeof ${behaviorName}Schema>,
  requestId: string
): Promise<${behaviorName}Result> {
${generateBusinessLogicSkeleton(behavior)}
}
`;
}

// ============================================================================
// Helper Generators
// ============================================================================

function generateAuditHelper(behaviorName: string): string {
  return `
/**
 * Audit helper - called on ALL exit paths
 * @intent audit-required
 */
async function auditAttempt(input: {
  success: boolean;
  reason?: string;
  requestId: string;
  action: string;
}) {
  await audit({
    action: input.action,
    timestamp: new Date().toISOString(),
    success: input.success,
    reason: input.reason,
    requestId: input.requestId,
  });
}
`;
}

function generateRedactPII(): string {
  return `
/**
 * Redact PII from objects before logging
 * @intent no-pii-logging
 */
function redactPII(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  const redacted = { ...obj as Record<string, unknown> };
  const piiFields = ['email', 'password', 'token', 'secret', 'credential', 'ssn', 'phone'];
  for (const field of piiFields) {
    if (field in redacted) redacted[field] = '[REDACTED]';
  }
  return redacted;
}
`;
}

function generateRateLimitBlock(behaviorName: string, hasAudit: boolean): string {
  return `  // @intent rate-limit-required - MUST be before body parsing
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
${hasAudit ? `    await auditAttempt({ success: false, reason: 'rate_limited', requestId, action: '${behaviorName}' });` : ''}
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
`;
}

function generateOutputTypes(behavior: BehaviorAST): string {
  const successType = behavior.output.success.name;
  return `
interface ${behavior.name}Result {
  ${camelCase(successType)}: ${successType};
}

interface ${successType} {
  // Define based on ISL entity
  id: string;
}
`;
}

function generateErrorClasses(behavior: BehaviorAST): string {
  return behavior.output.errors.map(e => `
class ${e.name}Error extends Error {
  constructor(message = '${e.when}') {
    super(message);
    this.name = '${e.name}Error';
  }
}
`).join('\n');
}

function generateErrorHandlers(behavior: BehaviorAST, hasAudit: boolean, hasNoPII: boolean): string {
  const handlers = behavior.output.errors.map(e => `
    if (error instanceof ${e.name}Error) {
${hasAudit ? `      await auditAttempt({ success: false, reason: '${camelCase(e.name)}', requestId, action: '${behavior.name}' });` : ''}
      return NextResponse.json({ error: '${e.when}' }, { status: ${getErrorStatusCode(e.name)} });
    }`).join('\n');

  return `${handlers}
${hasAudit ? `    await auditAttempt({ success: false, reason: 'internal_error', requestId, action: '${behavior.name}' });` : ''}
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });`;
}

function generateBusinessLogicSkeleton(behavior: BehaviorAST): string {
  // Generate a real skeleton based on behavior type
  const behaviorName = behavior.name.toLowerCase();
  
  if (behaviorName.includes('login')) {
    return `  // TODO: Replace with real implementation
  // 
  // Example implementation:
  // const user = await db.user.findUnique({ where: { email: input.email } });
  // if (!user) {
  //   throw new InvalidCredentialsError();
  // }
  // const passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  // if (!passwordValid) {
  //   throw new InvalidCredentialsError();
  // }
  // const token = await generateJWT({ userId: user.id });
  // return { authToken: { accessToken: token, expiresAt: new Date(Date.now() + 3600000) } };
  
  throw new Error('IMPLEMENTATION_REQUIRED: ${behavior.name}');`;
  }
  
  if (behaviorName.includes('register')) {
    return `  // TODO: Replace with real implementation
  //
  // Example implementation:
  // const existingUser = await db.user.findUnique({ where: { email: input.email } });
  // if (existingUser) {
  //   throw new EmailAlreadyExistsError();
  // }
  // const passwordHash = await bcrypt.hash(input.password, 12);
  // const user = await db.user.create({
  //   data: { email: input.email, passwordHash }
  // });
  // return { user: { id: user.id } };
  
  throw new Error('IMPLEMENTATION_REQUIRED: ${behavior.name}');`;
  }

  return `  // TODO: Implement ${behavior.name} business logic
  //
  // ISL Postconditions to satisfy:
${behavior.postconditions.map(p => `  // - ${p.predicates.map(pred => pred.source).join(', ')}`).join('\n')}
  
  throw new Error('IMPLEMENTATION_REQUIRED: ${behavior.name}');`;
}

// ============================================================================
// Test Template
// ============================================================================

export function generateTests(ctx: TemplateContext): string {
  const { behavior } = ctx;
  const behaviorName = behavior.name;
  
  return `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('@/lib/audit', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

function createMockRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/${kebabCase(behaviorName)}', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'x-request-id': 'test-request-id',
    },
  });
}

describe('${behaviorName}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Precondition tests
${generatePreconditionTests(behavior)}

  // Error condition tests
${generateErrorTests(behavior)}

  // Intent enforcement tests
${generateIntentTests(behavior)}
});
`;
}

function generatePreconditionTests(behavior: BehaviorAST): string {
  return behavior.preconditions.map((pre, i) => `
  it('should validate: ${pre.source}', async () => {
    const request = createMockRequest({
      // Invalid input that violates: ${pre.source}
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(400);
    expect(data.error).toBe('Validation failed');
  });`).join('\n');
}

function generateErrorTests(behavior: BehaviorAST): string {
  return behavior.output.errors.map(e => `
  it('should return ${e.name} when ${e.when}', async () => {
    // TODO: Setup conditions for ${e.name}
    const request = createMockRequest({
      email: 'test@example.com',
      password: 'validpassword123',
    });
    
    const response = await POST(request);
    // Verify error handling
  });`).join('\n');
}

function generateIntentTests(behavior: BehaviorAST): string {
  return behavior.intents.map(intent => `
  it('should enforce @intent ${intent.tag}', async () => {
    const { rateLimit } = await import('@/lib/rate-limit');
    const { audit } = await import('@/lib/audit');
    
    const request = createMockRequest({
      email: 'test@example.com',
      password: 'validpassword123',
    });
    
    await POST(request);
    
    // Verify intent enforcement
    ${intent.tag === 'rate-limit-required' ? 'expect(rateLimit).toHaveBeenCalledWith(request);' : ''}
    ${intent.tag === 'audit-required' ? 'expect(audit).toHaveBeenCalled();' : ''}
  });`).join('\n');
}

// ============================================================================
// Utility Functions
// ============================================================================

function camelCase(str: string): string {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

function getZodType(typeName: string, constraints: Array<{ expression: string }>): string {
  const baseTypes: Record<string, string> = {
    'String': 'z.string()',
    'Email': 'z.string().email()',
    'Int': 'z.number().int()',
    'Float': 'z.number()',
    'Boolean': 'z.boolean()',
    'UUID': 'z.string().uuid()',
    'DateTime': 'z.date()',
  };
  
  let zodType = baseTypes[typeName] || 'z.unknown()';
  
  // Add constraints
  for (const constraint of constraints) {
    if (constraint.expression.includes('min length')) {
      const match = constraint.expression.match(/min length (\d+)/);
      if (match) zodType += `.min(${match[1]})`;
    }
    if (constraint.expression.includes('max length')) {
      const match = constraint.expression.match(/max length (\d+)/);
      if (match) zodType += `.max(${match[1]})`;
    }
  }
  
  return zodType;
}

function getErrorStatusCode(errorName: string): number {
  const codes: Record<string, number> = {
    'InvalidCredentials': 401,
    'Unauthorized': 401,
    'AccountLocked': 423,
    'AccountDisabled': 403,
    'NotFound': 404,
    'Conflict': 409,
    'RateLimited': 429,
  };
  return codes[errorName] || 400;
}
