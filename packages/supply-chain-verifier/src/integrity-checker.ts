import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseLockfile, detectLockfileType, type PackageEntry } from './lockfile-parser.js';

export interface IntegrityResult {
  valid: boolean;
  mismatches: string[];
  warnings: string[];
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const LOCKFILE_NAMES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'] as const;

export function findLockfile(projectRoot: string): string | null {
  for (const name of LOCKFILE_NAMES) {
    const fullPath = join(projectRoot, name);
    if (existsSync(fullPath)) return fullPath;
  }
  return null;
}

export function verifyLockfileIntegrity(lockfilePath: string): IntegrityResult {
  const mismatches: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(lockfilePath)) {
    return { valid: false, mismatches: ['Lockfile does not exist'], warnings: [] };
  }

  let lockfileContent: string;
  try {
    lockfileContent = readFileSync(lockfilePath, 'utf-8');
  } catch (err) {
    return {
      valid: false,
      mismatches: [`Failed to read lockfile: ${err instanceof Error ? err.message : String(err)}`],
      warnings: [],
    };
  }

  if (lockfileContent.trim().length === 0) {
    return { valid: false, mismatches: ['Lockfile is empty'], warnings: [] };
  }

  const lockfileName = basename(lockfilePath);
  if (!detectLockfileType(lockfileName)) {
    return { valid: false, mismatches: [`Unrecognized lockfile format: ${lockfileName}`], warnings: [] };
  }

  let lockfileEntries: PackageEntry[];
  try {
    lockfileEntries = parseLockfile(lockfileName, lockfileContent);
  } catch (err) {
    return {
      valid: false,
      mismatches: [`Failed to parse lockfile: ${err instanceof Error ? err.message : String(err)}`],
      warnings: [],
    };
  }

  if (lockfileEntries.length === 0) {
    warnings.push('Lockfile contains no package entries');
  }

  const projectRoot = lockfilePath.replace(/[/\\][^/\\]+$/, '');
  const packageJsonPath = join(projectRoot, 'package.json');

  if (!existsSync(packageJsonPath)) {
    warnings.push('No package.json found alongside lockfile');
    return { valid: mismatches.length === 0, mismatches, warnings };
  }

  let packageJson: PackageJson;
  try {
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageJson;
  } catch {
    warnings.push('Failed to parse package.json');
    return { valid: mismatches.length === 0, mismatches, warnings };
  }

  const declaredDeps = new Set<string>();
  for (const depGroup of [
    packageJson.dependencies,
    packageJson.devDependencies,
    packageJson.peerDependencies,
    packageJson.optionalDependencies,
  ]) {
    if (depGroup) {
      for (const name of Object.keys(depGroup)) {
        declaredDeps.add(name);
      }
    }
  }

  const lockfilePackageNames = new Set(lockfileEntries.map((e) => e.name));

  for (const dep of declaredDeps) {
    if (!lockfilePackageNames.has(dep)) {
      mismatches.push(`Package "${dep}" is in package.json but missing from lockfile`);
    }
  }

  const entriesMissingIntegrity = lockfileEntries.filter(
    (e) => !e.integrity && declaredDeps.has(e.name),
  );
  if (entriesMissingIntegrity.length > 0) {
    warnings.push(
      `${entriesMissingIntegrity.length} direct dependencies missing integrity hashes`,
    );
  }

  return { valid: mismatches.length === 0, mismatches, warnings };
}
