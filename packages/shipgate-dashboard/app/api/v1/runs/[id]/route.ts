import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.run.findUnique({
    where: { id: params.id },
    include: {
      project: { select: { name: true, repoUrl: true } },
      user: { select: { name: true, email: true, avatar: true } },
      findings: { orderBy: { severity: 'asc' } },
      proofs: true,
      artifacts: true,
    },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const orgErr = assertOrgAccess(auth, run.orgId);
  if (orgErr) return orgErr;

  return NextResponse.json({
    data: {
      id: run.id,
      orgId: run.orgId,
      projectId: run.projectId,
      projectName: run.project.name,
      projectRepoUrl: run.project.repoUrl,
      userId: run.userId,
      userName: run.user.name,
      userAvatar: run.user.avatar,
      agentType: run.agentType,
      agentVersion: run.agentVersion,
      commitSha: run.commitSha,
      branch: run.branch,
      status: run.status,
      verdict: run.verdict,
      score: run.score,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      metaJson: run.metaJson,
      findings: run.findings,
      proofs: run.proofs,
      artifacts: run.artifacts,
    },
  });
}
