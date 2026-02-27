// ============================================================================
// Diff Viewer Types
// ============================================================================

export type DiffViewMode = 'side-by-side' | 'unified' | 'semantic';

export type ChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export type BreakingChangeLevel = 'breaking' | 'warning' | 'safe';

export interface LineDiff {
  lineNumber: number;
  type: ChangeType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface HunkDiff {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: LineDiff[];
}

export interface FileDiff {
  oldContent: string;
  newContent: string;
  hunks: HunkDiff[];
  additions: number;
  deletions: number;
}

export interface SemanticChange {
  id: string;
  type: SemanticChangeType;
  path: string[];
  oldValue?: unknown;
  newValue?: unknown;
  description: string;
  breakingLevel: BreakingChangeLevel;
  location?: {
    oldLine?: number;
    newLine?: number;
  };
}

export type SemanticChangeType =
  // Domain-level
  | 'domain_version_changed'
  | 'domain_renamed'
  // Type changes
  | 'type_added'
  | 'type_removed'
  | 'type_renamed'
  | 'type_constraint_added'
  | 'type_constraint_removed'
  | 'type_constraint_modified'
  // Entity changes
  | 'entity_added'
  | 'entity_removed'
  | 'entity_renamed'
  | 'field_added'
  | 'field_removed'
  | 'field_renamed'
  | 'field_type_changed'
  | 'field_made_optional'
  | 'field_made_required'
  | 'field_annotation_added'
  | 'field_annotation_removed'
  | 'invariant_added'
  | 'invariant_removed'
  | 'invariant_modified'
  // Behavior changes
  | 'behavior_added'
  | 'behavior_removed'
  | 'behavior_renamed'
  | 'input_field_added'
  | 'input_field_removed'
  | 'input_field_type_changed'
  | 'output_type_changed'
  | 'error_added'
  | 'error_removed'
  | 'precondition_added'
  | 'precondition_removed'
  | 'precondition_modified'
  | 'postcondition_added'
  | 'postcondition_removed'
  | 'postcondition_modified'
  | 'temporal_spec_added'
  | 'temporal_spec_removed'
  | 'temporal_spec_modified'
  | 'security_spec_added'
  | 'security_spec_removed'
  // Scenario changes
  | 'scenario_added'
  | 'scenario_removed'
  | 'scenario_modified'
  // Policy changes
  | 'policy_added'
  | 'policy_removed'
  | 'policy_modified';

export interface MigrationHint {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  changeIds: string[];
  steps: MigrationStep[];
  codeExample?: {
    before: string;
    after: string;
    language: string;
  };
}

export interface MigrationStep {
  order: number;
  title: string;
  description: string;
  required: boolean;
}

export interface DiffSummary {
  totalChanges: number;
  additions: number;
  deletions: number;
  modifications: number;
  breakingChanges: number;
  warnings: number;
  semanticChanges: SemanticChange[];
  migrationHints: MigrationHint[];
}

export interface DiffViewerState {
  oldContent: string;
  newContent: string;
  viewMode: DiffViewMode;
  showLineNumbers: boolean;
  showBreakingOnly: boolean;
  expandedHints: Set<string>;
  selectedChange: string | null;
}

export interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  oldVersion?: string;
  newVersion?: string;
  onChangeSelect?: (change: SemanticChange) => void;
}
