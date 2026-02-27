/**
 * Capability Manifest Schema
 * 
 * Defines the format for declaring package completion status and required deliverables.
 */

export type CompletionStatus = 'shell' | 'partial' | 'complete';

export interface CapabilityManifest {
  /** Package name, e.g. "@isl-lang/parser" */
  name: string;
  /** Declared completion status */
  status: CompletionStatus;
  /** ISO-8601 timestamp of last status update */
  updatedAt: string;
  /** Optional notes about current state */
  notes?: string;
}

export interface DeliverableCheck {
  /** Whether this deliverable is present */
  present: boolean;
  /** Human-readable detail */
  detail: string;
  /** Evidence file path (optional) */
  evidence?: string;
}

export interface PackageCompleteness {
  /** Package name */
  name: string;
  /** Directory name under packages/ */
  dir: string;
  /** Declared status from manifest */
  declaredStatus: CompletionStatus;
  /** Actual assessed status based on deliverables */
  assessedStatus: CompletionStatus;
  /** ISO-8601 timestamp of assessment */
  assessedAt: string;

  deliverables: {
    /** package.json exports field properly configured */
    exports: DeliverableCheck;
    /** Test files exist and are not stubbed */
    tests: DeliverableCheck;
    /** README.md or docs/ with meaningful content */
    docs: DeliverableCheck;
    /** Sample usage example (examples/, demo/, or documented in README) */
    sampleUsage: DeliverableCheck;
  };

  /** Missing deliverables for "complete" status */
  missingForComplete: string[];
  /** Whether declared status matches actual status */
  statusMatches: boolean;
}

export interface CompletenessReport {
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** Total packages scanned */
  totalPackages: number;
  /** Packages with status="complete" */
  completeCount: number;
  /** Packages with status="partial" */
  partialCount: number;
  /** Packages with status="shell" */
  shellCount: number;
  /** Packages where declared status doesn't match actual */
  mismatchedCount: number;
  /** Per-package results */
  packages: PackageCompleteness[];
}

export interface PrioritizedBacklog {
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** Packages ranked by priority */
  prioritized: Array<{
    /** Package name */
    name: string;
    /** Directory name */
    dir: string;
    /** Current status */
    status: CompletionStatus;
    /** Priority score (higher = more important) */
    priorityScore: number;
    /** Priority factors */
    factors: {
      /** Number of packages that depend on this */
      dependencyCount: number;
      /** Whether this is a core/essential package */
      isCore: boolean;
      /** Whether this blocks other packages */
      blocksOthers: boolean;
      /** Product impact score (0-10) */
      productImpact: number;
    };
    /** Missing deliverables */
    missingDeliverables: string[];
  }>;
}

/** Required deliverables for "complete" status */
export const REQUIRED_FOR_COMPLETE: (keyof PackageCompleteness['deliverables'])[] = [
  'exports',
  'tests',
  'docs',
  'sampleUsage',
];
