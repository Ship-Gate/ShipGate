/**
 * Fastify route inferrer.
 * Scans for fastify.get/post/put/delete() and route registrations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { InferredEndpoint, HttpMethod } from '../../types.js';

const FASTIFY_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

export async function inferFastifyEndpoints(
  projectRoot: string
): Promise<InferredEndpoint[]> {
  const srcDir = path.join(projectRoot, 'src');
  const rootDir = projectRoot;
  const dirs = fs.existsSync(srcDir) ? [srcDir, rootDir] : [rootDir];

  const tsFiles: string[] = [];
  for (const d of dirs) {
    tsFiles.push(...collectTsFiles(d));
  }

  const endpoints: InferredEndpoint[] = [];
  const fileContents = new Map<string, string>();

  for (const file of tsFiles) {
    try {
      fileContents.set(file, fs.readFileSync(file, 'utf-8'));
    } catch {
      continue;
    }
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

  const program = ts.createProgram(Array.from(fileContents.keys()), compilerOptions, host);

  for (const [file] of fileContents) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;

    const found = extractFastifyRoutes(sf);
    endpoints.push(...found);
  }

  return endpoints;
}

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(full);
    }
  }
  return results;
}

function extractFastifyRoutes(sf: ts.SourceFile): InferredEndpoint[] {
  const endpoints: InferredEndpoint[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      const exprText = expr.getText(sf);

      for (const method of FASTIFY_METHODS) {
        const lower = method.toLowerCase();
        if (
          exprText.includes(`.${lower}`) ||
          exprText.includes(`fastify.${lower}`) ||
          exprText.includes(`app.${lower}`)
        ) {
          const args = node.arguments;
          if (args.length >= 1) {
            const pathArg = args[0];
            let pathText = pathArg.getText(sf).replace(/^['"]|['"]$/g, '');

            if (args.length >= 2) {
              const optsText = args[1].getText(sf);
              const urlMatch = optsText.match(/url:\s*['"]([^'"]+)['"]/);
              const pathMatch = optsText.match(/path:\s*['"]([^'"]+)['"]/);
              pathText = (urlMatch?.[1] ?? pathMatch?.[1]) || pathText;
            }

            endpoints.push({
              method,
              path: pathText,
              confidence: 'high',
              source: 'fastify',
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
