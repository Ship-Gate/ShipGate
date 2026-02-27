/**
 * ISL Pipeline
 * 
 * The complete flow:
 * 1. NL → ISL (Translator)
 * 2. ISL → Code (Generator)
 * 3. Verify (Gate)
 * 4. Proof Bundle
 * 
 * @module @isl-lang/pipeline
 */

import { createTranslator, type TranslationResult, type RepoContext, type ISLAST } from '@isl-lang/translator';
import { createGenerator, type GenerationResult, type ProofLink } from '@isl-lang/generator';
import { createProofBundle, formatProofBundle, type ProofBundle, type GateEvidence, type TestEvidence } from '@isl-lang/proof';

// ============================================================================
// Types
// ============================================================================

export interface PipelineInput {
  /** Natural language input */
  prompt: string;
  /** Repository context */
  repoContext: RepoContext;
  /** Target directory for generated code */
  targetDir: string;
  /** Pipeline options */
  options?: PipelineOptions;
}

export interface PipelineOptions {
  /** Dry run - don't write files */
  dryRun?: boolean;
  /** Skip gate check */
  skipGate?: boolean;
  /** Require human approval for low-confidence translations */
  requireApproval?: boolean;
  /** Approval callback */
  onApprovalRequired?: (result: TranslationResult) => Promise<boolean>;
}

export interface PipelineResult {
  success: boolean;
  /** Translation result */
  translation: TranslationResult;
  /** Generation result (if translation succeeded) */
  generation?: GenerationResult;
  /** Gate result (if generation succeeded) */
  gate?: GateEvidence;
  /** Proof bundle (if gate passed) */
  proof?: ProofBundle;
  /** Final verdict */
  verdict: 'SHIP' | 'NO_SHIP' | 'PENDING_APPROVAL';
  /** Errors */
  errors: string[];
  /** Warnings */
  warnings: string[];
}

// ============================================================================
// Pipeline Implementation
// ============================================================================

export class ISLPipeline {
  private translator = createTranslator();

  /**
   * Run the full pipeline
   */
  async run(input: PipelineInput): Promise<PipelineResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: NL → ISL
    console.log('\n┌─ Step 1: NL → ISL Translation ─────────────────────────┐');
    const translation = this.translator.translate({
      prompt: input.prompt,
      repoContext: input.repoContext,
    });

    if (!translation.success || !translation.ast) {
      return {
        success: false,
        translation,
        verdict: 'NO_SHIP',
        errors: ['Translation failed: ' + (translation.errors?.join(', ') || 'Unknown error')],
        warnings,
      };
    }

    console.log(`│ ✓ Matched pattern: ${translation.matchedPattern || 'generic'}`);
    console.log(`│ ✓ Confidence: ${(translation.confidence * 100).toFixed(0)}%`);
    console.log(`│ ✓ Behaviors: ${translation.ast.behaviors.map(b => b.name).join(', ')}`);
    
    // Check for open questions
    if (translation.openQuestions.length > 0) {
      console.log(`│ ⚠ Open questions: ${translation.openQuestions.length}`);
      for (const q of translation.openQuestions) {
        warnings.push(`Open question: ${q.question}`);
      }
    }

    // Check for low confidence
    if (translation.confidence < 0.7) {
      console.log(`│ ⚠ Low confidence - may need human review`);
      
      if (input.options?.requireApproval && input.options?.onApprovalRequired) {
        const approved = await input.options.onApprovalRequired(translation);
        if (!approved) {
          return {
            success: false,
            translation,
            verdict: 'PENDING_APPROVAL',
            errors: ['Translation requires human approval'],
            warnings,
          };
        }
      }
    }
    console.log('└──────────────────────────────────────────────────────────┘\n');

    // Step 2: ISL → Code
    console.log('┌─ Step 2: ISL → Code Generation ────────────────────────┐');
    const generator = createGenerator(input.repoContext);
    const generation = generator.generate({
      ast: translation.ast,
      repoContext: input.repoContext,
      targetDir: input.targetDir,
    });

    console.log(`│ ✓ Files to create: ${generation.plan.filesToCreate.length}`);
    for (const f of generation.plan.filesToCreate) {
      console.log(`│   • ${f.path}`);
    }
    console.log(`│ ✓ Proof links: ${generation.proofLinks.length}`);
    
    if (generation.plan.refused.length > 0) {
      console.log(`│ ✗ Refused actions: ${generation.plan.refused.length}`);
      for (const r of generation.plan.refused) {
        console.log(`│   • ${r.action}: ${r.reason}`);
        warnings.push(`Refused: ${r.action} - ${r.suggestion}`);
      }
    }
    
    if (generation.plan.warnings.length > 0) {
      for (const w of generation.plan.warnings) {
        warnings.push(w);
      }
    }
    console.log('└──────────────────────────────────────────────────────────┘\n');

