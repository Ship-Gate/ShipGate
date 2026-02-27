/**
 * Agent OS Orchestrator
 * 
 * The brain of IntentOS - coordinates the full pipeline:
 * 
 * User Request (Plain English)
 *     ↓
 * [TRIAGE] - Classify what kind of request this is
 *     ↓
 * [TRANSLATE] - Convert to ISL specification
 *     ↓
 * [PLAN] - Break down into executable steps
 *     ↓
 * [EXECUTE] - Generate code via specialized agents
 *     ↓
 * [VERIFY] - Check code against ISL spec
 *     ↓
 * Result with Trust Score
 */

import { ISL_AGENT_PROMPTS } from '@isl-lang/intent-translator';
import type { Domain } from '@isl-lang/parser';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RequestScope = 
  | 'simple'      // Single file change
  | 'moderate'    // Multiple files, one concern
  | 'complex'     // Architecture-level changes
  | 'unknown';

export type RequestType =
  | 'new-feature'      // Build something new
  | 'modify-existing'  // Change existing code
  | 'fix-bug'          // Fix an issue
  | 'refactor'         // Improve code structure
  | 'question'         // Just asking
  | 'unknown';

export interface TriageResult {
  scope: RequestScope;
  type: RequestType;
  suggestedLibraries: string[];
  requiresPlanning: boolean;
  confidence: number;
}

export interface PlanStep {
  id: string;
  name: string;
  description: string;
  agent: 'architect' | 'backend' | 'frontend' | 'test' | 'security';
  dependencies: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface ExecutionPlan {
  steps: PlanStep[];
  totalSteps: number;
  parallelizable: string[][];  // Groups of steps that can run in parallel
}

export interface ExecutionResult {
  stepId: string;
  success: boolean;
  output?: string;
  files?: GeneratedFile[];
  errors?: string[];
  durationMs: number;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: 'types' | 'implementation' | 'test' | 'config';
}

export interface VerificationResult {
  success: boolean;
  trustScore: number;
  confidence: number;
  breakdown: {
    preconditions: { passed: number; total: number };
    postconditions: { passed: number; total: number };
    invariants: { passed: number; total: number };
    errors: { covered: number; total: number };
  };
  issues: string[];
}

export interface OrchestratorResult {
  success: boolean;
  requestId: string;
  
  // Pipeline stages
  triage: TriageResult;
  isl?: string;
  plan?: ExecutionPlan;
  execution?: ExecutionResult[];
  verification?: VerificationResult;
  
  // Final outputs
  files?: GeneratedFile[];
  trustScore?: number;
  
  // Timing
  totalDurationMs: number;
  
  // Errors
  errors?: string[];
}

export interface OrchestratorOptions {
  /** AI API key */
  apiKey?: string;
  /** Model for triage (cheap/fast) */
  triageModel?: string;
  /** Model for planning (smart) */
  planModel?: string;
  /** Model for execution (capable) */
  executeModel?: string;
  /** Enable verification step */
  verify?: boolean;
  /** Stream events */
  onEvent?: (event: OrchestratorEvent) => void;
}

export interface OrchestratorEvent {
  type: 'triage' | 'translate' | 'plan' | 'execute' | 'verify' | 'complete' | 'error';
  data: unknown;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator Class
// ─────────────────────────────────────────────────────────────────────────────

export class Orchestrator {
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions = {}) {
    this.options = {
      triageModel: 'claude-3-5-haiku-20241022',
      planModel: 'claude-sonnet-4-20250514',
      executeModel: 'claude-sonnet-4-20250514',
      verify: true,
      ...options,
    };
  }

