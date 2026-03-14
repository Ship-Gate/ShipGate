import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { auditLog } from '@/lib/audit';
import { runProvenanceScan } from '@/lib/provenance';
import { incrementScanUsage, ScanLimitError } from '@/lib/license';

/**
 * POST /api/v1/provenance/scan — trigger a provenance scan.
 *
 * Counts against the user's monthly scan quota (free tier: 25/month).
 *
 * Body:
 *   cwd       - project root path (required)
 *   projectId - dashboard project ID (optional, for audit trail)
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { cwd?: string; projectId?: string };

  if (!body.cwd) {
    return NextResponse.json(
      { error: 'cwd is required in request body' },
      { status: 400 },
    );
  }

  try {
    await incrementScanUsage(auth.userId);
  } catch (err) {
    if (err instanceof ScanLimitError) {
      return NextResponse.json(
        {
          error: 'scan_limit_reached',
          message: err.message,
          upgradeUrl: `${req.nextUrl.origin}/checkout`,
        },
        { status: 402 },
      );
    }
    throw err;
  }

  try {
    const startTime = Date.now();
    const summary = await runProvenanceScan(body.cwd);
    const durationMs = Date.now() - startTime;

    auditLog(req, auth, 'provenance.scan', `project:${body.projectId ?? 'local'}`, undefined, {
      cwd: body.cwd,
      totalLines: summary.totalLines,
      aiPercentage: summary.aiPercentage,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      data: {
        summary,
        meta: { durationMs, scannedAt: new Date().toISOString() },
      },
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
