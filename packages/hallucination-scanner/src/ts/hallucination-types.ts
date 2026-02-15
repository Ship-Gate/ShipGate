/**
 * HallucinationDetector finding types
 * @module @isl-lang/hallucination-scanner/ts/hallucination-types
 */

export type HallucinationSeverity = 'critical' | 'high' | 'medium' | 'low';

export type HallucinationCategory =
  | 'phantom_api'
  | 'env_var_undefined'
  | 'env_var_local_only'
  | 'file_reference'
  | 'loose_equality'
  | 'json_parse_unsafe'
  | 'array_find_unsafe'
  | 'req_body_unsafe'
  | 'async_unhandled'
  | 'silent_catch'
  | 'placeholder_text'
  | 'template_variable'
  | 'duplicated_logic'
  | 'stale_pattern'
  | 'blocking_sync'
  | 'custom';

export interface HallucinationFinding {
  category: HallucinationCategory;
  severity: HallucinationSeverity;
  message: string;
  suggestion?: string;
  file: string;
  line: number;
  column: number;
  /** Snippet of the problematic code */
  snippet?: string;
  /** Raw matched text for context */
  raw?: string;
}

export interface HallucinationScanResult {
  success: boolean;
  findings: HallucinationFinding[];
  /** Count by severity */
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Finding format compatible with spec-implementation-verifier / ISL Gate.
 * Use toHallucinationFindings() to convert HallucinationFinding[] to this format.
 */
export interface Finding {
  id: string;
  checker: string;
  ruleId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  file?: string;
  line?: number;
  column?: number;
  blocking: boolean;
  recommendation?: string;
  snippet?: string;
  context?: Record<string, unknown>;
}
