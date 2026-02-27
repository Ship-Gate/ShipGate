/**
 * ISL Telemetry Module
 * 
 * Opt-in local telemetry for ISL operations.
 * All data is stored locally - no network calls are made.
 * 
 * @example
 * ```typescript
 * import { 
 *   createLocalTelemetry, 
 *   TELEMETRY_EVENTS,
 *   redactSecrets 
 * } from '@isl/core/telemetry';
 * 
 * // Create telemetry recorder (opt-in)
 * const telemetry = await createLocalTelemetry({ enabled: true });
 * 
 * // Record events
 * telemetry.recordEvent(TELEMETRY_EVENTS.VERIFY_COMPLETE, {
 *   specName: 'auth.isl',
 *   score: 95,
 *   duration: 1234,
 * });
 * 
 * // Close when done
 * await telemetry.close();
 * ```
 */

// Export types
export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryMetadata,
  TelemetryRecorder,
  RedactionPattern,
  TelemetryEventName,
} from './telemetryTypes.js';

// Export constants
export {
  TELEMETRY_EVENTS,
  DEFAULT_REDACTION_PATTERNS,
  TELEMETRY_ENV_VAR,
  TELEMETRY_DIR_ENV_VAR,
} from './telemetryTypes.js';

// Export functions
export {
  createTelemetry,
  createLocalTelemetry,
  createNullTelemetry,
  redactSecrets,
  MemoryTelemetryRecorder,
} from './telemetry.js';

// Export local recorder
export { LocalTelemetryRecorder, createLocalRecorder } from './localRecorder.js';
