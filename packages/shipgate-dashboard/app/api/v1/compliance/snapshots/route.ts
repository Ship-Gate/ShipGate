import { NextRequest, NextResponse } from 'next/server';
import { authenticate, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId');
  if (!orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, orgId, ['admin']);
  if (roleErr) return roleErr;

  const snapshots = await prisma.complianceSnapshot.findMany({
    where: { orgId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return NextResponse.json({ ok: true, data: snapshots });
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { orgId: string };
  if (!body.orgId) {
    return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
  }

  const roleErr = requireOrgRole(auth, body.orgId, ['admin']);
  if (roleErr) return roleErr;

  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)}`;
  const period = `${now.getFullYear()}-${quarter}`;

  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3001';

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const cookie = req.cookies.get('shipgate-session')?.value;
  if (cookie) headers['Cookie'] = `shipgate-session=${cookie}`;
  const authHeader = req.headers.get('authorization');
  if (authHeader) headers['Authorization'] = authHeader;

  const [evidenceRes, controlsRes] = await Promise.all([
    fetch(`${baseUrl}/api/v1/compliance/evidence?orgId=${body.orgId}`, {
      headers,
    }).then((r) => r.json()),
    fetch(`${baseUrl}/api/v1/compliance/controls?orgId=${body.orgId}`, {
      headers,
    }).then((r) => r.json()),
  ]);

  const snapshot = await prisma.complianceSnapshot.create({
    data: {
      orgId: body.orgId,
      period,
      framework: 'soc2',
      controls: controlsRes.data ?? {},
      evidence: evidenceRes.data ?? {},
    },
  });

  auditLog(req, auth, 'compliance.snapshot_created', `snapshot:${snapshot.id}`, body.orgId, {
    period,
    framework: 'soc2',
  });

  return NextResponse.json({ ok: true, data: snapshot }, { status: 201 });
}
