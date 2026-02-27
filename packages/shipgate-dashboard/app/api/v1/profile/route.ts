import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { name?: string };
  const name = body.name?.trim();

  if (!name || name.length < 1 || name.length > 100) {
    return NextResponse.json(
      { error: 'Name must be between 1 and 100 characters' },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: { name },
    select: { id: true, name: true, email: true, avatar: true, provider: true },
  });

  return NextResponse.json({ data: user });
}
