import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';
import { incrementScanUsage, ScanLimitError } from '@/lib/license';
import type { AgentType, Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');
  const trigger = searchParams.get('trigger') as AgentType | null;
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
  const cursor = searchParams.get('cursor');

  const where: Record<string, unknown> = { orgId: { in: auth.orgIds } };
  if (projectId) where.projectId = projectId;
  if (trigger) where.agentType = trigger;

  const runs = await prisma.run.findMany({
    where,
    include: {
      project: { select: { name: true } },
      user: { select: { name: true, email: true, avatar: true } },
      _count: { select: { findings: true } },
    },
    orderBy: { startedAt: 'desc' },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = runs.length > limit;
  const items = hasMore ? runs.slice(0, limit) : runs;
  const nextCursor = hasMore ? items[items.length - 1]?.id : null;

  return NextResponse.json({
    data: items.map((r) => ({
      id: r.id,
      orgId: r.orgId,
      projectId: r.projectId,
      projectName: r.project.name,
      userId: r.userId,
      userName: r.user.name,
      userAvatar: r.user.avatar,
      agentType: r.agentType,
      agentVersion: r.agentVersion,
      commitSha: r.commitSha,
      branch: r.branch,
      status: r.status,
      verdict: r.verdict,
      score: r.score,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      durationMs: r.durationMs,
      findingCount: r._count.findings,
    })),
    meta: { nextCursor, hasMore },
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    orgId: string;
    projectId: string;
    agentType: AgentType;
    agentVersion?: string;
    commitSha?: string;
    branch?: string;
    meta?: Record<string, unknown>;
  };

  if (!body.orgId || !body.projectId || !body.agentType) {
    return NextResponse.json(
      { error: 'orgId, projectId, and agentType are required' },
      { status: 400 }
    );
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  // Enforce scan usage limits
  try {
    await incrementScanUsage(auth.userId);
  } catch (err) {
    if (err instanceof ScanLimitError) {
      return NextResponse.json(
        {
          error: 'scan_limit_reached',
          message: err.message,
          upgradeUrl: `${req.nextUrl.origin}/checkout`,
        },
        { status: 402 }
      );
    }
    throw err;
  }

  const project = await prisma.project.findFirst({
    where: { id: body.projectId, orgId: body.orgId },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found in this org' }, { status: 404 });
  }

  const run = await prisma.run.create({
    data: {
      orgId: body.orgId,
      projectId: body.projectId,
      userId: auth.userId,
      agentType: body.agentType,
      agentVersion: body.agentVersion,
      commitSha: body.commitSha,
      branch: body.branch,
      status: 'running',
      metaJson: body.meta as Prisma.InputJsonValue | undefined,
    },
  });

  auditLog(req, auth, 'run.created', `run:${run.id}`, body.orgId);
  logger.info('run.created', {
    requestId: req.headers.get('x-request-id') ?? undefined,
    userId: auth.userId,
    orgId: body.orgId,
    projectId: body.projectId,
    runId: run.id,
  });

  return NextResponse.json({ data: { id: run.id, status: run.status } }, { status: 201 });
}
