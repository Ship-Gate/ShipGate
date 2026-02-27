#!/usr/bin/env tsx
/**
 * Type Surface + Exports Auditor
 * 
 * Validates:
 * 1. package.json "types" field points to existing dist/*.d.ts
 * 2. "exports" has proper "types" mappings
 * 3. "files" includes dist/
 * 4. No deep imports (e.g., @isl-lang/package-name/dist/... or /src/...)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PACKAGES_DIR = join(ROOT, 'packages');

interface PackageIssue {
  package: string;
  type: 'missing_types' | 'missing_exports_types' | 'missing_files' | 'types_file_missing' | 'deep_import';
  message: string;
  fix?: string;
}

interface DeepImport {
  file: string;
  line: number;
  import: string;
  suggested: string;
}

const issues: PackageIssue[] = [];
const deepImports: DeepImport[] = [];

function findPackages(): string[] {
  const packages: string[] = [];
  const entries = readdirSync(PACKAGES_DIR, { withFileTypes: true });
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const pkgPath = join(PACKAGES_DIR, entry.name);
      const pkgJsonPath = join(pkgPath, 'package.json');
      if (existsSync(pkgJsonPath)) {
        packages.push(entry.name);
      }
    }
  }
  
  return packages;
}

function validatePackage(pkgName: string): void {
  const pkgPath = join(PACKAGES_DIR, pkgName);
  const pkgJsonPath = join(pkgPath, 'package.json');
  
  if (!existsSync(pkgJsonPath)) {
    return;
  }
  
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
  
  // Check if package has types field
  if (pkgJson.types) {
    const typesPath = join(pkgPath, pkgJson.types);
    
    // Check if types file exists (or would exist after build)
    if (!existsSync(typesPath)) {
      issues.push({
        package: pkgName,
        type: 'types_file_missing',
        message: `types field points to ${pkgJson.types} but file doesn't exist (may need build)`,
      });
    }
    
    // Validate types path is in dist/
    if (!pkgJson.types.includes('dist/')) {
      issues.push({
        package: pkgName,
        type: 'missing_types',
        message: `types field "${pkgJson.types}" should point to dist/ directory`,
        fix: `Change types to "./dist/index.d.ts"`,
      });
    }
  }
  
  // Check exports field
  if (pkgJson.exports) {
    if (typeof pkgJson.exports === 'object' && !Array.isArray(pkgJson.exports)) {
      // Helper function to check if types are present in export value
      function hasTypes(exportValue: unknown): boolean {
        if (typeof exportValue !== 'object' || exportValue === null) return false;
        
        // Direct types field
        if ('types' in exportValue) return true;
        
        // Check nested import/require objects (dual ESM/CJS pattern)
        if ('import' in exportValue && typeof exportValue.import === 'object' && exportValue.import !== null) {
          if ('types' in exportValue.import) return true;
        }
        if ('require' in exportValue && typeof exportValue.require === 'object' && exportValue.require !== null) {
          if ('types' in exportValue.require) return true;
        }
        
        // Check if it's a string (valid for package.json exports)
        if (typeof exportValue === 'string') return true;
        
        return false;
      }
      
      // Check main export "."
      if (pkgJson.exports['.']) {
        const mainExport = pkgJson.exports['.'];
        if (!hasTypes(mainExport)) {
          issues.push({
            package: pkgName,
            type: 'missing_exports_types',
            message: 'exports["."] missing "types" field',
            fix: 'Add "types": "./dist/index.d.ts" to exports["."]',
          });
        }
      }
      
      // Check all subpath exports
      for (const [subpath, exportValue] of Object.entries(pkgJson.exports)) {
        if (subpath === 'package.json') continue;
        if (typeof exportValue === 'string') continue; // String exports are valid
        if (typeof exportValue === 'object' && exportValue !== null) {
          if (!hasTypes(exportValue)) {
            issues.push({
              package: pkgName,
              type: 'missing_exports_types',
              message: `exports["${subpath}"] missing "types" field`,
              fix: `Add "types" field to exports["${subpath}"]`,
            });
          }
        }
      }
    }
  } else if (pkgJson.types) {
    // Package has types but no exports - should have exports
    issues.push({
      package: pkgName,
      type: 'missing_exports_types',
      message: 'Package has "types" but no "exports" field',
      fix: 'Add exports field with types mapping',
    });
  }
  
  // Check files field
  if (pkgJson.files) {
    if (!pkgJson.files.includes('dist') && !pkgJson.files.includes('dist/')) {
      issues.push({
        package: pkgName,
        type: 'missing_files',
        message: '"files" array should include "dist"',
        fix: 'Add "dist" to files array',
      });
    }
  } else if (pkgJson.types || pkgJson.exports) {
    // Package has types/exports but no files field
    issues.push({
      package: pkgName,
      type: 'missing_files',
      message: 'Package should have "files" field including "dist"',
      fix: 'Add files: ["dist"] to package.json',
    });
  }
}

function scanForDeepImports(pkgName: string): void {
  const pkgPath = join(PACKAGES_DIR, pkgName);
  const srcPath = join(pkgPath, 'src');
  
  if (!existsSync(srcPath)) {
    return;
  }
  
  function scanDirectory(dir: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules, dist, etc.
        if (!['node_modules', 'dist', '.git'].includes(entry.name)) {
          scanDirectory(fullPath);
        }
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        scanFile(fullPath);
      }
    }
  }
  
  function scanFile(filePath: string): void {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Match import/require statements
      const importMatch = line.match(/from\s+['"](@isl-lang\/[^'"]+\/(?:dist|src)\/[^'"]+)['"]/);
      if (importMatch) {
        const importPath = importMatch[1];
        const relativePath = relative(ROOT, filePath);
        
        // Extract package name
        const pkgMatch = importPath.match(/@isl-lang\/([^/]+)/);
        if (pkgMatch) {
          const importedPkg = pkgMatch[1];
          const suggested = `@isl-lang/${importedPkg}`;
          
          deepImports.push({
            file: relativePath,
            line: index + 1,
            import: importPath,
            suggested,
          });
        }
      }
      
      // Also check require() and dynamic imports
      const requireMatch = line.match(/require\(['"](@isl-lang\/[^'"]+\/(?:dist|src)\/[^'"]+)['"]\)/);
      if (requireMatch) {
        const importPath = requireMatch[1];
        const relativePath = relative(ROOT, filePath);
        const pkgMatch = importPath.match(/@isl-lang\/([^/]+)/);
        if (pkgMatch) {
          const importedPkg = pkgMatch[1];
          deepImports.push({
            file: relativePath,
            line: index + 1,
            import: importPath,
            suggested: `@isl-lang/${importedPkg}`,
          });
        }
      }
    });
  }
  
  scanDirectory(srcPath);
}

// Main execution
console.log('🔍 Type Surface + Exports Auditor\n');
console.log('Scanning packages...\n');

const packages = findPackages();
console.log(`Found ${packages.length} packages\n`);

// Validate each package
for (const pkg of packages) {
  validatePackage(pkg);
  scanForDeepImports(pkg);
}

// Report results
console.log('='.repeat(80));
console.log('VALIDATION RESULTS');
console.log('='.repeat(80));

if (issues.length === 0 && deepImports.length === 0) {
  console.log('\n✅ All packages validated successfully!\n');
} else {
  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} package.json issues:\n`);
    
    const byType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {} as Record<string, PackageIssue[]>);
    
    for (const [type, typeIssues] of Object.entries(byType)) {
      console.log(`\n${type}:`);
      for (const issue of typeIssues) {
        console.log(`  📦 ${issue.package}`);
        console.log(`     ${issue.message}`);
        if (issue.fix) {
          console.log(`     💡 Fix: ${issue.fix}`);
        }
      }
    }
  }
  
  if (deepImports.length > 0) {
    console.log(`\n\n🔴 Found ${deepImports.length} deep imports:\n`);
    
    const byFile = deepImports.reduce((acc, imp) => {
      if (!acc[imp.file]) acc[imp.file] = [];
      acc[imp.file].push(imp);
      return acc;
    }, {} as Record<string, DeepImport[]>);
    
    for (const [file, imports] of Object.entries(byFile)) {
      console.log(`\n  📄 ${file}:`);
      for (const imp of imports) {
        console.log(`     Line ${imp.line}: ${imp.import}`);
        console.log(`     → Should be: ${imp.suggested}`);
      }
    }
  }
}

console.log('\n' + '='.repeat(80));
console.log('SUMMARY');
console.log('='.repeat(80));
console.log(`Packages scanned: ${packages.length}`);
console.log(`Package.json issues: ${issues.length}`);
console.log(`Deep imports found: ${deepImports.length}`);

if (issues.length > 0 || deepImports.length > 0) {
  process.exit(1);
}
