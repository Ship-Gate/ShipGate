/**
 * Zod schema inferrer.
 * Uses TypeScript compiler API to parse Zod schemas and extract validation constraints.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import type { InferredEntity, InferredField } from '../../types.js';

export async function inferFromZod(
  sourceFiles: string[],
  _projectRoot: string
): Promise<InferredEntity[]> {
  const fileContents = new Map<string, string>();
  for (const file of sourceFiles) {
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

  const program = ts.createProgram(sourceFiles, compilerOptions, host);
  const entities: InferredEntity[] = [];

  for (const file of sourceFiles) {
    const sf = program.getSourceFile(file);
    if (!sf) continue;

    ts.forEachChild(sf, (node) => {
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          const init = decl.initializer;
          if (init && ts.isCallExpression(init)) {
            const expr = init.expression;
            const exprText = expr.getText(sf);
            if (exprText.includes('z.object') || exprText.includes('.object')) {
              const name = (decl.name as ts.Identifier).getText(sf);
              const args = init.arguments;
              if (args.length > 0 && ts.isObjectLiteralExpression(args[0])) {
                const fields = extractZodFields(args[0], sf);
                if (fields.length > 0) {
                  entities.push({
                    name: name ?? 'AnonymousSchema',
                    fields,
                    confidence: 'high',
                    source: 'zod',
                  });
                }
              }
            }
          }
        }
      }
    });
  }

  return entities;
}

function extractZodFields(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile
): InferredField[] {
  const fields: InferredField[] = [];

  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;

    const name = (prop.name as ts.Identifier).getText(sf);
    const init = prop.initializer;
    if (!init) continue;

    const { type, optional, constraints } = parseZodType(init.getText(sf));
    fields.push({
      name: toSnakeCase(name),
      type,
      optional,
      constraints: Object.keys(constraints).length ? constraints : undefined,
    });
  }

  return fields;
}

function parseZodType(text: string): {
  type: string;
  optional: boolean;
  constraints: Record<string, unknown>;
} {
  let type = 'String';
  let optional = false;
  const constraints: Record<string, unknown> = {};

  if (text.includes('.optional()') || text.includes('.nullable()')) {
    optional = true;
  }

  if (text.includes('z.string()') || text.includes('zod.string()')) {
    type = 'String';
    const minMatch = text.match(/\.min\((\d+)\)/);
    const maxMatch = text.match(/\.max\((\d+)\)/);
    const emailMatch = text.match(/\.email\(\)/);
    const uuidMatch = text.match(/\.uuid\(\)/);
    if (minMatch) constraints.min_length = parseInt(minMatch[1], 10);
    if (maxMatch) constraints.max_length = parseInt(maxMatch[1], 10);
    if (emailMatch) type = 'Email';
    if (uuidMatch) type = 'UUID';
  } else if (text.includes('z.number()') || text.includes('zod.number()')) {
    type = 'Int';
    const minMatch = text.match(/\.min\((\d+)\)/);
    const maxMatch = text.match(/\.max\((\d+)\)/);
    if (minMatch) constraints.min = parseInt(minMatch[1], 10);
    if (maxMatch) constraints.max = parseInt(maxMatch[1], 10);
  } else if (text.includes('z.boolean()')) {
    type = 'Boolean';
  } else if (text.includes('z.date()')) {
    type = 'Timestamp';
  } else if (text.includes('z.enum(')) {
    type = 'String';
  } else if (text.includes('z.array(')) {
    type = 'List<String>';
  }

  return { type, optional, constraints };
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '');
}
