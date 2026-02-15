/**
 * Schema Detector
 *
 * Detects validation schemas (zod, yup, prisma, joi, typebox) in source code
 * and extracts their field definitions and constraints.
 *
 * @module @isl-lang/ai-generator/grounded-spec/schema-detector
 */

import type { SchemaInfo, SchemaField, SourceSpan } from './types.js';

// ============================================================================
// Main entry
// ============================================================================

/**
 * Detect all validation schemas in source code.
 */
export function detectSchemas(sourceCode: string, filePath: string): SchemaInfo[] {
  const schemas: SchemaInfo[] = [];

  schemas.push(...detectZodSchemas(sourceCode, filePath));
  schemas.push(...detectYupSchemas(sourceCode, filePath));
  schemas.push(...detectPrismaModels(sourceCode, filePath));
  schemas.push(...detectJoiSchemas(sourceCode, filePath));
  schemas.push(...detectTypeboxSchemas(sourceCode, filePath));

  return schemas;
}

// ============================================================================
// Zod
// ============================================================================

const ZOD_SCHEMA_RE =
  /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*z\.object\(\s*\{([\s\S]*?)\}\s*\)/g;

const ZOD_FIELD_RE =
  /(\w+)\s*:\s*z\.([\w.()]+(?:\([\s\S]*?\))?(?:\.[\w()]+)*)/g;

function detectZodSchemas(source: string, filePath: string): SchemaInfo[] {
  const results: SchemaInfo[] = [];
  let match: RegExpExecArray | null;

  ZOD_SCHEMA_RE.lastIndex = 0;
  while ((match = ZOD_SCHEMA_RE.exec(source)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const fields = parseZodFields(body);
    const location = spanFromIndex(source, match.index, match[0].length, filePath);

    results.push({ kind: 'zod', name, fields, raw: match[0], location });
  }

  return results;
}

function parseZodFields(body: string): SchemaField[] {
  const fields: SchemaField[] = [];
  let m: RegExpExecArray | null;

  ZOD_FIELD_RE.lastIndex = 0;
  while ((m = ZOD_FIELD_RE.exec(body)) !== null) {
    const name = m[1]!;
    const chain = m[2]!;
    const type = extractZodBaseType(chain);
    const constraints = extractZodConstraints(chain);
    const optional = chain.includes('.optional()') || chain.includes('.nullable()');

    fields.push({ name, type, constraints, optional });
  }

  return fields;
}

function extractZodBaseType(chain: string): string {
  const baseMatch = chain.match(/^(\w+)/);
  return baseMatch ? baseMatch[1]! : 'unknown';
}

function extractZodConstraints(chain: string): string[] {
  const constraints: string[] = [];
  const methodCalls = chain.match(/\.(\w+)\([^)]*\)/g) ?? [];

  for (const call of methodCalls) {
    const cleaned = call.replace(/^\./, '');
    if (!['optional', 'nullable', 'default'].includes(cleaned.replace(/\(.*/, ''))) {
      constraints.push(cleaned);
    }
  }

  return constraints;
}

// ============================================================================
// Yup
// ============================================================================

const YUP_SCHEMA_RE =
  /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:yup|Yup)\.object\(\s*\{([\s\S]*?)\}\s*\)/g;

const YUP_FIELD_RE =
  /(\w+)\s*:\s*(?:yup|Yup)\.([\w.()]+(?:\([\s\S]*?\))?(?:\.[\w()]+)*)/g;

function detectYupSchemas(source: string, filePath: string): SchemaInfo[] {
  const results: SchemaInfo[] = [];
  let match: RegExpExecArray | null;

  YUP_SCHEMA_RE.lastIndex = 0;
  while ((match = YUP_SCHEMA_RE.exec(source)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const fields = parseYupFields(body);
    const location = spanFromIndex(source, match.index, match[0].length, filePath);

    results.push({ kind: 'yup', name, fields, raw: match[0], location });
  }

  return results;
}

function parseYupFields(body: string): SchemaField[] {
  const fields: SchemaField[] = [];
  let m: RegExpExecArray | null;

  YUP_FIELD_RE.lastIndex = 0;
  while ((m = YUP_FIELD_RE.exec(body)) !== null) {
    const name = m[1]!;
    const chain = m[2]!;
    const type = extractZodBaseType(chain);
    const constraints: string[] = [];
    const methodCalls = chain.match(/\.(\w+)\([^)]*\)/g) ?? [];
    for (const call of methodCalls) {
      constraints.push(call.replace(/^\./, ''));
    }
    const optional = !chain.includes('.required()');

    fields.push({ name, type, constraints, optional });
  }

  return fields;
}

