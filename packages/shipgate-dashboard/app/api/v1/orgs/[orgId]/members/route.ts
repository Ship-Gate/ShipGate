import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireOrgRole(auth, params.orgId, ['admin', 'member', 'viewer']);
  if (roleErr) return roleErr;

  const memberships = await prisma.membership.findMany({
    where: { orgId: params.orgId },
    include: {
      user: {
        select: { id: true, email: true, name: true, avatar: true, provider: true, createdAt: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const members = memberships.map((m) => ({
    membershipId: m.id,
    userId: m.user.id,
    email: m.user.email,
    name: m.user.name,
    avatar: m.user.avatar,
    provider: m.user.provider,
    role: m.role,
    joinedAt: m.user.createdAt.toISOString(),
  }));

  return NextResponse.json({ data: members });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireOrgRole(auth, params.orgId, ['admin']);
  if (roleErr) return roleErr;

  const body = await req.json();
  const { email, role = 'member' } = body as { email?: string; role?: string };

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  if (!['admin', 'member', 'viewer'].includes(role)) {
    return NextResponse.json(
      { error: 'Role must be admin, member, or viewer' },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: `No user found with email ${email}. They must sign in to ShipGate first.` },
      { status: 404 }
    );
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId: params.orgId } },
  });
  if (existing) {
    return NextResponse.json(
      { error: 'User is already a member of this organization' },
      { status: 409 }
    );
  }

  const membership = await prisma.membership.create({
    data: {
      userId: user.id,
      orgId: params.orgId,
      role: role as 'admin' | 'member' | 'viewer',
    },
  });

  return NextResponse.json(
    {
      data: {
        membershipId: membership.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        role: membership.role,
      },
    },
    { status: 201 }
  );
}
