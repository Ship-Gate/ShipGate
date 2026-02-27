/**
 * Mock Detector
 * 
 * Behavior-based detection of mock data and placeholder code.
 * Distinguishes mock-like naming from actual mock behavior.
 * 
 * @module @isl-lang/mock-detector
 */

export { scanFile, calculateSummary } from './detector.js';
export { scanFileWithResult } from './scan-result.js';
export type { ScanResult } from './scan-result.js';
export type {
  MockFinding,
  MockBehaviorType,
  MockSeverity,
  MockLocation,
  MockDetectorConfig,
  MockPattern,
  DetectionSummary,
  MockDetectionResult,
  MockClaim,
} from './types.js';

export { isAllowlisted, getAllowlistReason } from './allowlist.js';
export { DEFAULT_ALLOWLIST_PATTERNS, DEV_BUILD_PATTERNS } from './allowlist.js';

export {
  findingToClaim,
  findingsToClaims,
  createMockClaim,
  mockClaimsToClaims,
} from './claims.js';

export {
  buildClaimGraph,
  addToClaimGraph,
  getClaimGraphSummary,
} from './claim-graph.js';

export type {
  ClaimGraph,
  ClaimGraphNode,
  ClaimGraphEdge,
} from './claim-graph.js';

export { DEFAULT_PATTERNS } from './patterns/index.js';
