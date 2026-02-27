import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { getGitHubToken, githubFetch } from '@/lib/github';

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  default_branch: string;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const creds = await getGitHubToken(auth.orgIds);
  if (!creds) {
    return NextResponse.json({
      data: { connected: false, repos: [] },
    });
  }

  const repos = await githubFetch<GHRepo[]>(
    creds.token,
    '/user/repos?sort=updated&per_page=30&type=all'
  );

  return NextResponse.json({
    data: {
      connected: true,
      repos: (repos ?? []).map((r) => ({
        id: r.id,
        fullName: r.full_name,
        name: r.name,
        private: r.private,
        url: r.html_url,
        description: r.description,
        language: r.language,
        updatedAt: r.updated_at,
        defaultBranch: r.default_branch,
      })),
    },
  });
}
