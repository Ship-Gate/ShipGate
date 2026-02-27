/**
 * Types for Evidence Report HTML Viewer
 *
 * Configuration options for rendering evidence reports as HTML.
 */

import type {
  EvidenceReport,
  EvidenceClauseResult,
  Assumption,
  OpenQuestion,
  EvidenceArtifact,
  ScoreSummary,
} from '../evidence/evidenceTypes.js';

/**
 * Re-export evidence types for convenience
 */
export type {
  EvidenceReport,
  EvidenceClauseResult,
  Assumption,
  OpenQuestion,
  EvidenceArtifact,
  ScoreSummary,
};

/**
 * Options for rendering HTML reports
 */
export interface RenderOptions {
  /** Report title (defaults to specName or 'Evidence Report') */
  title?: string;
  /** Whether to include inline CSS (default: true) */
  includeStyles?: boolean;
  /** Whether to include a timestamp in the header (default: true) */
  showTimestamp?: boolean;
  /** Whether to collapse passed clauses by default (default: false) */
  collapsePassed?: boolean;
  /** Custom CSS class prefix for styling (default: 'ev') */
  classPrefix?: string;
  /** Base path for artifact links (default: '.') */
  artifactBasePath?: string;
  /** Whether to render as a complete HTML document (default: true) */
  fullDocument?: boolean;
  /** Custom footer text */
  footerText?: string;
  /** Dark mode theme (default: false) */
  darkMode?: boolean;
}

/**
 * Theme colors for the viewer
 */
export interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  pass: string;
  passBg: string;
  partial: string;
  partialBg: string;
  fail: string;
  failBg: string;
  ship: string;
  review: string;
  block: string;
  link: string;
  code: string;
}

/**
 * Light theme colors
 */
export const lightTheme: ThemeColors = {
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#212529',
  textSecondary: '#6c757d',
  border: '#dee2e6',
  pass: '#198754',
  passBg: '#d1e7dd',
  partial: '#fd7e14',
  partialBg: '#fff3cd',
  fail: '#dc3545',
  failBg: '#f8d7da',
  ship: '#198754',
  review: '#fd7e14',
  block: '#dc3545',
  link: '#0d6efd',
  code: '#e9ecef',
};

/**
 * Dark theme colors
 */
export const darkTheme: ThemeColors = {
  background: '#1a1a2e',
  surface: '#16213e',
  text: '#eaeaea',
  textSecondary: '#a0a0a0',
  border: '#2a2a4a',
  pass: '#4ade80',
  passBg: '#064e3b',
  partial: '#fbbf24',
  partialBg: '#78350f',
  fail: '#f87171',
  failBg: '#7f1d1d',
  ship: '#4ade80',
  review: '#fbbf24',
  block: '#f87171',
  link: '#60a5fa',
  code: '#2a2a4a',
};

/**
 * Grouped clause results by state
 */
export interface GroupedClauses {
  pass: EvidenceClauseResult[];
  partial: EvidenceClauseResult[];
  fail: EvidenceClauseResult[];
}

/**
 * Rendered section of the report
 */
export interface RenderedSection {
  id: string;
  title: string;
  html: string;
  isEmpty: boolean;
}

/**
 * Badge type for visual indicators
 */
export type BadgeType = 'pass' | 'partial' | 'fail' | 'ship' | 'review' | 'block' | 'info' | 'warning';

/**
 * Statistics derived from the report
 */
export interface ReportStats {
  totalClauses: number;
  passCount: number;
  partialCount: number;
  failCount: number;
  passRate: number;
  assumptionCount: number;
  questionCount: number;
  artifactCount: number;
  highPriorityQuestions: number;
  criticalAssumptions: number;
}
