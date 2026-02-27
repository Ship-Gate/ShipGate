import { NextRequest, NextResponse } from 'next/server';
import { authenticate, assertOrgAccess, requireOrgRole } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { auditLog } from '@/lib/audit';
import type { Prisma } from '@prisma/client';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.run.findUnique({ where: { id: params.id } });
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const orgErr = assertOrgAccess(auth, run.orgId);
  if (orgErr) return orgErr;

  const findings = await prisma.finding.findMany({
    where: { runId: params.id },
    orderBy: { severity: 'asc' },
  });

  return NextResponse.json({ data: findings });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const run = await prisma.run.findUnique({ where: { id: params.id } });
  if (!run) {
    return NextResponse.json({ error: 'Run not found' }, { status: 404 });
  }

  const roleErr = requireOrgRole(auth, run.orgId, ['admin', 'member']);
  if (roleErr) return roleErr;

  const body = (await req.json()) as {
    findings: Array<{
      severity: string;
      category: string;
      title: string;
      filePath?: string;
      lineStart?: number;
      lineEnd?: number;
      message: string;
      fingerprint: string;
      confidence?: number;
      meta?: Record<string, unknown>;
    }>;
  };

  if (!Array.isArray(body.findings) || body.findings.length === 0) {
    return NextResponse.json({ error: 'findings array is required' }, { status: 400 });
  }

  const created = await prisma.finding.createMany({
    data: body.findings.map((f) => ({
      runId: params.id,
      severity: f.severity,
      category: f.category,
      title: f.title,
      filePath: f.filePath ?? null,
      lineStart: f.lineStart ?? null,
      lineEnd: f.lineEnd ?? null,
      message: f.message,
      fingerprint: f.fingerprint,
      confidence: f.confidence ?? null,
      metaJson: f.meta as Prisma.InputJsonValue | undefined,
    })),
  });

  auditLog(req, auth, 'findings.uploaded', `run:${params.id}`, run.orgId, { count: created.count });

  return NextResponse.json(
    { data: { count: created.count } },
    { status: 201 }
  );
}
