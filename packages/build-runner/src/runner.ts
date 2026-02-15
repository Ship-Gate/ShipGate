// ============================================================================
// Build Runner - Main Entry Point
// ============================================================================

import type {
  BuildOptions,
  BuildResult,
  OutputFile,
  PipelineTiming,
  StageError,
} from './types.js';
import {
  parseStage,
  checkStage,
  importResolveStage,
  codegenStage,
  testgenStage,
  verifyStage,
  runTestsStage,
} from './pipeline.js';
import { frontendStage } from './frontend-stage.js';
import {
  writeOutputFiles,
  generateManifestContent,
  sortFilesDeterministically,
} from './output.js';
import { generateEvidenceJson, generateEvidenceHtml } from './evidence.js';

/**
 * Default build options
 */
const DEFAULT_OPTIONS: Partial<BuildOptions> = {
  target: 'typescript',
  testFramework: 'vitest',
  verify: true,
  htmlReport: true,
  includeChaosTests: true,
  includeHelpers: true,
  runTests: true,
  maxTestFixIterations: 2,
};

/**
 * Run the complete build pipeline
 * 
 * Performs:
 * 1. Parse ISL spec
 * 2. Type check
 * 3. Resolve imports
 * 4. Generate code (TypeScript)
 * 5. Generate tests
 * 6. Run verification
 * 7. Generate evidence JSON and HTML
 * 
 * All outputs are deterministic with stable ordering and no timestamps.
 */
export async function run(options: BuildOptions): Promise<BuildResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: StageError[] = [];
  const files: OutputFile[] = [];
  const timing: PipelineTiming = {
    parse: 0,
    check: 0,
    importResolve: 0,
    codegen: 0,
    testgen: 0,
    verify: 0,
    total: 0,
  };

  const totalStart = performance.now();

  // Stage 1: Parse
  const parseResult = await parseStage(opts.specPath);
  timing.parse = parseResult.durationMs;
  errors.push(...parseResult.errors);

  if (!parseResult.success || !parseResult.data) {
    return createFailedResult(errors, timing, opts.outDir, files);
  }

  const { domain, source } = parseResult.data;

  // Stage 2: Type Check
  const checkResult = checkStage(domain);
  timing.check = checkResult.durationMs;
  errors.push(...checkResult.errors);

  if (!checkResult.success) {
    return createFailedResult(errors, timing, opts.outDir, files);
  }

  // Stage 3: Import Resolution
  const importResult = importResolveStage(source);
  timing.importResolve = importResult.durationMs;
  errors.push(...importResult.errors);

  // Stage 4: Code Generation
  const codegenResult = await codegenStage(domain, {
    target: opts.target === 'openapi' ? 'openapi' : 'typescript',
    apiOnly: opts.apiOnly,
  });
  timing.codegen = codegenResult.durationMs;
  errors.push(...codegenResult.errors);

  if (codegenResult.success && codegenResult.data) {
    files.push(...codegenResult.data.files);
  }

  // Stage 5: Test Generation (runs AFTER codegen with source context)
  const testgenResult = await testgenStage(
    domain,
    {
      testFramework: opts.testFramework,
      includeChaosTests: opts.includeChaosTests,
      includeHelpers: opts.includeHelpers,
    },
    codegenResult.success && codegenResult.data ? codegenResult.data.files : undefined
  );
  timing.testgen = testgenResult.durationMs;
  errors.push(...testgenResult.errors);

  if (testgenResult.success && testgenResult.data) {
    files.push(...testgenResult.data.files);
  }

  // Stage 5b: Frontend Generation (optional, skipped when apiOnly)
  if (opts.generateFrontend && !opts.apiOnly) {
    const frontendResult = frontendStage(
      domain,
      opts.frontendOutDir ?? 'frontend'
    );
    if (frontendResult.success && frontendResult.data) {
      files.push(...frontendResult.data.files);
    }
    errors.push(...frontendResult.errors);
  }

  // Stage 6: Verification (optional)
  let evidence = undefined;
  if (opts.verify) {
    const verifyResult = await verifyStage(domain, opts.specPath, source);
    timing.verify = verifyResult.durationMs;
    errors.push(...verifyResult.errors);

    if (verifyResult.data) {
      evidence = verifyResult.data.evidence;

      // Update evidence timing
      evidence.timing = { ...timing };

      // Add evidence files
      const evidenceJson = generateEvidenceJson(evidence);
      files.push({
        path: 'evidence/evidence.json',
        content: evidenceJson,
        type: 'evidence',
      });

      if (opts.htmlReport) {
        const evidenceHtml = generateEvidenceHtml(evidence);
        files.push({
          path: 'reports/report.html',
          content: evidenceHtml,
          type: 'report',
        });
      }
    }
  }

  // Calculate total time
  timing.total = performance.now() - totalStart;

  // Update evidence timing with final total
  if (evidence) {
    evidence.timing.total = timing.total;
  }

  // Sort files deterministically
  const sortedFiles = sortFilesDeterministically(files);

  // Write output files (must happen before test execution)
  const manifest = await writeOutputFiles(opts.outDir, sortedFiles);

  // Run tests after files are written
  const { testReport } = await runTestsStage(opts.outDir, {
    runTests: opts.runTests ?? true,
    maxTestFixIterations: opts.maxTestFixIterations ?? 2,
  });

  // Add test report to evidence if available
  if (evidence && testReport) {
    evidence.testReport = testReport;
  }

  // Generate manifest content before adding to manifest
  const manifestEntry = {
    path: 'manifest.json',
    type: 'config' as const,
    sizeBytes: 0,
    hash: '',
  };
  
  // Include manifest in the manifest itself for completeness
  manifest.files.push(manifestEntry);
  manifest.files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  
  const manifestContent = generateManifestContent(manifest);
  manifestEntry.sizeBytes = Buffer.byteLength(manifestContent, 'utf8');
  
  await writeOutputFiles(opts.outDir, [{
    path: 'manifest.json',
    content: manifestContent,
    type: 'config',
  }]);

  // Build fails on: parse errors, or test verdict FAIL when runTests enabled
  const hasParseErrors = errors.filter((e) => e.stage === 'parse').length > 0;
  const testVerdictFail =
    opts.runTests !== false &&
    evidence?.testReport?.verdict === 'FAIL';
  const success = !hasParseErrors && !testVerdictFail;

  return {
    success,
    files: sortedFiles,
    evidence,
    errors,
    timing,
    outDir: opts.outDir,
    manifest,
  };
}

/**
 * Create a failed build result
 */
function createFailedResult(
  errors: StageError[],
  timing: PipelineTiming,
  outDir: string,
  files: OutputFile[]
): BuildResult {
  timing.total = performance.now();

  return {
    success: false,
    files,
    evidence: undefined,
    errors,
    timing,
    outDir,
    manifest: {
      root: outDir,
      files: [],
      counts: {
        types: 0,
        test: 0,
        helper: 0,
        config: 0,
        fixture: 0,
        evidence: 0,
        report: 0,
        openapi: 0,
      },
    },
  };
}

/**
 * Build runner API object for convenient importing
 */
export const buildRunner = {
  run,
};

export default buildRunner;
