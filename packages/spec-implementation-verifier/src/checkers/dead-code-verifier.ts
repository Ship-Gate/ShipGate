/**
 * Dead Code Detection Checker
 *
 * - Exported functions never imported/called anywhere
 * - Routes defined but unreachable (no link, no client call)
 * - Files that exist but are never imported
 * - Flag: dead export = low, dead route = medium, orphan file = low
 */

import * as ts from 'typescript';
import type { Finding, VerificationContext } from '../types.js';

const CHECKER_NAME = 'DeadCodeVerifier';

function makeId(prefix: string, ...parts: string[]): string {
  return `${prefix}-${parts.join('-').replace(/[^a-z0-9-]/gi, '')}`.slice(0, 80);
}

/** Extract exported function/class names from a file */
function getExportedNames(
  content: string,
  filePath: string
): Array<{ name: string; line: number; kind: 'function' | 'class' | 'const' }> {
  const exported: Array<{ name: string; line: number; kind: 'function' | 'class' | 'const' }> = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (isExported) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        exported.push({ name: node.name.text, line: line + 1, kind: 'function' });
      }
    }
    if (ts.isClassDeclaration(node) && node.name) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (isExported) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        exported.push({ name: node.name.text, line: line + 1, kind: 'class' });
      }
    }
    if (ts.isVariableStatement(node)) {
      const isExported = node.modifiers?.some(
        (m) => m.kind === ts.SyntaxKind.ExportKeyword
      );
      if (isExported) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
            exported.push({ name: decl.name.text, line: line + 1, kind: 'const' });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return exported;
}

/** Check if a symbol is imported or used in any other file */
function isSymbolUsed(
  symbolName: string,
  fromFile: string,
  implFiles: Map<string, string>
): boolean {
  for (const [filePath, content] of implFiles) {
    if (filePath === fromFile) continue;

    // Import: import { X } or import X or import * as X
    const importRegex = new RegExp(
      `import\\s+.*\\b${escapeRegex(symbolName)}\\b`,
      'g'
    );
    if (importRegex.test(content)) return true;

    // Dynamic import
    if (new RegExp(`import\\s*\\([^)]*${escapeRegex(symbolName)}`).test(content))
      return true;

    // Direct reference (e.g. function call) - simplistic
    const refRegex = new RegExp(`\\b${escapeRegex(symbolName)}\\s*\\(`, 'g');
    if (refRegex.test(content)) return true;
  }
  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Check if a file is imported by any other file */
function isFileImported(
  filePath: string,
  implFiles: Map<string, string>
): boolean {
  const baseName = filePath.replace(/\.(ts|tsx|js|jsx)$/, '');
  const pathVariants = [
    filePath,
    baseName,
    './' + filePath.split(/[/\\]/).pop(),
  ];

  for (const [otherPath, content] of implFiles) {
    if (otherPath === filePath) continue;
    for (const variant of pathVariants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`from\\s+['"\`]${escaped}['"\`]`).test(content)) {
        return true;
      }
      if (new RegExp(`require\\s*\\(\\s*['"\`]${escaped}['"\`]`).test(content)) {
        return true;
      }
    }
  }
  return false;
}

/** Extract route registrations to check if they're reachable */
function getRouteRegistrations(
  implFiles: Map<string, string>
): Array<{ method: string; path: string; file: string }> {
  const routes: Array<{ method: string; path: string; file: string }> = [];
  const routeRe = /\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  for (const [filePath, content] of implFiles) {
    let match: RegExpExecArray | null;
    while ((match = routeRe.exec(content)) !== null) {
      routes.push({
        method: (match[1] ?? 'GET').toUpperCase(),
        path: match[2] ?? '/',
        file: filePath,
      });
    }
  }
  return routes;
}

/** Check if a route is called from client code (fetch, axios, etc.) */
function isRouteCalled(
  method: string,
  path: string,
  implFiles: Map<string, string>
): boolean {
  const pathPattern = path.replace(/:[^/]+/g, '[^/]+');
  for (const content of implFiles.values()) {
    if (/\bfetch\s*\(/.test(content) && new RegExp(pathPattern).test(content))
      return true;
    if (/\baxios\.\w+\s*\(/.test(content) && new RegExp(pathPattern).test(content))
      return true;
    if (/\brequest\s*\(/.test(content) && new RegExp(pathPattern).test(content))
      return true;
  }
  return false;
}

export async function runDeadCodeVerifier(
  ctx: VerificationContext
): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Dead exports
  for (const [filePath, content] of ctx.implFiles) {
    if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) continue;

    const exported = getExportedNames(content, filePath);
    for (const exp of exported) {
      if (!isSymbolUsed(exp.name, filePath, ctx.implFiles)) {
        findings.push({
          id: makeId('dead-export', filePath, exp.name),
          checker: CHECKER_NAME,
          ruleId: 'dead-code/dead-export',
          severity: 'low',
          message: `Exported ${exp.kind} "${exp.name}" is never imported or called`,
          file: filePath,
          line: exp.line,
          blocking: false,
          recommendation: 'Remove if unused, or ensure it is imported elsewhere.',
          context: { symbolName: exp.name, kind: exp.kind },
        });
      }
    }
  }

  // Orphan files (never imported)
  const entryPatterns = [
    /\/index\.(ts|tsx|js|jsx)$/,
    /\/route\.(ts|tsx|js|jsx)$/,
    /\/page\.(ts|tsx|js|jsx)$/,
    /\/layout\.(ts|tsx|js|jsx)$/,
    /\/app\.(ts|tsx|js|jsx)$/,
    /\/main\.(ts|tsx|js|jsx)$/,
  ];
  for (const filePath of ctx.implFiles.keys()) {
    const isEntry = entryPatterns.some((p) => p.test(filePath));
    if (isEntry) continue; // Entry points are not orphans

    if (!isFileImported(filePath, ctx.implFiles)) {
      findings.push({
        id: makeId('orphan-file', filePath),
        checker: CHECKER_NAME,
        ruleId: 'dead-code/orphan-file',
        severity: 'low',
        message: `File "${filePath}" is never imported by any other file`,
        file: filePath,
        blocking: false,
        recommendation: 'Verify this file is needed; it may be dead code or an unused module.',
        context: { filePath },
      });
    }
  }

  // Dead routes (defined but no client call)
  const routes = getRouteRegistrations(ctx.implFiles);
  for (const route of routes) {
    if (!isRouteCalled(route.method, route.path, ctx.implFiles)) {
      findings.push({
        id: makeId('dead-route', route.file, route.method, route.path),
        checker: CHECKER_NAME,
        ruleId: 'dead-code/dead-route',
        severity: 'medium',
        message: `Route ${route.method} ${route.path} has no client call (fetch/axios)`,
        file: route.file,
        blocking: false,
        recommendation: 'Ensure the route is called from frontend or remove if unused.',
        context: { method: route.method, path: route.path },
      });
    }
  }

  return findings;
}
