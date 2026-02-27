import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { getGitHubToken, githubFetch } from '@/lib/github';
import { prisma } from '@/lib/prisma';

interface GHPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  draft: boolean;
  user: { login: string; avatar_url: string };
  labels: Array<{ name: string; color: string }>;
  head: { ref: string };
  base: { ref: string; repo: { full_name: string } };
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const creds = await getGitHubToken(auth.orgIds);
  if (!creds) {
    return NextResponse.json({ data: { connected: false, prs: [] } });
  }

  const projects = await prisma.project.findMany({
    where: { orgId: { in: auth.orgIds }, repoUrl: { not: null } },
    select: { repoUrl: true },
  });

  const repoSlugs = projects
    .map((p) => {
      if (!p.repoUrl) return null;
      const match = p.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      return match?.[1]?.replace(/\.git$/, '') ?? null;
    })
    .filter(Boolean) as string[];

  const allPrs: GHPullRequest[] = [];
  for (const slug of repoSlugs.slice(0, 10)) {
    const prs = await githubFetch<GHPullRequest[]>(
      creds.token,
      `/repos/${slug}/pulls?state=open&per_page=10&sort=updated`
    );
    if (prs) allPrs.push(...prs);
  }

  allPrs.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return NextResponse.json({
    data: {
      connected: true,
      prs: allPrs.slice(0, 25).map((pr) => ({
        id: pr.id,
        number: pr.number,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
        url: pr.html_url,
        repo: pr.base.repo.full_name,
        author: pr.user.login,
        authorAvatar: pr.user.avatar_url,
        branch: pr.head.ref,
        baseBranch: pr.base.ref,
        labels: pr.labels.map((l) => ({ name: l.name, color: l.color })),
        createdAt: pr.created_at,
        updatedAt: pr.updated_at,
      })),
    },
  });
}
