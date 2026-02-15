/**
 * Express router endpoint inferrer.
 * Scans for router.get/post/put/delete() calls and extracts path, method, middleware.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { InferredEndpoint, HttpMethod } from '../../types.js';

const EXPRESS_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export async function inferExpressEndpoints(
  projectRoot: string
): Promise<InferredEndpoint[]> {
  const routesDir = path.join(projectRoot, 'routes');
  const srcRoutesDir = path.join(projectRoot, 'src', 'routes');
  const routesPath = fs.existsSync(routesDir) ? routesDir : srcRoutesDir;

  if (!fs.existsSync(routesPath)) {
    return inferFromIndexFiles(projectRoot);
  }

  const routeFiles = collectTsFiles(routesPath);
  const endpoints: InferredEndpoint[] = [];

  const fileContents = new Map<string, string>();
  for (const file of routeFiles) {
    fileContents.set(file, fs.readFileSync(file, 'utf-8'));
  }

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    skipLibCheck: true,
    noEmit: true,
  };

  const host = ts.createCompilerHost(compilerOptions);
  const originalReadFile = host.readFile;
  host.readFile = (fileName: string) => fileContents.get(fileName) ?? originalReadFile(fileName);

  const program = ts.createProgram(routeFiles, compilerOptions, host);

  for (const file of routeFiles) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;

    const found = extractExpressRoutes(sf, file);
    endpoints.push(...found);
  }

  return endpoints;
}

function inferFromIndexFiles(projectRoot: string): InferredEndpoint[] {
  const candidates = [
    path.join(projectRoot, 'src', 'index.ts'),
    path.join(projectRoot, 'src', 'app.ts'),
    path.join(projectRoot, 'index.ts'),
    path.join(projectRoot, 'app.ts'),
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8');
      const compilerOptions: ts.CompilerOptions = {
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        skipLibCheck: true,
        noEmit: true,
      };
      const sf = ts.createSourceFile(p, content, ts.ScriptTarget.ESNext, true);
      return extractExpressRoutes(sf, p);
    }
  }

  return [];
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function extractExpressRoutes(
  sf: ts.SourceFile,
  _filePath: string
): InferredEndpoint[] {
  const endpoints: InferredEndpoint[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const exprText = expr.getText(sf);

      for (const method of EXPRESS_METHODS) {
        const lower = method.toLowerCase();
        if (
          exprText.includes(`.${lower}`) ||
          exprText.includes(`router.${lower}`) ||
          exprText.includes(`app.${lower}`)
        ) {
          const args = node.arguments;
          if (args.length >= 1) {
            const pathArg = args[0];
            const pathText = pathArg.getText(sf).replace(/^['"]|['"]$/g, '');
            const auth = inferAuthFromMiddleware(args.slice(1), sf);

            endpoints.push({
              method,
              path: pathText,
              auth: auth ?? 'public',
              confidence: 'high',
              source: 'express',
            });
          }
          break;
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sf, visit);
  return endpoints;
}

function inferAuthFromMiddleware(
  middlewareArgs: ts.Node[],
  sf: ts.SourceFile
): 'public' | 'authenticated' | 'role' | null {
  for (const arg of middlewareArgs) {
    const text = arg.getText(sf);
    if (text.includes('auth') || text.includes('authenticate') || text.includes('requireAuth')) {
      return 'authenticated';
    }
    if (text.includes('admin') || text.includes('requireRole') || text.includes('isAdmin')) {
      return 'role';
    }
  }
  return null;
}
