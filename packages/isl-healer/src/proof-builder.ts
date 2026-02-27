/**
 * ProofBundle v2 Builder - Construct comprehensive proof with iteration history
 *
 * The proof bundle includes:
 * - Source ISL specification info
 * - Full healing iteration history with unified diffs
 * - Clause-level evidence
 * - Build and test proof
 * - Cryptographic chain for tamper detection
 *
 * @module @isl-lang/healer
 */

import * as crypto from 'crypto';
import { createTwoFilesPatch } from 'diff';
import type {
  ProofBundleV2,
  IterationSnapshot,
  ClauseEvidence,
  ProofChainEntry,
  BuildProof,
  TestProof,
  HealReason,
  GateVerdict,
  Violation,
  ISLAST,
} from './types.js';

// ============================================================================
// ProofBundleV2Builder
// ============================================================================

/**
 * Builder for ProofBundleV2
 */
export class ProofBundleV2Builder {
  private source: ProofBundleV2['source'];
  private healing: ProofBundleV2['healing'];
  private evidence: ClauseEvidence[] = [];
  private gate: ProofBundleV2['gate'];
  private buildProof?: BuildProof;
  private tests?: TestProof;
  private chain: ProofChainEntry[] = [];
  private startTime: number;

  // Code state tracking for diff computation
  private codeSnapshots: Map<number, Map<string, string>> = new Map();
  private initialCode?: Map<string, string>;

