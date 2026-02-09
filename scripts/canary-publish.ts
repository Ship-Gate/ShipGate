#!/usr/bin/env tsx

/**
 * Canary Publish for Experimental Packages
 *
 * Publishes experimental/partial packages under a canary dist-tag so they
 * can be tested without affecting stable consumers.
 *
 * Version format: <current-version>-canary.<short-sha>.<timestamp>
 * Dist-tag:      canary
 *
 * Usage:
 *   tsx scripts/canary-publish.ts              # Publish canary versions
 *   tsx scripts/canary-publish.ts --dry-run    # Preview without publishing
 *   tsx scripts/canary-publish.ts --list       # List eligible packages
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

const ROOT = resolve(import.meta.dirname ?? process.cwd(), '..');

function exec(cmd: string, opts?: { silent?: boolean }): string {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: opts?.silent ? 'pipe' : 'inherit',
    }).trim();
  } catch {
    return '';
  }
}

function execSilent(cmd: string): string {
  return exec(cmd, { silent: true });
}

interface ExperimentalConfig {
  experimental: Record<string, string[]>;
  partial: Record<string, string[]>;
}

function loadCanaryPackages(): string[] {
  const configPath = join(ROOT, 'experimental.json');
  if (!existsSync(configPath)) {
    console.error('experimental.json not found');
    process.exit(1);
  }

  const config: ExperimentalConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  const packages: string[] = [];

  // Collect experimental packages
  for (const [_category, pkgs] of Object.entries(config.experimental)) {
    if (Array.isArray(pkgs)) {
      packages.push(...pkgs);
    }
  }

  // Collect partial packages (these also get canary releases)
  for (const [_category, pkgs] of Object.entries(config.partial)) {
    if (Array.isArray(pkgs)) {
      packages.push(...pkgs);
    }
  }

  return [...new Set(packages)].sort();
}

interface PackageInfo {
  name: string;
  dir: string;
  version: string;
  canaryVersion: string;
  private: boolean;
  hasDist: boolean;
}

function resolvePackageDir(packageName: string): string | null {
  const shortName = packageName.replace('@isl-lang/', '');
  const dir = join(ROOT, 'packages', shortName);
  if (existsSync(join(dir, 'package.json'))) {
    return dir;
  }
  return null;
}

function buildCanaryVersion(baseVersion: string, sha: string): string {
  const timestamp = Date.now();
  return `${baseVersion}-canary.${sha}.${timestamp}`;
}

function getPackageInfos(packages: string[], sha: string): PackageInfo[] {
  const infos: PackageInfo[] = [];

  for (const name of packages) {
    const dir = resolvePackageDir(name);
    if (!dir) continue;

    const pkgJson = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
    const baseVersion = pkgJson.version ?? '0.0.0';

    infos.push({
      name,
      dir,
      version: baseVersion,
      canaryVersion: buildCanaryVersion(baseVersion, sha),
      private: pkgJson.private ?? false,
      hasDist: existsSync(join(dir, 'dist')),
    });
  }

  return infos;
}

function listPackages(infos: PackageInfo[]): void {
  console.log(`\nCanary-eligible packages (${infos.length}):\n`);

  const publishable = infos.filter((p) => !p.private);
  const privateOnly = infos.filter((p) => p.private);

  if (publishable.length > 0) {
    console.log('Publishable:');
    for (const pkg of publishable) {
      const built = pkg.hasDist ? '✓ built' : '✗ not built';
      console.log(`  ${pkg.name}@${pkg.version} → ${pkg.canaryVersion} (${built})`);
    }
  }

  if (privateOnly.length > 0) {
    console.log(`\nPrivate (skipped): ${privateOnly.length}`);
    for (const pkg of privateOnly) {
      console.log(`  ${pkg.name} (private)`);
    }
  }
}

function publishCanary(infos: PackageInfo[], dryRun: boolean): void {
  const publishable = infos.filter((p) => !p.private && p.hasDist);
  const skipped: string[] = [];
  const published: string[] = [];
  const failed: string[] = [];

  console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Publishing ${publishable.length} canary packages…\n`);

  for (const pkg of publishable) {
    const pkgJsonPath = join(pkg.dir, 'package.json');
    const originalContent = readFileSync(pkgJsonPath, 'utf-8');

    try {
      // Temporarily set canary version
      const pkgJson = JSON.parse(originalContent);
      pkgJson.version = pkg.canaryVersion;
      writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');

      const cmd = dryRun
        ? `pnpm publish --access public --tag canary --no-git-checks --dry-run`
        : `pnpm publish --access public --tag canary --no-git-checks`;

      console.log(`Publishing ${pkg.name}@${pkg.canaryVersion}…`);
      execSync(cmd, { cwd: pkg.dir, stdio: 'pipe', encoding: 'utf-8' });
      published.push(`${pkg.name}@${pkg.canaryVersion}`);
      console.log(`  ✓ ${pkg.name}@${pkg.canaryVersion}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cannot publish over')) {
        console.log(`  ⚠ ${pkg.name} already published at this version`);
        skipped.push(pkg.name);
      } else {
        console.error(`  ✗ ${pkg.name}: ${msg.slice(0, 120)}`);
        failed.push(pkg.name);
      }
    } finally {
      // Always restore original package.json
      writeFileSync(pkgJsonPath, originalContent);
    }
  }

  // Summary
  console.log('\n--- Canary Publish Summary ---');
  console.log(`  Published: ${published.length}`);
  published.forEach((p) => console.log(`    ✓ ${p}`));
  if (skipped.length) {
    console.log(`  Skipped:   ${skipped.length}`);
    skipped.forEach((p) => console.log(`    ⚠ ${p}`));
  }
  if (failed.length) {
    console.log(`  Failed:    ${failed.length}`);
    failed.forEach((p) => console.log(`    ✗ ${p}`));
  }

  if (failed.length > 0 && !dryRun) {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const listOnly = args.includes('--list');

  const sha = execSilent('git rev-parse --short=8 HEAD') || 'unknown';
  const packages = loadCanaryPackages();
  const infos = getPackageInfos(packages, sha);

  console.log(`🐤 ISL Canary Publisher`);
  console.log(`   Commit: ${sha}`);
  console.log(`   Eligible: ${infos.length} packages`);

  if (listOnly) {
    listPackages(infos);
    return;
  }

  publishCanary(infos, dryRun);
}

main().catch((err) => {
  console.error('Canary publish failed:', err);
  process.exit(1);
});
