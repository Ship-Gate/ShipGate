/**
 * Mock Detector - Behavior-based detection engine
 * 
 * Detects mock behavior patterns rather than just naming conventions.
 */

import type {
  MockFinding,
  MockBehaviorType,
  MockSeverity,
  MockLocation,
  MockDetectorConfig,
  MockPattern,
  DetectionSummary,
} from './types.js';
import { isAllowlisted } from './allowlist.js';
import { detectHardcodedSuccess } from './patterns/hardcoded-success.js';
import { detectPlaceholderArrays } from './patterns/placeholder-arrays.js';
import { detectTodoFakePatterns } from './patterns/todo-fake.js';
import { DEFAULT_PATTERNS } from './patterns/index.js';

export interface ScanOptions {
  /** File path */
  filePath: string;
  /** File content */
  content: string;
  /** Configuration */
  config: MockDetectorConfig;
}

export interface ScanResult {
  /** Findings detected */
  findings: MockFinding[];
  /** Whether file was allowlisted */
  allowed: boolean;
  /** Reason for allowlisting if applicable */
  allowlistReason?: string;
}

/**
 * Scan a file for mock behavior patterns
 */
export function scanFile(options: ScanOptions): MockFinding[] {
  const { filePath, content, config } = options;

  // Check if file is allowlisted
  if (isAllowlisted(filePath, config.allowlist)) {
    return [];
  }

  const findings: MockFinding[] = [];
  const lines = content.split('\n');

  // Combine default and custom patterns
  const allPatterns = [...DEFAULT_PATTERNS, ...(config.customPatterns || [])];

  // Scan each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1; // 1-indexed

    // Detect hardcoded success responses
    const hardcodedFindings = detectHardcodedSuccess(
      line,
      lineNumber,
      filePath,
      config
    );
    findings.push(...hardcodedFindings);

    // Detect placeholder arrays
    const placeholderFindings = detectPlaceholderArrays(
      line,
      lineNumber,
      filePath,
      config
    );
    findings.push(...placeholderFindings);

    // Detect TODO/fake patterns
    const todoFindings = detectTodoFakePatterns(
      line,
      lineNumber,
      filePath,
      config
    );
    findings.push(...todoFindings);

    // Apply custom patterns
    for (const pattern of config.customPatterns || []) {
      const matches = matchPattern(pattern, line, lineNumber, filePath);
      findings.push(...matches);
    }
  }

  // Filter by confidence threshold
  return findings.filter(f => f.confidence >= config.minConfidence);
}

/**
 * Match a custom pattern against a line
 */
function matchPattern(
  pattern: MockPattern,
  line: string,
  lineNumber: number,
  filePath: string
): MockFinding[] {
  const findings: MockFinding[] = [];
  const regex = new RegExp(pattern.pattern);
  let match: RegExpExecArray | null;

  // Reset regex state
  regex.lastIndex = 0;

  while ((match = regex.exec(line)) !== null) {
    const location: MockLocation = {
      file: filePath,
      line: lineNumber,
      column: match.index + 1,
      snippet: match[0],
    };

    const finding: MockFinding = {
      id: generateFindingId(filePath, lineNumber, pattern.name),
      type: pattern.behaviorType,
      severity: pattern.severity,
      location,
      reason: `Matches pattern: ${pattern.name}`,
      confidence: pattern.confidenceMultiplier,
    };

    findings.push(finding);
  }

  return findings;
}

/**
 * Generate a unique finding ID
 */
function generateFindingId(
  filePath: string,
  lineNumber: number,
  patternName: string
): string {
  const hash = `${filePath}:${lineNumber}:${patternName}`;
  // Simple hash function
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue = hashValue & hashValue; // Convert to 32-bit integer
  }
  return `mock-${Math.abs(hashValue).toString(36)}`;
}

/**
 * Calculate detection summary statistics
 */
export function calculateSummary(
  findings: MockFinding[],
  totalFiles: number
): DetectionSummary {
  const filesWithFindings = new Set(findings.map(f => f.location.file)).size;

  const findingsByType: Record<MockBehaviorType, number> = {
    hardcoded_success: 0,
    placeholder_array: 0,
    todo_fake_data: 0,
    sentinel_value: 0,
    mock_response: 0,
    stub_implementation: 0,
    fake_data_structure: 0,
  };

  const findingsBySeverity: Record<MockSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const finding of findings) {
    findingsByType[finding.type]++;
    findingsBySeverity[finding.severity]++;
  }

  // Precision calculation (would need ground truth for real calculation)
  // For now, use confidence-weighted approach
  const truePositives = findings.filter(f => f.confidence >= 0.7).length;
  const falsePositives = findings.filter(f => f.confidence < 0.7).length;
  const precisionScore =
    truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 1.0;

  return {
    totalFiles,
    filesWithFindings,
    totalFindings: findings.length,
    findingsByType,
    findingsBySeverity,
    precision: {
      truePositives,
      falsePositives,
      precisionScore,
    },
  };
}
