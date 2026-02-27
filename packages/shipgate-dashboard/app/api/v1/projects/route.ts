import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const projects = await prisma.project.findMany({
    where: { orgId: { in: auth.orgIds } },
    include: {
      _count: { select: { runs: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    data: projects.map((p) => ({
      id: p.id,
      orgId: p.orgId,
      name: p.name,
      repoUrl: p.repoUrl,
      defaultBranch: p.defaultBranch,
      runCount: p._count.runs,
      createdAt: p.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    orgId: string;
    name: string;
    repoUrl?: string;
    defaultBranch?: string;
  };

  if (!body.orgId || !body.name) {
    return NextResponse.json({ error: 'orgId and name are required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const existing = await prisma.project.findUnique({
    where: { orgId_name: { orgId: body.orgId, name: body.name } },
  });
  if (existing) {
    return NextResponse.json({ data: existing });
  }

  const project = await prisma.project.create({
    data: {
      orgId: body.orgId,
      name: body.name,
      repoUrl: body.repoUrl ?? null,
      defaultBranch: body.defaultBranch ?? null,
    },
  });

  return NextResponse.json({ data: project }, { status: 201 });
}
