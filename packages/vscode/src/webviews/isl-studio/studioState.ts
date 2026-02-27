/**
 * ISL Studio State
 * 
 * State management for the ISL Studio webview panel.
 * Handles prompt input, spec generation, and status tracking.
 */

/**
 * Generation mode for spec creation
 */
export type GenerationMode = 'generate' | 'generateAndBuild' | 'audit';

/**
 * Studio operation status
 */
export type StudioStatus = 'idle' | 'generating' | 'building' | 'auditing' | 'error' | 'success';

/**
 * Clause from a generated spec
 */
export interface SpecClause {
  id: string;
  type: 'precondition' | 'postcondition' | 'invariant' | 'effect' | 'constraint';
  description: string;
  status: 'pending' | 'verified' | 'failed' | 'skipped';
  code?: string;
}

/**
 * Score breakdown for verification
 */
export interface StudioScore {
  overall: number;
  passed: number;
  failed: number;
  pending: number;
  total: number;
}

/**
 * Open question requiring user input
 */
export interface StudioOpenQuestion {
  id: string;
  question: string;
  options?: string[];
  defaultOption?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  answered?: boolean;
  answer?: string;
}

/**
 * Assumption made during generation
 */
export interface StudioAssumption {
  id: string;
  topic: string;
  assumed: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Generated spec content
 */
export interface GeneratedSpec {
  raw: string;
  formatted: string;
  clauses: SpecClause[];
  assumptions: StudioAssumption[];
  openQuestions: StudioOpenQuestion[];
  timestamp: number;
}

/**
 * Messages from webview to extension
 */
export type StudioWebviewMessage =
  | { type: 'generateSpec'; prompt: string }
  | { type: 'generateAndBuild'; prompt: string }
  | { type: 'auditExisting'; specPath?: string }
  | { type: 'cancelOperation' }
  | { type: 'saveSpec'; path?: string }
  | { type: 'copySpec' }
  | { type: 'answerQuestion'; questionId: string; answer: string }
  | { type: 'clearState' }
  | { type: 'openSettings' };

/**
 * Messages from extension to webview
 */
export type StudioExtensionMessage =
  | { type: 'updateState'; state: StudioState }
  | { type: 'setStatus'; status: StudioStatus; message?: string }
  | { type: 'setSpec'; spec: GeneratedSpec }
  | { type: 'setScore'; score: StudioScore }
  | { type: 'setError'; error: string }
  | { type: 'appendLog'; log: string }
  | { type: 'setLoading'; isLoading: boolean };

/**
 * Full studio state
 */
export interface StudioState {
  // Input
  prompt: string;
  mode: GenerationMode;
  
  // Status
  status: StudioStatus;
  statusMessage: string;
  isLoading: boolean;
  error: string | null;
  
  // Generated content
  spec: GeneratedSpec | null;
  score: StudioScore | null;
  
  // Activity log
  logs: string[];
  
  // Metadata
  specPath: string | null;
  lastGenerated: number | null;
}

/**
 * Create initial empty state
 */
export function createInitialStudioState(): StudioState {
  return {
    prompt: '',
    mode: 'generate',
    status: 'idle',
    statusMessage: 'Ready to generate ISL specifications',
    isLoading: false,
    error: null,
    spec: null,
    score: null,
    logs: [],
    specPath: null,
    lastGenerated: null
  };
}

/**
 * Calculate score from clauses
 */
export function calculateScoreFromClauses(clauses: SpecClause[]): StudioScore {
  const passed = clauses.filter(c => c.status === 'verified').length;
  const failed = clauses.filter(c => c.status === 'failed').length;
  const pending = clauses.filter(c => c.status === 'pending').length;
  const total = clauses.length;
  
  const overall = total > 0 ? Math.round((passed / total) * 100) : 0;
  
  return { overall, passed, failed, pending, total };
}

/**
 * Get status color class
 */
export function getStatusColorClass(status: StudioStatus): string {
  switch (status) {
    case 'success': return 'status-success';
    case 'error': return 'status-error';
    case 'generating':
    case 'building':
    case 'auditing':
      return 'status-progress';
    default:
      return 'status-idle';
  }
}

/**
 * Get clause type label
 */
export function getClauseTypeLabel(type: SpecClause['type']): string {
  const labels: Record<SpecClause['type'], string> = {
    precondition: 'PRE',
    postcondition: 'POST',
    invariant: 'INV',
    effect: 'EFF',
    constraint: 'CON'
  };
  return labels[type];
}
