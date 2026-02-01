/**
 * SARIF Output for ISL Clause Failures
 *
 * Exports functions and types for converting ISL Evidence Reports
 * to SARIF (Static Analysis Results Interchange Format) 2.1.0.
 *
 * @module @intentos/core/formatters/sarif-isl
 */

// Main conversion functions
export {
  toSarif,
  toSarifString,
  createClauseFailureResult,
  mergeSarifLogs,
} from './toSarif.js';

// Type exports
export type {
  // Core SARIF types
  SarifLog,
  SarifRun,
  SarifTool,
  SarifToolComponent,
  SarifResult,
  SarifReportingDescriptor,
  SarifReportingConfiguration,
  SarifLevel,
  SarifMessage,
  SarifLocation,
  SarifPhysicalLocation,
  SarifArtifactLocation,
  SarifRegion,
  SarifArtifactContent,
  SarifLogicalLocation,
  SarifFix,
  SarifArtifactChange,
  SarifReplacement,
  SarifInvocation,
  SarifNotification,
  SarifArtifact,
  SarifPropertyBag,
  // ISL-specific types
  IslClauseType,
  IslClauseState,
  IslBindingLocation,
  ToSarifOptions,
} from './sarifTypes.js';
