#!/usr/bin/env npx tsx
/**
 * Initialize Capability Manifests
 * 
 * Generates initial capability manifests for packages based on their assessed completeness.
 * This helps bootstrap the completeness system by creating manifests that match reality.
 * 
 * Usage:
 *   npx tsx scripts/completeness-init-manifests.ts          # dry-run (show what would be created)
 *   npx tsx scripts/completeness-init-manifests.ts --apply  # actually create manifests
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { CompletenessReport, CompletionStatus } from './completeness-schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const reportsDir = join(rootDir, 'reports');
const manifestDir = join(rootDir, '.capability-manifests');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const filterStatus = args.find((_, i, a) => a[i - 1] === '--status') as CompletionStatus | undefined;

// ---------------------------------------------------------------------------
// Generate manifests
// ---------------------------------------------------------------------------

function generateManifest(
  pkgName: string,
  assessedStatus: CompletionStatus,
  declaredStatus: CompletionStatus,
): string {
  const status = assessedStatus; // Use assessed status as the truth
  const notes: string[] = [];

  if (declaredStatus !== assessedStatus) {
    notes.push(`Previously declared as "${declaredStatus}", assessed as "${assessedStatus}"`);
  }

  return JSON.stringify(
    {
      name: pkgName,
      status,
      updatedAt: new Date().toISOString(),
      ...(notes.length > 0 && { notes: notes.join('. ') }),
    },
    null,
    2,
  );
}

function main() {
  console.log('\n📝 Initialize Capability Manifests');
  console.log(`   Mode: ${apply ? 'APPLY (will create files)' : 'DRY-RUN (preview only)'}`);
  if (filterStatus) {
    console.log(`   Filter: Only ${filterStatus} packages`);
  }
  console.log('');

  // Load completeness report
  const completenessPath = join(reportsDir, 'completeness.json');
  if (!existsSync(completenessPath)) {
    console.error('❌ completeness.json not found. Run completeness-checker.ts first.');
    process.exit(1);
  }

  const report = JSON.parse(readFileSync(completenessPath, 'utf-8')) as CompletenessReport;

  // Filter packages
  let packages = report.packages;
  if (filterStatus) {
    packages = packages.filter((p) => p.assessedStatus === filterStatus);
  }

  // Only create manifests for packages where declared != assessed
  // (or if no manifest exists, create one based on assessed status)
  const toCreate = packages.filter((pkg) => {
    // Create manifest if status doesn't match OR if we want to initialize all
    return !pkg.statusMatches || !filterStatus;
  });

  if (toCreate.length === 0) {
    console.log('✅ No manifests need to be created.');
    console.log('   All packages already have matching manifests.\n');
    return;
  }

  // Ensure manifest directory exists
  if (!existsSync(manifestDir)) {
    if (apply) {
      mkdirSync(manifestDir, { recursive: true });
      console.log(`📁 Created ${manifestDir}/`);
    } else {
      console.log(`📁 Would create ${manifestDir}/`);
    }
  }

  console.log(`📦 Found ${toCreate.length} package(s) to create manifests for:\n`);

  let created = 0;
  let skipped = 0;

  for (const pkg of toCreate) {
    // Handle scoped packages and special cases
    let manifestName = pkg.name;
    if (manifestName.startsWith('@isl-lang/')) {
      manifestName = manifestName.replace('@isl-lang/', '');
    } else if (manifestName === 'shipgate') {
      manifestName = 'cli';
    } else if (manifestName.startsWith('@')) {
      // Scoped packages: @shipgate/sdk -> shipgate-sdk
      manifestName = manifestName.replace('@', '').replace('/', '-');
    }
    const manifestPath = join(manifestDir, `${manifestName}.json`);

    // Skip if manifest already exists (unless forcing update)
    if (existsSync(manifestPath) && pkg.statusMatches) {
      skipped++;
      continue;
    }

    const manifestContent = generateManifest(
      pkg.name,
      pkg.assessedStatus,
      pkg.declaredStatus,
    );

    console.log(`${apply ? '✅' : '📄'} ${pkg.name}`);
    console.log(`   Status: ${pkg.declaredStatus} → ${pkg.assessedStatus}`);
    console.log(`   Path: ${manifestPath}`);

    if (apply) {
      writeFileSync(manifestPath, manifestContent + '\n');
      created++;
    }
    console.log('');
  }

  console.log('---');
  if (apply) {
    console.log(`✅ Created ${created} manifest(s)`);
    if (skipped > 0) {
      console.log(`⏭️  Skipped ${skipped} (already exist)`);
    }
    console.log('\n💡 Next steps:');
    console.log('   1. Review the generated manifests');
    console.log('   2. Update any that need manual adjustment');
    console.log('   3. Run: pnpm completeness:report');
  } else {
    console.log(`📄 Would create ${toCreate.length - skipped} manifest(s)`);
    console.log(`⏭️  Would skip ${skipped} (already exist)`);
    console.log('\n💡 Run with --apply to actually create the manifests');
  }
  console.log('');
}

main();
