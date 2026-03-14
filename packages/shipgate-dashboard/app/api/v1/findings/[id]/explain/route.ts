import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

const SEVERITY_CONTEXT: Record<string, { impact: string; urgency: string }> = {
  critical: {
    impact: 'This is a critical security or compliance issue that could lead to data breaches, unauthorized access, or regulatory violations.',
    urgency: 'Must be fixed before deployment. Block the release pipeline until resolved.',
  },
  high: {
    impact: 'This issue poses a significant risk to application security or data integrity.',
    urgency: 'Should be fixed in the current sprint. Do not ship to production without a remediation plan.',
  },
  medium: {
    impact: 'This issue may lead to unexpected behavior or minor security weaknesses.',
    urgency: 'Plan to fix within the next 1-2 sprints. Monitor for exploitation.',
  },
  low: {
    impact: 'This is a minor issue or best practice violation with limited direct impact.',
    urgency: 'Fix when convenient. Good for tech debt cleanup.',
  },
  info: {
    impact: 'This is an informational finding for awareness.',
    urgency: 'No immediate action required.',
  },
};

const CATEGORY_EXPLANATIONS: Record<string, { description: string; example: string; fix: string }> = {
  'ghost-route': {
    description: 'An API endpoint is referenced in code but not defined in the spec or router. This can indicate dead code, a missing route handler, or a hallucinated API that AI generated without creating the actual endpoint.',
    example: 'Code calls `fetch("/api/users/export")` but no handler exists at that path.',
    fix: 'Either create the missing route handler or remove the reference to the non-existent endpoint.',
  },
  'ghost-env': {
    description: 'An environment variable is used in code (via `process.env.*` or equivalent) but is not declared in your env configuration (.env, .env.example, or truthpack).',
    example: '`process.env.STRIPE_SECRET_KEY` is used but not listed in .env.example.',
    fix: 'Add the variable to your .env.example and ensure it is set in all deployment environments.',
  },
  'auth-bypass': {
    description: 'A route or endpoint that handles sensitive data or operations is not protected by authentication middleware. This means unauthenticated users could access it.',
    example: 'The `/api/admin/users` endpoint has no auth check, allowing anyone to list all users.',
    fix: 'Add authentication middleware (e.g., `requireAuth()`) to the route handler.',
  },
  'pii-exposure': {
    description: 'Personally identifiable information (PII) like email, phone, SSN, or IP address may be logged, exposed in error messages, or returned in API responses without proper filtering.',
    example: 'Error handler logs the full user object including email and phone to console.',
    fix: 'Sanitize log output and API responses. Use allowlist patterns to control which fields are exposed.',
  },
  'placeholder-code': {
    description: 'The code contains placeholder or stub implementations (TODO, FIXME, mock data, hardcoded values) that should not reach production.',
    example: 'Password validation returns `true` unconditionally with a `// TODO: implement` comment.',
    fix: 'Replace placeholder code with real implementation. Remove TODO/FIXME comments after implementing.',
  },
  'security': {
    description: 'A general security issue was detected, such as weak cryptography, insecure defaults, or missing input validation.',
    example: 'Using MD5 for password hashing instead of bcrypt/argon2.',
    fix: 'Follow OWASP security guidelines for the specific issue type.',
  },
  general: {
    description: 'A specification violation was detected where the implementation does not match the declared behavioral contract.',
    example: 'The spec says the endpoint returns 404 on missing resources, but the code returns 200 with null.',
    fix: 'Update the implementation to match the spec, or update the spec if the behavior is intentional.',
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const finding = await prisma.finding.findUnique({
    where: { id: params.id },
    include: { run: { select: { orgId: true, projectId: true, project: { select: { name: true } } } } },
  });

  if (!finding) {
    return NextResponse.json({ error: 'Finding not found' }, { status: 404 });
  }

  if (!auth.orgIds.includes(finding.run.orgId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const severity = finding.severity?.toLowerCase() ?? 'medium';
  const category = finding.category?.toLowerCase() ?? 'general';

  const severityInfo = SEVERITY_CONTEXT[severity] ?? SEVERITY_CONTEXT['medium'];
  const categoryKey = Object.keys(CATEGORY_EXPLANATIONS).find(k => category.includes(k)) ?? 'general';
  const categoryInfo = CATEGORY_EXPLANATIONS[categoryKey];

  const explanation = {
    finding: {
      id: finding.id,
      title: finding.title,
      severity: finding.severity,
      category: finding.category,
      message: finding.message,
      filePath: finding.filePath,
      lineStart: finding.lineStart,
      lineEnd: finding.lineEnd,
      projectName: finding.run.project.name,
    },
    explanation: {
      whatItMeans: categoryInfo.description,
      whyItMatters: severityInfo.impact,
      example: categoryInfo.example,
      howToFix: categoryInfo.fix,
      urgency: severityInfo.urgency,
    },
    relatedResources: [
      { label: 'ShipGate Docs', url: 'https://docs.shipgate.dev/guides/best-practices' },
      ...(category.includes('auth')
        ? [{ label: 'OWASP Auth Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html' }]
        : []),
      ...(category.includes('pii') || category.includes('security')
        ? [{ label: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' }]
        : []),
    ],
  };

  return NextResponse.json({ data: explanation });
}
