import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const providers = await prisma.deploymentProvider.findMany({
    where: { orgId: { in: auth.orgIds } },
    select: {
      id: true,
      provider: true,
      projectFilter: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    data: {
      providers: providers.map((p: { id: string; provider: string; projectFilter: string | null; createdAt: Date }) => ({
        id: p.id,
        provider: p.provider,
        projectFilter: p.projectFilter,
        createdAt: p.createdAt.toISOString(),
      })),
    },
  });
}
