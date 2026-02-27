import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? '20'),
    50
  );

  const providers = await prisma.deploymentProvider.findMany({
    where: { orgId: { in: auth.orgIds } },
    select: { id: true, provider: true },
  });

  if (providers.length === 0) {
    return NextResponse.json({ data: { deployments: [] } });
  }

  const deployments = await prisma.deployment.findMany({
    where: {
      providerId: { in: providers.map((p: { id: string }) => p.id) },
    },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      provider: { select: { provider: true } },
    },
  });

  return NextResponse.json({
    data: {
      deployments: deployments.map((d) => ({
        id: d.id,
        provider: d.provider.provider,
        externalId: d.externalId,
        projectName: d.projectName,
        environment: d.environment,
        status: d.status,
        url: d.url,
        commitSha: d.commitSha,
        branch: d.branch,
        creator: d.creator,
        startedAt: d.startedAt.toISOString(),
        finishedAt: d.finishedAt?.toISOString() ?? null,
      })),
    },
  });
}
