/**
 * @isl-lang/isl-verify-cli
 *
 * ISL Verify CLI — Instant verification for any project.
 * Infer specs from code, verify implementation, detect hallucinations.
 */

export { runScan } from './scan.js';
export { runInit, formatInitOutput } from './init.js';
export { runDiff, formatDiffOutput } from './diff.js';
export { runExplain, formatExplainOutput } from './explain.js';
export { loadConfig, getReportPath, getInferredSpecPath } from './config.js';
export type { ScanReport, Finding, IslVerifyConfig } from './types.js';
