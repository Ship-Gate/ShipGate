/**
 * Postcondition Fix Strategy
 * 
 * Fixes return values and state mutations to satisfy postconditions.
 */

import type { AnalysisResult, CodeSegment } from '../analyzer.js';
import type { Patch, PatchContext } from '../patcher.js';

export interface PostconditionFix {
  type: 'value_change' | 'add_property' | 'state_update';
  target: string;
  expected: unknown;
  actual?: unknown;
}

/**
 * Generate patches to fix postcondition failures
 */
export function generatePostconditionPatches(
  analysis: AnalysisResult,
  context: PatchContext
): Patch[] {
  const patches: Patch[] = [];
  const { failure, relatedCode } = analysis;

  // Parse the predicate to understand what needs to change
  const fix = parsePostconditionPredicate(failure.predicate, failure.expected, failure.actual);
  
  if (!fix) {
    return patches;
  }

  // Find the code that needs to be fixed
  const targetCode = findTargetCode(fix, relatedCode, context.implementation);
  
  if (!targetCode) {
    return patches;
  }

  // Generate the appropriate patch
  switch (fix.type) {
    case 'value_change':
      patches.push(...generateValueChangePatch(fix, targetCode, analysis.confidence));
      break;
    case 'add_property':
      patches.push(...generateAddPropertyPatch(fix, targetCode, analysis.confidence));
      break;
    case 'state_update':
      patches.push(...generateStateUpdatePatch(fix, targetCode, context, analysis.confidence));
      break;
  }

  return patches;
}

/**
 * Parse postcondition predicate to determine the fix needed
 */
function parsePostconditionPredicate(
  predicate: string,
  expected?: unknown,
  actual?: unknown
): PostconditionFix | null {
  // Pattern: result.field == VALUE
  const resultFieldMatch = predicate.match(/result\.(\w+)\s*==\s*['"]?(\w+)['"]?/);
  if (resultFieldMatch) {
    const [, field, expectedValue] = resultFieldMatch;
    return {
      type: 'value_change',
      target: field!,
      expected: expected ?? expectedValue,
      actual,
    };
  }

  // Pattern: Entity.lookup(result.id).field == VALUE
  const entityFieldMatch = predicate.match(/(\w+)\.lookup\([^)]+\)\.(\w+)\s*==\s*['"]?(\w+)['"]?/);
  if (entityFieldMatch) {
    const [, entity, field, expectedValue] = entityFieldMatch;
    return {
      type: 'value_change',
      target: `${entity}.${field}`,
      expected: expected ?? expectedValue,
      actual,
    };
  }

  // Pattern: Entity.exists(result.id)
  const existsMatch = predicate.match(/(\w+)\.exists\(result\.(\w+)\)/);
  if (existsMatch) {
    const [, entity, field] = existsMatch;
    return {
      type: 'state_update',
      target: `${entity}.create`,
      expected: true,
    };
  }

  // Pattern: field == old(field) + value (increment)
  const incrementMatch = predicate.match(/(\w+(?:\.\w+)*)\s*==\s*old\(([^)]+)\)\s*\+\s*(\d+)/);
  if (incrementMatch) {
    const [, field, , increment] = incrementMatch;
    return {
      type: 'state_update',
      target: field!,
      expected: `+${increment}`,
    };
  }

  // Pattern: field == old(field) - value (decrement)
  const decrementMatch = predicate.match(/(\w+(?:\.\w+)*)\s*==\s*old\(([^)]+)\)\s*-\s*(\d+)/);
  if (decrementMatch) {
    const [, field, , decrement] = decrementMatch;
    return {
      type: 'state_update',
      target: field!,
      expected: `-${decrement}`,
    };
  }

  // Generic field assignment
  if (expected !== undefined && actual !== undefined) {
    return {
      type: 'value_change',
      target: extractTarget(predicate),
      expected,
      actual,
    };
  }

  return null;
}

/**
 * Extract target field from predicate
 */
function extractTarget(predicate: string): string {
  // Try to extract the first field reference
  const match = predicate.match(/(\w+(?:\.\w+)+)/);
  return match ? match[1]! : 'unknown';
}

/**
 * Find the code segment that needs to be fixed
 */
function findTargetCode(
  fix: PostconditionFix,
  relatedCode: CodeSegment[],
  implementation: string
): { segment: CodeSegment; lineIndex: number; matchedLine: string } | null {
  const lines = implementation.split('\n');
  const targetField = fix.target.split('.').pop() ?? fix.target;

  // Search for the target in related code first
  for (const segment of relatedCode) {
    const segmentLines = segment.code.split('\n');
    for (let i = 0; i < segmentLines.length; i++) {
      const line = segmentLines[i]!;
      
      // Look for field assignment
      if (line.includes(targetField) && (line.includes(':') || line.includes('='))) {
        return {
          segment,
          lineIndex: segment.startLine + i,
          matchedLine: line,
        };
      }
    }
  }

  // Search the entire implementation
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    
    // Look for field assignment (object property or variable)
    const assignmentPattern = new RegExp(`${targetField}\\s*[:=]`);
    if (assignmentPattern.test(line)) {
      return {
        segment: {
          file: 'implementation',
          startLine: Math.max(0, i - 2),
          endLine: Math.min(lines.length, i + 3),
          code: lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 3)).join('\n'),
          relevance: 0.8,
        },
        lineIndex: i,
        matchedLine: line,
      };
    }
  }

  // Look for return statements as fallback
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/return\s+{/.test(line) || /return\s+\w+;/.test(line)) {
      return {
        segment: {
          file: 'implementation',
          startLine: Math.max(0, i - 1),
          endLine: Math.min(lines.length, i + 5),
          code: lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 5)).join('\n'),
          relevance: 0.6,
        },
        lineIndex: i,
        matchedLine: line,
      };
    }
  }

  return null;
}

