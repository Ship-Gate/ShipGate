import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const periodStart = from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const periodEnd = to ? new Date(to) : new Date();

  const dateFilter = { gte: periodStart, lte: periodEnd };

  const [
    membershipsByRole,
    totalMembers,
    auditLogCount,
    recentAuditActions,
    proofBundleCount,
    latestProofs,
    runCount,
    runsByVerdict,
    roleChangeEvents,
    ssoEnabled,
  ] = await Promise.all([
    prisma.membership.groupBy({
      by: ['role'],
      where: { orgId },
      _count: true,
    }),
    prisma.membership.count({ where: { orgId } }),
    prisma.auditLog.count({
      where: { orgId, createdAt: dateFilter },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { orgId, createdAt: dateFilter },
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
    prisma.proofBundle.count({
      where: { run: { orgId }, createdAt: dateFilter },
    }),
    prisma.proofBundle.findMany({
      where: { run: { orgId }, createdAt: dateFilter },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, kind: true, status: true, createdAt: true, runId: true },
    }),
    prisma.run.count({
      where: { orgId, startedAt: dateFilter },
    }),
    prisma.run.groupBy({
      by: ['verdict'],
      where: { orgId, status: 'completed', startedAt: dateFilter },
      _count: true,
    }),
    prisma.auditLog.count({
      where: { orgId, action: { in: ['role.changed', 'membership.created', 'membership.removed'] }, createdAt: dateFilter },
    }),
    prisma.org.findUnique({
      where: { id: orgId },
      select: { ssoEnabled: true, ssoEnforced: true, ssoDomain: true, domainVerified: true },
    }),
  ]);

  const roleBreakdown: Record<string, number> = {};
  for (const r of membershipsByRole) {
    roleBreakdown[r.role] = r._count;
  }

  const verdictBreakdown: Record<string, number> = {};
  for (const v of runsByVerdict) {
    verdictBreakdown[v.verdict ?? 'null'] = v._count;
  }

  return NextResponse.json({
    ok: true,
    data: {
      period: { from: periodStart.toISOString(), to: periodEnd.toISOString() },
      cc6_logical_access: {
        totalMembers,
        roleBreakdown,
        roleChangeEvents,
        ssoEnabled: ssoEnabled?.ssoEnabled ?? false,
        ssoEnforced: ssoEnabled?.ssoEnforced ?? false,
        domainVerified: ssoEnabled?.domainVerified ?? false,
      },
      cc7_system_operations: {
        auditLogCount,
        recentAuditActions: recentAuditActions.map((a) => ({
          action: a.action,
          count: a._count,
        })),
        auditExportAvailable: true,
      },
      cc8_change_management: {
        proofBundleCount,
        latestProofs,
      },
      cc5_control_activities: {
        runCount,
        verdictBreakdown,
      },
    },
  });
}
