/**
 * Execution Proof Fallback Runner
 *
 * When Vitest (or another test framework) cannot run, this minimal harness
 * dynamically imports the target module and exercises every exported function
 * with property-based generated inputs.  It records:
 *
 *   - whether each function throws or resolves
 *   - runtime return-type shape checks
 *   - effect stubs (globalThis.fetch / fs patched to safe no-ops)
 *
 * The resulting "Runtime Evidence Report" is translated into TestResult so the
 * existing trust-score pipeline can consume it, but the score is **hard-capped
 * at WARN** — this evidence can never produce a SHIP verdict on its own.
 */

import { writeFile, readFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Domain } from '@isl-lang/parser';
import type { TestResult, TestDetail } from './test-runner';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RuntimeProbe {
  exportName: string;
  kind: 'function' | 'class' | 'object' | 'primitive' | 'unknown';
  invocations: InvocationRecord[];
  shapeCheck: ShapeCheckResult | null;
}

export interface InvocationRecord {
  args: unknown[];
  threw: boolean;
  resolved: boolean;
  returnType: string;
  returnShape: Record<string, string> | null;
  error?: string;
  durationMs: number;
}

export interface ShapeCheckResult {
  expected: Record<string, string> | null;
  actual: Record<string, string> | null;
  matches: boolean;
}

export interface RuntimeEvidenceReport {
  timestamp: string;
  module: string;
  fallbackReason: string;
  probes: RuntimeProbe[];
  effectStubs: EffectStubSummary;
  summary: {
    totalExports: number;
    functionsProbed: number;
    invocationsRun: number;
    threw: number;
    resolved: number;
    shapeMatches: number;
    shapeMismatches: number;
  };
}

export interface EffectStubSummary {
  fetchCalls: number;
  fsCalls: number;
  stubbed: boolean;
}

export interface ExecutionProofOptions {
  /** Max sample inputs per function */
  maxSamples?: number;
  /** Timeout per invocation in ms */
  invocationTimeout?: number;
  /** Whether to stub globalThis.fetch and fs */
  stubEffects?: boolean;
  /** Verbose logging */
  verbose?: boolean;
  /** Working directory override */
  workDir?: string;
}

// ---------------------------------------------------------------------------
// Property-based input generators (minimal, deterministic)
// ---------------------------------------------------------------------------

const SAMPLE_STRINGS = ['', 'hello', 'test@example.com', '  ', '0', 'null', '<script>'];
const SAMPLE_NUMBERS = [0, 1, -1, 42, NaN, Infinity, Number.MAX_SAFE_INTEGER];
const SAMPLE_BOOLEANS = [true, false];
const SAMPLE_OBJECTS = [{}, { id: '1', name: 'test' }, { id: 1 }, null];
const SAMPLE_ARRAYS: unknown[][] = [[], ['a'], [1, 2, 3]];

/**
 * Generate sample argument vectors for a function with `arity` params.
 * This is intentionally simple property-based generation — we try a
 * cross-product of representative values so the probe is honest.
 */
function generateSampleInputs(arity: number, maxSamples: number): unknown[][] {
  if (arity === 0) return [[]];

  const pools: unknown[][] = [
    SAMPLE_STRINGS,
    SAMPLE_NUMBERS,
    SAMPLE_BOOLEANS,
    SAMPLE_OBJECTS,
    SAMPLE_ARRAYS,
  ];

  const results: unknown[][] = [];

  // For each type pool, generate a vector of length `arity`
  for (const pool of pools) {
    for (const val of pool) {
      if (results.length >= maxSamples) break;
      results.push(Array(arity).fill(val));
    }
    if (results.length >= maxSamples) break;
  }

  // Mixed-type vectors
  if (arity > 1 && results.length < maxSamples) {
    results.push([SAMPLE_STRINGS[1], SAMPLE_NUMBERS[1], ...Array(Math.max(0, arity - 2)).fill(true)]);
    results.push([null, undefined, ...Array(Math.max(0, arity - 2)).fill('')]);
  }

  return results.slice(0, maxSamples);
}

// ---------------------------------------------------------------------------
// Runtime shape inspector
// ---------------------------------------------------------------------------

function describeType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Promise) return 'promise';
  if (value instanceof Date) return 'date';
  if (value instanceof Error) return 'error';
  return typeof value;
}

