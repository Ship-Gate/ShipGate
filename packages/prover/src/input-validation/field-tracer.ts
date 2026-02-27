// ============================================================================
// Field Access Tracer - Detects which fields are accessed in handler code
// ============================================================================

import type { FieldAccess } from './types.js';

/**
 * Trace field accesses in handler code
 */
export function traceFieldAccesses(code: string, startLine: number): FieldAccess[] {
  const accesses: FieldAccess[] = [];
  const lines = code.split('\n');

  // Patterns for different access types
  const patterns = [
    // req.body.field, request.body.field
    { regex: /(?:req|request)\.body\.(\w+)/g, source: 'body' as const },
    // req.params.field, request.params.field
    { regex: /(?:req|request)\.params\.(\w+)/g, source: 'params' as const },
    // req.query.field, request.query.field
    { regex: /(?:req|request)\.query\.(\w+)/g, source: 'query' as const },
    // req.headers.field, request.headers.field
    { regex: /(?:req|request)\.headers\.(\w+)/g, source: 'headers' as const },
    // Destructuring: { field } = req.body
    { regex: /\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*(?:req|request)\.body/g, source: 'body' as const },
    { regex: /\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*(?:req|request)\.params/g, source: 'params' as const },
    { regex: /\{\s*(\w+(?:\s*,\s*\w+)*)\s*\}\s*=\s*(?:req|request)\.query/g, source: 'query' as const },
    // Validated data access: validatedData.field
    { regex: /(?:validated|validatedData|data|result)\.(\w+)/g, source: 'body' as const },
  ];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const actualLine = startLine + lineIdx;

    for (const pattern of patterns) {
      const regex = new RegExp(pattern.regex.source, 'g');
      let match;

      while ((match = regex.exec(line)) !== null) {
        const fieldPart = match[1];
        if (!fieldPart) continue;

        // Handle destructuring (multiple fields)
        if (fieldPart.includes(',')) {
          const fields = fieldPart.split(',').map(f => f.trim());
          for (const field of fields) {
            if (field) {
              accesses.push({
                field,
                line: actualLine,
                accessType: determineAccessType(line, field),
                source: pattern.source,
              });
            }
          }
        } else {
          accesses.push({
            field: fieldPart,
            line: actualLine,
            accessType: determineAccessType(line, fieldPart),
            source: pattern.source,
          });
        }
      }
    }
  }

  // Deduplicate by field name (keep first occurrence)
  const seen = new Set<string>();
  return accesses.filter(access => {
    const key = `${access.source}:${access.field}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Determine if field access is read or write
 */
function determineAccessType(line: string, field: string): 'read' | 'write' {
  // Simple heuristic: if field appears on left side of assignment, it's a write
  const writePattern = new RegExp(`${field}\\s*=`);
  return writePattern.test(line) ? 'write' : 'read';
}

/**
 * Extract unique field names from accesses
 */
export function extractFieldNames(accesses: FieldAccess[]): string[] {
  const fields = new Set(accesses.map(a => a.field));
  return Array.from(fields).sort();
}

/**
 * Find validation line number in code
 */
export function findValidationLine(code: string, startLine: number): number | null {
  const validationPatterns = [
    /\.parse\s*\(/,
    /\.safeParse\s*\(/,
    /\.validate\s*\(/,
    /\.validateSync\s*\(/,
    /validate\s*\(/,
    /schema\s*:\s*\{/,
  ];

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (validationPatterns.some(pattern => pattern.test(line))) {
      return startLine + i;
    }
  }

  return null;
}

/**
 * Check if validation occurs before business logic
 * Heuristic: validation should be in first 30% of handler
 */
export function isValidationBeforeLogic(
  validationLine: number | null,
  handlerStart: number,
  handlerEnd: number
): boolean {
  if (validationLine === null) return false;

  const handlerLength = handlerEnd - handlerStart;
  const validationOffset = validationLine - handlerStart;
  const threshold = handlerLength * 0.3; // First 30% of handler

  return validationOffset <= threshold;
}

/**
 * Detect if validation is in a catch block (anti-pattern)
 */
export function isValidationInCatchBlock(code: string, validationLine: number | null): boolean {
  if (validationLine === null) return false;

  const lines = code.split('\n');
  let inCatchBlock = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (/catch\s*\(/.test(line)) {
      inCatchBlock = true;
      braceDepth = 0;
    }

    if (inCatchBlock) {
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;

      if (braceDepth <= 0) {
        inCatchBlock = false;
      }
    }

    if (i === validationLine && inCatchBlock) {
      return true;
    }
  }

  return false;
}
