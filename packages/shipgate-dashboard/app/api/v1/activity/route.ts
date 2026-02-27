import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

interface ActivityItem {
  id: string;
  type: 'run' | 'finding' | 'audit';
  title: string;
  subtitle: string | null;
  timestamp: string;
  meta: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? '15'),
    30
  );

  const [recentRuns, recentAudit] = await Promise.all([
    prisma.run.findMany({
      where: { orgId: { in: auth.orgIds } },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        status: true,
        verdict: true,
        startedAt: true,
        project: { select: { name: true } },
        user: { select: { name: true, avatar: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { orgId: { in: auth.orgIds } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        resource: true,
        createdAt: true,
        metaJson: true,
      },
    }),
  ]);

  const items: ActivityItem[] = [];

  for (const run of recentRuns) {
    const verb = run.status === 'completed' ? 'completed' : run.status;
    items.push({
      id: `run-${run.id}`,
      type: 'run',
      title: `Run ${verb} on ${run.project.name}`,
      subtitle: run.verdict
        ? `Verdict: ${run.verdict}`
        : null,
      timestamp: run.startedAt.toISOString(),
      meta: {
        verdict: run.verdict,
        status: run.status,
        userName: run.user.name,
        userAvatar: run.user.avatar,
      },
    });
  }

  for (const log of recentAudit) {
    items.push({
      id: `audit-${log.id}`,
      type: 'audit',
      title: log.action.replace(/\./g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      subtitle: log.resource,
      timestamp: log.createdAt.toISOString(),
      meta: (log.metaJson as Record<string, unknown>) ?? {},
    });
  }

  items.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json({
    data: { items: items.slice(0, limit) },
  });
}