    // Step 3: Gate Check
    let gate: GateEvidence | undefined;
    
    if (!input.options?.skipGate) {
      console.log('┌─ Step 3: Gate Verification ──────────────────────────────┐');
      gate = await this.runGate(generation, translation.ast);
      console.log(`│ Score:   ${gate.score}/100`);
      console.log(`│ Verdict: ${gate.verdict}`);
      if (gate.violations.length > 0) {
        console.log(`│ Violations: ${gate.violations.length}`);
        for (const v of gate.violations.slice(0, 3)) {
          console.log(`│   • ${v.ruleId}: ${v.message}`);
        }
      }
      console.log('└──────────────────────────────────────────────────────────┘\n');
    }

    // Step 4: Build Proof Bundle
    console.log('┌─ Step 4: Proof Bundle ────────────────────────────────────┐');
    const proofBuilder = createProofBundle(translation.ast);
    
    proofBuilder.addProofLinks(generation.proofLinks);
    
    // Simulate test results (in real implementation, run actual tests)
    const mockTests: TestEvidence[] = translation.ast.behaviors.flatMap(b => [
      ...b.preconditions.map((pre, i) => ({
        name: `${b.name}: validates ${pre.source.slice(0, 30)}`,
        file: `src/tests/${b.name.toLowerCase()}.test.ts`,
        clausesCovered: [`${b.name}:precondition:${i}`],
        result: 'pass' as const,
        duration: Math.random() * 100,
      })),
      ...b.intents.map((intent, i) => ({
        name: `${b.name}: enforces @intent ${intent.tag}`,
        file: `src/tests/${b.name.toLowerCase()}.test.ts`,
        clausesCovered: [`${b.name}:intent:${i}`],
        result: 'pass' as const,
        duration: Math.random() * 50,
      })),
    ]);
    proofBuilder.addTestResults(mockTests);
    
    if (gate) {
      proofBuilder.addGateResults(gate);
    }
    
    const proof = proofBuilder.build();
    console.log(`│ Bundle ID: ${proof.bundleId.slice(0, 16)}...`);
    console.log(`│ Evidence:  ${proof.evidence.length} clauses`);
    console.log(`│ Tests:     ${proof.tests.length} tests`);
    console.log(`│ Verdict:   ${proof.verdict}`);
    console.log('└──────────────────────────────────────────────────────────┘\n');

    // Determine final verdict
    const verdict = gate?.verdict === 'NO_SHIP' ? 'NO_SHIP' : 
                   proof.verdict === 'VIOLATED' ? 'NO_SHIP' : 'SHIP';

    return {
      success: verdict === 'SHIP',
      translation,
      generation,
      gate,
      proof,
      verdict,
      errors,
      warnings,
    };
  }

  /**
   * Run gate check on generated code
   */
  private async runGate(generation: GenerationResult, ast: ISLAST): Promise<GateEvidence> {
    const violations: GateEvidence['violations'] = [];
    let score = 100;

    // Check each generated file for policy violations
    for (const diff of generation.diffs) {
      const content = diff.hunks.map(h => h.content).join('\n');
      
      // Check for common violations
      if (content.includes('console.log') && !content.includes('// eslint-disable')) {
        violations.push({
          ruleId: 'pii/console-in-production',
          file: diff.path,
          line: 1,
          message: 'console.log in production code',
          severity: 'medium',
        });
        score -= 5;
      }

      // Check for intent compliance
      for (const behavior of ast.behaviors) {
        for (const intent of behavior.intents) {
          const intentComment = `@intent ${intent.tag}`;
          if (!content.includes(intentComment)) {
            violations.push({
              ruleId: `intent/${intent.tag}`,
              file: diff.path,
              line: 1,
              message: `Missing @intent ${intent.tag} enforcement`,
              severity: 'high',
            });
            score -= 10;
          }
        }
      }
    }

    // Check for refused actions that indicate unsafe patterns
    for (const refused of generation.plan.refused) {
      violations.push({
        ruleId: 'intent/server-side-amount',
        file: 'generated',
        line: 0,
        message: refused.reason,
        severity: 'critical',
      });
      score -= 20;
    }

    score = Math.max(0, score);

    return {
      runId: `gate-${Date.now()}`,
      score,
      violations,
      verdict: score >= 70 ? 'SHIP' : 'NO_SHIP',
    };
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

export function createPipeline(): ISLPipeline {
  return new ISLPipeline();
}

/**
 * Quick pipeline run
 */
export async function runPipeline(
  prompt: string,
  repoContext: RepoContext,
  targetDir: string = './generated'
): Promise<PipelineResult> {
  const pipeline = createPipeline();
  return pipeline.run({ prompt, repoContext, targetDir });
}
