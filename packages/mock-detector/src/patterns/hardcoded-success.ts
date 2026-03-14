/**
 * Detect hardcoded "success" responses
 *
 * Patterns like:
 * - return { success: true }
 * - return { status: 'success' }
 * - return { ok: true }
 * - obj["success"] = true (bracket notation)
 * - Object flow: obj.success = true → return obj
 * - Promise.resolve({ delivered: true })
 * - Always returning success without actual logic
 */

import type { MockFinding, MockDetectorConfig } from '../types.js';

/**
 * Success-like property names detected across all patterns.
 */
export const SUCCESS_INDICATORS = [
  'success', 'status', 'ok',
  'delivered', 'shipped', 'completed', 'approved',
  'valid', 'verified', 'processed', 'accepted',
  'confirmed', 'authorized',
] as const;

const INDICATOR_PATTERN = SUCCESS_INDICATORS.join('|');

const SUCCESS_VALUE_PATTERN = [
  'true',
  ...SUCCESS_INDICATORS.flatMap(s => [`'${s}'`, `"${s}"`]),
].join('|');

/**
 * Detect hardcoded success responses
 */
export function detectHardcodedSuccess(
  line: string,
  lineNumber: number,
  filePath: string,
  config: MockDetectorConfig
): MockFinding[] {
  const findings: MockFinding[] = [];

  // Pattern: return { success: true, delivered: "completed", ... }
  const successPattern = new RegExp(
    `\\breturn\\s*\\{[^}]*\\b(${INDICATOR_PATTERN})\\s*:\\s*(${SUCCESS_VALUE_PATTERN})[^}]*\\}`,
    'i',
  );
  if (successPattern.test(line)) {
    findings.push({
      id: `hardcoded-success-${filePath}-${lineNumber}`,
      type: 'hardcoded_success',
      severity: 'high',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Hardcoded success response detected',
      confidence: 0.8,
      suggestion: 'Replace with actual error handling and conditional logic',
    });
  }

  // Pattern: Always returning 200/201/204 status codes
  const statusPattern = /\b(status|statusCode)\s*:\s*(200|201|204)\b/i;
  if (statusPattern.test(line) && !line.includes('if') && !line.includes('?')) {
    findings.push({
      id: `hardcoded-status-${filePath}-${lineNumber}`,
      type: 'hardcoded_success',
      severity: 'medium',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Hardcoded success status code without conditional logic',
      confidence: 0.7,
      suggestion: 'Add error handling and conditional status codes',
    });
  }

  // Pattern: bracket notation — obj["success"] = true, obj['ok'] = true
  const bracketPattern = new RegExp(
    `\\w+\\[\\s*['"](?:${INDICATOR_PATTERN})['"]\\s*\\]\\s*=\\s*(?:true|\\d+|['"][^'"]+['"])`,
    'i',
  );
  if (bracketPattern.test(line)) {
    findings.push({
      id: `bracket-success-${filePath}-${lineNumber}`,
      type: 'hardcoded_success',
      severity: 'high',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Success property assigned via bracket notation',
      confidence: 0.8,
      suggestion: 'Ensure success state reflects actual operation results',
    });
  }

  // Pattern: Promise.resolve({ success: true }) with any success-like property
  const promiseResolvePattern = new RegExp(
    `\\bPromise\\.resolve\\s*\\(\\s*\\{[^}]*\\b(${INDICATOR_PATTERN})\\s*:[^}]*\\}\\s*\\)`,
    'i',
  );
  if (promiseResolvePattern.test(line)) {
    findings.push({
      id: `promise-resolve-success-${filePath}-${lineNumber}`,
      type: 'hardcoded_success',
      severity: 'high',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Promise.resolve with hardcoded success response',
      confidence: 0.85,
      suggestion: 'Replace with actual async operation that may fail',
    });
  }

  return findings;
}

/**
 * Detect object flow patterns where a variable has success-like properties
 * set and is then returned or sent as a response.
 * Operates on the full set of lines for multi-line analysis.
 */
export function detectObjectFlowPatterns(
  lines: string[],
  filePath: string,
  config: MockDetectorConfig,
): MockFinding[] {
  const findings: MockFinding[] = [];
  const successVars = new Map<string, number>();

  const dotAssignPattern = new RegExp(
    `(\\w+)\\.(${INDICATOR_PATTERN})\\s*=\\s*(?:true|\\d+|['"][^'"]*['"])`,
    'i',
  );

  const bracketAssignPattern = new RegExp(
    `(\\w+)\\[\\s*['"](?:${INDICATOR_PATTERN})['"]\\s*\\]\\s*=\\s*(?:true|\\d+|['"][^'"]*['"])`,
    'i',
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const dotMatch = dotAssignPattern.exec(line);
    if (dotMatch?.[1]) successVars.set(dotMatch[1], i + 1);

    const bracketMatch = bracketAssignPattern.exec(line);
    if (bracketMatch?.[1]) successVars.set(bracketMatch[1], i + 1);
  }

  if (successVars.size === 0) return findings;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const lineNumber = i + 1;
    let matchedVar: string | undefined;

    const returnMatch = /\breturn\s+(\w+)\s*;?\s*$/.exec(line);
    if (returnMatch?.[1] && successVars.has(returnMatch[1])) {
      matchedVar = returnMatch[1];
    }

    if (!matchedVar) {
      const resMatch = /\bres\.(json|send)\s*\(\s*(\w+)\s*\)/.exec(line);
      if (resMatch?.[2] && successVars.has(resMatch[2])) {
        matchedVar = resMatch[2];
      }
    }

    if (!matchedVar) {
      const resolveMatch = /\bresolve\s*\(\s*(\w+)\s*\)/.exec(line);
      if (resolveMatch?.[1] && successVars.has(resolveMatch[1])) {
        matchedVar = resolveMatch[1];
      }
    }

    if (matchedVar) {
      const assignLine = successVars.get(matchedVar)!;
      findings.push({
        id: `object-flow-${filePath}-${lineNumber}`,
        type: 'hardcoded_success',
        severity: 'high',
        location: {
          file: filePath,
          line: lineNumber,
          snippet: line.trim(),
        },
        reason: `Variable "${matchedVar}" has hardcoded success property (set at line ${assignLine}) and is returned/sent here`,
        confidence: 0.75,
        suggestion: 'Ensure the success property reflects actual operation results',
      });
    }
  }

  return findings;
}
