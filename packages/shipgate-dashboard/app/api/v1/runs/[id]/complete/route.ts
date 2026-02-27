import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import type { Verdict } from '@prisma/client';
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
    status?: 'completed' | 'failed';
    verdict?: Verdict;
    score?: number;
    durationMs?: number;
    meta?: Record<string, unknown>;
  };

  const updated = await prisma.run.update({
    where: { id: params.id },
    data: {
      status: body.status ?? 'completed',
      verdict: body.verdict ?? null,
      score: body.score ?? null,
      durationMs: body.durationMs ?? null,
      finishedAt: new Date(),
      metaJson: (body.meta ?? run.metaJson ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  auditLog(req, auth, 'run.completed', `run:${params.id}`, run.orgId, { verdict: updated.verdict, score: updated.score });

  return NextResponse.json({
    data: { id: updated.id, status: updated.status, verdict: updated.verdict, score: updated.score },
  });
}
