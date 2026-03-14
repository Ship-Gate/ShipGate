import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { runProvenanceScan } from '@/lib/provenance';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/v1/provenance — project-level attribution summary.
 *
 * Serves stored provenance data when projectId is provided (production mode),
 * or runs a live scan when cwd is provided (local dev mode).
 *
 * Query params:
 *   projectId - dashboard project ID (serves stored data)
 *   cwd       - project root path (runs live scan, local dev only)
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const projectId = req.nextUrl.searchParams.get('projectId');
  const cwd = req.nextUrl.searchParams.get('cwd');

  if (!projectId && !cwd) {
    return NextResponse.json(
      { error: 'projectId or cwd query parameter is required' },
      { status: 400 },
    );
  }

  try {
    if (projectId) {
      const stored = await prisma.provenanceScan.findFirst({
        where: {
          projectId,
          project: { orgId: { in: auth.orgIds } },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!stored) {
        return NextResponse.json(
          { ok: false, error: 'No provenance scan found for this project. Run `shipgate provenance --upload` to submit one.' },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true, data: stored.dataJson });
    }

    const summary = await runProvenanceScan(cwd!);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
