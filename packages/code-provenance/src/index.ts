/**
 * @isl-lang/code-provenance
 *
 * Line-level AI code attribution system. Maps every line of code to its
 * authoring agent (Claude, Copilot, Codex, Gemini, etc.), the human
 * operator who prompted it, and the timestamp.
 *
 * @module @isl-lang/code-provenance
 */

// Core types
export type {
  AgentTool,
  AgentInfo,
  DetectionMethod,
  Confidence,
  LineAttribution,
  AuthorInfo,
  CommitInfo,
  FileAttribution,
  ProjectAttribution,
  ProjectSummary,
  AuthorStats,
  ContributorSummary,
  BlameEntry,
  CommitMetadata,
  CoAuthor,
  AISignal,
  ProvenanceSession,
  ProvenanceScanOptions,
} from './types.js';

export { DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from './types.js';

// Git blame
export { blameFile, parseBlameOutput, isTracked, listTrackedFiles } from './blame.js';

// Commit parsing
export {
  getCommitMetadata,
  parseCommitOutput,
  parseTrailers,
  parseCoAuthors,
  extractAISignals,
  normalizeAgentName,
} from './commit-parser.js';

// Agent classification
export {
  classifyCommit,
  detectConfigSignals,
  loadProvenanceSession,
  getAgentDisplayName,
  determineConfidence,
} from './classifier.js';

// Commit cache
export { CommitCache } from './cache.js';

// Attribution builder
export {
  buildFileAttribution,
  buildProjectAttribution,
  buildSingleFileAttribution,
} from './builder.js';

// Reporting
export {
  formatSummaryReport,
  formatFileBlameReport,
  toJSON,
  fileToJSON,
  toCSV,
  fileToCSV,
  generateDashboardSummary,
} from './reporter.js';

// Hooks
export { detectActiveTool, formatTrailerValue } from './hooks/detect-tool.js';
export { installHook, uninstallHook, initProvenanceSession } from './hooks/pre-commit.js';
