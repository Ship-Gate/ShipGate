/**
 * Detect TODO/fake data patterns gated by runtime usage
 * 
 * Patterns like:
 * - // TODO: Replace with real API
 * - // FIXME: Fake data
 * - if (process.env.NODE_ENV === 'development') return fakeData
 */

import type { MockFinding, MockDetectorConfig } from '../types.js';

/**
 * Detect TODO/fake patterns
 */
export function detectTodoFakePatterns(
  line: string,
  lineNumber: number,
  filePath: string,
  config: MockDetectorConfig
): MockFinding[] {
  const findings: MockFinding[] = [];

  // Pattern: TODO/FIXME comments with mock/fake keywords
  const todoPattern = /\/\/\s*(TODO|FIXME|XXX|HACK|NOTE):\s*.*\b(mock|fake|placeholder|stub|dummy|test\s*data|real\s*api|actual\s*data)/i;
  if (todoPattern.test(line)) {
    // Check if this is gated by runtime check (dev-only)
    const nextLines = line; // In real implementation, would check surrounding context
    const isGatedByRuntime = /process\.env\.(NODE_ENV|ENV)\s*===?\s*['"]development['"]/i.test(line) ||
                             /__DEV__|__DEVELOPMENT__/i.test(line);

    const finding: MockFinding = {
      id: `todo-fake-${filePath}-${lineNumber}`,
      type: 'todo_fake_data',
      severity: isGatedByRuntime ? 'low' : 'high',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: isGatedByRuntime
        ? 'TODO/fake data pattern detected but gated by runtime check'
        : 'TODO/fake data pattern detected in production code',
      confidence: isGatedByRuntime ? 0.5 : 0.9,
      suggestion: isGatedByRuntime
        ? 'Consider removing dev-only mock data or ensuring it never reaches production'
        : 'Replace TODO/fake data with actual implementation',
    };
    findings.push(finding);
  }

  // Pattern: Return statements with fake/mock in comments
  const returnFakePattern = /\breturn\s+.*\s*;?\s*\/\/\s*.*\b(fake|mock|placeholder|test\s*data)\b/i;
  if (returnFakePattern.test(line)) {
    const finding: MockFinding = {
      id: `return-fake-${filePath}-${lineNumber}`,
      type: 'todo_fake_data',
      severity: 'high',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Return statement with fake/mock data comment',
      confidence: 0.85,
      suggestion: 'Replace with actual data source',
    };
    findings.push(finding);
  }

  // Pattern: Conditional return of fake data without proper gating
  const conditionalFakePattern = /if\s*\([^)]+\)\s*return\s+.*\b(fake|mock|placeholder|test)\w*\b/i;
  if (conditionalFakePattern.test(line) && !line.includes('NODE_ENV') && !line.includes('__DEV__')) {
    const finding: MockFinding = {
      id: `conditional-fake-${filePath}-${lineNumber}`,
      type: 'todo_fake_data',
      severity: 'medium',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Conditional return of fake data without proper environment gating',
      confidence: 0.7,
      suggestion: 'Gate fake data with NODE_ENV check or remove entirely',
    };
    findings.push(finding);
  }

  return findings;
}
