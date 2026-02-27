import { NextRequest, NextResponse } from 'next/server';
import { authenticate } from '@/lib/api-auth';
import { getGitHubToken, githubFetch } from '@/lib/github';
import { prisma } from '@/lib/prisma';

interface GHCommit {
  sha: string;
  html_url: string;
  commit: {
    message: string;
    author: { name: string; date: string };
  };
  author: { login: string; avatar_url: string } | null;
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  const creds = await getGitHubToken(auth.orgIds);
  if (!creds) {
    return NextResponse.json({ data: { connected: false, commits: [] } });
  }

  const limit = Math.min(
    Number(req.nextUrl.searchParams.get('limit') ?? '15'),
    30
  );

  const projects = await prisma.project.findMany({
    where: { orgId: { in: auth.orgIds }, repoUrl: { not: null } },
    select: { repoUrl: true, defaultBranch: true },
  });

  const repoSlugs = projects
    .map((p) => {
      if (!p.repoUrl) return null;
      const match = p.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
      return match?.[1]?.replace(/\.git$/, '') ?? null;
    })
    .filter(Boolean) as string[];

  const allCommits: Array<GHCommit & { repo: string }> = [];
  for (const slug of repoSlugs.slice(0, 5)) {
    const commits = await githubFetch<GHCommit[]>(
      creds.token,
      `/repos/${slug}/commits?per_page=10`
    );
    if (commits) {
      allCommits.push(...commits.map((c) => ({ ...c, repo: slug })));
    }
  }

  allCommits.sort(
    (a, b) =>
      new Date(b.commit.author.date).getTime() -
      new Date(a.commit.author.date).getTime()
  );

  return NextResponse.json({
    data: {
      connected: true,
      commits: allCommits.slice(0, limit).map((c) => ({
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        url: c.html_url,
        message: c.commit.message.split('\n')[0],
        author: c.author?.login ?? c.commit.author.name,
        authorAvatar: c.author?.avatar_url ?? null,
        date: c.commit.author.date,
        repo: c.repo,
      })),
    },
  });
}
