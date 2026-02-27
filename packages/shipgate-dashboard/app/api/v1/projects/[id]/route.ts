import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { runs: true } },
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          status: true,
          verdict: true,
          score: true,
          branch: true,
          startedAt: true,
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const orgErr = assertOrgAccess(auth, project.orgId);
  if (orgErr) return orgErr;

  return NextResponse.json({ data: { ...project, runCount: project._count.runs } });
}
