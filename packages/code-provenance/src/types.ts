/**
 * AI Code Provenance — Core Types
 *
 * Line-level attribution system that maps every line of code to its authoring
 * agent (Claude, Copilot, Codex, Gemini, etc.), the human who prompted it,
 * and when it was written.
 *
 * @module @isl-lang/code-provenance
 */

// ============================================================================
// Agent identification
// ============================================================================

export type AgentTool =
  | 'cursor'
  | 'copilot'
  | 'codex'
  | 'claude-code'
  | 'gemini'
  | 'windsurf'
  | 'aider'
  | 'cody'
  | 'unknown-ai';

export interface AgentInfo {
  tool: AgentTool;
  model?: string;
  detectionMethod: DetectionMethod;
}

export type DetectionMethod =
  | 'commit-trailer'
  | 'co-authored-by'
  | 'provenance-json'
  | 'commit-message'
  | 'author-heuristic'
  | 'env-var'
  | 'config-file'
  | 'heuristic';

export type Confidence = 'high' | 'medium' | 'low';

// ============================================================================
// Line-level attribution
// ============================================================================

export interface LineAttribution {
  line: number;
  content: string;
  author: AuthorInfo;
  agent: AgentInfo | null;
  commit: CommitInfo;
  confidence: Confidence;
}

export interface AuthorInfo {
  name: string;
  email: string;
}

export interface CommitInfo {
  hash: string;
  message: string;
  timestamp: string;
}

// ============================================================================
// File-level attribution
// ============================================================================

export interface FileAttribution {
  path: string;
  totalLines: number;
  humanLines: number;
  aiLines: number;
  unknownLines: number;
  byAgent: Partial<Record<AgentTool, number>>;
  byAuthor: Record<string, number>;
  lines: LineAttribution[];
}

// ============================================================================
// Project-level attribution
// ============================================================================

export interface ProjectAttribution {
  repository: string;
  branch: string;
  commit: string;
  generatedAt: string;
  files: FileAttribution[];
  summary: ProjectSummary;
}

export interface ProjectSummary {
  totalLines: number;
  humanAuthored: number;
  aiAuthored: number;
  unknown: number;
  byAgent: Partial<Record<AgentTool, number>>;
  byAuthor: Record<string, AuthorStats>;
  topContributors: ContributorSummary[];
}

export interface AuthorStats {
  total: number;
  withAi: number;
}

export interface ContributorSummary {
  name: string;
  email: string;
  lines: number;
  aiPercentage: number;
}

// ============================================================================
// Git blame raw types
// ============================================================================

export interface BlameEntry {
  commitHash: string;
  lineNumber: number;
  content: string;
  authorName: string;
  authorEmail: string;
  authorTimestamp: number;
  authorTz: string;
  committerName: string;
  committerEmail: string;
  committerTimestamp: number;
  committerTz: string;
  summary: string;
}

// ============================================================================
// Commit metadata and AI signal types
// ============================================================================

export interface CommitMetadata {
  hash: string;
  message: string;
  body: string;
  authorName: string;
  authorEmail: string;
  authorDate: string;
  trailers: Record<string, string>;
  coAuthors: CoAuthor[];
}

export interface CoAuthor {
  name: string;
  email: string;
}

export interface AISignal {
  agent: AgentTool;
  model?: string;
  confidence: Confidence;
  method: DetectionMethod;
  raw: string;
}

// ============================================================================
// Provenance session (for .shipgate/provenance.json)
// ============================================================================

export interface ProvenanceSession {
  generator: string;
  model?: string;
  operator?: string;
  sessionStarted: string;
  sessionEnded?: string;
  autoDetected: boolean;
}

// ============================================================================
// Scan options
// ============================================================================

export interface ProvenanceScanOptions {
  cwd?: string;
  include?: string[];
  exclude?: string[];
  since?: string;
  maxFiles?: number;
}

export const DEFAULT_INCLUDE = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.go', '**/*.rs', '**/*.java', '**/*.rb'];
export const DEFAULT_EXCLUDE = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/vendor/**', '**/build/**', '**/.next/**'];
