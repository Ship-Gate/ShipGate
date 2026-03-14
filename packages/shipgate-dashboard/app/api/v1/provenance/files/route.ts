import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { getProvenanceFiles, getProvenanceFileDetail } from '@/lib/provenance';

/**
 * GET /api/v1/provenance/files — list files with attribution stats.
 *
 * Query params:
 *   cwd  - project root path (required)
 *   path - specific file path for line-level detail (optional)
 *   sort - sort by: ai_percentage, total_lines, path (default: ai_percentage)
 *   order - asc or desc (default: desc)
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

  const filePath = req.nextUrl.searchParams.get('path');

  try {
    if (filePath) {
      const detail = await getProvenanceFileDetail(cwd, filePath);
      return NextResponse.json({ ok: true, data: detail });
    }

    const sortBy = req.nextUrl.searchParams.get('sort') ?? 'ai_percentage';
    const order = req.nextUrl.searchParams.get('order') ?? 'desc';

    let files = await getProvenanceFiles(cwd);

    if (sortBy === 'ai_percentage') {
      files.sort((a, b) => order === 'desc' ? b.aiPercentage - a.aiPercentage : a.aiPercentage - b.aiPercentage);
    } else if (sortBy === 'total_lines') {
      files.sort((a, b) => order === 'desc' ? b.totalLines - a.totalLines : a.totalLines - b.totalLines);
    } else if (sortBy === 'path') {
      files.sort((a, b) => order === 'desc' ? b.path.localeCompare(a.path) : a.path.localeCompare(b.path));
    }

    return NextResponse.json({
      ok: true,
      data: files,
      meta: { total: files.length },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
