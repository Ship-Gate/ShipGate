import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';

/**
 * GET /api/v1/provenance/trends — attribution trends over time.
 *
 * Returns weekly/monthly data points showing AI adoption trajectory.
 *
 * Query params:
 *   cwd      - project root path (required)
 *   period   - weekly or monthly (default: weekly)
 *   limit    - number of periods to return (default: 12)
 */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const cwd = req.nextUrl.searchParams.get('cwd');
  if (!cwd) {
    return NextResponse.json(
      { error: 'cwd query parameter is required' },
      { status: 400 },
    );
  }

  const period = req.nextUrl.searchParams.get('period') ?? 'weekly';
  const limit = Math.min(52, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 12));

  try {
    const { execSync } = await import('child_process');
    const { buildSingleFileAttribution, listTrackedFiles, CommitCache, detectConfigSignals, loadProvenanceSession } = await import('@isl-lang/code-provenance');

    const now = new Date();
    const points: Array<{ date: string; totalCommits: number; aiCommits: number; aiPercentage: number }> = [];

    const intervalDays = period === 'monthly' ? 30 : 7;

    const ctx = {
      cwd,
      provenanceSession: loadProvenanceSession(cwd),
      configSignals: detectConfigSignals(cwd),
    };
    const commitCache = new CommitCache(ctx);

    for (let i = limit - 1; i >= 0; i--) {
      const end = new Date(now.getTime() - i * intervalDays * 24 * 60 * 60 * 1000);
      const start = new Date(end.getTime() - intervalDays * 24 * 60 * 60 * 1000);

      const afterDate = start.toISOString().split('T')[0];
      const beforeDate = end.toISOString().split('T')[0];

      try {
        const logOutput = execSync(
          `git log --after="${afterDate}" --before="${beforeDate}" --format="%H" --no-merges`,
          { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
        );

        const hashes = logOutput.split('\n').filter(Boolean);
        let aiCommits = 0;

        for (const hash of hashes) {
          const cached = commitCache.get(hash);
          if (cached?.agent) aiCommits++;
        }

        points.push({
          date: beforeDate!,
          totalCommits: hashes.length,
          aiCommits,
          aiPercentage: hashes.length > 0 ? Math.round((aiCommits / hashes.length) * 100) : 0,
        });
      } catch {
        points.push({
          date: beforeDate!,
          totalCommits: 0,
          aiCommits: 0,
          aiPercentage: 0,
        });
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        period,
        points,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
