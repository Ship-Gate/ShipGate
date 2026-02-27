import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');

  const where: Record<string, unknown> = { orgId: { in: auth.orgIds } };
  if (projectId) where.projectId = projectId;

  const [totalRuns, totalFindings, runsByVerdict, recentRuns, findingsBySeverity] =
    await Promise.all([
      prisma.run.count({ where }),
      prisma.finding.count({
        where: { run: where },
      }),
      prisma.run.groupBy({
        by: ['verdict'],
        where: { ...where, verdict: { not: null } },
        _count: true,
      }),
      prisma.run.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        take: 30,
        select: {
          id: true,
          startedAt: true,
          verdict: true,
          score: true,
          status: true,
        },
      }),
      prisma.finding.groupBy({
        by: ['severity'],
        where: { run: where },
        _count: true,
      }),
    ]);

  const projectCount = await prisma.project.count({
    where: { orgId: { in: auth.orgIds } },
  });

  const shipCount = runsByVerdict.find((v) => v.verdict === 'SHIP')?._count ?? 0;
  const totalVerdicts = runsByVerdict.reduce((sum, v) => sum + v._count, 0);
  const shipRate = totalVerdicts > 0 ? Math.round((shipCount / totalVerdicts) * 100) : 0;

  return NextResponse.json({
    data: {
      totalRuns,
      totalFindings,
      projectCount,
      shipRate,
      verdictBreakdown: Object.fromEntries(
        runsByVerdict.map((v) => [v.verdict ?? 'none', v._count])
      ),
      severityBreakdown: Object.fromEntries(
        findingsBySeverity.map((s) => [s.severity, s._count])
      ),
      trend: recentRuns.map((r) => ({
        date: r.startedAt.toISOString(),
        verdict: r.verdict,
        score: r.score,
        status: r.status,
      })),
    },
  });
}
