/**
 * 7-Stage Verification Pipeline Runner
 *
 * Wires the full verification pipeline into a single end-to-end flow:
 *   1. Parse  (ISL spec → AST)
 *   2. Type check  (AST → validated AST)
 *   3. Static analysis  (tri-state prover)
 *   4. Code generation  (AST → verification tests)
 *   5. Test execution  (run generated tests)
 *   6. Evidence collection  (gather all results)
 *   7. Scoring  (produce verdict)
 *
 * Every stage failure becomes evidence, not an exception.
 *
 * @module @isl-lang/verify-pipeline
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

/** Configuration for the 7-stage pipeline */
export interface PipelineRunConfig {
  /** ISL source code (takes precedence over specPath) */
  spec?: string;
  /** ISL spec file path */
  specPath?: string;
  /** Implementation file path (for test generation) */
  implPath?: string;
  /** Working directory for test execution */
  cwd?: string;
  /** Timeout per stage in ms */
  stageTimeout?: number;
  /** Enable SMT solver for static analysis fallback */
  enableSMT?: boolean;
  /** Test framework override */
  testFramework?: 'vitest' | 'jest';
  /** Whether to write generated tests to disk */
  writeGeneratedTests?: boolean;
  /** Output directory for generated tests */
  generatedTestDir?: string;
  /** Enable verbose logging via hooks */
  verbose?: boolean;
}

/** Evidence produced by any pipeline stage */
export interface GateEvidence {
  source: 'parse' | 'typecheck' | 'static-analysis' | 'test-generation' | 'test-execution' | 'runtime-eval' | 'scoring';
  check: string;
  result: 'pass' | 'fail' | 'warn' | 'skip';
  confidence: number;
  details: string;
  metadata?: Record<string, unknown>;
}

/** Result of a single pipeline stage */
export interface StageOutcome {
  stage: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  evidence: GateEvidence[];
  error?: string;
  output?: unknown;
}

/** Final pipeline result */
export interface PipelineRunResult {
  runId: string;
  verdict: 'SHIP' | 'WARN' | 'NO_SHIP';
  score: number;
  evidence: GateEvidence[];
  stages: StageOutcome[];
  summary: {
    totalClauses: number;
    proven: number;
    violated: number;
    unknown: number;
    skipped: number;
  };
  timing: {
    totalMs: number;
    parseMs: number;
    typecheckMs: number;
    staticAnalysisMs: number;
    codegenMs: number;
    testExecMs: number;
    evidenceMs: number;
    scoringMs: number;
  };
  exitCode: 0 | 1 | 2;
}

// ============================================================================
// Dynamic imports — each returns null if the package is missing
//
// We use a helper to prevent bundlers (Vite/esbuild) from statically
// resolving these optional peer dependencies at build time.
// ============================================================================

/**
 * Import a package by name at runtime. Returns null if unavailable.
 * Uses createRequire as the primary mechanism, with dynamic import() fallback.
 * The indirection prevents bundlers from statically resolving optional deps.
 */
async function tryImport(name: string): Promise<unknown> {
  // Strategy 1: Node.js createRequire (works in CJS and ESM)
  try {
    const { createRequire } = await import('module');
    const req = createRequire(import.meta.url ?? __filename);
    return req(name);
  } catch {
    // fall through
  }

  // Strategy 2: Dynamic import via Function constructor (opaque to bundlers)
  try {
    const importFn = new Function('n', 'return import(n)') as (n: string) => Promise<unknown>;
    return await importFn(name);
  } catch {
    return null;
  }
}

type ParserModule = {
  parse: (source: string, filename?: string) => {
    success: boolean;
    domain?: unknown;
    errors: Array<{ message: string; line?: number; column?: number }>;
  };
};

type TypecheckerModule = {
  check: (domain: unknown) => {
    success: boolean;
    diagnostics: Array<{ message: string; severity?: string }>;
    symbolTable?: unknown;
  };
};

type StaticAnalyzerModule = {
  analyzeStatically: (expr: unknown, typeContext: unknown) => {
    expression: string;
    verdict: 'true' | 'false' | 'unknown';
    reason: string;
    confidence: number;
  };
  analyzeAll: (exprs: unknown[], typeContext: unknown) => Array<{
    expression: string;
    verdict: 'true' | 'false' | 'unknown';
    reason: string;
    confidence: number;
  }>;
  createTypeContext: (config: Record<string, unknown>) => unknown;
  summarizeResults: (results: Array<{ verdict: string }>) => {
    total: number;
    provablyTrue: number;
    provablyFalse: number;
    unknown: number;
    needsRuntime: boolean;
  };
};

