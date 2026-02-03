/**
 * Script to mark experimental packages as private.
 * This excludes them from npm publish and reduces IDE errors.
 * 
 * Usage: npx tsx scripts/mark-experimental-private.ts [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read experimental.json
const experimentalConfig = JSON.parse(
  readFileSync(join(rootDir, 'experimental.json'), 'utf-8')
);

// Collect all experimental package names
const experimentalPackages: string[] = [];

// Flatten experimental categories
const experimental = experimentalConfig.experimental;
for (const category of Object.keys(experimental)) {
  if (Array.isArray(experimental[category])) {
    experimentalPackages.push(...experimental[category]);
  }
}

// Also mark internal packages
const internal = experimentalConfig.internal;
if (internal?.packages) {
  experimentalPackages.push(...internal.packages);
}

// Map package names to directory names
function packageNameToDir(name: string): string {
  // @isl-lang/foo-bar -> foo-bar
  return name.replace('@isl-lang/', '');
}

const dryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

console.log(`\n📦 Marking experimental packages as private${dryRun ? ' (DRY RUN)' : ''}...\n`);

let updated = 0;
let skipped = 0;
let notFound = 0;
let alreadyPrivate = 0;

for (const pkgName of experimentalPackages) {
  const dirName = packageNameToDir(pkgName);
  const pkgJsonPath = join(rootDir, 'packages', dirName, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    if (verbose) {
      console.log(`⚠️  Not found: ${dirName}`);
    }
    notFound++;
    continue;
  }
  
  try {
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    
    if (pkgJson.private === true) {
      if (verbose) {
        console.log(`✓  Already private: ${pkgName}`);
      }
      alreadyPrivate++;
      continue;
    }
    
    // Mark as private and add experimental flag
    pkgJson.private = true;
    pkgJson.experimental = true;
    
    if (!dryRun) {
      writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    }
    
    console.log(`✅ Marked private: ${pkgName}`);
    updated++;
  } catch (err) {
    console.error(`❌ Error processing ${pkgName}:`, err);
    skipped++;
  }
}

console.log(`
📊 Summary:
   Updated:        ${updated}
   Already private: ${alreadyPrivate}
   Not found:      ${notFound}
   Errors:         ${skipped}
   Total:          ${experimentalPackages.length}
${dryRun ? '\n⚠️  DRY RUN - no files were modified. Run without --dry-run to apply changes.' : ''}
`);
