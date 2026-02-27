/**
 * TypeScript interface/type inferrer.
 * Detects model-like shapes (id field, timestamps) from TS interfaces and types.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import type { InferredEntity, InferredField } from '../../types.js';

const MODEL_LIKE_INDICATORS = ['id', 'createdAt', 'created_at', 'updatedAt', 'updated_at'];

export async function inferFromTypeScript(
  sourceFiles: string[]
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
      if (ts.isInterfaceDeclaration(node)) {
        const fields = extractInterfaceFields(node, sf);
        const isModelLike = fields.some((f) => MODEL_LIKE_INDICATORS.includes(f.name));
        if (fields.length > 0 && (isModelLike || fields.length >= 3)) {
          entities.push({
            name: node.name.getText(sf),
            fields,
            confidence: isModelLike ? 'high' : 'medium',
            source: 'typescript',
          });
        }
      } else if (ts.isTypeAliasDeclaration(node)) {
        const typeNode = node.type;
        if (ts.isTypeLiteralNode(typeNode)) {
          const fields = extractTypeLiteralFields(typeNode, sf);
          const isModelLike = fields.some((f) => MODEL_LIKE_INDICATORS.includes(f.name));
          if (fields.length > 0 && (isModelLike || fields.length >= 3)) {
            entities.push({
              name: node.name.getText(sf),
              fields,
              confidence: isModelLike ? 'high' : 'low',
              source: 'typescript',
            });
          }
        }
      }
    });
  }

  return entities;
}

function extractInterfaceFields(
  iface: ts.InterfaceDeclaration,
  sf: ts.SourceFile
): InferredField[] {
  const fields: InferredField[] = [];

  for (const member of iface.members) {
    if (!ts.isPropertySignature(member)) continue;

    const name = (member.name as ts.Identifier)?.getText(sf);
    if (!name || name.startsWith('_')) continue;

    const typeNode = member.type;
    const typeStr = typeNode?.getText(sf) ?? 'unknown';
    const optional = !!member.questionToken;
    const annotations = inferAnnotations(name, typeStr);

    fields.push({
      name: toSnakeCase(name),
      type: mapTsTypeToIsl(typeStr),
      optional,
      annotations: annotations.length ? annotations : undefined,
    });
  }

  return fields;
}

function extractTypeLiteralFields(
  typeLit: ts.TypeLiteralNode,
  sf: ts.SourceFile
): InferredField[] {
  const fields: InferredField[] = [];

  for (const member of typeLit.members) {
    if (!ts.isPropertySignature(member)) continue;

    const name = (member.name as ts.Identifier)?.getText(sf);
    if (!name || name.startsWith('_')) continue;

    const typeNode = member.type;
    const typeStr = typeNode?.getText(sf) ?? 'unknown';
    const optional = !!member.questionToken;
    const annotations = inferAnnotations(name, typeStr);

    fields.push({
      name: toSnakeCase(name),
      type: mapTsTypeToIsl(typeStr),
      optional,
      annotations: annotations.length ? annotations : undefined,
    });
  }

  return fields;
}

function mapTsTypeToIsl(tsType: string): string {
  const normalized = tsType.replace(/\s/g, '');
  if (normalized.includes('string')) return 'String';
  if (normalized.includes('number')) return 'Int';
  if (normalized.includes('boolean')) return 'Boolean';
  if (normalized.includes('Date')) return 'Timestamp';
  if (normalized.includes('ObjectId') || normalized.includes('mongoose')) return 'UUID';
  if (normalized.includes('Promise<')) return mapTsTypeToIsl(normalized.replace(/Promise<|>/g, ''));
  if (normalized.includes('[]') || normalized.includes('Array<')) return 'List<String>';
  return 'String';
}

function inferAnnotations(name: string, _typeStr: string): string[] {
  const annotations: string[] = [];
  if (name === 'id' || name.endsWith('Id')) {
    annotations.push('immutable', 'unique');
  }
  if (name === 'email' || name.includes('email')) {
    annotations.push('unique');
  }
  if (name === 'createdAt' || name === 'created_at') {
    annotations.push('immutable');
  }
  return annotations;
}

function toSnakeCase(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, '');
}