type TestGeneratorModule = {
  generate: (domain: unknown, options: Record<string, unknown>) => {
    files: Array<{ path: string; content: string; behavior?: string }>;
    errors: Array<{ message: string }>;
  };
};

type GateModule = {
  produceVerdict: (evidence: readonly GateEvidence[], thresholds?: Record<string, number>) => {
    decision: 'SHIP' | 'WARN' | 'NO_SHIP';
    score: number;
    summary: string;
    blockers: string[];
    recommendations: string[];
  };
  createGateEvidence: (
    source: string,
    check: string,
    result: 'pass' | 'fail' | 'warn' | 'skip',
    confidence: number,
    details: string,
  ) => GateEvidence;
};

async function loadParser(): Promise<ParserModule | null> {
  return (await tryImport('@isl-lang/parser')) as ParserModule | null;
}

async function loadTypechecker(): Promise<TypecheckerModule | null> {
  return (await tryImport('@isl-lang/typechecker')) as TypecheckerModule | null;
}

async function loadStaticAnalyzer(): Promise<StaticAnalyzerModule | null> {
  return (await tryImport('@isl-lang/static-analyzer')) as StaticAnalyzerModule | null;
}

async function loadTestGenerator(): Promise<TestGeneratorModule | null> {
  return (await tryImport('@isl-lang/test-generator')) as TestGeneratorModule | null;
}

async function loadGate(): Promise<GateModule | null> {
  return (await tryImport('@isl-lang/gate')) as GateModule | null;
}

// ============================================================================
// Clause extraction helpers
// ============================================================================

interface ExtractedClause {
  id: string;
  type: 'postcondition' | 'invariant' | 'precondition';
  behavior?: string;
  outcome?: string;
  expression: unknown;
  expressionText: string;
}

function extractAllClauses(domain: Record<string, unknown>): ExtractedClause[] {
  const clauses: ExtractedClause[] = [];
  const behaviors = (domain.behaviors ?? []) as Array<Record<string, unknown>>;

  for (const behavior of behaviors) {
    // Parser AST: name is { kind: "Identifier", name: "Foo" }
    const nameNode = behavior.name as Record<string, unknown> | undefined;
    const bName = (nameNode?.name ?? nameNode?.value ?? 'unknown') as string;

    // ── Postconditions ──
    // Parser AST: postconditions is an array of PostconditionBlock:
    //   { kind: "PostconditionBlock", condition: "success", predicates: [...] }
    // OR the old isl-core shape: { conditions: [{ trigger, statements }] }
    const postconditions = behavior.postconditions;
    if (Array.isArray(postconditions)) {
      // New parser shape: array of PostconditionBlock
      for (const block of postconditions as Array<Record<string, unknown>>) {
        const outcome = (block.condition as string) ?? 'success';
        const predicates = (block.predicates ?? block.statements ?? []) as Array<unknown>;
        for (let i = 0; i < predicates.length; i++) {
          const expr = predicates[i];
          clauses.push({
            id: `${bName}_post_${outcome}_${i}`,
            type: 'postcondition',
            behavior: bName,
            outcome,
            expression: expr,
            expressionText: formatExpr(expr),
          });
        }
      }
    } else if (postconditions && typeof postconditions === 'object') {
      // Old isl-core shape: { conditions: [{ trigger, statements }] }
      const conditions = ((postconditions as Record<string, unknown>).conditions ?? []) as Array<Record<string, unknown>>;
      for (const cond of conditions) {
        const trigger = cond.trigger as Record<string, unknown> | undefined;
        const outcome = trigger?.type === 'success' ? 'success'
          : trigger?.type === 'any_error' ? 'failure'
          : trigger?.code ? String(trigger.code)
          : 'success';

        const stmts = (cond.statements ?? []) as Array<Record<string, unknown>>;
        for (let i = 0; i < stmts.length; i++) {
          const stmt = stmts[i];
          clauses.push({
            id: `${bName}_post_${outcome}_${i}`,
            type: 'postcondition',
            behavior: bName,
            outcome,
            expression: stmt.expression ?? stmt,
            expressionText: formatExpr(stmt.expression ?? stmt),
          });
        }
      }
    }

    // ── Invariants ──
    // Parser AST: invariants is an array of expression ASTs or InvariantStatement
    const behaviorInvariants = (behavior.invariants ?? []) as Array<unknown>;
    for (let i = 0; i < behaviorInvariants.length; i++) {
      const inv = behaviorInvariants[i];
      const invObj = inv as Record<string, unknown> | undefined;
      const expression = invObj?.expression ?? inv;
      clauses.push({
        id: `${bName}_inv_${i}`,
        type: 'invariant',
        behavior: bName,
        expression,
        expressionText: formatExpr(expression),
      });
    }

    // ── Preconditions ──
    // Parser AST: preconditions is an array of expression ASTs directly
    // OR old shape: { statements: [...] }
    const preconditions = behavior.preconditions;
    const preArray = Array.isArray(preconditions)
      ? preconditions as Array<unknown>
      : ((preconditions as Record<string, unknown> | undefined)?.statements ?? []) as Array<unknown>;

    for (let i = 0; i < preArray.length; i++) {
      const pre = preArray[i];
      const preObj = pre as Record<string, unknown> | undefined;
      const expression = preObj?.expression ?? pre;
      clauses.push({
        id: `${bName}_pre_${i}`,
        type: 'precondition',
        behavior: bName,
        expression,
        expressionText: formatExpr(expression),
      });
    }
  }

  // ── Domain-level invariants ──
  // Parser AST: invariants may be an array of InvariantBlock or expressions
  const domainInvariants = (domain.invariants ?? []) as Array<unknown>;
  for (let blockIdx = 0; blockIdx < domainInvariants.length; blockIdx++) {
    const block = domainInvariants[blockIdx] as Record<string, unknown>;
    // Could be a block with nested .invariants or a direct expression
    const innerInvs = (block.invariants ?? [block]) as Array<unknown>;
    for (let i = 0; i < innerInvs.length; i++) {
      const inv = innerInvs[i] as Record<string, unknown>;
      const expression = inv.expression ?? inv;
      clauses.push({
        id: `domain_inv_${blockIdx}_${i}`,
        type: 'invariant',
        expression,
        expressionText: formatExpr(expression),
      });
    }
  }

  return clauses;
}