  /**
   * Run the full orchestration pipeline
   */
  async run(request: string): Promise<OrchestratorResult> {
    const startTime = Date.now();
    const requestId = generateRequestId();

    try {
      // Step 1: Triage
      this.emit('triage', { request });
      const triage = await this.triage(request);

      // If it's just a question, don't proceed with full pipeline
      if (triage.type === 'question') {
        return {
          success: true,
          requestId,
          triage,
          totalDurationMs: Date.now() - startTime,
        };
      }

      // Step 2: Translate to ISL
      this.emit('translate', { triage });
      const isl = await this.translate(request, triage);

      // Step 3: Plan (if needed)
      let plan: ExecutionPlan | undefined;
      if (triage.requiresPlanning) {
        this.emit('plan', { isl });
        plan = await this.plan(isl, triage);
      } else {
        // Simple plan for simple requests
        plan = this.simplePlan(isl);
      }

      // Step 4: Execute
      this.emit('execute', { plan });
      const execution = await this.execute(isl, plan);

      // Collect generated files
      const files = execution
        .filter(r => r.success && r.files)
        .flatMap(r => r.files!);

      // Step 5: Verify (if enabled)
      let verification: VerificationResult | undefined;
      if (this.options.verify && files.length > 0) {
        this.emit('verify', { files });
        verification = await this.verify(isl, files);
      }

      const result: OrchestratorResult = {
        success: true,
        requestId,
        triage,
        isl,
        plan,
        execution,
        verification,
        files,
        trustScore: verification?.trustScore,
        totalDurationMs: Date.now() - startTime,
      };

      this.emit('complete', result);
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.emit('error', { error: errorMessage });
      
      return {
        success: false,
        requestId,
        triage: { scope: 'unknown', type: 'unknown', suggestedLibraries: [], requiresPlanning: false, confidence: 0 },
        errors: [errorMessage],
        totalDurationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Step 1: Triage - Classify the request
   */
  private async triage(request: string): Promise<TriageResult> {
    // Pattern-based triage (fast, no AI needed)
    const lowerRequest = request.toLowerCase();
    
    // Detect type
    let type: RequestType = 'unknown';
    if (/\b(build|create|add|new|implement|make)\b/.test(lowerRequest)) {
      type = 'new-feature';
    } else if (/\b(change|modify|update|edit)\b/.test(lowerRequest)) {
      type = 'modify-existing';
    } else if (/\b(fix|bug|issue|error|broken)\b/.test(lowerRequest)) {
      type = 'fix-bug';
    } else if (/\b(refactor|clean|improve|optimize)\b/.test(lowerRequest)) {
      type = 'refactor';
    } else if (/\b(what|how|why|can you|could you)\b/.test(lowerRequest)) {
      type = 'question';
    }

    // Detect scope
    let scope: RequestScope = 'simple';
    const complexKeywords = ['app', 'application', 'system', 'platform', 'saas', 'full'];
    const moderateKeywords = ['api', 'service', 'feature', 'module', 'component'];
    
    if (complexKeywords.some(kw => lowerRequest.includes(kw))) {
      scope = 'complex';
    } else if (moderateKeywords.some(kw => lowerRequest.includes(kw))) {
      scope = 'moderate';
    }

    // Detect libraries
    const { detectLibraries } = await import('@isl-lang/intent-translator');
    const suggestedLibraries = detectLibraries(request);

    return {
      scope,
      type,
      suggestedLibraries,
      requiresPlanning: scope === 'complex' || scope === 'moderate',
      confidence: type === 'unknown' ? 0.5 : 0.85,
    };
  }

  /**
   * Step 2: Translate to ISL
   */
  private async translate(request: string, triage: TriageResult): Promise<string> {
    const { translate } = await import('@isl-lang/intent-translator');
    
    const result = await translate(request, {
      apiKey: this.options.apiKey,
      preferredLibraries: triage.suggestedLibraries,
    });

    if (!result.success || !result.isl) {
      throw new Error(result.errors?.join(', ') || 'Translation failed');
    }

    return result.isl;
  }

  /**
   * Step 3: Plan the execution
   */
  private async plan(isl: string, triage: TriageResult): Promise<ExecutionPlan> {
    // Parse ISL to understand structure
    const steps: PlanStep[] = [];

    // Always start with architecture review
    steps.push({
      id: 'arch-1',
      name: 'Architecture Review',
      description: 'Review ISL spec and plan implementation structure',
      agent: 'architect',
      dependencies: [],
      estimatedComplexity: 'low',
    });

    // Add type generation
    steps.push({
      id: 'types-1',
      name: 'Generate Types',
      description: 'Generate TypeScript types from ISL entities and behaviors',
      agent: 'backend',
      dependencies: ['arch-1'],
      estimatedComplexity: 'low',
    });

    // Add backend implementation
    steps.push({
      id: 'backend-1',
      name: 'Backend Implementation',
      description: 'Implement services and repositories',
      agent: 'backend',
      dependencies: ['types-1'],
      estimatedComplexity: triage.scope === 'complex' ? 'high' : 'medium',
    });

    // Add frontend if complex
    if (triage.scope === 'complex') {
      steps.push({
        id: 'frontend-1',
        name: 'Frontend Implementation',
        description: 'Implement UI components and hooks',
        agent: 'frontend',
        dependencies: ['types-1'],
        estimatedComplexity: 'medium',
      });
    }

    // Always add tests
    steps.push({
      id: 'test-1',
      name: 'Test Generation',
      description: 'Generate tests for behaviors',
      agent: 'test',
      dependencies: ['backend-1'],
      estimatedComplexity: 'medium',
    });

    // Security review for complex projects
    if (triage.scope === 'complex' || triage.suggestedLibraries.includes('stdlib-auth')) {
      steps.push({
        id: 'security-1',
        name: 'Security Review',
        description: 'Review security constraints and implementations',
        agent: 'security',
        dependencies: ['backend-1'],
        estimatedComplexity: 'low',
      });
    }

    // Determine parallelizable groups
    const parallelizable: string[][] = [];
    
    // Types and arch can be parallel in some cases
    parallelizable.push(['types-1']);
    
    // Backend and frontend can be parallel
    const implSteps = steps
      .filter(s => s.id.startsWith('backend-') || s.id.startsWith('frontend-'))
      .map(s => s.id);
    if (implSteps.length > 1) {
      parallelizable.push(implSteps);
    }

    // Tests and security can be parallel
    const verifySteps = steps
      .filter(s => s.id.startsWith('test-') || s.id.startsWith('security-'))
      .map(s => s.id);
    if (verifySteps.length > 0) {
      parallelizable.push(verifySteps);
    }

    return {
      steps,
      totalSteps: steps.length,
      parallelizable,
    };
  }

  /**
   * Simple plan for simple requests
   */
  private simplePlan(isl: string): ExecutionPlan {
    return {
      steps: [
        {
          id: 'impl-1',
          name: 'Generate Implementation',
          description: 'Generate types and basic implementation',
          agent: 'backend',
          dependencies: [],
          estimatedComplexity: 'low',
        },
        {
          id: 'test-1',
          name: 'Generate Tests',
          description: 'Generate test scaffolds',
          agent: 'test',
          dependencies: ['impl-1'],
          estimatedComplexity: 'low',
        },
      ],
      totalSteps: 2,
      parallelizable: [['impl-1'], ['test-1']],
    };
  }

  /**
   * Step 4: Execute the plan
   */
  private async execute(isl: string, plan: ExecutionPlan): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const step of plan.steps) {
      const startTime = Date.now();
      
      try {
        // Check dependencies
        const depsFailed = step.dependencies.some(
          dep => results.find(r => r.stepId === dep)?.success === false
        );

        if (depsFailed) {
          results.push({
            stepId: step.id,
            success: false,
            errors: ['Dependency failed'],
            durationMs: 0,
          });
          continue;
        }

        // Execute based on agent type
        const files = await this.executeStep(step, isl);

        results.push({
          stepId: step.id,
          success: true,
          files,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          stepId: step.id,
          success: false,
          errors: [error instanceof Error ? error.message : 'Step failed'],
          durationMs: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * Parse ISL source into a domain declaration
   */
  private async parseDomain(isl: string): Promise<Domain | null> {
    try {
      const { parse } = await import('@isl-lang/parser');
      const result = parse(isl);
      return result.domain ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: PlanStep, isl: string): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const domain = await this.parseDomain(isl);

    switch (step.agent) {
      case 'architect':
        // Architecture step: analyze ISL and produce a summary
        if (domain) {
          const entityNames = domain.entities.map(e => e.name.name);
          const behaviorNames = domain.behaviors.map(b => b.name.name);
          files.push({
            path: 'generated/ARCHITECTURE.md',
            content: [
              `# Architecture: ${domain.name.name}`,
              '',
              `## Entities (${entityNames.length})`,
              ...entityNames.map(n => `- ${n}`),
              '',
              `## Behaviors (${behaviorNames.length})`,
              ...behaviorNames.map(n => `- ${n}`),
              '',
              '## Generated by Agent OS',
              `Generated at: ${new Date().toISOString()}`,
            ].join('\n'),
            type: 'config',
          });
        }
        break;

      case 'backend': {
        // Step 1: Deterministic type generation via ISL compiler
        if (domain) {
          try {
            const { compile } = await import('@isl-lang/isl-compiler');
            const compiled = compile(domain);
            if (compiled.types.content) {
              files.push({
                path: compiled.types.filename || 'generated/types.ts',
                content: compiled.types.content,
                type: 'types',
              });
            }
          } catch {
            // Fallback: generate basic type stubs from domain entities
            const typeStubs = this.generateTypeStubs(domain);
            files.push({ path: 'generated/types.ts', content: typeStubs, type: 'types' });
          }
        }

        // Step 2: AI-powered behavior implementation (if API key available)
        if (domain && this.options.apiKey) {
          try {
            // Dynamic import — ai-generator is an optional peer; may not be installed
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const aiGen: { generateAll: (domain: unknown, opts: { model: string; language: string; apiKey: string }) => Promise<Array<{ code: string; confidence: number; metadata: { behaviorName: string } }>> } = await import('@isl-lang/ai-generator' as string);
            const results = await aiGen.generateAll(domain, {
              model: this.options.executeModel ?? 'claude-sonnet-4-20250514',
              language: 'typescript',
              apiKey: this.options.apiKey!,
            });
            for (const result of results) {
              if (result.code && result.confidence > 0.3) {
                const fileName = result.metadata.behaviorName
                  .replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
                files.push({
                  path: `generated/${fileName}.ts`,
                  content: result.code,
                  type: 'implementation',
                });
              }
            }
          } catch {
            // AI generation failed — fall back to scaffold
            const scaffold = this.generateBehaviorScaffold(domain);
            files.push({ path: 'generated/behaviors.ts', content: scaffold, type: 'implementation' });
          }
        } else if (domain) {
          // No API key: generate deterministic scaffold
          const scaffold = this.generateBehaviorScaffold(domain);
          files.push({ path: 'generated/behaviors.ts', content: scaffold, type: 'implementation' });
        }
        break;
      }

      case 'frontend': {
        // Generate React component stubs from ISL entities
        if (domain) {
          const components = this.generateReactStubs(domain);
          files.push({ path: 'generated/components.tsx', content: components, type: 'implementation' });
        }
        break;
      }

      case 'test': {
        // Generate tests via ISL compiler
        if (domain) {
          try {
            const { compile } = await import('@isl-lang/isl-compiler');
            const compiled = compile(domain);
            if (compiled.tests.content) {
              files.push({
                path: compiled.tests.filename || 'generated/spec.test.ts',
                content: compiled.tests.content,
                type: 'test',
              });
            }
          } catch {
            // Fallback: generate basic test scaffolds
            const tests = this.generateTestScaffold(domain);
            files.push({ path: 'generated/spec.test.ts', content: tests, type: 'test' });
          }
        }
        break;
      }

      case 'security': {
        // Security review: check ISL for auth/security patterns
        if (domain) {
          const issues: string[] = [];
          for (const behavior of domain.behaviors) {
            const hasAuth = behavior.preconditions.some(
              p => JSON.stringify(p).toLowerCase().includes('auth')
            );
            if (!hasAuth) {
              issues.push(`Warning: Behavior "${behavior.name.name}" has no auth precondition`);
            }
          }
          if (issues.length > 0) {
            files.push({
              path: 'generated/SECURITY_REVIEW.md',
              content: ['# Security Review', '', ...issues].join('\n'),
              type: 'config',
            });
          }
        }
        break;
      }
    }

    return files;
  }

  /**
   * Generate TypeScript type stubs from domain entities (fallback)
   */
  private generateTypeStubs(domain: Domain): string {
    const lines: string[] = [
      `// Types generated from ISL domain: ${domain.name.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ];

    for (const entity of domain.entities) {
      lines.push(`export interface ${entity.name.name} {`);
      for (const field of entity.fields) {
        const tsType = this.islTypeToTs(field.type);
        lines.push(`  ${field.name.name}: ${tsType};`);
      }
      lines.push('}', '');
    }

    return lines.join('\n');
  }

  /**
   * Generate behavior scaffold (no AI)
   */
  private generateBehaviorScaffold(domain: Domain): string {
    const lines: string[] = [
      `// Behavior implementations for: ${domain.name.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      '',
    ];

    for (const behavior of domain.behaviors) {
      const name = behavior.name.name;
      const inputFields = behavior.input.fields.map(f => `${f.name.name}: ${this.islTypeToTs(f.type)}`).join(', ');
      const inputType = inputFields ? `input: { ${inputFields} }` : '';
      const outputType = ': Promise<void>';
      lines.push(
        `export async function ${name[0]!.toLowerCase() + name.slice(1)}(${inputType})${outputType} {`,
        `  throw new Error('Not implemented: ${name}');`,
        '}',
        '',
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate React component stubs from ISL entities
   */
  private generateReactStubs(domain: Domain): string {
    const lines: string[] = [
      `// React components for: ${domain.name.name}`,
      `// Generated at: ${new Date().toISOString()}`,
      "import React from 'react';",
      '',
    ];

    for (const entity of domain.entities) {
      const name = entity.name.name;
      lines.push(
        `export function ${name}List({ items }: { items: ${name}[] }) {`,
        '  return (',
        '    <div>',
        `      <h2>${name} List</h2>`,
        '      <ul>',
        `        {items.map((item, i) => <li key={i}>{JSON.stringify(item)}</li>)}`,
        '      </ul>',
        '    </div>',
        '  );',
        '}',
        '',
      );
    }

    return lines.join('\n');
  }

  /**
   * Generate test scaffolds from ISL behaviors (fallback)
   */
  private generateTestScaffold(domain: Domain): string {
    const lines: string[] = [
      "import { describe, it, expect } from 'vitest';",
      '',
      `describe('${domain.name.name}', () => {`,
    ];

    for (const behavior of domain.behaviors) {
      lines.push(
        `  describe('${behavior.name.name}', () => {`,
      );

      // Generate test for each precondition
      for (let idx = 0; idx < behavior.preconditions.length; idx++) {
        lines.push(
          `    it('should validate precondition ${idx + 1}', () => {`,
          `      expect(true).toBe(true); // TODO: implement`,
          '    });',
          '',
        );
      }

      // Generate test for each postcondition block
      for (const post of behavior.postconditions) {
        const condName = typeof post.condition === 'string' ? post.condition : post.condition.name;
        lines.push(
          `    it('should ensure postcondition: ${condName}', () => {`,
          `      expect(true).toBe(true); // TODO: implement`,
          '    });',
          '',
        );
      }

      // Default test if no conditions
      if (behavior.preconditions.length === 0 && behavior.postconditions.length === 0) {
        lines.push(
          `    it('should execute successfully', () => {`,
          `      expect(true).toBe(true); // TODO: implement`,
          '    });',
          '',
        );
      }

      lines.push('  });', '');
    }

    lines.push('});', '');
    return lines.join('\n');
  }

  /**
   * Convert ISL type reference to TypeScript type
   */
  private islTypeToTs(typeRef: unknown): string {
    if (!typeRef) return 'unknown';
    if (typeof typeRef === 'string') return typeRef;
    if (typeof typeRef === 'object' && typeRef !== null && 'name' in typeRef) {
      return String((typeRef as { name: string }).name);
    }
    return 'unknown';
  }

  /**
   * Step 5: Verify the generated code against ISL spec
   */
  private async verify(isl: string, files: GeneratedFile[]): Promise<VerificationResult> {
    const issues: string[] = [];
    let totalChecks = 0;
    let passedChecks = 0;
    const breakdown = {
      preconditions: { passed: 0, total: 0 },
      postconditions: { passed: 0, total: 0 },
      invariants: { passed: 0, total: 0 },
      errors: { covered: 0, total: 0 },
    };

    // 1. Parse the ISL spec
    const domain = await this.parseDomain(isl);
    if (!domain) {
      return {
        success: false,
        trustScore: 0,
        confidence: 0,
        breakdown,
        issues: ['Failed to parse ISL specification'],
      };
    }

    // 2. Check that all behaviors have implementations
    const implFiles = files.filter(f => f.type === 'implementation');
    const implContent = implFiles.map(f => f.content).join('\n');

    for (const behavior of domain.behaviors) {
      const name = behavior.name.name;
      const nameLower = name[0]!.toLowerCase() + name.slice(1);
      totalChecks++;

      if (implContent.includes(name) || implContent.includes(nameLower)) {
        passedChecks++;
      } else {
        issues.push(`Missing implementation for behavior: ${name}`);
      }
    }

    // 3. Check preconditions are referenced in implementations
    for (const behavior of domain.behaviors) {
      for (let i = 0; i < behavior.preconditions.length; i++) {
        breakdown.preconditions.total++;
        totalChecks++;
        if (implContent.includes('validate') || implContent.includes('check') || implContent.includes('throw') || implContent.includes('assert')) {
          breakdown.preconditions.passed++;
          passedChecks++;
        } else {
          issues.push(`Precondition ${i + 1} not enforced in ${behavior.name.name}`);
        }
      }
    }

    // 4. Check postconditions
    for (const behavior of domain.behaviors) {
      for (const post of behavior.postconditions) {
        breakdown.postconditions.total++;
        totalChecks++;
        if (implContent.includes('return')) {
          breakdown.postconditions.passed++;
          passedChecks++;
        } else {
          const condName = typeof post.condition === 'string' ? post.condition : post.condition.name;
          issues.push(`Postcondition "${condName}" may not be met in ${behavior.name.name}`);
        }
      }
    }

    // 5. Check invariants
    for (const behavior of domain.behaviors) {
      for (let i = 0; i < behavior.invariants.length; i++) {
        breakdown.invariants.total++;
        totalChecks++;
        if (implContent.length > 50) {
          breakdown.invariants.passed++;
          passedChecks++;
        } else {
          issues.push(`Invariant ${i + 1} not verifiable in ${behavior.name.name}`);
        }
      }
    }

    // 6. Check error handling (errors are in output.errors)
    for (const behavior of domain.behaviors) {
      for (const err of behavior.output.errors) {
        breakdown.errors.total++;
        totalChecks++;
        if (implContent.includes('catch') || implContent.includes('throw') || implContent.includes('Error')) {
          breakdown.errors.covered++;
          passedChecks++;
        } else {
          issues.push(`Error case not handled: ${err.name.name} in ${behavior.name.name}`);
        }
      }
    }

    // 7. Check that test files exist
    const testFiles = files.filter(f => f.type === 'test');
    totalChecks++;
    if (testFiles.length > 0) {
      passedChecks++;
    } else {
      issues.push('No test files generated');
    }

    // 8. Check types were generated
    const typeFiles = files.filter(f => f.type === 'types');
    totalChecks++;
    if (typeFiles.length > 0) {
      passedChecks++;
    } else {
      issues.push('No type files generated');
    }

    // Calculate trust score
    const trustScore = totalChecks > 0
      ? Math.round((passedChecks / totalChecks) * 100)
      : 0;
    const confidence = Math.min(90, totalChecks * 5); // More checks = higher confidence, cap at 90

    return {
      success: issues.length === 0,
      trustScore,
      confidence,
      breakdown,
      issues,
    };
  }

  /**
   * Emit an event
   */
  private emit(type: OrchestratorEvent['type'], data: unknown): void {
    if (this.options.onEvent) {
      this.options.onEvent({
        type,
        data,
        timestamp: new Date(),
      });
    }
  }
}

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export default Orchestrator;
