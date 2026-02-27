import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getLicenseStatus } from '@/lib/license';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      memberships: { include: { org: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const license = await getLicenseStatus(auth.userId);

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      provider: user.provider,
      createdAt: user.createdAt.toISOString(),
      isPro: license.isPro,
      scansUsed: license.scansUsed,
      scansLimit: license.scansLimit,
      canScan: license.canScan,
      orgs: user.memberships.map((m) => ({
        id: m.org.id,
        name: m.org.name,
        role: m.role,
      })),
    },
  });
}
