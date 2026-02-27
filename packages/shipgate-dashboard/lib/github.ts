import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export interface GitHubConnectionInfo {
  id: string;
  login: string;
  avatarUrl: string | null;
  scope: string;
  createdAt: Date;
}

/**
 * Get all GitHub connections for the given org IDs.
 */
export async function getGitHubConnections(orgIds: string[]) {
  return prisma.gitHubConnection.findMany({
    where: { orgId: { in: orgIds } },
    select: {
      id: true,
      orgId: true,
      login: true,
      avatarUrl: true,
      scope: true,
      createdAt: true,
      accessToken: true,
    },
  });
}

/**
 * Get a decrypted access token for the first connection in the given orgs.
 * Returns null if no connection exists.
 */
export async function getGitHubToken(
  orgIds: string[]
): Promise<{ token: string; login: string } | null> {
  const conn = await prisma.gitHubConnection.findFirst({
    where: { orgId: { in: orgIds } },
    select: { accessToken: true, login: true },
  });
  if (!conn) return null;
  return { token: decrypt(conn.accessToken), login: conn.login };
}

/**
 * Fetch from the GitHub API using a decrypted token.
 */
export async function githubFetch<T>(
  token: string,
  path: string
): Promise<T | null> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json() as Promise<T>;
}
