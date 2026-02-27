import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const provider = await prisma.deploymentProvider.findUnique({
    where: { id: params.id },
  });

  if (!provider || !auth.orgIds.includes(provider.orgId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, provider.orgId, ['admin']);
  if (roleErr) return roleErr;

  await prisma.deploymentProvider.delete({ where: { id: params.id } });

  return NextResponse.json({ data: { deleted: true } });
}
