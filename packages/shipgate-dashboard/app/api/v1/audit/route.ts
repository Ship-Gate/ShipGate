import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/audit — list audit events (org-scoped, admin-only).
 * Query: orgId (required), type (action filter), actor (userId), from, to (ISO dates), page, limit.
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json(
      { error: 'orgId is required' },
      { status: 400 }
    );
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const type = req.nextUrl.searchParams.get('type') ?? undefined;
  const actor = req.nextUrl.searchParams.get('actor') ?? undefined;
  const from = req.nextUrl.searchParams.get('from') ?? undefined;
  const to = req.nextUrl.searchParams.get('to') ?? undefined;
  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 20));

  const where: {
    orgId: string;
    action?: string;
    userId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { orgId };

  if (type) where.action = type;
  if (actor) where.userId = actor;
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [records, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    ok: true,
    data: records,
    pagination: { page, limit, total, totalPages },
  });
}
