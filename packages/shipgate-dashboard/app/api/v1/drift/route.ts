import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { checkDrift } from '@/lib/drift-detector';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'projectId query parameter is required' },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const orgErr = assertOrgAccess(auth, project.orgId);
  if (orgErr) return orgErr;

  const drift = await checkDrift(projectId);

  return NextResponse.json({
    data: {
      drifted: drift.drifted,
      lastVerifiedAt: drift.lastVerifiedAt?.toISOString() ?? null,
      currentHash: drift.currentCodeHash,
      verifiedHash: drift.proofBundleHash,
      daysSinceVerification: drift.daysSinceVerification,
      lastBundleId: drift.lastBundleId,
      staleDepCount: drift.staleDepCount,
    },
  });
}