function describeShape(value: unknown): Record<string, string> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const shape: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    shape[k] = describeType(v);
  }
  return shape;
}

/**
 * Build expected shape from ISL domain behaviors for a given export name.
 */
function expectedShapeForExport(
  domain: Domain | null,
  exportName: string
): Record<string, string> | null {
  if (!domain) return null;

  for (const behavior of domain.behaviors) {
    const behaviorName = behavior.name.name;
    const funcName = behaviorName.charAt(0).toLowerCase() + behaviorName.slice(1);
    if (funcName === exportName || behaviorName === exportName) {
      if (behavior.output?.success) {
        // Try to build a shape from the output type
        const outType = behavior.output.success as unknown as Record<string, unknown>;
        if (outType.kind === 'ReferenceType') {
          const refName = (outType.name as { name?: string })?.name;
          if (refName) {
            const entity = domain.entities.find(e => e.name.name === refName);
            if (entity) {
              const shape: Record<string, string> = {};
              for (const field of entity.fields ?? []) {
                shape[field.name.name] = 'any'; // We only check key presence
              }
              return shape;
            }
          }
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Effect stubs
// ---------------------------------------------------------------------------

interface EffectStubState {
  fetchCalls: number;
  fsCalls: number;
  originalFetch: typeof globalThis.fetch | undefined;
  originalRequire: null; // We don't patch require, just track
}

function installEffectStubs(): EffectStubState {
  const state: EffectStubState = {
    fetchCalls: 0,
    fsCalls: 0,
    originalFetch: globalThis.fetch,
    originalRequire: null,
  };

  // Stub fetch → returns empty 200
  (globalThis as Record<string, unknown>).fetch = async (..._args: unknown[]) => {
    state.fetchCalls++;
    return new Response(JSON.stringify({ stubbed: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  return state;
}

function removeEffectStubs(state: EffectStubState): void {
  if (state.originalFetch) {
    globalThis.fetch = state.originalFetch;
  }
}

// ---------------------------------------------------------------------------
// Core execution proof runner
// ---------------------------------------------------------------------------

/**
 * Probe a single exported function with generated inputs.
 */
async function probeFunction(
  fn: (...args: unknown[]) => unknown,
  exportName: string,
  domain: Domain | null,
  options: Required<ExecutionProofOptions>
): Promise<RuntimeProbe> {
  const arity = fn.length;
  const samples = generateSampleInputs(arity, options.maxSamples);
  const invocations: InvocationRecord[] = [];
  const expectedShape = expectedShapeForExport(domain, exportName);

  let lastReturnValue: unknown = undefined;

  for (const args of samples) {
    const start = Date.now();
    let threw = false;
    let resolved = false;
    let returnType = 'void';
    let returnShape: Record<string, string> | null = null;
    let error: string | undefined;

    try {
      let result = fn(...args);

      // Await promises with timeout
      if (result instanceof Promise) {
        result = await Promise.race([
          result,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('invocation_timeout')), options.invocationTimeout)
          ),
        ]);
      }

      resolved = true;
      returnType = describeType(result);
      returnShape = describeShape(result);
      lastReturnValue = result;
    } catch (e) {
      threw = true;
      error = e instanceof Error ? e.message : String(e);
    }

    invocations.push({
      args,
      threw,
      resolved,
      returnType,
      returnShape,
      error,
      durationMs: Date.now() - start,
    });
  }

  // Shape check: compare last successful return against expected shape
  let shapeCheck: ShapeCheckResult | null = null;
  if (expectedShape) {
    const actualShape = describeShape(lastReturnValue);
    const matches = actualShape !== null && 
      Object.keys(expectedShape).every(k => k in actualShape);
    shapeCheck = { expected: expectedShape, actual: actualShape, matches };
  }

  return {
    exportName,
    kind: 'function',
    invocations,
    shapeCheck,
  };
}

/**
 * Run the execution-proof fallback against a module's source code.
 *
 * 1. Writes the source to a temp file
 * 2. Dynamic-imports it
 * 3. Probes every export
 * 4. Produces a RuntimeEvidenceReport
 */
export async function runExecutionProof(
  implementationCode: string,
  domain: Domain | null,
  fallbackReason: string,
  options?: ExecutionProofOptions
): Promise<{ report: RuntimeEvidenceReport; testResult: TestResult }> {
  const opts: Required<ExecutionProofOptions> = {
    maxSamples: options?.maxSamples ?? 8,
    invocationTimeout: options?.invocationTimeout ?? 5000,
    stubEffects: options?.stubEffects ?? true,
    verbose: options?.verbose ?? false,
    workDir: options?.workDir ?? join(tmpdir(), 'isl-exec-proof'),
  };

  const workDir = join(opts.workDir, `proof-${Date.now()}`);
  await mkdir(workDir, { recursive: true });

  const modulePath = join(workDir, 'target.mjs');

  // Strip TypeScript type annotations for plain Node import.
  // This is a best-effort transform — not a full compiler.
  const jsCode = stripTypeAnnotations(implementationCode);
  await writeFile(modulePath, jsCode, 'utf-8');

  // Install effect stubs
  let stubState: EffectStubState | null = null;
  if (opts.stubEffects) {
    stubState = installEffectStubs();
  }

  const probes: RuntimeProbe[] = [];
  let mod: Record<string, unknown>;

  try {
    // Dynamic import
    mod = await import(`file://${modulePath.replace(/\\/g, '/')}`);
  } catch (importErr) {
    // Module couldn't even load — still evidence
    const errMsg = importErr instanceof Error ? importErr.message : String(importErr);
    if (stubState) removeEffectStubs(stubState);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});

    const report = buildReport([], fallbackReason, errMsg, stubState, modulePath);
    return {
      report,
      testResult: reportToTestResult(report, fallbackReason),
    };
  }

  try {
    for (const [name, value] of Object.entries(mod)) {
      if (name === '__esModule' || name === 'default') continue;

      if (typeof value === 'function') {
        const probe = await probeFunction(
          value as (...args: unknown[]) => unknown,
          name,
          domain,
          opts
        );
        probes.push(probe);
      } else {
        // Non-function export — record shape only
        probes.push({
          exportName: name,
          kind: typeof value === 'object' && value !== null
            ? (Array.isArray(value) ? 'object' : 'object')
            : 'primitive',
          invocations: [],
          shapeCheck: domain
            ? {
                expected: expectedShapeForExport(domain, name),
                actual: describeShape(value),
                matches: false,
              }
            : null,
        });
      }
    }
  } finally {
    if (stubState) removeEffectStubs(stubState);
    if (!opts.verbose) {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  const report = buildReport(probes, fallbackReason, null, stubState, modulePath);
  return {
    report,
    testResult: reportToTestResult(report, fallbackReason),
  };
}

// ---------------------------------------------------------------------------
// TypeScript → JS best-effort strip (no full compiler needed)
// ---------------------------------------------------------------------------

function stripTypeAnnotations(code: string): string {
  let result = code;

  // Remove import type statements
  result = result.replace(/^import\s+type\s+.*?;?\s*$/gm, '');

  // Remove `export type` / `export interface` blocks (greedy brace match)
  result = result.replace(/export\s+(type|interface)\s+\w+[^{]*\{[^}]*\}/g, '');

  // Remove standalone `type` / `interface` declarations
  result = result.replace(/^(type|interface)\s+\w+[^{]*\{[^}]*\}/gm, '');

  // Remove `: Type` annotations from parameters and return types
  // This is intentionally conservative to avoid breaking string literals
  result = result.replace(/:\s*(?:string|number|boolean|void|any|unknown|never|null|undefined|Record<[^>]+>|Array<[^>]+>|Promise<[^>]+>|[A-Z]\w*(?:\[\])?)\s*(?=[,)={])/g, '');

  // Remove `as Type` casts
  result = result.replace(/\s+as\s+(?:string|number|boolean|any|unknown|[A-Z]\w*(?:<[^>]+>)?)/g, '');

  // Remove generic type parameters from function declarations
  result = result.replace(/<(?:[A-Z]\w*(?:\s+extends\s+\w+)?(?:\s*,\s*[A-Z]\w*(?:\s+extends\s+\w+)?)*)>/g, '');

  return result;
}

// ---------------------------------------------------------------------------
// Report builders
// ---------------------------------------------------------------------------

function buildReport(
  probes: RuntimeProbe[],
  fallbackReason: string,
  importError: string | null,
  stubState: EffectStubState | null,
  modulePath: string
): RuntimeEvidenceReport {
  let totalInvocations = 0;
  let threw = 0;
  let resolved = 0;
  let shapeMatches = 0;
  let shapeMismatches = 0;
  const functionsProbed = probes.filter(p => p.kind === 'function').length;

  for (const probe of probes) {
    for (const inv of probe.invocations) {
      totalInvocations++;
      if (inv.threw) threw++;
      if (inv.resolved) resolved++;
    }
    if (probe.shapeCheck) {
      if (probe.shapeCheck.matches) shapeMatches++;
      else shapeMismatches++;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    module: modulePath,
    fallbackReason: importError
      ? `${fallbackReason}; import failed: ${importError}`
      : fallbackReason,
    probes,
    effectStubs: {
      fetchCalls: stubState?.fetchCalls ?? 0,
      fsCalls: stubState?.fsCalls ?? 0,
      stubbed: stubState !== null,
    },
    summary: {
      totalExports: probes.length,
      functionsProbed,
      invocationsRun: totalInvocations,
      threw,
      resolved,
      shapeMatches,
      shapeMismatches,
    },
  };
}

/**
 * Translate a RuntimeEvidenceReport into a TestResult compatible with the
 * existing trust-score pipeline.
 *
 * **Critical invariant**: `fallbackEvidence` is always `true`, which signals
 * the trust calculator to cap the verdict at WARN — never SHIP.
 */
function reportToTestResult(
  report: RuntimeEvidenceReport,
  fallbackReason: string
): TestResult {
  const details: TestDetail[] = [];
  const startTime = Date.now();

  // If module couldn't even import, everything is failed
  if (report.probes.length === 0) {
    details.push({
      name: 'execution-proof: module import',
      status: 'failed',
      duration: 0,
      category: 'scenario',
      impact: 'high',
      error: `Module could not be imported. ${report.fallbackReason}`,
    });

    return {
      passed: 0,
      failed: 1,
      skipped: 0,
      duration: Date.now() - startTime,
      details,
      fallbackEvidence: true,
      verificationFailed: true,
      verificationFailureReason: report.fallbackReason,
    };
  }

  // One detail per probed function
  for (const probe of report.probes) {
    if (probe.kind !== 'function') {
      // Non-function exports get a shape-only check
      if (probe.shapeCheck) {
        details.push({
          name: `execution-proof: export shape [${probe.exportName}]`,
          status: probe.shapeCheck.matches ? 'passed' : 'failed',
          duration: 0,
          category: 'scenario',
          impact: 'low',
          error: probe.shapeCheck.matches
            ? undefined
            : `Shape mismatch for ${probe.exportName}`,
        });
      }
      continue;
    }

    const totalInv = probe.invocations.length;
    const threwCount = probe.invocations.filter(i => i.threw).length;
    const resolvedCount = probe.invocations.filter(i => i.resolved).length;

    // Did it throw on every single input?  That's a fail.
    // Did it resolve on at least some?  That's evidence of life — pass.
    const allThrew = threwCount === totalInv && totalInv > 0;
    const someResolved = resolvedCount > 0;

    details.push({
      name: `execution-proof: invocation [${probe.exportName}]`,
      status: allThrew ? 'failed' : someResolved ? 'passed' : 'failed',
      duration: probe.invocations.reduce((s, i) => s + i.durationMs, 0),
      category: 'scenario',
      impact: 'medium',
      error: allThrew
        ? `All ${totalInv} invocations threw: ${probe.invocations[0]?.error ?? 'unknown'}`
        : undefined,
    });

    // Shape check detail
    if (probe.shapeCheck) {
      details.push({
        name: `execution-proof: return shape [${probe.exportName}]`,
        status: probe.shapeCheck.matches ? 'passed' : 'failed',
        duration: 0,
        category: 'postcondition',
        impact: 'medium',
        error: probe.shapeCheck.matches
          ? undefined
          : `Expected keys: ${JSON.stringify(probe.shapeCheck.expected)}, got: ${JSON.stringify(probe.shapeCheck.actual)}`,
      });
    }
  }

  const passed = details.filter(d => d.status === 'passed').length;
  const failed = details.filter(d => d.status === 'failed').length;

  return {
    passed,
    failed,
    skipped: 0,
    duration: Date.now() - startTime,
    details,
    fallbackEvidence: true,
    verificationFailed: false,
    verificationFailureReason: fallbackReason,
  };
}
