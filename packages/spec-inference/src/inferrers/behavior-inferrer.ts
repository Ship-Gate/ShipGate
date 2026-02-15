/**
 * Behavior inferrer.
 * Scans service functions for CRUD operations, preconditions, postconditions, side effects.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import type { InferredBehavior } from '../types.js';

const CRUD_PATTERNS = ['create', 'update', 'delete', 'get', 'find', 'list', 'add', 'remove'];
const SERVICE_DIRS = ['services', 'lib', 'src/services', 'src/lib'];

export async function inferBehaviors(
  projectRoot: string,
  sourceFiles: string[]
): Promise<InferredBehavior[]> {
  const filesToScan = sourceFiles.length > 0
    ? sourceFiles
    : collectServiceFiles(projectRoot);

  const fileContents = new Map<string, string>();
  for (const file of filesToScan) {
    try {
      fileContents.set(file, await fs.promises.readFile(file, 'utf-8'));
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
  const behaviors: InferredBehavior[] = [];

  for (const file of filesToScan) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;

    ts.forEachChild(sf, (node) => {
      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.getText(sf);
        if (!isUtilityFunction(name)) {
          const isCrudLike = CRUD_PATTERNS.some((p) => name.toLowerCase().includes(p));
          const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
          if (isCrudLike || isExported) {
            const behavior = extractBehavior(node, sf);
            if (behavior) behaviors.push(behavior);
          }
        }
      } else if (ts.isVariableStatement(node)) {
        const isExported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
        if (!isExported) return;

        for (const decl of node.declarationList.declarations) {
          const name = (decl.name as ts.Identifier)?.getText(sf);
          if (!name) continue;

          const isCrudLike = CRUD_PATTERNS.some((p) => name.toLowerCase().includes(p));
          if (!isCrudLike) continue;

          const init = decl.initializer;
          if (init && ts.isArrowFunction(init)) {
            const behavior = extractBehaviorFromArrow(init, name, sf);
            if (behavior) behaviors.push(behavior);
          }
        }
      }
    });
  }

  return behaviors;
}

function collectServiceFiles(projectRoot: string): string[] {
  const results: string[] = [];

  for (const dir of SERVICE_DIRS) {
    const full = path.join(projectRoot, dir);
    if (fs.existsSync(full)) {
      results.push(...collectTsFiles(full));
    }
  }

  if (results.length === 0) {
    const src = path.join(projectRoot, 'src');
    if (fs.existsSync(src)) {
      results.push(...collectTsFiles(src));
    }
  }

  return results;
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

function isUtilityFunction(name: string): boolean {
  return /^(get|set|is|has|to|from|_)/.test(name) || /Helper$|Util$/.test(name);
}

function extractBehavior(
  func: ts.FunctionDeclaration,
  sf: ts.SourceFile
): InferredBehavior | null {
  const name = func.name?.getText(sf);
  if (!name) return null;

  const params = func.parameters;
  const input: Record<string, { type: string; optional?: boolean }> = {};
  for (const p of params) {
    const typeStr = p.type?.getText(sf) ?? 'unknown';
    input[p.name.getText(sf)] = {
      type: mapTsTypeToIsl(typeStr),
      optional: !!p.questionToken,
    };
  }

  const returnType = func.type;
  const successType = returnType ? mapTsTypeToIsl(returnType.getText(sf)) : 'unknown';

  const body = func.body;
  const preconditions = body ? extractPreconditions(body, sf) : [];
  const postconditions = body ? extractPostconditions(body, name) : [];
  const sideEffects = body ? extractSideEffects(body, sf) : [];

  return {
    name,
    description: toSentenceCase(name),
    input,
    output: { success: successType },
    preconditions: preconditions.length ? preconditions : undefined,
    postconditions: postconditions.length ? postconditions : undefined,
    sideEffects: sideEffects.length ? sideEffects : undefined,
    confidence: 'medium',
    source: 'typescript',
  };
}

function extractBehaviorFromArrow(
  arrow: ts.ArrowFunction,
  name: string,
  sf: ts.SourceFile
): InferredBehavior | null {
  const params = arrow.parameters;
  const input: Record<string, { type: string; optional?: boolean }> = {};
  for (const p of params) {
    const typeStr = p.type?.getText(sf) ?? 'unknown';
    input[p.name.getText(sf)] = {
      type: mapTsTypeToIsl(typeStr),
      optional: !!p.questionToken,
    };
  }

  const returnType = arrow.type;
  const successType = returnType ? mapTsTypeToIsl(returnType.getText(sf)) : 'unknown';

  const body = arrow.body;
  let preconditions: string[] = [];
  let postconditions: string[] = [];
  let sideEffects: string[] = [];

  if (body && ts.isBlock(body)) {
    preconditions = extractPreconditions(body, sf);
    postconditions = extractPostconditions(body, name);
    sideEffects = extractSideEffects(body, sf);
  }

  return {
    name,
    description: toSentenceCase(name),
    input,
    output: { success: successType },
    preconditions: preconditions.length ? preconditions : undefined,
    postconditions: postconditions.length ? postconditions : undefined,
    sideEffects: sideEffects.length ? sideEffects : undefined,
    confidence: 'medium',
    source: 'typescript',
  };
}

function extractPreconditions(block: ts.Block, sf: ts.SourceFile): string[] {
  const pre: string[] = [];

  for (const stmt of block.statements) {
    if (ts.isIfStatement(stmt)) {
      const cond = stmt.expression.getText(sf);
      const thenStmt = stmt.thenStatement;
      const thenText = ts.isBlock(thenStmt)
        ? thenStmt.statements.map((s) => s.getText(sf)).join(' ')
        : thenStmt.getText(sf);
      if (thenText.includes('throw') || thenText.includes('return')) {
        pre.push(cond);
      }
    }
  }

  return pre;
}

function extractPostconditions(_block: ts.Block, funcName: string): string[] {
  const post: string[] = [];
  const lower = funcName.toLowerCase();
  if (lower.includes('create')) post.push('result.id != null');
  if (lower.includes('delete')) post.push('success');
  if (lower.includes('update')) post.push('result != null');
  return post;
}

function extractSideEffects(block: ts.Block, sf: ts.SourceFile): string[] {
  const effects: string[] = [];
  const text = block.getText(sf);

  if (text.includes('send') || text.includes('email') || text.includes('mail')) {
    effects.push('email');
  }
  if (text.includes('emit') || text.includes('publish')) effects.push('event');
  if (text.includes('fetch') || text.includes('axios') || text.includes('http')) effects.push('http');
  if (text.includes('create') && (text.includes('prisma') || text.includes('db') || text.includes('model'))) {
    effects.push('db_create');
  }
  if (text.includes('update') && (text.includes('prisma') || text.includes('db') || text.includes('model'))) {
    effects.push('db_update');
  }
  if (text.includes('delete') && (text.includes('prisma') || text.includes('db') || text.includes('model'))) {
    effects.push('db_delete');
  }

  return effects;
}

function mapTsTypeToIsl(tsType: string): string {
  const n = tsType.replace(/\s/g, '');
  if (n.includes('string')) return 'String';
  if (n.includes('number')) return 'Int';
  if (n.includes('boolean')) return 'Boolean';
  if (n.includes('Date')) return 'Timestamp';
  if (n.includes('Promise<')) return mapTsTypeToIsl(n.replace(/Promise<|>/g, ''));
  if (n.includes('[]') || n.includes('Array<')) return 'List<String>';
  return 'String';
}

function toSentenceCase(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[._]/g, ' ')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
