/**
 * Detect hardcoded "success" responses
 * 
 * Patterns like:
 * - return { success: true }
 * - return { status: 'success' }
 * - return { ok: true }
 * - Always returning success without actual logic
 */

import type { MockFinding, MockDetectorConfig } from '../types.js';

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

  // Pattern: return { success: true }
  const successPattern = /\breturn\s*\{[^}]*\b(success|status|ok)\s*:\s*(true|'success'|"success"|'ok'|"ok")[^}]*\}/i;
  if (successPattern.test(line)) {
    // Check if this is in a function that always returns success
    const finding: MockFinding = {
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
    };
    findings.push(finding);
  }

  // Pattern: Always returning 200/201 status codes
  const statusPattern = /\b(status|statusCode)\s*:\s*(200|201|204)\b/i;
  if (statusPattern.test(line) && !line.includes('if') && !line.includes('?')) {
    const finding: MockFinding = {
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
    };
    findings.push(finding);
  }

  // Pattern: return Promise.resolve({ success: true })
  const promiseResolvePattern = /\bPromise\.resolve\s*\(\s*\{[^}]*\b(success|status|ok)\s*:\s*(true|'success'|"success")[^}]*\}\s*\)/i;
  if (promiseResolvePattern.test(line)) {
    const finding: MockFinding = {
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
    };
    findings.push(finding);
  }

  return findings;
}
