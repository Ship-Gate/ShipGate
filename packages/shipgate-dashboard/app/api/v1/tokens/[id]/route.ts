import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireAdminOrMember } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireAdminOrMember(auth);
  if (roleErr) return roleErr;

  const token = await prisma.personalAccessToken.findUnique({
    where: { id: params.id },
  });

  if (!token || token.userId !== auth.userId) {
    return NextResponse.json({ error: 'Token not found' }, { status: 404 });
  }

  auditLog(req, auth, 'token.revoked', `token:${params.id}`);

  await prisma.personalAccessToken.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { ok: true } });
}
