import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

type ReverifyTrigger = 'dependency-update' | 'schedule' | 'manual';

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    projectId: string;
    trigger: ReverifyTrigger;
    lockfileHash?: string;
  };

  if (!body.projectId || !body.trigger) {
    return NextResponse.json(
      { error: 'projectId and trigger are required' },
      { status: 400 }
    );
  }

  const validTriggers: ReverifyTrigger[] = ['dependency-update', 'schedule', 'manual'];
  if (!validTriggers.includes(body.trigger)) {
    return NextResponse.json(
      { error: `trigger must be one of: ${validTriggers.join(', ')}` },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: body.projectId },
    select: { id: true, orgId: true, name: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, project.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const meta: Record<string, unknown> = {
    source: 'reverification',
    trigger: body.trigger,
  };
  if (body.lockfileHash) {
    meta.lockfileHash = body.lockfileHash;
  }

  const run = await prisma.run.create({
    data: {
      orgId: project.orgId,
      projectId: body.projectId,
      userId: auth.userId,
      agentType: 'ci',
      status: 'pending',
      metaJson: meta as Prisma.InputJsonValue,
    },
  });

  auditLog(req, auth, 'reverify.queued', `run:${run.id}`, project.orgId, {
    trigger: body.trigger,
    projectName: project.name,
    lockfileHash: body.lockfileHash,
  });

  return NextResponse.json(
    { data: { runId: run.id, status: 'queued' } },
    { status: 201 }
  );
}