function formatExpr(expr: unknown): string {
  if (!expr || typeof expr !== 'object') return String(expr ?? '');
  const node = expr as Record<string, unknown>;
  switch (node.kind) {
    case 'Identifier': return (node.name ?? node.value ?? 'id') as string;
    case 'StringLiteral': return JSON.stringify(node.value);
    case 'NumberLiteral': return String(node.value);
    case 'BooleanLiteral': return String(node.value);
    case 'BinaryExpr': return `${formatExpr(node.left)} ${node.operator} ${formatExpr(node.right)}`;
    case 'UnaryExpr': return `${node.operator}${formatExpr(node.operand)}`;
    case 'MemberExpr': {
      const prop = node.property as Record<string, unknown> | undefined;
      return `${formatExpr(node.object)}.${prop?.name ?? prop?.value ?? '?'}`;
    }
    case 'ResultExpr': {
      const prop = node.property as Record<string, unknown> | undefined;
      return prop ? `result.${prop.name ?? prop.value}` : 'result';
    }
    case 'InputExpr': {
      const prop = node.property as Record<string, unknown> | undefined;
      return prop ? `input.${prop.name ?? prop.value}` : 'input';
    }
    case 'OldExpr': return `old(${formatExpr(node.expression)})`;
    default: return `[${(node.kind as string) ?? 'unknown'}]`;
  }
}

// ============================================================================
// Stage runners
// ============================================================================

