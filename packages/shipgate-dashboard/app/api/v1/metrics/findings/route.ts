import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const groupBy = searchParams.get('groupBy') ?? 'severity';
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200);

  const where: Record<string, unknown> = { run: { orgId: { in: auth.orgIds } } };
  if (projectId) where.run = { ...where.run as object, projectId };

  if (groupBy === 'severity' || groupBy === 'category') {
    const grouped = await prisma.finding.groupBy({
      by: [groupBy],
      where,
      _count: true,
      orderBy: { _count: { [groupBy]: 'desc' } } as never,
    });

    return NextResponse.json({
      data: grouped.map((g) => ({
        key: g[groupBy],
        count: g._count,
      })),
    });
  }

  // Default: return latest findings
  const findings = await prisma.finding.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    include: {
      run: {
        select: {
          id: true,
          projectId: true,
          project: { select: { name: true } },
          startedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ data: findings });
}
