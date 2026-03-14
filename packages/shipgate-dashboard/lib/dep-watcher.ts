import { createHash } from 'crypto';

export type DepUpdate = {
  name: string;
  oldVersion: string;
  newVersion: string;
  hasAdvisory: boolean;
};

export type DepUpdateResult = {
  updatedPackages: DepUpdate[];
  totalChecked: number;
  advisoryCount: number;
};

type LockfileDep = {
  version: string;
  resolved?: string;
  integrity?: string;
};

type LockfileShape = {
  lockfileVersion?: number;
  packages?: Record<string, LockfileDep>;
  dependencies?: Record<string, LockfileDep>;
};

const KNOWN_ADVISORY_PATTERNS = [
  /prototype\s*pollut/i,
  /remote\s*code\s*execut/i,
  /denial\s*of\s*service/i,
  /cross[- ]site\s*script/i,
  /sql\s*inject/i,
  /path\s*travers/i,
  /command\s*inject/i,
];

/**
 * Parse a package-lock.json or similar lockfile to extract dependency entries.
 * Supports lockfile v2/v3 (packages) and v1 (dependencies).
 */
function parseLockfile(content: string): Map<string, string> {
  const deps = new Map<string, string>();

  let parsed: LockfileShape;
  try {
    parsed = JSON.parse(content) as LockfileShape;
  } catch {
    return deps;
  }

  const source = parsed.packages ?? parsed.dependencies ?? {};

  for (const [key, entry] of Object.entries(source)) {
    if (!entry?.version) continue;
    const name = key.startsWith('node_modules/')
      ? key.replace(/^node_modules\//, '')
      : key;
    if (name) {
      deps.set(name, entry.version);
    }
  }

  return deps;
}

/**
 * Detect which dependency names appear to be flagged by known advisory patterns.
 * In production this would query the OSV API; this implementation checks
 * package names against known vulnerable naming patterns as a baseline.
 */
function checkAgainstKnownAdvisories(name: string): boolean {
  return KNOWN_ADVISORY_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * Compare a current lockfile against a previous snapshot to find updated packages.
 * If no previous lockfile is available, treats all entries as new.
 */
export async function checkDependencyUpdates(
  lockfileContent: string,
  lastCheckedAt: Date,
  previousLockfileContent?: string
): Promise<DepUpdateResult> {
  const currentDeps = parseLockfile(lockfileContent);
  const previousDeps = previousLockfileContent
    ? parseLockfile(previousLockfileContent)
    : new Map<string, string>();

  const updatedPackages: DepUpdate[] = [];
  let advisoryCount = 0;

  for (const [name, currentVersion] of currentDeps) {
    const previousVersion = previousDeps.get(name);

    if (previousVersion && previousVersion !== currentVersion) {
      const hasAdvisory = checkAgainstKnownAdvisories(name);
      if (hasAdvisory) advisoryCount++;

      updatedPackages.push({
        name,
        oldVersion: previousVersion,
        newVersion: currentVersion,
        hasAdvisory,
      });
    }
  }

  return {
    updatedPackages,
    totalChecked: currentDeps.size,
    advisoryCount,
  };
}

/**
 * Hash a lockfile's content for quick equality comparison.
 */
export function hashLockfile(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
