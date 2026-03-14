import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

/**
 * GET /api/v1/shared/[token] — public endpoint for shared run reports.
 * No auth required. Returns limited run data (no detailed findings or source paths).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const tokenHash = createHash('sha256').update(params.token).digest('hex');

  const artifact = await prisma.artifact.findFirst({
    where: {
      kind: 'share_token',
      path: tokenHash,
    },
    include: {
      run: {
        include: {
          project: { select: { name: true } },
          findings: { select: { severity: true } },
          proofs: { select: { id: true } },
        },
      },
    },
  });

  if (!artifact) {
    return NextResponse.json({ error: 'Shared report not found or expired' }, { status: 404 });
  }

  const run = artifact.run;

  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of run.findings) {
    const sev = f.severity?.toLowerCase();
    if (sev === 'critical') severityCounts.critical++;
    else if (sev === 'high') severityCounts.high++;
    else if (sev === 'medium') severityCounts.medium++;
    else severityCounts.low++;
  }

  return NextResponse.json({
    data: {
      projectName: run.project.name,
      branch: run.branch,
      verdict: run.verdict,
      score: run.score,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      durationMs: run.durationMs,
      findingsSummary: {
        total: run.findings.length,
        ...severityCounts,
      },
      proofCount: run.proofs.length,
    },
  });
}
