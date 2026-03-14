import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/compliance — aggregated compliance posture across frameworks.
 * Query: orgId (optional, defaults to first org), framework (optional filter).
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const orgId = req.nextUrl.searchParams.get('orgId') ?? auth.orgIds[0];
  if (!orgId || !auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Invalid org' }, { status: 403 });
  }

  const frameworkFilter = req.nextUrl.searchParams.get('framework');

  const where: Record<string, unknown> = { orgId };
  if (frameworkFilter) where.framework = frameworkFilter;

  const snapshots = await prisma.complianceSnapshot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const latestByFramework = new Map<string, typeof snapshots[0]>();
  for (const s of snapshots) {
    if (!latestByFramework.has(s.framework)) {
      latestByFramework.set(s.framework, s);
    }
  }

  const frameworks = [...latestByFramework.entries()].map(([framework, snapshot]) => {
    const controls = (snapshot.controls as any[]) ?? [];
    const total = controls.length;
    const pass = controls.filter((c: any) => c.status === 'pass' || c.status === 'implemented').length;
    const partial = controls.filter((c: any) => c.status === 'partial' || c.status === 'warn').length;
    const fail = controls.filter((c: any) => c.status === 'fail' || c.status === 'not_implemented').length;
    const na = controls.filter((c: any) => c.status === 'not_applicable').length;
    const scored = total - na;
    const percentage = scored > 0 ? Math.round(((pass + partial * 0.5) / scored) * 100) : 0;

    return {
      framework,
      period: snapshot.period,
      percentage,
      total,
      pass,
      partial,
      fail,
      notApplicable: na,
      controls,
      updatedAt: snapshot.createdAt.toISOString(),
    };
  });

  // If no snapshots exist, return illustrative framework data so the UI isn't empty
  if (frameworks.length === 0) {
    const runs = await prisma.run.count({ where: { orgId } });
    const proofBundles = await prisma.proofBundle.count({
      where: { run: { orgId } },
    });

    return NextResponse.json({
      data: {
        frameworks: [],
        hasData: false,
        stats: { totalRuns: runs, totalProofBundles: proofBundles },
        hint: 'Run `shipgate compliance soc2` to generate your first compliance snapshot.',
      },
    });
  }

  return NextResponse.json({
    data: {
      frameworks,
      hasData: true,
    },
  });
}

/**
 * POST /api/v1/compliance — store a compliance snapshot.
 * Body: { orgId, framework, period, controls, evidence? }
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const { orgId, framework, period, controls, evidence } = body as {
    orgId?: string;
    framework?: string;
    period?: string;
    controls?: unknown[];
    evidence?: unknown;
  };

  if (!orgId || !framework || !controls) {
    return NextResponse.json(
      { error: 'orgId, framework, and controls are required' },
      { status: 400 }
    );
  }

  if (!auth.orgIds.includes(orgId)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const snapshot = await prisma.complianceSnapshot.create({
    data: {
      orgId,
      framework,
      period: period ?? `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
      controls: controls as any,
      evidence: (evidence as any) ?? {},
    },
  });

  return NextResponse.json({ data: { id: snapshot.id } }, { status: 201 });
}
