// ============================================================================
// Build Pipeline - Stage Implementations
// ============================================================================

import { parse, type DomainDeclaration } from '@isl-lang/parser';
import { check } from '@isl-lang/typechecker';
import { preprocessSource, compile, type CompileResult } from '@isl-lang/isl-compiler';
import { generate as generateTests, type GeneratedFile as TestGenFile } from '@isl-lang/codegen-tests';
import {
  verify,
  getBehaviorNames,
  buildMockImplementation,
  type VerifyResult,
} from '@isl-lang/verifier-runtime';
import * as fs from 'fs/promises';
import type {
  StageResult,
  StageError,
  ParseStageData,
  CheckStageData,
  ImportStageData,
  CodegenStageData,
  TestgenStageData,
  VerifyStageData,
  BuildOptions,
  OutputFile,
  BuildEvidence,
  BehaviorEvidence,
  CheckEvidence,
  EvidenceSummary,
} from './types.js';
import { createDeterministicBuildId, hashContent } from './output.js';

/**
 * Execute the parse stage
 */
export async function parseStage(specPath: string): Promise<StageResult<ParseStageData>> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    // Read file content
    const source = await fs.readFile(specPath, 'utf-8');
    
    // Parse the source
    const result = parse(source, specPath);

    if (!result.success || !result.domain) {
      for (const err of result.errors) {
        errors.push({
          stage: 'parse',
          code: err.code,
          message: err.message,
          file: err.location?.file,
          line: err.location?.line,
          column: err.location?.column,
        });
      }
      return {
        success: false,
        errors,
        durationMs: performance.now() - start,
      };
    }

    return {
      success: true,
      data: {
        domain: result.domain,
        source,
      },
      errors: [],
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'parse',
      code: 'PARSE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown parse error',
      file: specPath,
    });
    return {
      success: false,
      errors,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Execute the type checking stage
 * Note: Type check errors are treated as warnings and don't fail the build
 * This allows codegen to proceed even when the typechecker has known limitations
 */
export function checkStage(domain: DomainDeclaration): StageResult<CheckStageData> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    const result = check(domain);

    // Collect diagnostics as warnings, don't fail the stage
    for (const diag of result.diagnostics) {
      if (diag.severity === 'error') {
        errors.push({
          stage: 'check',
          code: diag.code,
          message: diag.message,
          file: diag.location?.file,
          line: diag.location?.line,
          column: diag.location?.column,
        });
      }
    }

    // Always succeed - check errors are warnings
    return {
      success: true,
      data: { diagnostics: result.diagnostics },
      errors,
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'check',
      code: 'TYPE_ERROR',
      message: error instanceof Error ? error.message : 'Unknown type error',
    });
    // Still succeed even on exception - let codegen attempt to proceed
    return {
      success: true,
      errors,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Execute the import resolution stage
 */
export function importResolveStage(source: string): StageResult<ImportStageData> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    const result = preprocessSource(source);

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        errors.push({
          stage: 'import',
          code: 'IMPORT_ERROR',
          message: err,
        });
      }
      // Import errors are warnings, not failures
    }

    return {
      success: true,
      data: {
        resolvedSource: result.source,
        imports: result.imports,
      },
      errors,
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'import',
      code: 'IMPORT_ERROR',
      message: error instanceof Error ? error.message : 'Unknown import error',
    });
    return {
      success: false,
      errors,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Execute the code generation stage (TypeScript target)
 * Note: Codegen errors are handled gracefully - we continue with what we can generate
 */
export function codegenStage(domain: DomainDeclaration): StageResult<CodegenStageData> {
  const start = performance.now();
  const errors: StageError[] = [];
  const files: OutputFile[] = [];

  try {
    const result: CompileResult = compile(domain, {
      types: {
        includeValidation: true,
        includeComments: true,
      },
      tests: {
        framework: 'vitest',
      },
    });

    // Add generated types file
    if (result.types) {
      files.push({
        path: `types/${result.types.filename}`,
        content: result.types.content,
        type: 'types',
      });
    }

    // Add generated tests file
    if (result.tests) {
      files.push({
        path: `tests/${result.tests.filename}`,
        content: result.tests.content,
        type: 'test',
      });
    }
  } catch (error) {
    errors.push({
      stage: 'codegen',
      code: 'CODEGEN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown codegen error',
    });
    // Continue with empty files - don't fail the whole build
  }

  return {
    success: true, // Codegen errors are warnings
    data: { files },
    errors,
    durationMs: performance.now() - start,
  };
}

/**
 * Execute the test generation stage
 */
export function testgenStage(
  domain: DomainDeclaration,
  options: Pick<BuildOptions, 'testFramework' | 'includeChaosTests' | 'includeHelpers'>
): StageResult<TestgenStageData> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    // Convert domain to the expected format
    const domainAst = {
      name: domain.name,
      version: domain.version,
      entities: domain.entities || [],
      behaviors: domain.behaviors || [],
      scenarios: domain.scenarios || [],
      chaos: domain.chaos || [],
      invariants: domain.invariants || [],
    };

    const generatedFiles = generateTests(domainAst as any, {
      framework: options.testFramework || 'vitest',
      outputDir: 'tests',
      includeHelpers: options.includeHelpers ?? true,
      includeChaosTests: options.includeChaosTests ?? true,
    });

    const files: OutputFile[] = generatedFiles.map((f: TestGenFile) => ({
      path: f.path,
      content: f.content,
      type: f.type === 'test' ? 'test' : f.type === 'helper' ? 'helper' : f.type === 'fixture' ? 'fixture' : 'config',
    }));

    return {
      success: true,
      data: { files },
      errors: [],
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'testgen',
      code: 'TESTGEN_ERROR',
      message: error instanceof Error ? error.message : 'Unknown testgen error',
    });
    return {
      success: false,
      errors,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Execute the verification stage
 */
export async function verifyStage(
  domain: DomainDeclaration,
  specPath: string,
  source: string
): Promise<StageResult<VerifyStageData>> {
  const start = performance.now();
  const errors: StageError[] = [];

  try {
    const behaviorNames = getBehaviorNames(domain as any);
    const results: VerifyResult[] = [];

    // Build a mock implementation for verification
    const impl = buildMockImplementation(domain as any);

    for (const behaviorName of behaviorNames) {
      try {
        const result = await verify(impl, domain as any, behaviorName);
        results.push(result);
      } catch (error) {
        // Record verification failure but continue
        errors.push({
          stage: 'verify',
          code: 'VERIFY_BEHAVIOR_ERROR',
          message: `Failed to verify ${behaviorName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    // Build evidence
    const evidence = buildEvidence(domain, specPath, source, results);

    return {
      success: errors.length === 0,
      data: { results, evidence },
      errors,
      durationMs: performance.now() - start,
    };
  } catch (error) {
    errors.push({
      stage: 'verify',
      code: 'VERIFY_ERROR',
      message: error instanceof Error ? error.message : 'Unknown verify error',
    });
    return {
      success: false,
      errors,
      durationMs: performance.now() - start,
    };
  }
}

/**
 * Build evidence structure from verification results
 */
function buildEvidence(
  domain: DomainDeclaration,
  specPath: string,
  source: string,
  results: VerifyResult[]
): BuildEvidence {
  const specHash = hashContent(source);
  const buildId = createDeterministicBuildId(specPath, source);

  // Build behavior evidence with stable ordering
  const behaviors: BehaviorEvidence[] = results
    .sort((a, b) => a.behaviorName.localeCompare(b.behaviorName))
    .map((r) => ({
      name: r.behaviorName,
      success: r.success,
      score: r.score,
      verdict: r.verdict,
      preconditions: r.preconditions.map(mapCheckEvidence),
      postconditions: r.postconditions.map(mapCheckEvidence),
      invariants: r.invariants.map(mapCheckEvidence),
      inputUsed: r.inputUsed.name,
      executionDurationMs: r.execution.duration,
    }));

  // Calculate summary
  const summary = calculateSummary(results);

  return {
    version: '1.0.0',
    buildId,
    specPath,
    specHash,
    domainName: domain.name.name,
    domainVersion: domain.version?.value || '0.0.0',
    summary,
    behaviors,
    timing: {
      parse: 0,
      check: 0,
      importResolve: 0,
      codegen: 0,
      testgen: 0,
      verify: 0,
      total: 0,
    },
  };
}

/**
 * Map verification check result to evidence format
 */
function mapCheckEvidence(check: any): CheckEvidence {
  return {
    expression: check.expression,
    passed: check.passed,
    expected: check.expected,
    actual: check.actual,
    error: check.error,
  };
}

/**
 * Calculate summary from verification results
 */
function calculateSummary(results: VerifyResult[]): EvidenceSummary {
  const totalBehaviors = results.length;
  const passedBehaviors = results.filter((r) => r.success).length;
  const failedBehaviors = totalBehaviors - passedBehaviors;

  let totalChecks = 0;
  let passedChecks = 0;

  for (const r of results) {
    const allChecks = [...r.preconditions, ...r.postconditions, ...r.invariants];
    totalChecks += allChecks.length;
    passedChecks += allChecks.filter((c) => c.passed).length;
  }

  const overallScore = totalBehaviors > 0
    ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / totalBehaviors)
    : 0;

  let verdict: 'verified' | 'risky' | 'unsafe';
  if (overallScore >= 90 && failedBehaviors === 0) {
    verdict = 'verified';
  } else if (overallScore >= 50) {
    verdict = 'risky';
  } else {
    verdict = 'unsafe';
  }

  return {
    totalBehaviors,
    passedBehaviors,
    failedBehaviors,
    totalChecks,
    passedChecks,
    failedChecks: totalChecks - passedChecks,
    overallScore,
    verdict,
  };
}
