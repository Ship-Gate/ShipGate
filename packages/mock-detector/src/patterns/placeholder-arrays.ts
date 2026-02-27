/**
 * Detect placeholder arrays with sentinel values
 * 
 * Patterns like:
 * - const users = [{ id: 1, name: 'John' }, { id: 2, name: 'Jane' }]
 * - Arrays with obvious placeholder data
 * - Arrays with TODO comments
 */

import type { MockFinding, MockDetectorConfig } from '../types.js';

/**
 * Sentinel values that indicate placeholder data
 */
const SENTINEL_VALUES = [
  'placeholder',
  'example',
  'test',
  'dummy',
  'fake',
  'sample',
  'lorem',
  'ipsum',
  'john',
  'jane',
  'doe',
  'user1',
  'user2',
  'admin',
  'demo',
];

/**
 * Detect placeholder arrays
 */
export function detectPlaceholderArrays(
  line: string,
  lineNumber: number,
  filePath: string,
  config: MockDetectorConfig
): MockFinding[] {
  const findings: MockFinding[] = [];

  // Pattern: Array with sentinel values
  const arrayPattern = /\[[^\]]*\{[^}]*\b(name|email|username|title|description)\s*:\s*['"]([^'"]+)['"][^}]*\}[^\]]*\]/i;
  const match = arrayPattern.exec(line);

  if (match) {
    const value = match[2]?.toLowerCase();
    if (value && SENTINEL_VALUES.some(sentinel => value.includes(sentinel))) {
      const finding: MockFinding = {
        id: `placeholder-array-${filePath}-${lineNumber}`,
        type: 'placeholder_array',
        severity: 'medium',
        location: {
          file: filePath,
          line: lineNumber,
          snippet: line.trim(),
        },
        reason: `Array contains sentinel value: "${match[2]}"`,
        confidence: 0.75,
        suggestion: 'Replace with actual data source or remove if not needed',
      };
      findings.push(finding);
    }
  }

  // Pattern: Array with sequential IDs (1, 2, 3...) - often indicates mock data
  const sequentialIdPattern = /\[[^\]]*\{[^}]*\bid\s*:\s*([1-9])\s*[,\}][^\]]*\]/;
  const sequentialMatch = sequentialIdPattern.exec(line);
  if (sequentialMatch && line.match(/\{[^}]*id\s*:\s*\d+\s*[,\}]/g)?.length === 2) {
    // Check if there are exactly 2 items with IDs 1 and 2
    const finding: MockFinding = {
      id: `sequential-id-array-${filePath}-${lineNumber}`,
      type: 'placeholder_array',
      severity: 'low',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Array with sequential IDs suggests placeholder data',
      confidence: 0.6,
      suggestion: 'Verify this is not mock data in production code',
    };
    findings.push(finding);
  }

  // Pattern: Empty array assigned to a variable that suggests data
  const emptyArrayPattern = /(const|let|var)\s+(\w+)\s*=\s*\[\s*\]\s*;?\s*\/\/\s*(TODO|FIXME|placeholder|mock|fake)/i;
  if (emptyArrayPattern.test(line)) {
    const finding: MockFinding = {
      id: `empty-array-todo-${filePath}-${lineNumber}`,
      type: 'placeholder_array',
      severity: 'low',
      location: {
        file: filePath,
        line: lineNumber,
        snippet: line.trim(),
      },
      reason: 'Empty array with TODO/placeholder comment',
      confidence: 0.7,
      suggestion: 'Implement actual data loading or remove if not needed',
    };
    findings.push(finding);
  }

  return findings;
}
