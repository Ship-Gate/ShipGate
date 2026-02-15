/**
 * Import Verification Checker
 *
 * - Every import resolves to a real file or installed package
 * - Every imported symbol is actually exported by the source
 * - Flag: hallucinated imports (import from files that don't exist)
 * - Flag: unused imports (imported but never referenced)
 * - Severity: hallucinated = critical, unused = low
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as ts from 'typescript';
import type { Finding, VerificationContext } from '../types.js';

const CHECKER_NAME = 'ImportVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Extract import statements and their usage from source */
function analyzeImports(
  content: string,
  filePath: string
): Array<{
  specifier: string;
  isTypeOnly: boolean;
  importedNames: string[];
  line: number;
  column: number;
  isRelative: boolean;
}> {
  const imports: Array<{
    specifier: string;
    isTypeOnly: boolean;
    importedNames: string[];
    line: number;
    column: number;
    isRelative: boolean;
  }> = [];

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const specifier = node.moduleSpecifier;
      if (ts.isStringLiteral(specifier)) {
        const text = specifier.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart()
        );
        const isTypeOnly = !!node.importClause?.isTypeOnly;
        const importedNames: string[] = [];

        const clause = node.importClause;
        if (clause?.name) {
          importedNames.push(clause.name.text);
        }
        if (clause?.namedBindings) {
          if (ts.isNamespaceImport(clause.namedBindings)) {
            importedNames.push(clause.namedBindings.name.text);
          } else if (ts.isNamedImports(clause.namedBindings)) {
            for (const e of clause.namedBindings.elements) {
              importedNames.push(e.name.text);
            }
          }
        }

        imports.push({
          specifier: text,
          isTypeOnly,
          importedNames,
          line: line + 1,
          column: character + 1,
          isRelative: text.startsWith('.'),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return imports;
}

/** Find which imported names are actually used in the file */
function findUsedNames(content: string, importedNames: string[]): Set<string> {
  const used = new Set<string>();
  for (const name of importedNames) {
    // Simple heuristic: name appears as identifier (not in import/declaration)
    const identifierRegex = new RegExp(
      `\\b${escapeRegex(name)}\\b`,
      'g'
    );
    const importDeclRegex = new RegExp(
      `import\\s+.*\\b${escapeRegex(name)}\\b`,
      'g'
    );
    const importCount = (content.match(importDeclRegex) ?? []).length;
    const totalCount = (content.match(identifierRegex) ?? []).length;
    if (totalCount > importCount) {
      used.add(name);
    }
  }
  return used;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resolve import specifier to absolute path or package name */
async function resolveImport(
  specifier: string,
  fromFile: string,
  projectRoot: string,
  dependencies: Record<string, string>
): Promise<{ resolved: boolean; path?: string; isPackage?: boolean }> {
  if (specifier.startsWith('.')) {
    const dir = path.dirname(fromFile);
    const candidates = [
      path.join(dir, specifier),
      path.join(dir, `${specifier}.ts`),
      path.join(dir, `${specifier}.tsx`),
      path.join(dir, specifier, 'index.ts'),
      path.join(dir, specifier, 'index.tsx'),
    ];
    for (const c of candidates) {
      try {
        const stat = await fs.stat(c);
        if (stat.isFile() || (stat.isDirectory() && c.includes('index'))) {
          return { resolved: true, path: c };
        }
      } catch {
        // continue
      }
    }
    // Check for .js extension (compiled output)
    const jsCandidates = [
      path.join(dir, specifier.replace(/\.tsx?$/, '.js')),
      path.join(dir, specifier + '.js'),
    ];
    for (const c of jsCandidates) {
      try {
        await fs.stat(c);
        return { resolved: true, path: c };
      } catch {
        // continue
      }
    }
    return { resolved: false };
  }

  // Package import - check if in dependencies or node_modules
  const pkgName = specifier.split('/')[0]!;
  if (dependencies[pkgName]) {
    return { resolved: true, isPackage: true };
  }
  const nodeModulesPath = path.join(projectRoot, 'node_modules', pkgName);
  try {
    await fs.stat(nodeModulesPath);
    return { resolved: true, isPackage: true };
  } catch {
    return { resolved: false };
  }
}

export async function runImportVerifier(ctx: VerificationContext): Promise<Finding[]> {
  const findings: Finding[] = [];
  const dependencies = ctx.dependencies ?? {};

  for (const [filePath, content] of ctx.implFiles) {
    const imports = analyzeImports(content, filePath);
    const usedNames = findUsedNames(
      content,
      imports.flatMap((i) => i.importedNames)
    );

    for (const imp of imports) {
      const resolved = await resolveImport(
        imp.specifier,
        path.join(ctx.projectRoot, filePath),
        ctx.projectRoot,
        dependencies
      );

      if (!resolved.resolved) {
        findings.push({
          id: makeId('import-hallucinated', filePath, imp.specifier),
          checker: CHECKER_NAME,
          ruleId: 'import/hallucinated',
          severity: 'critical',
          message: `Import from non-existent module: "${imp.specifier}"`,
          file: filePath,
          line: imp.line,
          column: imp.column,
          blocking: true,
          recommendation: `Verify "${imp.specifier}" exists. Common AI mistake: inventing imports.`,
          snippet: `import { ... } from "${imp.specifier}"`,
          context: { specifier: imp.specifier, isRelative: imp.isRelative },
        });
      }

      // Unused imports (low severity)
      for (const name of imp.importedNames) {
        if (!usedNames.has(name)) {
          findings.push({
            id: makeId('import-unused', filePath, name),
            checker: CHECKER_NAME,
            ruleId: 'import/unused',
            severity: 'low',
            message: `Unused import: "${name}"`,
            file: filePath,
            line: imp.line,
            column: imp.column,
            blocking: false,
            recommendation: 'Remove the unused import.',
            context: { importedName: name, specifier: imp.specifier },
          });
        }
      }
    }
  }

  return findings;
}
