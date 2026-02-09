#!/usr/bin/env tsx
/**
 * License Verification Script
 * 
 * Verifies that all packages in the monorepo have consistent MIT licensing.
 * Checks:
 * - package.json has "license": "MIT"
 * - LICENSE file exists (optional but recommended)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '../..');

interface PackageInfo {
  path: string;
  name: string;
  license?: string;
  hasLicenseFile: boolean;
}

interface VerificationResult {
  packages: PackageInfo[];
  missingLicense: PackageInfo[];
  nonMitLicense: PackageInfo[];
  missingLicenseFile: PackageInfo[];
}

function findPackages(): string[] {
  const packageJsonFiles: string[] = [];

  function walkDir(dir: string): void {
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = join(dir, entry);
        
        // Skip node_modules, dist, build, .turbo, coverage
        if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || 
            entry === '.turbo' || entry === 'coverage' || entry.startsWith('.')) {
          continue;
        }

        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (entry === 'package.json') {
            packageJsonFiles.push(fullPath);
          }
        } catch (error) {
          // Skip files we can't access
          continue;
        }
      }
    } catch (error) {
      // Skip directories we can't access
    }
  }

  walkDir(ROOT_DIR);
  return packageJsonFiles;
}

function verifyPackage(packageJsonPath: string): PackageInfo {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const packageDir = dirname(packageJsonPath);
  const licensePath = join(packageDir, 'LICENSE');
  const hasLicenseFile = existsSync(licensePath);

  return {
    path: packageJsonPath,
    name: packageJson.name || 'unknown',
    license: packageJson.license,
    hasLicenseFile,
  };
}

function verifyAllPackages(): VerificationResult {
  const packageJsonFiles = findPackages();
  const packages: PackageInfo[] = [];
  const missingLicense: PackageInfo[] = [];
  const nonMitLicense: PackageInfo[] = [];
  const missingLicenseFile: PackageInfo[] = [];

  for (const packageJsonPath of packageJsonFiles) {
    const pkg = verifyPackage(packageJsonPath);
    packages.push(pkg);

    if (!pkg.license) {
      missingLicense.push(pkg);
    } else if (pkg.license !== 'MIT') {
      nonMitLicense.push(pkg);
    }

    // Core packages should have LICENSE files
    const relativePath = packageJsonPath.replace(ROOT_DIR + '/', '');
    const isCorePackage = relativePath.startsWith('packages/') && 
                         !relativePath.includes('examples/') &&
                         !relativePath.includes('demos/');
    
    if (isCorePackage && !pkg.hasLicenseFile) {
      missingLicenseFile.push(pkg);
    }
  }

  return {
    packages,
    missingLicense,
    nonMitLicense,
    missingLicenseFile,
  };
}

function main(): void {
  console.log('🔍 Verifying license consistency across packages...\n');

  const result = verifyAllPackages();

  console.log(`📦 Found ${result.packages.length} packages\n`);

  let hasErrors = false;

  if (result.missingLicense.length > 0) {
    hasErrors = true;
    console.error('❌ Packages missing license field:');
    for (const pkg of result.missingLicense) {
      console.error(`   - ${pkg.name} (${pkg.path})`);
    }
    console.error('');
  }

  if (result.nonMitLicense.length > 0) {
    hasErrors = true;
    console.error('❌ Packages with non-MIT license:');
    for (const pkg of result.nonMitLicense) {
      console.error(`   - ${pkg.name}: "${pkg.license}" (${pkg.path})`);
    }
    console.error('');
  }

  if (result.missingLicenseFile.length > 0) {
    console.warn('⚠️  Core packages missing LICENSE file (recommended):');
    for (const pkg of result.missingLicenseFile) {
      console.warn(`   - ${pkg.name} (${pkg.path})`);
    }
    console.warn('');
  }

  if (hasErrors) {
    console.error('❌ License verification failed');
    process.exit(1);
  }

  console.log('✅ All packages have MIT license');
  
  if (result.missingLicenseFile.length === 0) {
    console.log('✅ All core packages have LICENSE files');
  }

  console.log('\n📊 Summary:');
  console.log(`   Total packages: ${result.packages.length}`);
  console.log(`   MIT licensed: ${result.packages.length - result.missingLicense.length - result.nonMitLicense.length}`);
  console.log(`   With LICENSE file: ${result.packages.filter(p => p.hasLicenseFile).length}`);
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1])) {
  main();
}
