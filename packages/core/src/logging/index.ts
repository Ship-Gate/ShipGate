/**
 * ISL Unified Logger Module
 * 
 * Provides consistent logging across all ISL subsystems:
 * - Translator (ISL → TypeScript/contracts)
 * - Agent (AI verification)  
 * - Verifier (test execution)
 * 
 * @module @isl/core/logging
 */

export {
  // Main logger factory
  createISLLogger,
  createNullLogger,
  createMemoryLogger,
  createCorrelationId,
  
  // Types
  type ISLLogger,
  type ISLLogEvent,
  type LogLevel,
  type EventName,
  type LoggerOptions,
  type LogErrorDetails,
  type Subsystem,
  
  // Constants
  ISL_EVENTS,
  LOG_LEVEL_VALUES,
  
  // Formatters
  formatPretty,
  formatJSON,
  formatNDJSON,
  formatJSONArray,
  toEvidenceArtifact,
  type FormatOptions,
} from './islLogger.js';

export type {
  EventCategory,
} from './logTypes.js';
