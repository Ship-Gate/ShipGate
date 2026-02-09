/**
 * Test Fixtures for Heal Command
 * 
 * Provides common failure scenarios that can be healed automatically.
 */

export interface TestFixture {
  name: string;
  description: string;
  ruleId: string;
  brokenCode: string;
  expectedHealedCode: string;
  spec?: string;
}

export const HEAL_TEST_FIXTURES: TestFixture[] = [
  {
    name: 'missing-env-var',
    description: 'Missing environment variable declaration',
    ruleId: 'starter/no-missing-env-vars',
    brokenCode: `// src/api/config.ts
export const config = {
  apiKey: process.env.API_KEY, // Missing from .env
  baseUrl: process.env.BASE_URL,
};
`,
    expectedHealedCode: `// src/api/config.ts
export const config = {
  apiKey: process.env.API_KEY, // Missing from .env
  baseUrl: process.env.BASE_URL,
};
// Heal: Added API_KEY to .env.example
`,
  },
  {
    name: 'console-log-in-production',
    description: 'console.log found in production code',
    ruleId: 'pii/console-in-production',
    brokenCode: `// src/api/users.ts
export async function getUser(id: string) {
  console.log('Getting user:', id); // Violation
  return await db.users.findUnique({ where: { id } });
}
`,
    expectedHealedCode: `// src/api/users.ts
export async function getUser(id: string) {
  // @intent no-pii-logging - no sensitive data in logs
  return await db.users.findUnique({ where: { id } });
}
`,
  },
  {
    name: 'missing-rate-limit',
    description: 'Route handler missing rate limiting',
    ruleId: 'intent/rate-limit-required',
    brokenCode: `// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Missing rate limiting
  return NextResponse.json({ success: true });
}
`,
    expectedHealedCode: `// src/app/api/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // @intent rate-limit-required
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }
  
  const body = await request.json();
  return NextResponse.json({ success: true });
}
`,
  },
  {
    name: 'missing-input-validation',
    description: 'Route handler missing input validation',
    ruleId: 'intent/input-validation',
    brokenCode: `// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json(); // No validation
  return NextResponse.json({ success: true });
}
`,
    expectedHealedCode: `// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const InputSchema = z.object({
  // Add schema fields based on usage
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const validation = InputSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
`,
  },
  {
    name: 'missing-audit-logging',
    description: 'Route handler missing audit logging',
    ruleId: 'intent/audit-required',
    brokenCode: `// src/app/api/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // Missing audit logging
  return NextResponse.json({ success: true });
}
`,
    expectedHealedCode: `// src/app/api/transfer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { audit } from '@/lib/audit';

export async function POST(request: NextRequest) {
  const body = await request.json();
  // @intent audit-required
  await audit.log({
    action: 'transfer',
    userId: body.userId,
    result: 'success',
  });
  return NextResponse.json({ success: true });
}
`,
  },
  {
    name: 'missing-route-binding',
    description: 'Route handler not properly exported',
    ruleId: 'starter/missing-route-binding',
    brokenCode: `// src/app/api/users/route.ts
async function handler(request: Request) {
  return new Response('OK');
}
// Missing export and HTTP method binding
`,
    expectedHealedCode: `// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'OK' });
}
`,
  },
  {
    name: 'pii-in-logs',
    description: 'PII data found in log statements',
    ruleId: 'intent/no-pii-logging',
    brokenCode: `// src/app/api/login/route.ts
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  console.log('Login attempt:', { email, password }); // PII violation
  return NextResponse.json({ success: true });
}
`,
    expectedHealedCode: `// src/app/api/login/route.ts
export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  // @intent no-pii-logging - no sensitive data in logs
  // Removed PII from logs
  return NextResponse.json({ success: true });
}
`,
  },
  {
    name: 'type-mismatch',
    description: 'Type mismatch between spec and implementation',
    ruleId: 'starter/type-mismatch',
    brokenCode: `// src/app/api/users/route.ts
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id'); // Returns string | null
  // Spec expects number
  return NextResponse.json({ id });
}
`,
    expectedHealedCode: `// src/app/api/users/route.ts
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get('id');
  const id = idParam ? parseInt(idParam, 10) : null; // Fixed type mismatch
  if (id === null) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  return NextResponse.json({ id });
}
`,
  },
  {
    name: 'ghost-route',
    description: 'Route handler exists but route not registered',
    ruleId: 'starter/no-ghost-routes',
    brokenCode: `// src/app/api/custom/route.ts
export async function GET() {
  return NextResponse.json({ message: 'OK' });
}
// Route file exists but not discoverable by Next.js (wrong location)
`,
    expectedHealedCode: `// src/app/api/custom/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: 'OK' });
}
// Heal: Route is now properly located in app/api/custom/route.ts
`,
  },
  {
    name: 'missing-auth-check',
    description: 'Sensitive route missing authentication',
    ruleId: 'auth/missing-auth-check',
    brokenCode: `// src/app/api/admin/users/route.ts
export async function GET(request: NextRequest) {
  // Missing auth check
  return NextResponse.json({ users: [] });
}
`,
    expectedHealedCode: `// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ users: [] });
}
`,
  },
];

/**
 * Get fixture by name
 */
export function getFixture(name: string): TestFixture | undefined {
  return HEAL_TEST_FIXTURES.find(f => f.name === name);
}

/**
 * Get fixtures by rule ID
 */
export function getFixturesByRuleId(ruleId: string): TestFixture[] {
  return HEAL_TEST_FIXTURES.filter(f => f.ruleId === ruleId);
}
