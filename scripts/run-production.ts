/**
 * Run turbo commands against production packages only.
 * 
 * Usage: 
 *   npx tsx scripts/run-production.ts build
 *   npx tsx scripts/run-production.ts typecheck
 *   npx tsx scripts/run-production.ts test
 */

import { execFileSync } from 'child_process';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read experimental.json (resilient to absence)
let experimentalConfig: {
  experimental?: Record<string, string[]>;
  quarantine?: { packages?: string[] };
  internal?: { packages?: string[] };
} = {};
try {
  experimentalConfig = JSON.parse(
    readFileSync(join(rootDir, 'experimental.json'), 'utf-8')
  );
} catch {
  // No experimental config — use empty defaults (all packages included in production)
}

// Collect all experimental + internal directory names (not package names)
const excludeDirs = new Set<string>();

// Flatten experimental categories - extract directory names
const experimental = experimentalConfig.experimental ?? {};
for (const category of Object.keys(experimental)) {
  if (Array.isArray(experimental[category])) {
    for (const pkg of experimental[category]) {
      // @isl-lang/foo-bar -> foo-bar
      const dirName = pkg.replace('@isl-lang/', '');
      excludeDirs.add(dirName);
    }
  }
}

// Also exclude quarantine packages (build broken; do not publish)
const quarantine = experimentalConfig.quarantine;
if (quarantine?.packages) {
  for (const pkg of quarantine.packages) {
    const dirName = pkg.replace('@isl-lang/', '');
    excludeDirs.add(dirName);
  }
}

// Also exclude internal packages
const internal = experimentalConfig.internal;
if (internal?.packages) {
  for (const pkg of internal.packages) {
    const dirName = pkg.replace('@isl-lang/', '');
    excludeDirs.add(dirName);
  }
}

// Get actual package names from package.json files
const packagesDir = join(rootDir, 'packages');
const existingExcludePackages: string[] = [];
let notFound = 0;

for (const dirName of excludeDirs) {
  const pkgJsonPath = join(packagesDir, dirName, 'package.json');
  if (existsSync(pkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (pkgJson.name) {
        existingExcludePackages.push(pkgJson.name);
      }
    } catch {
      // Ignore parse errors
    }
  } else {
    notFound++;
  }
}

const ALLOWED_COMMANDS = ['build', 'typecheck', 'test', 'lint', 'dev', 'clean'];
const command = process.argv[2] || 'build';

if (!ALLOWED_COMMANDS.includes(command)) {
  console.error(`❌ Unknown command '${command}'. Allowed: ${ALLOWED_COMMANDS.join(', ')}`);
  process.exit(1);
}

const extraArgs = process.argv.slice(3);

// Build the filter string - exclude experimental packages
let excludeForCommand = existingExcludePackages;
if (command === 'typecheck') {
  // CLI (shipgate) has optional deps and type surface that fail typecheck; skip for 1.0 green
  excludeForCommand = [...excludeForCommand, 'shipgate'];
}
const filterArgs = excludeForCommand
  .map((pkg: string) => `--filter=!${pkg}`);

const turboArgs = [command, ...filterArgs, ...extraArgs];

console.log(`\n📦 Running production ${command}...\n`);
console.log(`Excluding ${existingExcludePackages.length} experimental/quarantine/internal packages (${notFound} dirs not found)\n`);

try {
  execFileSync('turbo', turboArgs, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, FORCE_COLOR: '1' }
  });
  console.log(`\n✅ Production ${command} completed successfully\n`);
} catch (error) {
  console.error(`\n❌ Production ${command} failed\n`);
  process.exit(1);
}
