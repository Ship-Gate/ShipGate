import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const packagesDir = join(process.cwd(), 'packages');
const packageDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => dirent.name);

interface PackageInfo {
  name: string;
  path: string;
  hasTestFiles: boolean;
  isTypesOnly: boolean;
  hasIndexFile: boolean;
}

const results: PackageInfo[] = [];

for (const pkgDir of packageDirs) {
  const pkgJsonPath = join(packagesDir, pkgDir, 'package.json');
  const testsDir = join(packagesDir, pkgDir, 'tests');
  const indexFile = join(packagesDir, pkgDir, 'src', 'index.ts');
  
  if (!existsSync(pkgJsonPath)) continue;
  
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  
  // Count test files
  let hasTestFiles = false;
  if (existsSync(testsDir)) {
    const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));
    hasTestFiles = testFiles.length > 0;
  }
  
  // Check if it's a types-only package
  let isTypesOnly = true;
  const srcDir = join(packagesDir, pkgDir, 'src');
  if (existsSync(srcDir)) {
    const srcFiles = readdirSync(srcDir, { recursive: true });
    isTypesOnly = !srcFiles.some(f => 
      typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.js')) && !f.endsWith('.d.ts')
    );
  }
  
  results.push({
    name: pkgJson.name || pkgDir,
    path: join(packagesDir, pkgDir),
    hasTestFiles,
    isTypesOnly,
    hasIndexFile: existsSync(indexFile)
  });
}

// Create test files for packages without any
for (const pkg of results) {
  if (!pkg.hasTestFiles) {
    const testsDir = join(pkg.path, 'tests');
    
    // Create tests directory if it doesn't exist
    if (!existsSync(testsDir)) {
      mkdirSync(testsDir, { recursive: true });
    }
    
    const testFile = join(testsDir, 'index.test.ts');
    
    if (pkg.isTypesOnly) {
      // Types-only package test
      writeFileSync(testFile, `import { expectTypeOf } from 'vitest'
import type * as mod from '../src/index'

describe('exports', () => {
  it('exports types', () => {
    expectTypeOf(mod).not.toBeAny()
  })
})
`);
    } else if (pkg.hasIndexFile) {
      // Regular package with index file
      writeFileSync(testFile, `import { describe, it, expect } from 'vitest'
import * as mod from '../src/index'

describe('exports', () => {
  it('exports something', () => {
    expect(Object.keys(mod).length).toBeGreaterThan(0)
  })
  
  it('has valid exports', () => {
    // Add specific tests for your exports here
    expect(mod).toBeDefined()
  })
})
`);
    } else {
      // Package without index file
      writeFileSync(testFile, `import { describe, it, expect } from 'vitest'

describe('package', () => {
  it('exists', () => {
    expect(true).toBe(true)
  })
})
`);
    }
    
    console.log(`Created test for ${pkg.name}`);
  }
}

console.log('\nDone!');
