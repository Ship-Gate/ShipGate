/**
 * Mock Detector Types
 * 
 * Behavior-based detection of mock data and placeholder code.
 */

/**
 * Severity level for a mock detection finding
 */
export type MockSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Type of mock behavior detected
 */
export type MockBehaviorType =
  | 'hardcoded_success'
  | 'placeholder_array'
  | 'todo_fake_data'
  | 'sentinel_value'
  | 'mock_response'
  | 'stub_implementation'
  | 'fake_data_structure';

/**
 * Location of detected mock behavior
 */
export interface MockLocation {
  /** File path */
  file: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed) */
  column?: number;
  /** Code snippet showing the issue */
  snippet?: string;
}

/**
 * A detected mock behavior finding
 */
export interface MockFinding {
  /** Unique identifier */
  id: string;
  /** Type of mock behavior */
  type: MockBehaviorType;
  /** Severity */
  severity: MockSeverity;
  /** Location in code */
  location: MockLocation;
  /** Why this was flagged */
  reason: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Suggested fix */
  suggestion?: string;
  /** Context around the finding */
  context?: {
    /** Lines before */
    before?: string[];
    /** Lines after */
    after?: string[];
  };
}

/**
 * Result of scanning a file or directory
 */
export interface MockDetectionResult {
  /** File path scanned */
  file: string;
  /** Findings detected */
  findings: MockFinding[];
  /** Whether this file should be allowed (e.g., in test folder) */
  allowed: boolean;
  /** Reason for allowlisting if applicable */
  allowlistReason?: string;
}

/**
 * Configuration for mock detection
 */
export interface MockDetectorConfig {
  /** Paths/patterns to allowlist (e.g. **\/tests/** or **\/mocks/**) */
  allowlist: string[];
  /** Whether to check dev-only build paths */
  checkDevPaths: boolean;
  /** Minimum confidence threshold (0-1) */
  minConfidence: number;
  /** Custom patterns for mock detection */
  customPatterns?: MockPattern[];
}

/**
 * Custom pattern for detecting mocks
 */
export interface MockPattern {
  /** Pattern name */
  name: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Type of behavior */
  behaviorType: MockBehaviorType;
  /** Severity */
  severity: MockSeverity;
  /** Confidence multiplier (0-1) */
  confidenceMultiplier: number;
}

/**
 * Summary statistics from detection
 */
export interface DetectionSummary {
  /** Total files scanned */
  totalFiles: number;
  /** Files with findings */
  filesWithFindings: number;
  /** Total findings */
  totalFindings: number;
  /** Findings by type */
  findingsByType: Record<MockBehaviorType, number>;
  /** Findings by severity */
  findingsBySeverity: Record<MockSeverity, number>;
  /** Precision metrics */
  precision: {
    /** True positives */
    truePositives: number;
    /** False positives */
    falsePositives: number;
    /** Precision score (0-1) */
    score: number;
  };
}

/**
 * Claim integration for mock findings
 */
export interface MockClaim {
  /** Claim ID */
  id: string;
  /** Claim text */
  text: string;
  /** Finding this claim is based on */
  finding: MockFinding;
  /** Confidence level */
  confidence: number;
  /** Verification status */
  status: 'detected' | 'verified' | 'false_positive';
}