// ============================================================================
// Prisma (model definitions in .prisma files or prisma client usage)
// ============================================================================

const PRISMA_CLIENT_RE =
  /prisma\.(\w+)\.(create|update|delete|findUnique|findFirst|findMany|upsert)\(/g;

function detectPrismaModels(source: string, filePath: string): SchemaInfo[] {
  const models = new Map<string, SchemaInfo>();
  let match: RegExpExecArray | null;

  PRISMA_CLIENT_RE.lastIndex = 0;
  while ((match = PRISMA_CLIENT_RE.exec(source)) !== null) {
    const modelName = match[1]!;
    const operation = match[2]!;

    if (!models.has(modelName)) {
      const location = spanFromIndex(source, match.index, match[0].length, filePath);
      models.set(modelName, {
        kind: 'prisma',
        name: modelName,
        fields: [],
        raw: `prisma.${modelName} (operations: ${operation})`,
        location,
      });
    } else {
      const existing = models.get(modelName)!;
      if (!existing.raw.includes(operation)) {
        existing.raw += `, ${operation}`;
      }
    }
  }

  return Array.from(models.values());
}

// ============================================================================
// Joi
// ============================================================================

const JOI_SCHEMA_RE =
  /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*Joi\.object\(\s*\{([\s\S]*?)\}\s*\)/g;

const JOI_FIELD_RE =
  /(\w+)\s*:\s*Joi\.([\w.()]+(?:\([\s\S]*?\))?(?:\.[\w()]+)*)/g;

function detectJoiSchemas(source: string, filePath: string): SchemaInfo[] {
  const results: SchemaInfo[] = [];
  let match: RegExpExecArray | null;

  JOI_SCHEMA_RE.lastIndex = 0;
  while ((match = JOI_SCHEMA_RE.exec(source)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const fields: SchemaField[] = [];
    let m: RegExpExecArray | null;

    JOI_FIELD_RE.lastIndex = 0;
    while ((m = JOI_FIELD_RE.exec(body)) !== null) {
      const fieldName = m[1]!;
      const chain = m[2]!;
      const type = extractZodBaseType(chain);
      const constraints: string[] = [];
      const methodCalls = chain.match(/\.(\w+)\([^)]*\)/g) ?? [];
      for (const call of methodCalls) {
        constraints.push(call.replace(/^\./, ''));
      }
      const optional = !chain.includes('.required()');
      fields.push({ name: fieldName, type, constraints, optional });
    }

    const location = spanFromIndex(source, match.index, match[0].length, filePath);
    results.push({ kind: 'joi', name, fields, raw: match[0], location });
  }

  return results;
}

// ============================================================================
// TypeBox
// ============================================================================

const TYPEBOX_SCHEMA_RE =
  /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*Type\.Object\(\s*\{([\s\S]*?)\}\s*\)/g;

const TYPEBOX_FIELD_RE =
  /(\w+)\s*:\s*Type\.(\w+)\(([\s\S]*?)\)/g;

function detectTypeboxSchemas(source: string, filePath: string): SchemaInfo[] {
  const results: SchemaInfo[] = [];
  let match: RegExpExecArray | null;

  TYPEBOX_SCHEMA_RE.lastIndex = 0;
  while ((match = TYPEBOX_SCHEMA_RE.exec(source)) !== null) {
    const name = match[1]!;
    const body = match[2]!;
    const fields: SchemaField[] = [];
    let m: RegExpExecArray | null;

    TYPEBOX_FIELD_RE.lastIndex = 0;
    while ((m = TYPEBOX_FIELD_RE.exec(body)) !== null) {
      const fieldName = m[1]!;
      const type = m[2]!.toLowerCase();
      fields.push({ name: fieldName, type, constraints: [], optional: false });
    }

    const location = spanFromIndex(source, match.index, match[0].length, filePath);
    results.push({ kind: 'typebox', name, fields, raw: match[0], location });
  }

  return results;
}

// ============================================================================
// Helpers
// ============================================================================

function spanFromIndex(source: string, index: number, length: number, filePath: string): SourceSpan {
  const before = source.slice(0, index);
  const startLine = (before.match(/\n/g) ?? []).length + 1;
  const afterMatch = source.slice(0, index + length);
  const endLine = (afterMatch.match(/\n/g) ?? []).length + 1;
  return { file: filePath, startLine, endLine };
}
