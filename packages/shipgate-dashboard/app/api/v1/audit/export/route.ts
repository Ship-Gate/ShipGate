import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

function escapeCsvCell(value: string | number | null | undefined): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function auditRecordsToCsv(
  records: Array<{
    id: string;
    userId: string;
    action: string;
    resource: string | null;
    orgId: string | null;
    metaJson: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    requestId: string | null;
    sessionId: string | null;
    createdAt: Date;
  }>
): string {
  const headers = [
    'id',
    'userId',
    'action',
    'resource',
    'orgId',
    'ipAddress',
    'userAgent',
    'requestId',
    'createdAt',
    'metaJson',
  ];
  const rows = records.map((r) =>
    headers
      .map((h) => {
        const v = (r as Record<string, unknown>)[h];
        return escapeCsvCell(v instanceof Date ? v.toISOString() : (v as string));
      })
      .join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/**
 * GET /api/v1/audit/export — export audit log (org-scoped, admin-only).
 * Query: orgId (required), type, actor, from, to, format=csv|json (default json).
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
  const format = (req.nextUrl.searchParams.get('format') ?? 'json') as 'csv' | 'json';

  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'format must be csv or json' },
      { status: 400 }
    );
  }

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

  const records = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 10_000,
  });

  if (format === 'csv') {
    const csv = auditRecordsToCsv(records);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-log-${orgId.slice(0, 8)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    data: records,
  });
}