  constructor(ast: ISLAST) {
    this.startTime = Date.now();
    
    // Initialize source info
    this.source = {
      domain: ast.name,
      version: ast.version,
      hash: this.computeASTHash(ast),
      files: [], // Will be populated from context
    };

    // Initialize healing info
    this.healing = {
      performed: false,
      iterations: 0,
      maxIterations: 8,
      reason: 'ship',
      durationMs: 0,
      history: [],
    };

    // Initialize gate with empty state
    this.gate = {
      verdict: 'NO_SHIP',
      score: 0,
      violations: [],
      fingerprint: '',
    };

    // Record init in chain
    this.addChainEntry('init', '', this.source.hash);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Builder Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set max iterations for healing
   */
  setMaxIterations(max: number): this {
    this.healing.maxIterations = max;
    return this;
  }

  /**
   * Add an iteration snapshot
   */
  addIteration(snapshot: IterationSnapshot): this {
    this.healing.history.push(snapshot);
    this.healing.iterations = snapshot.iteration;
    this.healing.performed = true;
    
    // Add to chain
    this.addChainEntry(
      'gate',
      snapshot.codeStateHash,
      snapshot.gateResult.fingerprint
    );

    return this;
  }

  /**
   * Set final gate result
   */
  setGateResult(
    verdict: GateVerdict,
    score: number,
    violations: Violation[],
    fingerprint: string
  ): this {
    this.gate = { verdict, score, violations, fingerprint };
    return this;
  }

  /**
   * Set healing termination reason
   */
  setHealReason(reason: HealReason): this {
    this.healing.reason = reason;
    return this;
  }

  /**
   * Add clause evidence
   */
  addClauseEvidence(evidence: ClauseEvidence): this {
    this.evidence.push(evidence);
    return this;
  }

  /**
   * Add multiple clause evidence entries
   */
  addAllClauseEvidence(evidence: ClauseEvidence[]): this {
    this.evidence.push(...evidence);
    return this;
  }

  /**
   * Set build proof
   */
  setBuildProof(proof: BuildProof): this {
    this.buildProof = proof;
    this.addChainEntry('build', '', proof.exitCode === 0 ? 'pass' : 'fail');
    return this;
  }

  /**
   * Set test proof
   */
  setTestProof(proof: TestProof): this {
    this.tests = proof;
    this.addChainEntry('test', '', proof.failed === 0 ? 'pass' : 'fail');
    return this;
  }

  /**
   * Add source files to the bundle
   */
  addSourceFiles(files: string[]): this {
    this.source.files = files;
    return this;
  }

  /**
   * Set initial code state (before healing)
   */
  setInitialCode(code: Map<string, string>): this {
    this.initialCode = new Map(code);
    this.codeSnapshots.set(0, new Map(code));
    return this;
  }

  /**
   * Get initial code state
   */
  getInitialCode(): Map<string, string> | undefined {
    return this.initialCode;
  }

  /**
   * Set code state at a specific iteration
   */
  setCodeAtIteration(iteration: number, code: Map<string, string>): this {
    this.codeSnapshots.set(iteration, new Map(code));
    return this;
  }

  /**
   * Compute unified diff between two iterations
   */
  computeIterationDiff(fromIteration: number, toIteration: number): { unified: string; perFile: Map<string, string> } {
    const fromCode = this.codeSnapshots.get(fromIteration) ?? new Map();
    const toCode = this.codeSnapshots.get(toIteration) ?? new Map();

    const perFile = new Map<string, string>();
    const allFiles = new Set([...fromCode.keys(), ...toCode.keys()]);

    const unifiedParts: string[] = [];

    for (const file of allFiles) {
      const oldContent = fromCode.get(file) ?? '';
      const newContent = toCode.get(file) ?? '';

      if (oldContent === newContent) continue;

      // Compute unified diff for this file
      const fileDiff = createTwoFilesPatch(
        `a/${file}`,
        `b/${file}`,
        oldContent,
        newContent,
        `iteration-${fromIteration}`,
        `iteration-${toIteration}`,
        { context: 3 }
      );

      if (fileDiff.split('\n').length > 4) { // Has actual changes
        perFile.set(file, fileDiff);
        unifiedParts.push(fileDiff);
      }
    }

    return {
      unified: unifiedParts.join('\n'),
      perFile,
    };
  }

  /**
   * Add iteration with diff computation
   */
  addIterationWithDiff(snapshot: IterationSnapshot, currentCode: Map<string, string>): this {
    const iteration = snapshot.iteration;

    // Store code snapshot
    this.setCodeAtIteration(iteration, currentCode);

    // Compute diff from previous iteration
    const previousIteration = iteration - 1;
    if (this.codeSnapshots.has(previousIteration)) {
      const { unified, perFile } = this.computeIterationDiff(previousIteration, iteration);
      snapshot.diff = unified;
      snapshot.fileDiffs = perFile;

      // Add to chain with diff hash
      const diffHash = crypto.createHash('sha256').update(unified).digest('hex').slice(0, 16);
      this.addChainEntry('patch', snapshot.codeStateHash, diffHash);
    }

    // Add the iteration
    return this.addIteration(snapshot);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Build the final proof bundle
   */
  build(): ProofBundleV2 {
    // Calculate duration
    this.healing.durationMs = Date.now() - this.startTime;

    // Finalize chain
    this.addChainEntry('finalize', this.gate.fingerprint, '');

    // Determine overall verdict
    const verdict = this.determineVerdict();

    // Generate bundle ID
    const bundleId = this.computeBundleId();

    const bundle: ProofBundleV2 = {
      version: '2.0.0',
      bundleId,
      timestamp: new Date().toISOString(),
      source: this.source,
      healing: this.healing,
      evidence: this.evidence,
      gate: this.gate,
      build: this.buildProof,
      tests: this.tests,
      verdict,
      chain: this.chain,
    };

    return bundle;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute hash of AST for integrity tracking
   */
  private computeASTHash(ast: ISLAST): string {
    const content = JSON.stringify({
      name: ast.name,
      version: ast.version,
      behaviors: ast.behaviors.map((b) => ({
        name: b.name,
        intents: b.intents,
        preconditions: b.preconditions,
        postconditions: b.postconditions,
      })),
    });
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Compute bundle ID from contents
   */
  private computeBundleId(): string {
    const content = JSON.stringify({
      source: this.source,
      healing: {
        performed: this.healing.performed,
        iterations: this.healing.iterations,
        reason: this.healing.reason,
      },
      gate: this.gate.fingerprint,
      chainLength: this.chain.length,
    });
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 32);
  }

  /**
   * Add entry to proof chain
   */
  private addChainEntry(
    action: ProofChainEntry['action'],
    inputHash: string,
    outputHash: string
  ): void {
    this.chain.push({
      step: this.chain.length + 1,
      action,
      inputHash,
      outputHash,
      timestamp: new Date().toISOString(),
      actor: '@isl-lang/healer@1.0.0',
    });
  }

  /**
   * Determine overall proof verdict
   */
  private determineVerdict(): ProofBundleV2['verdict'] {
    // If gate didn't pass, can't be proven
    if (this.gate.verdict !== 'SHIP') {
      return 'VIOLATED';
    }

    // If healing was performed and succeeded
    if (this.healing.performed && this.healing.reason === 'ship') {
      return 'HEALED';
    }

    // If no healing needed (already passing)
    if (!this.healing.performed || this.healing.iterations === 1) {
      return 'PROVEN';
    }

    // Fallback
    return 'UNPROVEN';
  }
}

// ============================================================================
// Evidence Generation Helpers
// ============================================================================

/**
 * Generate clause evidence from AST and code
 */
export function generateClauseEvidence(
  ast: ISLAST,
  codeMap: Map<string, string>,
  healedIterations: Map<string, number> = new Map()
): ClauseEvidence[] {
  const evidence: ClauseEvidence[] = [];

  for (const behavior of ast.behaviors) {
    // Generate evidence for each intent
    for (const intent of behavior.intents) {
      const clauseId = `${behavior.name}:intent:${intent.tag}`;
      
      // Search for evidence in code
      const codeEvidence = findIntentEvidence(intent.tag, codeMap);
      
      evidence.push({
        clauseId,
        type: 'intent',
        source: intent.description,
        behavior: behavior.name,
        evidenceType: codeEvidence ? 'code' : 'manual',
        codeLocation: codeEvidence,
        status: codeEvidence ? 'satisfied' : 'unsatisfied',
        healedAtIteration: healedIterations.get(clauseId),
        confidence: codeEvidence ? 0.9 : 0.1,
      });
    }

    // Generate evidence for preconditions
    for (let i = 0; i < behavior.preconditions.length; i++) {
      const precondition = behavior.preconditions[i]!;
      const clauseId = `${behavior.name}:pre:${i}`;
      
      evidence.push({
        clauseId,
        type: 'precondition',
        source: precondition,
        behavior: behavior.name,
        evidenceType: 'code',
        status: 'partial', // Preconditions need manual verification
        confidence: 0.5,
      });
    }

    // Generate evidence for postconditions
    for (let i = 0; i < behavior.postconditions.length; i++) {
      const postcondition = behavior.postconditions[i]!;
      const clauseId = `${behavior.name}:post:${i}`;
      
      evidence.push({
        clauseId,
        type: 'postcondition',
        source: postcondition,
        behavior: behavior.name,
        evidenceType: 'code',
        status: 'partial',
        confidence: 0.5,
      });
    }
  }

  return evidence;
}

/**
 * Find code evidence for an intent
 */
function findIntentEvidence(
  intentTag: string,
  codeMap: Map<string, string>
): ClauseEvidence['codeLocation'] | undefined {
  const searchPattern = new RegExp(`@intent\\s+${intentTag}`, 'g');
  
  for (const [file, content] of codeMap) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      if (searchPattern.test(line)) {
        return {
          file,
          span: {
            startLine: i + 1,
            startColumn: 1,
            endLine: i + 1,
            endColumn: line.length,
          },
          snippet: line.trim(),
          hash: crypto.createHash('sha256').update(line).digest('hex').slice(0, 8),
        };
      }
      searchPattern.lastIndex = 0;
    }
  }

  return undefined;
}

// Note: generateClauseEvidence is exported inline above
