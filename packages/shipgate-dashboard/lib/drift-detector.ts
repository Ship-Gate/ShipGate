import { prisma } from '@/lib/prisma';

export type DriftResult = {
  drifted: boolean;
  lastVerifiedAt: Date | null;
  lastBundleId: string | null;
  currentCodeHash: string | null;
  proofBundleHash: string | null;
  staleDepCount: number;
  daysSinceVerification: number | null;
};

/**
 * Check whether a project has drifted from its last verified state.
 *
 * Drift is detected when:
 *  1. A deployment has occurred after the latest completed verification run.
 *  2. The latest proof bundle's artifact hash no longer matches the current code artifact.
 *  3. No verification has ever been completed for the project.
 */
export async function checkDrift(projectId: string): Promise<DriftResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });

  if (!project) {
    return emptyDriftResult(true);
  }

  const lastVerifiedRun = await prisma.run.findFirst({
    where: {
      projectId,
      status: 'completed',
      verdict: { not: null },
    },
    orderBy: { finishedAt: 'desc' },
    select: {
      id: true,
      finishedAt: true,
      commitSha: true,
    },
  });

  if (!lastVerifiedRun || !lastVerifiedRun.finishedAt) {
    return emptyDriftResult(true);
  }

  const lastBundle = await prisma.proofBundle.findFirst({
    where: { runId: lastVerifiedRun.id, kind: 'proof_bundle' },
    orderBy: { createdAt: 'desc' },
    select: { id: true, summaryJson: true, createdAt: true },
  });

  const bundleArtifact = await prisma.artifact.findFirst({
    where: { runId: lastVerifiedRun.id, kind: 'proof_bundle' },
    orderBy: { createdAt: 'desc' },
    select: { sha256: true },
  });

  const latestDeployment = await getLatestDeployment(project.orgId, projectId);

  const deployedAfterVerification =
    latestDeployment?.finishedAt &&
    lastVerifiedRun.finishedAt &&
    latestDeployment.finishedAt > lastVerifiedRun.finishedAt;

  const latestCodeArtifact = await prisma.artifact.findFirst({
    where: { run: { projectId, status: 'completed' } },
    orderBy: { createdAt: 'desc' },
    select: { sha256: true },
  });

  const hashMismatch =
    bundleArtifact?.sha256 &&
    latestCodeArtifact?.sha256 &&
    bundleArtifact.sha256 !== latestCodeArtifact.sha256;

  const staleDepCount = await countStaleFindings(projectId, lastVerifiedRun.finishedAt);

  const daysSinceVerification = daysBetween(lastVerifiedRun.finishedAt, new Date());

  return {
    drifted: Boolean(deployedAfterVerification || hashMismatch),
    lastVerifiedAt: lastVerifiedRun.finishedAt,
    lastBundleId: lastBundle?.id ?? null,
    currentCodeHash: latestCodeArtifact?.sha256 ?? null,
    proofBundleHash: bundleArtifact?.sha256 ?? null,
    staleDepCount,
    daysSinceVerification,
  };
}

async function getLatestDeployment(orgId: string, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return null;

  return prisma.deployment.findFirst({
    where: {
      provider: { orgId },
      projectName: project.name,
      status: 'success',
    },
    orderBy: { finishedAt: 'desc' },
    select: { finishedAt: true, commitSha: true },
  });
}

/**
 * Count dependency-related findings that were created after the last verification.
 */
async function countStaleFindings(projectId: string, since: Date): Promise<number> {
  return prisma.finding.count({
    where: {
      run: { projectId, startedAt: { gt: since } },
      category: { in: ['dependency-update', 'stale-dependency', 'advisory'] },
    },
  });
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function emptyDriftResult(drifted: boolean): DriftResult {
  return {
    drifted,
    lastVerifiedAt: null,
    lastBundleId: null,
    currentCodeHash: null,
    proofBundleHash: null,
    staleDepCount: 0,
    daysSinceVerification: null,
  };
}
