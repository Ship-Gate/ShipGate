export interface PackageEntry {
  name: string;
  version: string;
  integrity?: string;
}

type LockfileType = 'pnpm' | 'npm' | 'yarn';

export function detectLockfileType(filename: string): LockfileType | null {
  const basename = filename.split('/').pop() ?? filename;
  if (basename === 'pnpm-lock.yaml') return 'pnpm';
  if (basename === 'package-lock.json') return 'npm';
  if (basename === 'yarn.lock') return 'yarn';
  return null;
}

export function parseLockfile(filename: string, content: string): PackageEntry[] {
  const type = detectLockfileType(filename);
  if (!type) {
    throw new Error(`Unrecognized lockfile: ${filename}`);
  }

  switch (type) {
    case 'pnpm':
      return parsePnpmLock(content);
    case 'npm':
      return parsePackageLock(content);
    case 'yarn':
      return parseYarnLock(content);
  }
}

/**
 * Parses pnpm-lock.yaml (v6+ format) without a YAML library.
 *
 * The packages section uses keys like:
 *   /@scope/name@version or /name@version
 * In v9+ the `packages:` section uses `name@version:` keys and
 * a separate `snapshots:` section. We handle both.
 */
export function parsePnpmLock(content: string): PackageEntry[] {
  const entries: PackageEntry[] = [];
  const seen = new Set<string>();
  const lines = content.split('\n');

  let inPackagesSection = false;
  let inSnapshotsSection = false;
  let currentIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trimStart();

    if (trimmed === 'packages:' || trimmed === 'packages: {}') {
      inPackagesSection = trimmed === 'packages:';
      inSnapshotsSection = false;
      continue;
    }

    if (trimmed === 'snapshots:' || trimmed === 'snapshots: {}') {
      inPackagesSection = false;
      inSnapshotsSection = trimmed === 'snapshots:';
      continue;
    }

    if (/^\S/.test(line) && !trimmed.startsWith('#')) {
      if (inPackagesSection || inSnapshotsSection) {
        inPackagesSection = false;
        inSnapshotsSection = false;
      }
    }

    if (!inPackagesSection && !inSnapshotsSection) continue;

    const indent = line.length - line.trimStart().length;

    // v6/v7: /@scope/pkg@version: or /pkg@version:
    const v6Match = trimmed.match(/^['"]?\/((?:@[^/@]+\/)?[^/@]+)@([^:('"]+)/);
    if (v6Match) {
      const name = v6Match[1]!;
      const version = v6Match[2]!.replace(/['"]$/, '');
      const key = `${name}@${version}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ name, version, integrity: findIntegrity(lines, i + 1, indent) });
      }
      currentIndent = indent;
      continue;
    }

    // v9+: 'pkg@version': or '@scope/pkg@version':
    const v9Match = trimmed.match(/^['"]?((?:@[^/@]+\/)?[^/@]+)@([^:('"]+)/);
    if (v9Match && trimmed.endsWith(':')) {
      const name = v9Match[1]!;
      let version = v9Match[2]!;
      version = version.replace(/['":]/g, '').trim();
      const key = `${name}@${version}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ name, version, integrity: findIntegrity(lines, i + 1, indent) });
      }
      currentIndent = indent;
      continue;
    }
  }

  return entries;
}

function findIntegrity(lines: string[], startIdx: number, parentIndent: number): string | undefined {
  for (let j = startIdx; j < Math.min(startIdx + 15, lines.length); j++) {
    const l = lines[j]!;
    const ind = l.length - l.trimStart().length;
    if (ind <= parentIndent && l.trim().length > 0) break;
    const match = l.match(/integrity:\s*['"]?(\S+)['"]?/);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Parses package-lock.json (v2/v3 format).
 */
export function parsePackageLock(content: string): PackageEntry[] {
  const entries: PackageEntry[] = [];
  const seen = new Set<string>();

  let data: {
    packages?: Record<string, { version?: string; integrity?: string }>;
    dependencies?: Record<string, { version?: string; integrity?: string; requires?: unknown; dependencies?: unknown }>;
  };

  try {
    data = JSON.parse(content) as typeof data;
  } catch {
    throw new Error('Invalid package-lock.json: failed to parse JSON');
  }

  // v2/v3 format: uses "packages" keyed by path
  if (data.packages) {
    for (const [path, info] of Object.entries(data.packages)) {
      if (path === '' || !info.version) continue;
      const name = extractPackageNameFromPath(path);
      if (!name) continue;
      const key = `${name}@${info.version}`;
      if (!seen.has(key)) {
        seen.add(key);
        entries.push({ name, version: info.version, integrity: info.integrity });
      }
    }
  }

  // v1 fallback: uses "dependencies"
  if (!data.packages && data.dependencies) {
    collectNpmV1Dependencies(data.dependencies, entries, seen);
  }

  return entries;
}

function extractPackageNameFromPath(path: string): string | null {
  const parts = path.replace(/^node_modules\//, '').split('node_modules/');
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : null;
}

function collectNpmV1Dependencies(
  deps: Record<string, { version?: string; integrity?: string; requires?: unknown; dependencies?: unknown }>,
  entries: PackageEntry[],
  seen: Set<string>,
): void {
  for (const [name, info] of Object.entries(deps)) {
    if (!info.version) continue;
    const key = `${name}@${info.version}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push({ name, version: info.version, integrity: info.integrity });
    }
    if (info.dependencies && typeof info.dependencies === 'object') {
      collectNpmV1Dependencies(
        info.dependencies as typeof deps,
        entries,
        seen,
      );
    }
  }
}

/**
 * Parses yarn.lock (v1 classic format).
 *
 * Format:
 *   "package-name@^version":
 *     version "resolved-version"
 *     resolved "url"
 *     integrity sha512-...
 */
export function parseYarnLock(content: string): PackageEntry[] {
  const entries: PackageEntry[] = [];
  const seen = new Set<string>();
  const lines = content.split('\n');

  let currentNames: string[] = [];
  let currentVersion: string | undefined;
  let currentIntegrity: string | undefined;

  function flush(): void {
    if (currentNames.length > 0 && currentVersion) {
      for (const name of currentNames) {
        const key = `${name}@${currentVersion}`;
        if (!seen.has(key)) {
          seen.add(key);
          entries.push({ name, version: currentVersion!, integrity: currentIntegrity });
        }
      }
    }
    currentNames = [];
    currentVersion = undefined;
    currentIntegrity = undefined;
  }

  for (const line of lines) {
    if (line.startsWith('#') || line.trim().length === 0) continue;

    // Top-level entry: starts with non-whitespace, may be quoted
    // e.g. "lodash@^4.17.21":  or  lodash@^4.17.21, lodash@~4.17.0:
    if (/^[^\s]/.test(line)) {
      flush();

      const headerLine = line.replace(/:$/, '').trim();
      const specifiers = headerLine.split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''));

      for (const spec of specifiers) {
        const atIdx = spec.lastIndexOf('@');
        if (atIdx > 0) {
          currentNames.push(spec.substring(0, atIdx));
        }
      }
      // Deduplicate names for this block
      currentNames = [...new Set(currentNames)];
      continue;
    }

    const trimmed = line.trim();
    const versionMatch = trimmed.match(/^version\s+["']?([^"'\s]+)["']?/);
    if (versionMatch) {
      currentVersion = versionMatch[1];
      continue;
    }

    const integrityMatch = trimmed.match(/^integrity\s+["']?(\S+)["']?/);
    if (integrityMatch) {
      currentIntegrity = integrityMatch[1];
    }
  }

  flush();
  return entries;
}
