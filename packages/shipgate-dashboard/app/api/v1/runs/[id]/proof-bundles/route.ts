import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.run.findUnique({ where: { id: params.id } });
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, run.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const body = (await req.json()) as {
    kind: string;
    artifactUrl?: string;
    summary?: Record<string, unknown>;
  };

  if (!body.kind) {
    return NextResponse.json({ error: 'kind is required' }, { status: 400 });
  }

  const proof = await prisma.proofBundle.create({
    data: {
      runId: params.id,
      kind: body.kind,
      artifactUrl: body.artifactUrl ?? null,
      summaryJson: body.summary as Prisma.InputJsonValue | undefined,
    },
  });

  return NextResponse.json({ data: proof }, { status: 201 });
}
