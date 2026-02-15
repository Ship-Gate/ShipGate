/**
 * Next.js App Router endpoint inferrer.
 * Scans app/api/.../route.ts for GET, POST, PUT, PATCH, DELETE exports.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { InferredEndpoint, HttpMethod } from '../../types.js';

const METHOD_EXPORTS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export async function inferNextJsEndpoints(
  projectRoot: string
): Promise<InferredEndpoint[]> {
  const appDir = path.join(projectRoot, 'app');
  if (!fs.existsSync(appDir)) return [];

  const routeFiles = findRouteFiles(appDir, '');
  const endpoints: InferredEndpoint[] = [];

  const fileContents = new Map<string, string>();
  for (const routeFile of routeFiles) {
    const fullPath = path.join(appDir, routeFile);
    if (fs.existsSync(fullPath)) {
      fileContents.set(fullPath, fs.readFileSync(fullPath, 'utf-8'));
    }
  }

  const files = Array.from(fileContents.keys());
  if (files.length === 0) return [];

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile;
  host.readFile = (fileName: string) => fileContents.get(fileName) ?? originalReadFile(fileName);

  const program = ts.createProgram(files, compilerOptions, host);

  for (const file of files) {
    if (!file.includes('route.ts') && !file.includes('route.tsx')) continue;

    const sf = program.getSourceFile(file);
    if (!sf) continue;

    const relativePath = path.relative(path.join(projectRoot, 'app'), file);
    const apiPath = pathToApiPath(relativePath);

    const exported = sf.getChildCount() > 0 ? getExportedNames(sf) : [];

    for (const name of exported) {
      if (METHOD_EXPORTS.includes(name as HttpMethod)) {
        const method = name as HttpMethod;
        const auth = inferAuthFromFile(fileContents.get(file) ?? '');
        const { requestBody, responseType, errors } = inferTypesFromFile(fileContents.get(file) ?? '');

        endpoints.push({
          method,
          path: apiPath,
          basePath: '/api',
          requestBody,
          responseType,
          auth: auth ?? 'public',
          errors,
          confidence: 'high',
          source: 'nextjs',
        });
      }
    }
  }

  return endpoints;
}

function getExportedNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  ts.forEachChild(sf, (node) => {
    if (ts.isFunctionDeclaration(node) && node.name) {
      if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        names.push(node.name.getText(sf));
      }
    } else if (ts.isVariableStatement(node)) {
      if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            names.push(decl.name.getText(sf));
          }
        }
      }
    }
  });
  return names;
}

function findRouteFiles(dir: string, prefix: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const rel = path.join(prefix, entry.name);

    if (entry.isDirectory()) {
      results.push(...findRouteFiles(path.join(dir, entry.name), rel));
    } else if (entry.name === 'route.ts' || entry.name === 'route.tsx') {
      results.push(rel);
    }
  }

  return results;
}

function pathToApiPath(relativePath: string): string {
  return '/' + relativePath
    .replace(/[\\/]route\.(ts|tsx)$/, '')
    .replace(/\\/g, '/')
    .replace(/^api\/?/, '')
    .replace(/\[([^\]]+)\]/g, ':$1');
}

function inferAuthFromFile(text: string): 'public' | 'authenticated' | 'role' | null {
  if (text.includes('getServerSession') || text.includes('auth()') || text.includes('auth(')) {
    return 'authenticated';
  }
  if (text.includes('session') && (text.includes('role') || text.includes('admin'))) {
    return 'role';
  }
  return null;
}

function inferTypesFromFile(text: string): {
  requestBody?: string;
  responseType?: string;
  errors?: { code: string; when: string; retriable?: boolean }[];
} {
  const result: {
    requestBody?: string;
    responseType?: string;
    errors?: { code: string; when: string; retriable?: boolean }[];
  } = {};

  if (text.includes('request.json') || text.includes('Request')) {
    result.requestBody = 'unknown';
  }
  if (text.includes('NextResponse.json')) {
    result.responseType = 'unknown';
  }
  const statusMatch = text.match(/status:\s*(\d+)/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);
    result.errors = [
      { code: `HTTP_${status}`, when: `HTTP ${status}`, retriable: status >= 500 },
    ];
  }

  return result;
}
