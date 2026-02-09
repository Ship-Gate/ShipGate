#!/usr/bin/env tsx

/**
 * Generate Release Manifest (Artifact Provenance)
 *
 * Records build inputs for provenance and auditability:
 *   - Git commit SHA, branch, tag
 *   - Node.js version, pnpm version
 *   - pnpm-lock.yaml SHA-256 hash
 *   - Package versions at time of release
 *   - Timestamp
 *
 * Output: reports/release-manifest.json
 *
 * Usage:
 *   tsx scripts/generate-release-manifest.ts
 *   tsx scripts/generate-release-manifest.ts --verify <path-to-manifest>
 */

import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname ?? process.cwd(), '..');

interface PackageEntry {
  name: string;
  version: string;
  private: boolean;
}

interface ReleaseManifest {
  schemaVersion: '1.0.0';
  timestamp: string;
  git: {
    commitSha: string;
    branch: string;
    tag: string | null;
    dirty: boolean;
  };
  environment: {
    nodeVersion: string;
    pnpmVersion: string;
    os: string;
    arch: string;
    ci: boolean;
  };
  lockfileHash: string;
  packages: PackageEntry[];
  buildCommand: string;
  testCommand: string;
}

function exec(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function sha256(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex');
}

function getPackages(): PackageEntry[] {
  const packagesDir = join(ROOT, 'packages');
  const entries: PackageEntry[] = [];

  try {
    const output = exec('pnpm list -r --json --depth 0');
    const parsed = JSON.parse(output);
    for (const pkg of parsed) {
      if (pkg.name && pkg.name !== 'isl-lang-monorepo') {
        entries.push({
          name: pkg.name,
          version: pkg.version ?? '0.0.0',
          private: pkg.private ?? false,
        });
      }
    }
  } catch {
    // Fallback: scan packages/ directory
    for (const dir of readdirSync(packagesDir)) {
      const pkgJsonPath = join(packagesDir, dir, 'package.json');
      if (existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
        entries.push({
          name: pkgJson.name ?? dir,
          version: pkgJson.version ?? '0.0.0',
          private: pkgJson.private ?? false,
        });
      }
    }
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function generateManifest(): ReleaseManifest {
  const lockfilePath = join(ROOT, 'pnpm-lock.yaml');

  return {
    schemaVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    git: {
      commitSha: exec('git rev-parse HEAD'),
      branch: exec('git rev-parse --abbrev-ref HEAD'),
      tag: exec('git describe --tags --exact-match 2>/dev/null') || null,
      dirty: exec('git status --porcelain').length > 0,
    },
    environment: {
      nodeVersion: process.version,
      pnpmVersion: exec('pnpm --version'),
      os: process.platform,
      arch: process.arch,
      ci: process.env.CI === 'true',
    },
    lockfileHash: existsSync(lockfilePath) ? sha256(lockfilePath) : 'NOT_FOUND',
    packages: getPackages(),
    buildCommand: 'pnpm build:production',
    testCommand: 'pnpm test:production',
  };
}

function verifyManifest(manifestPath: string): boolean {
  if (!existsSync(manifestPath)) {
    console.error(`Manifest not found: ${manifestPath}`);
    return false;
  }

  const manifest: ReleaseManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  let ok = true;

  console.log(`\nVerifying release manifest: ${manifestPath}`);
  console.log(`  Schema version: ${manifest.schemaVersion}`);
  console.log(`  Timestamp:      ${manifest.timestamp}`);
  console.log(`  Commit:         ${manifest.git.commitSha}`);
  console.log(`  Branch:         ${manifest.git.branch}`);
  console.log(`  Tag:            ${manifest.git.tag ?? '(none)'}`);
  console.log(`  Node:           ${manifest.environment.nodeVersion}`);
  console.log(`  pnpm:           ${manifest.environment.pnpmVersion}`);
  console.log(`  Lockfile hash:  ${manifest.lockfileHash}`);
  console.log(`  CI:             ${manifest.environment.ci}`);
  console.log(`  Packages:       ${manifest.packages.length}`);

  // Check current lockfile matches
  const lockfilePath = join(ROOT, 'pnpm-lock.yaml');
  if (existsSync(lockfilePath)) {
    const currentHash = sha256(lockfilePath);
    if (currentHash !== manifest.lockfileHash) {
      console.warn(`  ⚠ Lockfile hash mismatch (current: ${currentHash.slice(0, 12)}…)`);
      ok = false;
    } else {
      console.log(`  ✓ Lockfile hash matches`);
    }
  }

  // Check current commit matches
  const currentCommit = exec('git rev-parse HEAD');
  if (currentCommit && currentCommit !== manifest.git.commitSha) {
    console.warn(`  ⚠ Commit SHA mismatch (current: ${currentCommit.slice(0, 12)}…)`);
    ok = false;
  } else if (currentCommit) {
    console.log(`  ✓ Commit SHA matches`);
  }

  const publicPkgs = manifest.packages.filter((p) => !p.private);
  console.log(`\n  Published packages: ${publicPkgs.length}`);
  for (const pkg of publicPkgs) {
    console.log(`    ${pkg.name}@${pkg.version}`);
  }

  console.log(ok ? '\n✅ Manifest verified.' : '\n⚠ Manifest has mismatches (expected if checked out at a different commit).');
  return ok;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args[0] === '--verify') {
    const manifestPath = args[1] ?? join(ROOT, 'reports', 'release-manifest.json');
    const ok = verifyManifest(manifestPath);
    process.exit(ok ? 0 : 1);
  }

  console.log('Generating release manifest…');
  const manifest = generateManifest();

  const reportsDir = join(ROOT, 'reports');
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  const outPath = join(reportsDir, 'release-manifest.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`✅ Release manifest written to ${outPath}`);
  console.log(`   Commit: ${manifest.git.commitSha.slice(0, 12)}`);
  console.log(`   Node:   ${manifest.environment.nodeVersion}`);
  console.log(`   pnpm:   ${manifest.environment.pnpmVersion}`);
  console.log(`   Lock:   ${manifest.lockfileHash.slice(0, 12)}…`);
  console.log(`   Pkgs:   ${manifest.packages.length} total, ${manifest.packages.filter((p) => !p.private).length} public`);
}

main().catch((err) => {
  console.error('Failed to generate release manifest:', err);
  process.exit(1);
});
