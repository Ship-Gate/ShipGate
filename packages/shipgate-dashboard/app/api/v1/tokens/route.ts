import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { authenticate, hashToken, requireAdminOrMember } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireAdminOrMember(auth);
  if (roleErr) return roleErr;

  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId: auth.userId },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ data: tokens });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const roleErr = requireAdminOrMember(auth);
  if (roleErr) return roleErr;

  const body = (await req.json()) as { name?: string; expiresInDays?: number };
  const name = body.name?.trim() || 'Unnamed token';

  const rawToken = `sg_${randomBytes(32).toString('hex')}`;
  const tokenHash = hashToken(rawToken);
  const prefix = rawToken.slice(0, 11);
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const pat = await prisma.personalAccessToken.create({
    data: {
      userId: auth.userId,
      name,
      tokenHash,
      prefix,
      expiresAt,
    },
  });

  auditLog(req, auth, 'token.created', `token:${pat.id}`, undefined, { name: pat.name });

  // Return the raw token only on creation (never again)
  return NextResponse.json(
    {
      data: {
        id: pat.id,
        name: pat.name,
        token: rawToken,
        prefix: pat.prefix,
        expiresAt: pat.expiresAt?.toISOString() ?? null,
        createdAt: pat.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
