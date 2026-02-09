/**
 * Main Fake Success UI Detector
 * Orchestrates pattern detection across all patterns
 */

import * as ts from 'typescript';
import type {
  FakeSuccessClaim,
  DetectionResult,
  DetectionOptions,
  FrameworkType,
} from './types.js';
import { detectFramework } from './frameworks/index.js';
import { createSourceFile } from './utils/ast-utils.js';
import { detectCatchReturnsSuccess } from './patterns/catch-returns-success.js';
import { detectTryCatchToastSuccess } from './patterns/try-catch-toast-success.js';
import { detectPromiseCatchDefaultSuccess } from './patterns/promise-catch-default-success.js';

/**
 * Default detection options
 */
const DEFAULT_OPTIONS: Required<DetectionOptions> = {
  minConfidence: 0.7,
  includeSnippets: true,
  maxSnippetLines: 15,
  frameworkHints: [],
};

/**
 * Detect fake success patterns in a file
 */
export function detectFakeSuccess(
  content: string,
  filePath: string,
  options: DetectionOptions = {}
): DetectionResult {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const claims: FakeSuccessClaim[] = [];

  // Skip non-source files
  if (
    !filePath.match(/\.(ts|tsx|js|jsx|vue)$/) &&
    !opts.frameworkHints?.length
  ) {
    return {
      claims: [],
      filesScanned: 0,
      durationMs: Date.now() - startTime,
    };
  }

  // Detect framework
  const frameworkInfo = detectFramework(content, filePath);

  // Create TypeScript source file for AST parsing
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = createSourceFile(content, filePath);
  } catch (error) {
    // If parsing fails, return empty result
    return {
      claims: [],
      filesScanned: 1,
      durationMs: Date.now() - startTime,
    };
  }

  // Run all pattern detectors
  const catchReturnsClaims = detectCatchReturnsSuccess(
    sourceFile,
    filePath,
    content
  );
  claims.push(...catchReturnsClaims);

  const tryCatchToastClaims = detectTryCatchToastSuccess(
    sourceFile,
    filePath,
    content,
    frameworkInfo.framework,
    frameworkInfo.library
  );
  claims.push(...tryCatchToastClaims);

  const promiseCatchClaims = detectPromiseCatchDefaultSuccess(
    sourceFile,
    filePath,
    content,
    frameworkInfo.framework,
    frameworkInfo.library
  );
  claims.push(...promiseCatchClaims);

  // Set framework on all claims
  for (const claim of claims) {
    claim.framework = frameworkInfo.framework;
  }

  // Filter by confidence
  const filteredClaims = claims.filter(
    claim => claim.confidence >= opts.minConfidence
  );

  return {
    claims: filteredClaims,
    filesScanned: 1,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Detect fake success patterns across multiple files
 */
export async function detectFakeSuccessBatch(
  files: Array<{ path: string; content: string }>,
  options: DetectionOptions = {}
): Promise<DetectionResult> {
  const startTime = Date.now();
  const allClaims: FakeSuccessClaim[] = [];
  let filesScanned = 0;

  for (const file of files) {
    const result = detectFakeSuccess(file.content, file.path, options);
    allClaims.push(...result.claims);
    filesScanned += result.filesScanned;
  }

  return {
    claims: allClaims,
    filesScanned,
    durationMs: Date.now() - startTime,
  };
}
