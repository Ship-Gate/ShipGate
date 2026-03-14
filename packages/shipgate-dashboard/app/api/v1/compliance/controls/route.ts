import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

interface ControlStatus {
  id: string;
  name: string;
  category: string;
  status: 'met' | 'partial' | 'not_met';
  evidence: string[];
  lastVerified: string;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [
    memberCount,
    membersByRole,
    auditCount,
    proofCount,
    runCount,
    completedRuns,
    org,
  ] = await Promise.all([
    prisma.membership.count({ where: { orgId } }),
    prisma.membership.groupBy({ by: ['role'], where: { orgId }, _count: true }),
    prisma.auditLog.count({ where: { orgId, createdAt: { gte: ninetyDaysAgo } } }),
    prisma.proofBundle.count({ where: { run: { orgId }, createdAt: { gte: ninetyDaysAgo } } }),
    prisma.run.count({ where: { orgId, startedAt: { gte: ninetyDaysAgo } } }),
    prisma.run.count({ where: { orgId, status: 'completed', startedAt: { gte: ninetyDaysAgo } } }),
    prisma.org.findUnique({
      where: { id: orgId },
      select: { ssoEnabled: true, ssoEnforced: true, domainVerified: true },
    }),
  ]);

  const roles = membersByRole.map((r) => `${r._count} ${r.role}`).join(', ');
  const hasRbac = memberCount > 0;
  const hasAudit = auditCount > 0;
  const hasProofs = proofCount > 0;
  const hasRuns = runCount > 0;

  const controls: ControlStatus[] = [
    {
      id: 'CC6.1',
      name: 'Logical and Physical Access Controls',
      category: 'CC6 — Logical Access',
      status: hasRbac ? 'met' : 'not_met',
      evidence: [
        `${memberCount} members with RBAC (${roles})`,
        'Roles enforced on all API routes via requireOrgRole()',
        org?.ssoEnabled ? 'SSO enabled' : 'SSO not configured',
        org?.ssoEnforced ? 'SSO enforced for all members' : 'SSO not enforced',
      ].filter(Boolean),
      lastVerified: now,
    },
    {
      id: 'CC6.2',
      name: 'Access Provisioning',
      category: 'CC6 — Logical Access',
      status: hasRbac ? (org?.ssoEnabled ? 'met' : 'partial') : 'not_met',
      evidence: [
        'Admin/member/viewer roles with least-privilege enforcement',
        'PATs hashed with SHA-256, revocable, expirable',
        org?.domainVerified ? 'Domain verified for SSO' : 'Domain not verified',
      ],
      lastVerified: now,
    },
    {
      id: 'CC6.3',
      name: 'Access Removal',
      category: 'CC6 — Logical Access',
      status: hasRbac ? 'partial' : 'not_met',
      evidence: [
        'Membership can be removed by admin',
        'PATs revocable via API',
        org?.ssoEnforced ? 'SSO enforcement blocks non-SSO access' : 'Manual removal process',
      ],
      lastVerified: now,
    },
    {
      id: 'CC7.1',
      name: 'System Operations Monitoring',
      category: 'CC7 — System Operations',
      status: hasAudit ? 'met' : 'not_met',
      evidence: [
        `${auditCount} audit events in last 90 days`,
        'Audit log captures IP, user agent, request ID, session ID',
        'Admin-only audit export (CSV/JSON)',
      ],
      lastVerified: now,
    },
    {
      id: 'CC7.2',
      name: 'Incident Detection',
      category: 'CC7 — System Operations',
      status: hasAudit ? 'partial' : 'not_met',
      evidence: [
        'Audit trail available for incident review',
        'Incident response policy drafted',
        'Manual incident detection (automated alerting not yet implemented)',
      ],
      lastVerified: now,
    },
    {
      id: 'CC8.1',
      name: 'Change Management',
      category: 'CC8 — Change Management',
      status: hasProofs ? 'met' : 'partial',
      evidence: [
        `${proofCount} proof bundles generated in last 90 days`,
        'Signed proof bundles (HMAC-SHA256) for tamper detection',
        `${completedRuns} completed verification runs`,
      ],
      lastVerified: now,
    },
    {
      id: 'CC5.1',
      name: 'Control Activities — Verification',
      category: 'CC5 — Control Activities',
      status: hasRuns ? 'met' : 'not_met',
      evidence: [
        `${runCount} verification runs in last 90 days`,
        `${completedRuns} completed successfully`,
        'Automated verification via CLI, CI, and VS Code extension',
      ],
      lastVerified: now,
    },
    {
      id: 'CC5.2',
      name: 'Control Activities — Encryption',
      category: 'CC5 — Control Activities',
      status: 'met',
      evidence: [
        'HTTPS (TLS 1.3) for all traffic',
        'AES-256-GCM encryption at rest for OAuth tokens',
        'Stripe PCI-compliant payments (no card data stored)',
      ],
      lastVerified: now,
    },
  ];

  const summary = {
    total: controls.length,
    met: controls.filter((c) => c.status === 'met').length,
    partial: controls.filter((c) => c.status === 'partial').length,
    notMet: controls.filter((c) => c.status === 'not_met').length,
  };

  return NextResponse.json({ ok: true, data: { controls, summary } });
}
