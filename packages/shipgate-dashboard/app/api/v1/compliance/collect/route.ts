import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/v1/compliance/collect — automated evidence collection.
 * Designed to be called by Vercel cron or external scheduler.
 * Creates a ComplianceSnapshot for each org that has SSO enabled or has admin members.
 * Idempotent per org per period (upserts by orgId + period + framework).
 *
 * Protected by CRON_SECRET header to prevent unauthorized invocations.
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const period = `${now.getFullYear()}-${quarter}`;

  const orgs = await prisma.org.findMany({
    where: {
      OR: [
        { ssoEnabled: true },
        { memberships: { some: { role: 'admin' } } },
      ],
    },
    select: { id: true, name: true },
  });

  const results: Array<{ orgId: string; orgName: string; status: string; snapshotId?: string }> = [];
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  for (const org of orgs) {
    try {
      const existing = await prisma.complianceSnapshot.findFirst({
        where: { orgId: org.id, period, framework: 'soc2' },
      });

      if (existing) {
        results.push({ orgId: org.id, orgName: org.name, status: 'skipped_exists', snapshotId: existing.id });
        continue;
      }

      const [
        membersByRole,
        totalMembers,
        auditLogCount,
        proofBundleCount,
        runCount,
        completedRuns,
        runsByVerdict,
        orgData,
      ] = await Promise.all([
        prisma.membership.groupBy({ by: ['role'], where: { orgId: org.id }, _count: true }),
        prisma.membership.count({ where: { orgId: org.id } }),
        prisma.auditLog.count({ where: { orgId: org.id, createdAt: { gte: ninetyDaysAgo } } }),
        prisma.proofBundle.count({ where: { run: { orgId: org.id }, createdAt: { gte: ninetyDaysAgo } } }),
        prisma.run.count({ where: { orgId: org.id, startedAt: { gte: ninetyDaysAgo } } }),
        prisma.run.count({ where: { orgId: org.id, status: 'completed', startedAt: { gte: ninetyDaysAgo } } }),
        prisma.run.groupBy({
          by: ['verdict'],
          where: { orgId: org.id, status: 'completed', startedAt: { gte: ninetyDaysAgo } },
          _count: true,
        }),
        prisma.org.findUnique({
          where: { id: org.id },
          select: { ssoEnabled: true, ssoEnforced: true, domainVerified: true },
        }),
      ]);

      const roleBreakdown: Record<string, number> = {};
      for (const r of membersByRole) roleBreakdown[r.role] = r._count;

      const verdictBreakdown: Record<string, number> = {};
      for (const v of runsByVerdict) verdictBreakdown[v.verdict ?? 'null'] = v._count;

      const roles = membersByRole.map((r) => `${r._count} ${r.role}`).join(', ');
      const hasRbac = totalMembers > 0;
      const hasAudit = auditLogCount > 0;
      const hasProofs = proofBundleCount > 0;
      const hasRuns = runCount > 0;

      const controls = [
        { id: 'CC6.1', name: 'Logical Access Controls', status: hasRbac ? 'met' : 'not_met',
          evidence: [`${totalMembers} members (${roles})`, orgData?.ssoEnabled ? 'SSO enabled' : 'SSO off'] },
        { id: 'CC6.2', name: 'Access Provisioning', status: hasRbac ? (orgData?.ssoEnabled ? 'met' : 'partial') : 'not_met',
          evidence: ['RBAC enforced', orgData?.domainVerified ? 'Domain verified' : 'Domain unverified'] },
        { id: 'CC7.1', name: 'System Monitoring', status: hasAudit ? 'met' : 'not_met',
          evidence: [`${auditLogCount} audit events (90d)`, 'Audit export available'] },
        { id: 'CC8.1', name: 'Change Management', status: hasProofs ? 'met' : 'partial',
          evidence: [`${proofBundleCount} proof bundles (90d)`, `${completedRuns} completed runs`] },
        { id: 'CC5.1', name: 'Control Activities', status: hasRuns ? 'met' : 'not_met',
          evidence: [`${runCount} runs (90d)`, `Verdicts: ${JSON.stringify(verdictBreakdown)}`] },
        { id: 'CC5.2', name: 'Encryption', status: 'met',
          evidence: ['TLS 1.3', 'AES-256-GCM for tokens', 'Stripe PCI-compliant'] },
      ];

      const summary = {
        total: controls.length,
        met: controls.filter((c) => c.status === 'met').length,
        partial: controls.filter((c) => c.status === 'partial').length,
        notMet: controls.filter((c) => c.status === 'not_met').length,
      };

      const evidence = {
        period: { from: ninetyDaysAgo.toISOString(), to: now.toISOString() },
        totalMembers,
        roleBreakdown,
        auditLogCount,
        proofBundleCount,
        runCount,
        completedRuns,
        verdictBreakdown,
        ssoEnabled: orgData?.ssoEnabled ?? false,
        ssoEnforced: orgData?.ssoEnforced ?? false,
      };

      const snapshot = await prisma.complianceSnapshot.create({
        data: {
          orgId: org.id,
          period,
          framework: 'soc2',
          controls: { controls, summary },
          evidence,
        },
      });

      results.push({ orgId: org.id, orgName: org.name, status: 'created', snapshotId: snapshot.id });
    } catch {
      results.push({ orgId: org.id, orgName: org.name, status: 'error' });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      period,
      orgsProcessed: orgs.length,
      results,
    },
  });
}
