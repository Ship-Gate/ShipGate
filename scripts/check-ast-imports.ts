#!/usr/bin/env tsx
/**
 * AST Import Checker
 * 
 * Enforces that AST types (Domain, Entity, Behavior, etc.) are imported
 * only from canonical sources (@isl-lang/parser or @isl-lang/isl-core).
 * 
 * Run: pnpm tsx scripts/check-ast-imports.ts
 * 
 * @see docs/adr/ADR-001-ast-type-unification.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Configuration
// ============================================================================

const CANONICAL_SOURCES = [
  '@isl-lang/parser',
  '@isl-lang/isl-core',
];

const FORBIDDEN_IMPORT_PATTERNS = [
  // Local AST type files that should be deleted
  /from ['"]\.\.?\/.*ast(-types)?\.js['"]|from ['"]\.\.?\/.*ast(-types)?['"]/,
  /from ['"]\.\.?\/.*\/ast\/types\.js['"]|from ['"]\.\.?\/.*\/ast\/types['"]/,
];

const AST_TYPES = [
  'Domain',
  'DomainDeclaration',
  'Entity',
  'EntityDeclaration',
  'Behavior',
  'BehaviorDeclaration',
  'Field',
  'FieldDeclaration',
  'ASTNode',
  'BaseNode',
  'SourceLocation',
  'SourceSpan',
];

// Packages to skip (they define canonical types or have special needs)
const SKIP_PACKAGES = [
  'packages/parser',
  'packages/isl-core',
  'master_contracts',
];

// Files to skip
const SKIP_FILES = [
  'domain-adapter.ts',
  'domain-adapter.test.ts',
];

// ============================================================================
// Violation Detection
// ============================================================================

interface Violation {
  file: string;
  line: number;
  message: string;
  code: string;
}

function checkFile(filePath: string): Violation[] {
  const violations: Violation[] = [];
  
  // Skip canonical source packages
  if (SKIP_PACKAGES.some(pkg => filePath.includes(pkg))) {
    return violations;
  }
  
  // Skip specific files
  if (SKIP_FILES.some(f => filePath.endsWith(f))) {
    return violations;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    
    // Check for forbidden import patterns
    for (const pattern of FORBIDDEN_IMPORT_PATTERNS) {
      if (pattern.test(line)) {
        // Check if it imports AST types
        const hasAstType = AST_TYPES.some(type => 
          line.includes(type) || 
          new RegExp(`\\b${type}\\b`).test(line)
        );
        
        if (hasAstType) {
          violations.push({
            file: filePath,
            line: lineNum,
            message: `Import AST types from canonical sources (${CANONICAL_SOURCES.join(' or ')}) instead of local files`,
            code: line.trim(),
          });
        }
      }
    }
    
    // Check for imports of AST types from non-canonical packages
    const importMatch = line.match(/import\s+(?:type\s+)?{([^}]+)}\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const importedItems = importMatch[1];
      const source = importMatch[2];
      
      // Skip if from canonical source
      if (CANONICAL_SOURCES.some(s => source.startsWith(s))) {
        return;
      }
      
      // Skip relative imports within the same package (they might be re-exports)
      if (source.startsWith('.') && !FORBIDDEN_IMPORT_PATTERNS.some(p => p.test(line))) {
        return;
      }
      
      // Check if importing AST types from non-canonical package
      const importedAstTypes = AST_TYPES.filter(type => 
        new RegExp(`\\b${type}\\b`).test(importedItems)
      );
      
      if (importedAstTypes.length > 0 && source.startsWith('@isl-lang/')) {
        // Check if this is a package that shouldn't export AST types
        const nonCanonicalSources = [
          '@isl-lang/isl-federation',
          '@isl-lang/versioner',
          '@isl-lang/codegen-go',
          '@isl-lang/codegen-rust',
          '@isl-lang/codegen-loadtest',
          '@isl-lang/security-policies',
        ];
        
        if (nonCanonicalSources.some(s => source.startsWith(s))) {
          violations.push({
            file: filePath,
            line: lineNum,
            message: `Import ${importedAstTypes.join(', ')} from ${CANONICAL_SOURCES.join(' or ')}, not from ${source}`,
            code: line.trim(),
          });
        }
      }
    }
  });
  
  return violations;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('🔍 Checking AST imports...\n');
  
  const files = await glob('packages/**/*.ts', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/*.test.ts',
      '**/*.spec.ts',
    ],
  });
  
  let totalViolations = 0;
  const violationsByFile = new Map<string, Violation[]>();
  
  for (const file of files) {
    const violations = checkFile(file);
    if (violations.length > 0) {
      violationsByFile.set(file, violations);
      totalViolations += violations.length;
    }
  }
  
  // Report violations
  if (totalViolations === 0) {
    console.log('✅ No AST import violations found!\n');
    process.exit(0);
  }
  
  console.log(`❌ Found ${totalViolations} violation(s) in ${violationsByFile.size} file(s):\n`);
  
  for (const [file, violations] of violationsByFile) {
    console.log(`📄 ${file}`);
    for (const v of violations) {
      console.log(`   Line ${v.line}: ${v.message}`);
      console.log(`   > ${v.code}\n`);
    }
  }
  
  console.log('\n📚 See docs/adr/ADR-001-ast-type-unification.md for migration guide.\n');
  
  // Exit with error if running in CI
  if (process.env.CI) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
