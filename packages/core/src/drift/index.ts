/**
 * Drift Detection Module
 *
 * Detects when source code has changed but its ISL spec hasn't been
 * updated — the spec may no longer accurately describe the code's behavior.
 */

// Main API
export { detectDrift, scanForDrift, findMatchingSpec, matchSpecsToImpls } from './detectDrift.js';

// Watch mode
export { watchForDrift } from './watchDrift.js';

// Formatting
export { formatDriftScanSummary, formatSingleReport, formatDriftScanJSON } from './formatDrift.js';

// Score
export { calculateDriftScore, scoreSeverity } from './score.js';

// Extraction utilities
export { extractFunctions, extractImports, extractExportedNames } from './extract.js';

// Strategies (for advanced / custom usage)
export {
  detectTimestampDrift,
  detectSignatureDrift,
  detectBehaviorDrift,
  detectDependencyDrift,
  findMatchingBehavior,
  normalizeName,
  daysBetween,
} from './strategies.js';

// Types
export type {
  DriftReport,
  DriftSeverity,
  DriftIndicator,
  DriftIndicatorType,
  CodeLocation,
  ExtractedFunction,
  ExtractedImport,
  DriftConfig,
  DriftWatchConfig,
  DriftWatchEvent,
  DriftWatchEventCallback,
  DriftWatchHandle,
  SpecImplPair,
  DriftScanSummary,
} from './driftTypes.js';

export { DEFAULT_DRIFT_CONFIG, DEFAULT_DRIFT_WATCH_CONFIG } from './driftTypes.js';