async function runStage<T>(
  name: string,
  fn: () => Promise<{ evidence: GateEvidence[]; output?: T }>,
  timeout: number,
): Promise<StageOutcome> {
  const start = Date.now();
  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Stage "${name}" timed out after ${timeout}ms`)), timeout),
      ),
    ]);
    return {
      stage: name,
      status: 'passed',
      durationMs: Date.now() - start,
      evidence: result.evidence,
      output: result.output,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      stage: name,
      status: 'failed',
      durationMs: Date.now() - start,
      evidence: [{
        source: name as GateEvidence['source'],
        check: `${name}_execution`,
        result: 'fail',
        confidence: 1,
        details: `Stage "${name}" failed: ${message}`,
      }],
      error: message,
    };
  }
}

// ============================================================================
// Main pipeline
// ============================================================================

/**
 * Run the full 7-stage verification pipeline.
 *
 * Every stage failure becomes evidence — the pipeline never throws.
 */
export async function runPipeline(
  spec: string,
  impl: string,
  config?: PipelineRunConfig,
): Promise<PipelineRunResult> {
  const runId = `verify-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const pipelineStart = Date.now();
  const stages: StageOutcome[] = [];
  const allEvidence: GateEvidence[] = [];
  const timeout = config?.stageTimeout ?? 30_000;

  let domain: Record<string, unknown> | null = null;
  let clauses: ExtractedClause[] = [];
  let symbolTable: unknown = null;

  const timing = {
    totalMs: 0,
    parseMs: 0,
    typecheckMs: 0,
    staticAnalysisMs: 0,
    codegenMs: 0,
    testExecMs: 0,
    evidenceMs: 0,
    scoringMs: 0,
  };

  // ─── Resolve ISL source ───
  let islSource = config?.spec ?? spec;
  if (!islSource.includes('\n') && !islSource.includes('domain ')) {
    // Looks like a file path
    try {
      islSource = await fs.readFile(islSource, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      allEvidence.push({
        source: 'parse',
        check: 'spec_file_read',
        result: 'fail',
        confidence: 1,
        details: `Failed to read ISL spec: ${message}`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 1: Parse (ISL spec → AST)
  // ═══════════════════════════════════════════════════════════════════
  const stage1 = await runStage('parse', async () => {
    const parser = await loadParser();
    if (!parser) {
      return {
        evidence: [{
          source: 'parse' as const,
          check: 'parser_available',
          result: 'fail' as const,
          confidence: 1,
          details: '@isl-lang/parser package not available',
        }],
      };
    }

    const parseResult = parser.parse(islSource, config?.specPath ?? 'input.isl');

    if (!parseResult.success || !parseResult.domain) {
      const errorDetails = parseResult.errors
        .map(e => `Line ${e.line ?? '?'}: ${e.message}`)
        .join('; ');
      return {
        evidence: [{
          source: 'parse' as const,
          check: 'isl_parse',
          result: 'fail' as const,
          confidence: 1,
          details: `Parse failed: ${errorDetails || 'unknown error'}`,
        }],
      };
    }

    domain = parseResult.domain as Record<string, unknown>;
    clauses = extractAllClauses(domain);

    return {
      evidence: [{
        source: 'parse' as const,
        check: 'isl_parse',
        result: 'pass' as const,
        confidence: 1,
        details: `Parsed successfully: ${clauses.length} clause(s) extracted`,
        metadata: { clauseCount: clauses.length },
      }],
      output: domain,
    };
  }, timeout);

  stages.push(stage1);
  allEvidence.push(...stage1.evidence);
  timing.parseMs = stage1.durationMs;

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 2: Type check (AST → validated AST)
  // ═══════════════════════════════════════════════════════════════════
  const stage2 = await runStage('typecheck', async () => {
    if (!domain) {
      return {
        evidence: [{
          source: 'typecheck' as const,
          check: 'typecheck_skipped',
          result: 'skip' as const,
          confidence: 1,
          details: 'Skipped: no parsed domain available (parse failed)',
        }],
      };
    }

    const tc = await loadTypechecker();
    if (!tc) {
      return {
        evidence: [{
          source: 'typecheck' as const,
          check: 'typechecker_available',
          result: 'skip' as const,
          confidence: 0.5,
          details: '@isl-lang/typechecker package not available — skipping type check',
        }],
      };
    }

    const tcResult = tc.check(domain);
    symbolTable = tcResult.symbolTable ?? null;

    const evidence: GateEvidence[] = [];

    if (!tcResult.success) {
      const errors = tcResult.diagnostics
        .filter(d => d.severity === 'error' || !d.severity)
        .map(d => d.message);
      evidence.push({
        source: 'typecheck',
        check: 'type_validation',
        result: 'fail',
        confidence: 0.9,
        details: `Type check failed: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? ` (+${errors.length - 5} more)` : ''}`,
        metadata: { errorCount: errors.length },
      });
    } else {
      evidence.push({
        source: 'typecheck',
        check: 'type_validation',
        result: 'pass',
        confidence: 0.9,
        details: `Type check passed with ${tcResult.diagnostics.length} diagnostic(s)`,
      });
    }

    // Add warnings as separate evidence
    const warnings = tcResult.diagnostics.filter(d => d.severity === 'warning');
    for (const w of warnings.slice(0, 10)) {
      evidence.push({
        source: 'typecheck',
        check: 'type_warning',
        result: 'warn',
        confidence: 0.7,
        details: w.message,
      });
    }

    return { evidence, output: tcResult };
  }, timeout);

  stages.push(stage2);
  allEvidence.push(...stage2.evidence);
  timing.typecheckMs = stage2.durationMs;

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 3: Static analysis (tri-state prover)
  // ═══════════════════════════════════════════════════════════════════
  const stage3 = await runStage('static-analysis', async () => {
    if (clauses.length === 0) {
      return {
        evidence: [{
          source: 'static-analysis' as const,
          check: 'static_analysis_skipped',
          result: 'skip' as const,
          confidence: 1,
          details: 'Skipped: no clauses to analyze',
        }],
      };
    }

    const analyzer = await loadStaticAnalyzer();
    if (!analyzer) {
      // Mark all clauses as needing runtime — not a failure
      return {
        evidence: [{
          source: 'static-analysis' as const,
          check: 'static_analyzer_available',
          result: 'skip' as const,
          confidence: 0.5,
          details: '@isl-lang/isl-expression-evaluator not available — all clauses need runtime verification',
        }],
      };
    }

    const typeContext = analyzer.createTypeContext({});
    const expressions = clauses
      .map(c => c.expression)
      .filter((e): e is NonNullable<typeof e> => e != null);

    const results = analyzer.analyzeAll(expressions, typeContext);
    const summary = analyzer.summarizeResults(results);

    const evidence: GateEvidence[] = [];

    // Per-clause evidence
    for (let i = 0; i < results.length && i < clauses.length; i++) {
      const r = results[i];
      const clause = clauses[i];

      if (r.verdict === 'true') {
        evidence.push({
          source: 'static-analysis',
          check: `static_${clause.id}`,
          result: 'pass',
          confidence: r.confidence,
          details: `Statically proven: ${clause.expressionText} — ${r.reason}`,
          metadata: { clauseId: clause.id, verdict: r.verdict },
        });
      } else if (r.verdict === 'false') {
        evidence.push({
          source: 'static-analysis',
          check: `static_${clause.id}`,
          result: 'fail',
          confidence: r.confidence,
          details: `Statically disproven: ${clause.expressionText} — ${r.reason}`,
          metadata: { clauseId: clause.id, verdict: r.verdict },
        });
      }
      // 'unknown' clauses are omitted — they'll be checked at runtime
    }

    // Summary evidence
    evidence.push({
      source: 'static-analysis',
      check: 'static_summary',
      result: summary.provablyFalse > 0 ? 'fail' : 'pass',
      confidence: 0.8,
      details: `Static analysis: ${summary.provablyTrue} proven, ${summary.provablyFalse} disproven, ${summary.unknown} need runtime`,
      metadata: summary,
    });

    return { evidence, output: { results, summary } };
  }, timeout);

  stages.push(stage3);
  allEvidence.push(...stage3.evidence);
  timing.staticAnalysisMs = stage3.durationMs;

  // Determine which clauses still need runtime verification
  const staticResults = stage3.output as { results?: Array<{ verdict: string }>; summary?: Record<string, unknown> } | undefined;
  const needsRuntime = clauses.filter((_, i) => {
    const staticResult = staticResults?.results?.[i];
    return !staticResult || staticResult.verdict === 'unknown';
  });

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 4: Code generation (AST → verification tests)
  // ═══════════════════════════════════════════════════════════════════
  let generatedTestPaths: string[] = [];

  const stage4 = await runStage('codegen', async () => {
    if (!domain || needsRuntime.length === 0) {
      return {
        evidence: [{
          source: 'test-generation' as const,
          check: 'codegen_skipped',
          result: 'skip' as const,
          confidence: 1,
          details: needsRuntime.length === 0
            ? 'Skipped: all clauses resolved statically'
            : 'Skipped: no parsed domain available',
        }],
      };
    }

    const generator = await loadTestGenerator();
    if (!generator) {
      return {
        evidence: [{
          source: 'test-generation' as const,
          check: 'test_generator_available',
          result: 'skip' as const,
          confidence: 0.5,
          details: '@isl-lang/test-generator not available — skipping code generation',
        }],
      };
    }

    const genResult = generator.generate(domain, {
      framework: config?.testFramework ?? 'vitest',
      outputDir: config?.generatedTestDir ?? path.join(config?.cwd ?? process.cwd(), '.verify-pipeline', 'generated'),
      implPath: impl,
    });

    const evidence: GateEvidence[] = [];

    if (genResult.errors.length > 0) {
      evidence.push({
        source: 'test-generation',
        check: 'test_codegen',
        result: 'warn',
        confidence: 0.7,
        details: `Code generation completed with ${genResult.errors.length} error(s): ${genResult.errors.map(e => e.message).join('; ')}`,
      });
    }

    if (genResult.files.length > 0) {
      // Optionally write generated tests to disk
      if (config?.writeGeneratedTests !== false) {
        const outDir = config?.generatedTestDir
          ?? path.join(config?.cwd ?? process.cwd(), '.verify-pipeline', 'generated');
        await fs.mkdir(outDir, { recursive: true });

        for (const file of genResult.files) {
          const filePath = path.join(outDir, path.basename(file.path));
          await fs.writeFile(filePath, file.content, 'utf-8');
          generatedTestPaths.push(filePath);
        }
      }

      evidence.push({
        source: 'test-generation',
        check: 'test_codegen',
        result: 'pass',
        confidence: 0.8,
        details: `Generated ${genResult.files.length} test file(s)`,
        metadata: { fileCount: genResult.files.length },
      });
    } else {
      evidence.push({
        source: 'test-generation',
        check: 'test_codegen',
        result: 'skip',
        confidence: 0.5,
        details: 'No test files generated',
      });
    }

    return { evidence, output: genResult };
  }, timeout);

  stages.push(stage4);
  allEvidence.push(...stage4.evidence);
  timing.codegenMs = stage4.durationMs;

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 5: Test execution (run generated tests)
  // ═══════════════════════════════════════════════════════════════════
  const stage5 = await runStage('test-execution', async () => {
    if (generatedTestPaths.length === 0) {
      return {
        evidence: [{
          source: 'test-execution' as const,
          check: 'test_exec_skipped',
          result: 'skip' as const,
          confidence: 1,
          details: 'Skipped: no generated tests to run',
        }],
      };
    }

    // Use the existing test runner stage
    const { runTests } = await import('./stages/test-runner.js');

    const testDir = config?.generatedTestDir
      ?? path.join(config?.cwd ?? process.cwd(), '.verify-pipeline', 'generated');

    const testOutput = await runTests({
      pattern: path.join(testDir, '**/*.test.{ts,js}'),
      framework: config?.testFramework ?? 'vitest',
      timeout: timeout,
      cwd: config?.cwd ?? process.cwd(),
    });

    const evidence: GateEvidence[] = [];
    const { summary } = testOutput;

    // ── Execution failure gate ──────────────────────────────────────
    // If the runner could not execute tests (Vitest import errors,
    // TS config issues, runtime crashes, all-skipped), this is a
    // verification_blocked critical failure → forces NO_SHIP.
    if (testOutput.executionFailed || (summary.totalTests === 0 && generatedTestPaths.length > 0)) {
      const reason = testOutput.executionFailureReason
        ?? 'Verification blocked: tests did not run';
      evidence.push({
        source: 'test-execution',
        check: 'verification_blocked',
        result: 'fail',
        confidence: 1,
        details: reason,
        metadata: {
          executionFailed: true,
          reason,
          total: summary.totalTests,
          skipped: summary.skippedTests,
        },
      });
      return { evidence, output: testOutput };
    }

    // ── Normal results ──────────────────────────────────────────────
    if (summary.failedTests > 0) {
      evidence.push({
        source: 'test-execution',
        check: 'test_results',
        result: 'fail',
        confidence: 1,
        details: `${summary.failedTests}/${summary.totalTests} test(s) failed`,
        metadata: { total: summary.totalTests, passed: summary.passedTests, failed: summary.failedTests },
      });
    } else if (summary.totalTests > 0) {
      // Count actually-executed tests (exclude skipped)
      const executed = summary.totalTests - summary.skippedTests;
      if (executed === 0) {
        // All tests skipped = no verification occurred
        evidence.push({
          source: 'test-execution',
          check: 'verification_blocked',
          result: 'fail',
          confidence: 1,
          details: `Verification blocked: all ${summary.totalTests} test(s) were skipped — no assertions executed`,
          metadata: { executionFailed: true, total: summary.totalTests, skipped: summary.skippedTests },
        });
        return { evidence, output: testOutput };
      }

      evidence.push({
        source: 'test-execution',
        check: 'test_results',
        result: 'pass',
        confidence: 1,
        details: `All ${executed} executed test(s) passed` +
          (summary.skippedTests > 0 ? ` (${summary.skippedTests} skipped — execution_score reduced)` : ''),
        metadata: { total: summary.totalTests, passed: summary.passedTests, skipped: summary.skippedTests },
      });

      // Skipped tests decrease execution_score — emit separate evidence
      if (summary.skippedTests > 0) {
        evidence.push({
          source: 'test-execution',
          check: 'skipped_tests_penalty',
          result: 'warn',
          confidence: summary.skippedTests / summary.totalTests,
          details: `${summary.skippedTests}/${summary.totalTests} test(s) skipped — counts as not executed`,
          metadata: { skipped: summary.skippedTests, total: summary.totalTests },
        });
      }
    } else {
      // No generated tests to run (different from execution failure)
      evidence.push({
        source: 'test-execution',
        check: 'test_results',
        result: 'skip',
        confidence: 0.3,
        details: 'No tests were executed',
      });
    }

    // Per-suite evidence
    for (const suite of testOutput.suites) {
      for (const test of suite.tests) {
        if (test.status === 'failed') {
          evidence.push({
            source: 'test-execution',
            check: `test_${test.id}`,
            result: 'fail',
            confidence: 1,
            details: `Test failed: ${test.name} — ${test.error?.message ?? 'unknown error'}`,
          });
        }
        // Synthetic tests contribute 0 execution credit
        if (test.synthetic) {
          evidence.push({
            source: 'test-execution',
            check: `synthetic_${test.id}`,
            result: 'skip',
            confidence: 0,
            details: `NON_EVIDENCE: synthetic test "${test.name}" — contributes 0 execution credit`,
            metadata: { synthetic: true, nonEvidence: true },
          });
        }
      }
    }

    return { evidence, output: testOutput };
  }, timeout);

  stages.push(stage5);
  allEvidence.push(...stage5.evidence);
  timing.testExecMs = stage5.durationMs;

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 6: Evidence collection (gather all results)
  // ═══════════════════════════════════════════════════════════════════
  const evidenceStart = Date.now();

  const summary = {
    totalClauses: clauses.length,
    proven: 0,
    violated: 0,
    unknown: 0,
    skipped: 0,
  };

  // Tally per-clause results from evidence
  for (const clause of clauses) {
    const clauseEvidence = allEvidence.filter(
      e => e.metadata?.clauseId === clause.id,
    );

    if (clauseEvidence.some(e => e.result === 'fail')) {
      summary.violated++;
    } else if (clauseEvidence.some(e => e.result === 'pass')) {
      summary.proven++;
    } else if (clauseEvidence.some(e => e.result === 'skip')) {
      summary.skipped++;
    } else {
      summary.unknown++;
    }
  }

  // If no per-clause evidence exists, derive from static analysis
  if (summary.proven === 0 && summary.violated === 0 && summary.unknown === 0 && summary.skipped === 0) {
    const staticSummary = staticResults?.summary as Record<string, number> | undefined;
    if (staticSummary) {
      summary.proven = staticSummary.provablyTrue ?? 0;
      summary.violated = staticSummary.provablyFalse ?? 0;
      summary.unknown = staticSummary.unknown ?? 0;
    } else {
      summary.unknown = clauses.length;
    }
  }

  // Add collection summary evidence
  allEvidence.push({
    source: 'runtime-eval',
    check: 'evidence_collection',
    result: summary.violated > 0 ? 'fail' : summary.unknown > 0 ? 'warn' : 'pass',
    confidence: 1,
    details: `Evidence collected: ${summary.proven} proven, ${summary.violated} violated, ${summary.unknown} unknown, ${summary.skipped} skipped`,
    metadata: summary,
  });

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY SCAN (Stage 4 verification - integrated into evidence)
  // ═══════════════════════════════════════════════════════════════════
  let securityBlocking = false;
  try {
    const securityScanner = await tryImport('@isl-lang/security-scanner');
    if (securityScanner && typeof (securityScanner as { runVerificationSecurityScan: unknown }).runVerificationSecurityScan === 'function') {
      const { runVerificationSecurityScan } = securityScanner as {
        runVerificationSecurityScan: (opts?: {
          rootDir?: string;
          islSource?: string;
          islSpecPath?: string;
          skipDependencyAudit?: boolean;
        }) => Promise<{
          hasBlockingFindings: boolean;
          hasWarnings: boolean;
          checks: Array<{ check: string; passed: boolean; findings: unknown[] }>;
          summary: { critical: number; high: number; medium: number; low: number };
        }>;
      };
      const securityResult = await runVerificationSecurityScan({
        rootDir: config?.cwd ?? process.cwd(),
        islSource,
        islSpecPath: config?.specPath,
        skipDependencyAudit: true, // npm audit can be slow; enable explicitly if needed
      });
      securityBlocking = securityResult.hasBlockingFindings;

      allEvidence.push({
        source: 'runtime-eval',
        check: 'security_scan',
        result: securityBlocking ? 'fail' : securityResult.hasWarnings ? 'warn' : 'pass',
        confidence: 0.95,
        details: securityBlocking
          ? `Security scan FAILED: ${securityResult.summary.critical} critical, ${securityResult.summary.high} high findings → NO_SHIP`
          : securityResult.hasWarnings
            ? `Security scan passed with warnings: ${securityResult.summary.medium} medium, ${securityResult.summary.low} low`
            : 'Security scan passed: no critical/high findings',
        metadata: {
          securityScan: true,
          hasBlockingFindings: securityResult.hasBlockingFindings,
          hasWarnings: securityResult.hasWarnings,
          summary: securityResult.summary,
          checks: securityResult.checks.map((c) => ({
            check: c.check,
            passed: c.passed,
            findingCount: c.findings.length,
          })),
        },
      });
    }
  } catch (_err) {
    // Security scanner unavailable — don't block
    allEvidence.push({
      source: 'runtime-eval',
      check: 'security_scan',
      result: 'skip',
      confidence: 0,
      details: '@isl-lang/security-scanner not available — security scan skipped',
    });
  }

  timing.evidenceMs = Date.now() - evidenceStart;

  stages.push({
    stage: 'evidence-collection',
    status: 'passed',
    durationMs: timing.evidenceMs,
    evidence: [allEvidence[allEvidence.length - 1]],
  });

  // ═══════════════════════════════════════════════════════════════════
  // STAGE 7: Scoring (produce verdict)
  // ═══════════════════════════════════════════════════════════════════
  const scoringStart = Date.now();

  let verdict: 'SHIP' | 'WARN' | 'NO_SHIP' = 'NO_SHIP';
  let score = 0;

  const gate = await loadGate();

  if (gate) {
    try {
      const gateVerdict = gate.produceVerdict(allEvidence);
      verdict = gateVerdict.decision;
      score = gateVerdict.score;

      // Security scan critical/high → force NO_SHIP regardless of gate
      if (securityBlocking) {
        verdict = 'NO_SHIP';
        score = Math.min(score, 49);
      }

      allEvidence.push({
        source: 'scoring',
        check: 'gate_verdict',
        result: verdict === 'SHIP' ? 'pass' : verdict === 'WARN' ? 'warn' : 'fail',
        confidence: 1,
        details: gateVerdict.summary,
        metadata: {
          decision: gateVerdict.decision,
          score: gateVerdict.score,
          blockers: gateVerdict.blockers,
        },
      });
    } catch (err) {
      // Gate failed — fall through to local scoring
      allEvidence.push({
        source: 'scoring',
        check: 'gate_error',
        result: 'warn',
        confidence: 0.5,
        details: `Gate scoring failed: ${err instanceof Error ? err.message : String(err)} — using local scoring`,
      });
    }
  }

  // Local fallback scoring if gate is unavailable or failed
  if (score === 0 && !gate) {
    // Check for verification_blocked — forces NO_SHIP in local scoring too
    const hasVerificationBlocked = allEvidence.some(
      e => e.result === 'fail' && e.check.includes('verification_blocked'),
    );
    // Security scan blocking findings → NO_SHIP
    const hasSecurityBlocking = allEvidence.some(
      e => e.check === 'security_scan' && e.result === 'fail',
    );

    if (hasVerificationBlocked || hasSecurityBlocking) {
      score = 0;
      verdict = 'NO_SHIP';
      allEvidence.push({
        source: 'scoring',
        check: 'local_verdict',
        result: 'fail',
        confidence: 1,
        details: `Local scoring: NO_SHIP — verification blocked (tests did not run)`,
        metadata: { score: 0, verdict: 'NO_SHIP', verificationBlocked: true },
      });
    } else {
      score = computeLocalScore(allEvidence, summary);
      verdict = score >= 85 ? 'SHIP' : score >= 50 ? 'WARN' : 'NO_SHIP';

      allEvidence.push({
        source: 'scoring',
        check: 'local_verdict',
        result: verdict === 'SHIP' ? 'pass' : verdict === 'WARN' ? 'warn' : 'fail',
        confidence: 0.8,
        details: `Local scoring: ${verdict} (score=${score})`,
        metadata: { score, verdict },
      });
    }
  }

  timing.scoringMs = Date.now() - scoringStart;

  stages.push({
    stage: 'scoring',
    status: 'passed',
    durationMs: timing.scoringMs,
    evidence: [allEvidence[allEvidence.length - 1]],
  });

  timing.totalMs = Date.now() - pipelineStart;

  const exitCode: 0 | 1 | 2 = verdict === 'SHIP' ? 0 : verdict === 'NO_SHIP' ? 1 : 2;

  return {
    runId,
    verdict,
    score,
    evidence: allEvidence,
    stages,
    summary,
    timing,
    exitCode,
  };
}

// ============================================================================
// Local scoring fallback
// ============================================================================

function computeLocalScore(evidence: GateEvidence[], summary: { totalClauses: number; proven: number; violated: number; unknown: number }): number {
  if (summary.totalClauses === 0) {
    // No clauses — score based purely on evidence
    const passes = evidence.filter(e => e.result === 'pass').length;
    const fails = evidence.filter(e => e.result === 'fail').length;
    const total = passes + fails;
    return total > 0 ? Math.round((passes / total) * 100) : 0;
  }

  if (summary.violated > 0) {
    // Violations cap score
    return Math.max(0, Math.round(
      ((summary.proven / summary.totalClauses) * 100) - ((summary.violated / summary.totalClauses) * 50),
    ));
  }

  if (summary.unknown > 0) {
    return Math.round((summary.proven / summary.totalClauses) * 100);
  }

  return summary.proven === summary.totalClauses ? 100 : 0;
}