/**
 * Generate patch to change a value
 */
function generateValueChangePatch(
  fix: PostconditionFix,
  target: { segment: CodeSegment; lineIndex: number; matchedLine: string },
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const { expected, actual, target: fieldPath } = fix;
  const field = fieldPath.split('.').pop() ?? fieldPath;

  // Find what to replace
  const line = target.matchedLine;
  
  // Pattern: field: 'value' or field: "value"
  const stringValueMatch = line.match(new RegExp(`(${field}\\s*:\\s*)['"]([^'"]+)['"]`));
  if (stringValueMatch && typeof expected === 'string') {
    const [fullMatch, prefix] = stringValueMatch;
    patches.push({
      type: 'replace',
      file: target.segment.file,
      line: target.lineIndex + 1,
      original: fullMatch,
      replacement: `${prefix}'${expected}'`,
      description: `Fix ${field}: change to '${expected}'`,
      confidence,
    });
    return patches;
  }

  // Pattern: field: value (numeric or identifier)
  const valueMatch = line.match(new RegExp(`(${field}\\s*:\\s*)(\\w+)`));
  if (valueMatch) {
    const [fullMatch, prefix] = valueMatch;
    const replacement = typeof expected === 'string' ? `'${expected}'` : String(expected);
    patches.push({
      type: 'replace',
      file: target.segment.file,
      line: target.lineIndex + 1,
      original: fullMatch,
      replacement: `${prefix}${replacement}`,
      description: `Fix ${field}: change to ${replacement}`,
      confidence,
    });
    return patches;
  }

  // Pattern: field = value
  const assignmentMatch = line.match(new RegExp(`(${field}\\s*=\\s*)['"]?([^'";,]+)['"]?`));
  if (assignmentMatch) {
    const [fullMatch, prefix] = assignmentMatch;
    const replacement = typeof expected === 'string' ? `'${expected}'` : String(expected);
    patches.push({
      type: 'replace',
      file: target.segment.file,
      line: target.lineIndex + 1,
      original: fullMatch,
      replacement: `${prefix}${replacement}`,
      description: `Fix ${field}: change to ${replacement}`,
      confidence,
    });
  }

  return patches;
}

/**
 * Generate patch to add a missing property
 */
function generateAddPropertyPatch(
  fix: PostconditionFix,
  target: { segment: CodeSegment; lineIndex: number; matchedLine: string },
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const { expected, target: fieldPath } = fix;
  const field = fieldPath.split('.').pop() ?? fieldPath;

  // Find object literal to add property to
  const lines = target.segment.code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    
    // Look for object start
    if (line.includes('{') && !line.includes('}')) {
      const value = typeof expected === 'string' ? `'${expected}'` : String(expected);
      const indent = line.match(/^\s*/)?.[0] ?? '';
      
      patches.push({
        type: 'insert',
        file: target.segment.file,
        line: target.segment.startLine + i + 2,
        column: 0,
        content: `${indent}  ${field}: ${value},\n`,
        description: `Add missing property: ${field}`,
        confidence: confidence * 0.9,
      });
      break;
    }
  }

  return patches;
}

/**
 * Generate patch for state update
 */
function generateStateUpdatePatch(
  fix: PostconditionFix,
  target: { segment: CodeSegment; lineIndex: number; matchedLine: string },
  context: PatchContext,
  confidence: number
): Patch[] {
  const patches: Patch[] = [];
  const indent = context.indentation ?? '  ';

  // Handle increment/decrement
  if (typeof fix.expected === 'string' && (fix.expected.startsWith('+') || fix.expected.startsWith('-'))) {
    const operation = fix.expected;
    const field = fix.target;
    
    patches.push({
      type: 'insert',
      file: target.segment.file,
      line: target.lineIndex + 1,
      column: 0,
      content: `${indent}// Update ${field}\n${indent}${field} ${operation.startsWith('+') ? '+=' : '-='} ${operation.slice(1)};\n`,
      description: `Add state update: ${field} ${operation}`,
      confidence: confidence * 0.85,
    });
  }

  return patches;
}

/**
 * Suggest a complete fix for a postcondition
 */
export function suggestPostconditionFix(
  predicate: string,
  expected: unknown,
  actual: unknown
): string {
  const fix = parsePostconditionPredicate(predicate, expected, actual);
  
  if (!fix) {
    return `// Unable to determine automatic fix for: ${predicate}`;
  }

  const field = fix.target.split('.').pop() ?? fix.target;
  const expectedStr = typeof expected === 'string' ? `'${expected}'` : String(expected);
  const actualStr = typeof actual === 'string' ? `'${actual}'` : String(actual);

  return `// Postcondition fix: Change ${field} from ${actualStr} to ${expectedStr}
// Predicate: ${predicate}`;
}
