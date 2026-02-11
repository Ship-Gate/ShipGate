import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const packagesDir = join(process.cwd(), 'packages');
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

interface PackageInfo {
  name: string;
  path: string;
  hasTestScript: boolean;
  hasCoverageScript: boolean;
  needsVitest: boolean;
}

const results: PackageInfo[] = [];

for (const pkgDir of packageDirs) {
  const pkgJsonPath = join(packagesDir, pkgDir, 'package.json');
  
  if (!existsSync(pkgJsonPath)) continue;
  
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  const scripts = pkgJson.scripts || {};
  
  results.push({
    name: pkgJson.name || pkgDir,
    path: join(packagesDir, pkgDir),
    hasTestScript: !!scripts.test,
    hasCoverageScript: !!scripts['test:coverage'],
    needsVitest: !pkgJson.devDependencies?.vitest && !pkgJson.dependencies?.vitest
  });
}

// Update packages missing test scripts
for (const pkg of results) {
  if (!pkg.hasTestScript || !pkg.hasCoverageScript) {
    const pkgJsonPath = join(pkg.path, 'package.json');
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    
    if (!pkgJson.scripts) pkgJson.scripts = {};
    
    if (!pkg.hasTestScript) {
      pkgJson.scripts.test = "vitest run --passWithNoTests";
    }
    
    if (!pkg.hasCoverageScript) {
      pkgJson.scripts['test:coverage'] = "vitest run --coverage";
    }
    
    // Add vitest if needed
    if (pkg.needsVitest) {
      if (!pkgJson.devDependencies) pkgJson.devDependencies = {};
      pkgJson.devDependencies.vitest = "^1.2.0";
    }
    
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n');
    console.log(`Updated ${pkg.name}`);
  }
}

console.log('\nDone!');
