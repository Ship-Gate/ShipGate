/**
 * ISL Snapshot Testing
 * 
 * Snapshot testing library for ISL specifications and generated outputs.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Snapshot Management
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Store
  SnapshotStore,
  Store,
  getSnapshotStore,
  setSnapshotStore,
  resetSnapshotStore,
  
  // Operations
  matchSnapshot,
  updateSnapshot,
  
  // Utilities
  hashContent,
  generateSnapshotKey,
  getSnapshotPath,
  defaultSerializer,
  defaultComparator,
  
  // Types
  type Snapshot,
  type SnapshotMetadata,
  type SnapshotType,
  type SnapshotFile,
  type SnapshotComparisonResult,
  type SnapshotOptions,
  
  // Constants
  SNAPSHOT_VERSION,
  SNAPSHOT_EXTENSION,
  DEFAULT_SNAPSHOT_DIR,
} from './snapshot.js';

// ─────────────────────────────────────────────────────────────────────────────
// Comparators
// ─────────────────────────────────────────────────────────────────────────────

export {
  // JSON
  compareJson,
  compareJsonStrings,
  parseJson,
  serializeJson,
  createJsonSerializer,
  createJsonComparator,
  type JsonCompareOptions,
  type JsonDiff,
  type JsonCompareResult,
  
  // ISL
  compareIsl,
  parseIslElements,
  extractDomainName,
  extractVersion,
  removeComments,
  normalizeWhitespace,
  normalizeIsl,
  createIslSerializer,
  createIslComparator,
  type IslCompareOptions,
  type IslElement,
  type IslElementType,
  type IslDiff,
  type IslCompareResult,
  
  // Generated Code
  compareGenerated,
  compareLines,
  normalizeTypescript,
  normalizeFormatting,
  normalizeImports,
  removeGeneratedComments,
  removeTimestamps,
  createGeneratedSerializer,
  createGeneratedComparator,
  detectFileType,
  getNormalizerForFile,
  type GeneratedCompareOptions,
  type CodeDiff,
  type GeneratedCompareResult,
} from './comparators/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Updater
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Tracking
  markAccessed,
  getAccessedSnapshots,
  clearAccessedSnapshots,
  
  // Operations
  saveSnapshots,
  isUpdateMode,
  findSnapshotFiles,
  getSnapshotSummary,
  removeObsoleteSnapshots,
  cleanEmptySnapshotDirs,
  
  // Statistics
  resetStats,
  recordPassed,
  recordFailed,
  recordAdded,
  recordUpdated,
  recordRemoved,
  recordObsolete,
  getStats,
  formatStats,
  
  // Types
  type UpdateResult,
  type UpdateOptions,
  type SnapshotSummary,
  type TestRunStats,
} from './updater.js';

// ─────────────────────────────────────────────────────────────────────────────
// Reporter
// ─────────────────────────────────────────────────────────────────────────────

export {
  // Diff generation
  generateDiff,
  
  // Formatting
  formatUnifiedDiff,
  formatInlineDiff,
  
  // Reports
  generateSnapshotReport,
  generateSummaryReport,
  
  // Types
  type ReporterOptions,
  type DiffHunk,
  type DiffLine,
  type DiffResult,
} from './reporter.js';

// ─────────────────────────────────────────────────────────────────────────────
// High-Level API
// ─────────────────────────────────────────────────────────────────────────────

import { 
  matchSnapshot as _matchSnapshot, 
  getSnapshotStore,
  type SnapshotOptions,
} from './snapshot.js';
import { 
  createIslSerializer, 
  createIslComparator,
  type IslCompareOptions,
} from './comparators/isl.js';
import { 
  createGeneratedSerializer, 
  createGeneratedComparator,
  type GeneratedCompareOptions,
} from './comparators/generated.js';
import { 
  createJsonSerializer, 
  createJsonComparator,
  type JsonCompareOptions,
} from './comparators/json.js';
import { 
  isUpdateMode,
  markAccessed,
  recordPassed,
  recordFailed,
  recordAdded,
  saveSnapshots,
} from './updater.js';
import { generateSnapshotReport } from './reporter.js';

/** Context for snapshot matching */
export interface SnapshotContext {
  testFile: string;
  testName: string;
}

/** ISL snapshot options */
export interface IslSnapshotOptions extends IslCompareOptions {
  name?: string;
}

/** Generated code snapshot options */
export interface GeneratedSnapshotOptions extends GeneratedCompareOptions {
  name?: string;
  filename?: string;
}

/** JSON snapshot options */
export interface JsonSnapshotOptions extends JsonCompareOptions {
  name?: string;
}

/**
 * Match value against ISL snapshot
 */
export function matchIslSnapshot(
  value: string,
  context: SnapshotContext,
  options: IslSnapshotOptions = {}
): { pass: boolean; message: string } {
  const serializer = createIslSerializer(options);
  const comparator = createIslComparator(options);
  
  const result = _matchSnapshot(value, context.testFile, context.testName, {
    serializer,
    comparator,
    type: 'isl',
    name: options.name,
    update: isUpdateMode(),
  });

  markAccessed(context.testFile, result.metadata?.name ?? '');

  if (result.match) {
    recordPassed();
    return { pass: true, message: 'Snapshot matched' };
  }

  recordFailed();
  const report = generateSnapshotReport(
    context.testName,
    result.metadata?.name ?? 'unknown',
    result.expected,
    result.actual
  );
  
  return { pass: false, message: report };
}

/**
 * Match value against generated code snapshot
 */
export function matchGeneratedSnapshot(
  value: string,
  context: SnapshotContext,
  options: GeneratedSnapshotOptions = {}
): { pass: boolean; message: string } {
  const serializer = createGeneratedSerializer(options);
  const comparator = createGeneratedComparator(options);
  
  const snapshotName = options.name ?? options.filename;
  
  const result = _matchSnapshot(value, context.testFile, context.testName, {
    serializer,
    comparator,
    type: 'generated',
    name: snapshotName,
    update: isUpdateMode(),
  });

  markAccessed(context.testFile, result.metadata?.name ?? '');

  if (result.match) {
    recordPassed();
    return { pass: true, message: 'Snapshot matched' };
  }

  recordFailed();
  const report = generateSnapshotReport(
    context.testName,
    result.metadata?.name ?? options.filename ?? 'unknown',
    result.expected,
    result.actual
  );
  
  return { pass: false, message: report };
}

/**
 * Match value against JSON snapshot
 */
export function matchJsonSnapshot(
  value: unknown,
  context: SnapshotContext,
  options: JsonSnapshotOptions = {}
): { pass: boolean; message: string } {
  const serializer = createJsonSerializer(options);
  const comparator = createJsonComparator(options);
  
  const result = _matchSnapshot(value, context.testFile, context.testName, {
    serializer,
    comparator,
    type: 'json',
    name: options.name,
    update: isUpdateMode(),
  });

  markAccessed(context.testFile, result.metadata?.name ?? '');

  if (result.match) {
    recordPassed();
    return { pass: true, message: 'Snapshot matched' };
  }

  recordFailed();
  const report = generateSnapshotReport(
    context.testName,
    result.metadata?.name ?? 'unknown',
    result.expected,
    result.actual
  );
  
  return { pass: false, message: report };
}

/**
 * Save all snapshots (call at end of test run)
 */
export function finalize(): void {
  saveSnapshots();
}
