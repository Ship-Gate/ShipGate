import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireOrgRole(auth, params.orgId, ['admin']);
  if (roleErr) return roleErr;

  const body = await req.json();
  const { role } = body as { role?: string };

  if (!role || !['admin', 'member', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: 'Role must be admin, member, or viewer' },
      { status: 400 }
    );
  }

  const membership = await prisma.membership.findUnique({
    where: { id: params.memberId },
  });

  if (!membership || membership.orgId !== params.orgId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (membership.userId === auth.userId && role !== 'admin') {
    const adminCount = await prisma.membership.count({
      where: { orgId: params.orgId, role: 'admin' },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin. Promote another member first.' },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.membership.update({
    where: { id: params.memberId },
    data: { role: role as 'admin' | 'member' | 'viewer' },
  });

  return NextResponse.json({ data: { id: updated.id, role: updated.role } });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { orgId: string; memberId: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireOrgRole(auth, params.orgId, ['admin']);
  if (roleErr) return roleErr;

  const membership = await prisma.membership.findUnique({
    where: { id: params.memberId },
  });

  if (!membership || membership.orgId !== params.orgId) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (membership.userId === auth.userId) {
    const adminCount = await prisma.membership.count({
      where: { orgId: params.orgId, role: 'admin' },
    });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove yourself as the last admin' },
        { status: 400 }
      );
    }
  }

  await prisma.membership.delete({ where: { id: params.memberId } });

  return NextResponse.json({ data: { removed: true } });
}
