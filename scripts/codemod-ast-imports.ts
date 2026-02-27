#!/usr/bin/env tsx
/**
 * AST Import Codemod
 * 
 * Automatically rewrites imports of AST types from non-canonical sources
 * to the canonical @isl-lang/parser package.
 * 
 * Usage:
 *   pnpm tsx scripts/codemod-ast-imports.ts --dry-run   # Preview changes
 *   pnpm tsx scripts/codemod-ast-imports.ts             # Apply changes
 *   pnpm tsx scripts/codemod-ast-imports.ts --fix       # Apply and format
 * 
 * @see docs/adr/ADR-001-ast-type-unification.md
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

// ============================================================================
// Configuration
// ============================================================================

const CANONICAL_SOURCE = '@isl-lang/parser';

const SOURCES_TO_MIGRATE = new Map<string, string>([
  // Package-level imports to replace
  ['@isl-lang/isl-federation', CANONICAL_SOURCE],
  ['@isl-lang/isl-federation/ast', CANONICAL_SOURCE],
  ['@isl-lang/versioner/ast-types', CANONICAL_SOURCE],
  ['@isl-lang/codegen-go/ast-types', CANONICAL_SOURCE],
  ['@isl-lang/codegen-rust/ast-types', CANONICAL_SOURCE],
  ['@isl-lang/codegen-loadtest/ast-types', CANONICAL_SOURCE],
]);

// File-level imports to replace (relative paths)
const RELATIVE_AST_PATTERNS = [
  /\.\.?\/.*ast\.js/,
  /\.\.?\/.*ast-types\.js/,
  /\.\.?\/.*ast\/types\.js/,
  /\.\.?\/.*ast$/,
  /\.\.?\/.*ast-types$/,
];

// Types that should be imported from parser
const PARSER_TYPES = [
  'Domain',
  'Entity',
  'Behavior',
  'Field',
  'ASTNode',
  'SourceLocation',
  'Import',
  'TypeDeclaration',
  'TypeDefinition',
  'Expression',
  'Identifier',
  'StringLiteral',
  'NumberLiteral',
  'BooleanLiteral',
  // Add more as needed
];

// Types from isl-core that should stay (different shape)
const ISL_CORE_TYPES = [
  'DomainDeclaration',
  'EntityDeclaration',
  'BehaviorDeclaration',
  'FieldDeclaration',
  'BaseNode',
  'SourceSpan',
];

// Packages to skip
const SKIP_PACKAGES = [
  'packages/parser',
  'packages/isl-core',
  'master_contracts',
];

// ============================================================================
// Transform Logic
// ============================================================================

interface Transform {
  file: string;
  original: string;
  transformed: string;
  changes: string[];
}

function transformFile(filePath: string): Transform | null {
  // Skip canonical source packages
  if (SKIP_PACKAGES.some(pkg => filePath.includes(pkg))) {
    return null;
  }
  
  const original = fs.readFileSync(filePath, 'utf-8');
  let transformed = original;
  const changes: string[] = [];
  
  const lines = transformed.split('\n');
  const newLines: string[] = [];
  const importedFromParser = new Set<string>();
  const importLinesToRemove = new Set<number>();
  
  // First pass: identify imports to migrate
  lines.forEach((line, idx) => {
    let modified = line;
    
    // Check for imports from sources to migrate
    for (const [source, target] of SOURCES_TO_MIGRATE) {
      const importRegex = new RegExp(
        `import\\s+(?:type\\s+)?{([^}]+)}\\s+from\\s+['"]${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
        'g'
      );
      
      const match = line.match(importRegex);
      if (match) {
        const importedItems = match[0].match(/{([^}]+)}/)?.[1] || '';
        const types = importedItems.split(',').map(t => t.trim()).filter(Boolean);
        
        // Separate parser types from isl-core types
        const parserTypes = types.filter(t => !ISL_CORE_TYPES.includes(t.split(/\s+as\s+/)[0]));
        const coreTypes = types.filter(t => ISL_CORE_TYPES.includes(t.split(/\s+as\s+/)[0]));
        
        if (parserTypes.length > 0) {
          parserTypes.forEach(t => importedFromParser.add(t));
          changes.push(`Migrate ${parserTypes.join(', ')} from ${source} to ${target}`);
        }
        
        if (coreTypes.length > 0) {
          // Keep core types in a separate import
          modified = `import type { ${coreTypes.join(', ')} } from '@isl-lang/isl-core';`;
          changes.push(`Keep ${coreTypes.join(', ')} from @isl-lang/isl-core`);
        } else {
          importLinesToRemove.add(idx);
        }
      }
    }
    
    // Check for relative AST imports
    for (const pattern of RELATIVE_AST_PATTERNS) {
      if (pattern.test(line)) {
        const importMatch = line.match(/import\s+(?:type\s+)?{([^}]+)}/);
        if (importMatch) {
          const importedItems = importMatch[1];
          const types = importedItems.split(',').map(t => t.trim()).filter(Boolean);
          
          const parserTypes = types.filter(t => {
            const typeName = t.split(/\s+as\s+/)[0];
            return PARSER_TYPES.includes(typeName) || !ISL_CORE_TYPES.includes(typeName);
          });
          
          if (parserTypes.length > 0) {
            parserTypes.forEach(t => importedFromParser.add(t));
            importLinesToRemove.add(idx);
            changes.push(`Migrate relative import: ${parserTypes.join(', ')} to ${CANONICAL_SOURCE}`);
          }
        }
      }
    }
    
    newLines.push(modified);
  });
  
  // Second pass: add consolidated parser import and remove old lines
  if (importedFromParser.size > 0) {
    const sortedTypes = Array.from(importedFromParser).sort();
    const parserImport = `import type { ${sortedTypes.join(', ')} } from '${CANONICAL_SOURCE}';`;
    
    // Find the best place to insert (after existing @isl-lang imports or at top)
    let insertIdx = 0;
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].match(/import.*from\s+['"]@isl-lang/)) {
        insertIdx = i + 1;
      }
    }
    
    // Filter out removed lines and insert new import
    const finalLines = newLines
      .filter((_, idx) => !importLinesToRemove.has(idx))
      .map((line, idx) => {
        if (idx === insertIdx) {
          return parserImport + '\n' + line;
        }
        return line;
      });
    
    transformed = finalLines.join('\n');
    
    // If we couldn't insert at a good spot, prepend
    if (!transformed.includes(parserImport)) {
      transformed = parserImport + '\n\n' + transformed;
    }
  }
  
  if (changes.length === 0) {
    return null;
  }
  
  return {
    file: filePath,
    original,
    transformed,
    changes,
  };
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fix = args.includes('--fix');
  
  console.log('🔄 AST Import Codemod');
  console.log(dryRun ? '   Mode: DRY RUN (no changes will be made)\n' : '   Mode: APPLY\n');
  
  const files = await glob('packages/**/*.ts', {
    ignore: [
      '**/node_modules/**',
      '**/dist/**',
      '**/*.d.ts',
    ],
  });
  
  const transforms: Transform[] = [];
  
  for (const file of files) {
    const transform = transformFile(file);
    if (transform) {
      transforms.push(transform);
    }
  }
  
  if (transforms.length === 0) {
    console.log('✅ No files need transformation.\n');
    return;
  }
  
  console.log(`📝 Found ${transforms.length} file(s) to transform:\n`);
  
  for (const transform of transforms) {
    console.log(`📄 ${transform.file}`);
    for (const change of transform.changes) {
      console.log(`   → ${change}`);
    }
    console.log();
    
    if (!dryRun) {
      fs.writeFileSync(transform.file, transform.transformed, 'utf-8');
      console.log(`   ✅ Written\n`);
    }
  }
  
  if (dryRun) {
    console.log('\n💡 Run without --dry-run to apply changes.');
  } else {
    console.log(`\n✅ Transformed ${transforms.length} file(s).`);
    
    if (fix) {
      console.log('🔧 Running formatter...');
      const { execSync } = await import('child_process');
      try {
        execSync('pnpm -r exec prettier --write "src/**/*.ts"', { stdio: 'inherit' });
      } catch {
        console.log('   (Formatter not available or failed)');
      }
    }
  }
  
  // Generate report
  console.log('\n📊 Summary Report:');
  console.log(`   Files scanned: ${files.length}`);
  console.log(`   Files transformed: ${transforms.length}`);
  console.log(`   Total changes: ${transforms.reduce((acc, t) => acc + t.changes.length, 0)}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
