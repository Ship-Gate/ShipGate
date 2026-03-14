import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { exportProvenanceCSV, exportProvenanceJSON } from '@/lib/provenance';

/**
 * GET /api/v1/provenance/export — bulk export provenance data.
 *
 * Query params:
 *   cwd    - project root path (required)
 *   format - csv or json (default: csv)
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

  const format = req.nextUrl.searchParams.get('format') ?? 'csv';

  try {
    if (format === 'json') {
      const json = await exportProvenanceJSON(cwd);
      return new NextResponse(json, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="provenance-export.json"',
        },
      });
    }

    const csv = await exportProvenanceCSV(cwd);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="provenance-export.csv"',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
