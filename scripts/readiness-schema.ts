/**
 * PackageReadiness schema definition.
 * Defines the quality gates for graduating a package from experimental to production.
 */

export interface GateResult {
  /** Whether this gate passed */
  pass: boolean;
  /** Human-readable detail */
  detail: string;
  /** Evidence file path or URL (optional) */
  evidence?: string;
}

export interface PackageReadiness {
  /** Package name, e.g. "@isl-lang/parser" */
  name: string;
  /** Directory name under packages/ */
  dir: string;
  /** Current tier in experimental.json: production | partial | experimental | internal */
  tier: 'production' | 'partial' | 'experimental' | 'internal' | 'unlisted';
  /** ISO-8601 timestamp of this assessment */
  assessedAt: string;

  gates: {
    /** Package builds without errors */
    build: GateResult;
    /** TypeScript compiles with --noEmit */
    typecheck: GateResult;
    /** Tests exist and are not stubbed out */
    test: GateResult;
    /** README.md or docs/ exist with meaningful content */
    docs: GateResult;
    /** Coverage config or report exists */
    coverage: GateResult;
    /** package.json exports field is properly configured */
    exports: GateResult;
    /** No placeholder/echo-only scripts */
    perf: GateResult;
    /** Not marked private when it shouldn't be; no known security notes */
    security: GateResult;
  };

  /** Number of gates that passed */
  score: number;
  /** Total number of gates */
  total: number;
  /** Score as a percentage 0-100 */
  percent: number;
  /** Whether all required gates pass (eligible for promotion) */
  ready: boolean;
}

export interface ReadinessReport {
  /** ISO-8601 timestamp */
  generatedAt: string;
  /** Total packages scanned */
  totalPackages: number;
  /** Packages that meet promotion threshold */
  readyCount: number;
  /** Packages below threshold */
  notReadyCount: number;
  /** Promotion threshold percentage */
  threshold: number;
  /** Per-package results */
  packages: PackageReadiness[];
}

/** Gates that must pass for promotion (all of them) */
export const REQUIRED_GATES: (keyof PackageReadiness['gates'])[] = [
  'build',
  'typecheck',
  'test',
  'docs',
  'exports',
];

/** Gates that are advisory (warn but don't block) */
export const ADVISORY_GATES: (keyof PackageReadiness['gates'])[] = [
  'coverage',
  'perf',
  'security',
];

/** Default promotion threshold (percentage of all gates) */
export const PROMOTION_THRESHOLD = 75;
