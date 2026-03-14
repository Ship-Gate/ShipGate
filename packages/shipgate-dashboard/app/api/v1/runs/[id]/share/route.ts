import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { createHash, randomBytes } from 'crypto';

/**
 * POST /api/v1/runs/[id]/share — generate a shareable link token for a run.
 * Only admin/member can create share links.
 * Returns a token that can be used with GET /api/v1/shared/[token].
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.run.findUnique({
    where: { id: params.id },
    select: { orgId: true },
  });

  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, run.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const token = randomBytes(24).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  const body = await req.json().catch(() => ({}));
  const expiresInHours = (body as any)?.expiresInHours ?? 72;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  await prisma.artifact.create({
    data: {
      runId: params.id,
      kind: 'share_token',
      path: tokenHash,
      sha256: tokenHash,
      sizeBytes: expiresInHours,
    },
  });

  const baseUrl = req.nextUrl.origin;
  const shareUrl = `${baseUrl}/shared/${token}`;

  return NextResponse.json({
    data: {
      shareUrl,
      token,
      expiresAt: expiresAt.toISOString(),
    },
  }, { status: 201 });
}
