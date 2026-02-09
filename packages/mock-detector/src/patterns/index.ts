/**
 * Default mock detection patterns
 */

import type { MockPattern } from '../types.js';

/**
 * Default patterns for mock detection
 */
export const DEFAULT_PATTERNS: MockPattern[] = [
  {
    name: 'mock_response_object',
    pattern: /\b(mockResponse|mockData|fakeResponse|stubResponse)\s*[:=]/i,
    behaviorType: 'mock_response',
    severity: 'medium',
    confidenceMultiplier: 0.7,
  },
  {
    name: 'stub_function',
    pattern: /\b(stub|mock|fake)\w*\s*[:=]\s*(\([^)]*\)\s*=>|function)/i,
    behaviorType: 'stub_implementation',
    severity: 'medium',
    confidenceMultiplier: 0.65,
  },
  {
    name: 'fake_data_export',
    pattern: /export\s+(const|let|var)\s+\w*(fake|mock|stub|dummy|test)\w*\s*=/i,
    behaviorType: 'fake_data_structure',
    severity: 'low',
    confidenceMultiplier: 0.6,
  },
];
