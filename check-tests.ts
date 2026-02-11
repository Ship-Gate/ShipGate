import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const packagesDir = join(process.cwd(), 'packages');
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

interface PackageInfo {
  name: string;
  hasTestScript: boolean;
  hasCoverageScript: boolean;
  hasTestFiles: boolean;
  testFileCount: number;
  isTypesOnly: boolean;
}

const results: PackageInfo[] = [];

for (const pkgDir of packageDirs) {
  const pkgJsonPath = join(packagesDir, pkgDir, 'package.json');
  const testsDir = join(packagesDir, pkgDir, 'tests');
  const srcDir = join(packagesDir, pkgDir, 'src');
  
  if (!existsSync(pkgJsonPath)) continue;
  
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  const scripts = pkgJson.scripts || {};
  
  // Count test files
  let testFileCount = 0;
  if (existsSync(testsDir)) {
    const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));
    testFileCount = testFiles.length;
  }
  
  // Check if it's a types-only package
  let isTypesOnly = true;
  if (existsSync(srcDir)) {
    const srcFiles = readdirSync(srcDir, { recursive: true });
    isTypesOnly = !srcFiles.some(f => 
      typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts')
    );
  }
  
  results.push({
    name: pkgJson.name || pkgDir,
    hasTestScript: !!scripts.test,
    hasCoverageScript: !!scripts['test:coverage'],
    hasTestFiles: testFileCount > 0,
    testFileCount,
    isTypesOnly
  });
}

// Print results
console.log('Package Analysis:');
console.log('==================');
console.log();

const missingTestScript = results.filter(r => !r.hasTestScript);
const missingCoverageScript = results.filter(r => !r.hasCoverageScript);
const missingTestFiles = results.filter(r => !r.hasTestFiles);
const productionPackages = results.filter(r => !r.isTypesOnly && r.name.startsWith('@isl-lang/'));

console.log(`Total packages: ${results.length}`);
console.log(`Missing test script: ${missingTestScript.length}`);
console.log(`Missing coverage script: ${missingCoverageScript.length}`);
console.log(`Missing test files: ${missingTestFiles.length}`);
console.log(`Production packages (need 10+ tests): ${productionPackages.length}`);
console.log();

console.log('Packages missing test script:');
missingTestScript.forEach(p => console.log(`  - ${p.name}`));
console.log();

console.log('Packages missing coverage script:');
missingCoverageScript.forEach(p => console.log(`  - ${p.name}`));
console.log();

console.log('Packages missing test files:');
missingTestFiles.forEach(p => console.log(`  - ${p.name}`));
console.log();

console.log('Production packages with test counts:');
productionPackages.forEach(p => {
  const status = p.testFileCount >= 10 ? '✓' : '✗';
  console.log(`  ${status} ${p.name}: ${p.testFileCount} tests`);
});
