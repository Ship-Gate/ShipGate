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
   * Execute a single step
   */
  private async executeStep(step: PlanStep, isl: string): Promise<GeneratedFile[]> {
    // For now, use the ISL compiler to generate basic outputs
    // In full implementation, this would call specialized AI agents
    
    const files: GeneratedFile[] = [];

    switch (step.agent) {
      case 'architect':
        // Architecture step just analyzes, no files
        break;
        
      case 'backend':
        // Generate types and implementation stubs
        files.push({
          path: 'generated/types.ts',
          content: `// Generated from ISL\n// TODO: Full type generation\nexport {};\n`,
          type: 'types',
        });
        break;
        
      case 'frontend':
        files.push({
          path: 'generated/components.tsx',
          content: `// Generated React components\n// TODO: Full component generation\nexport {};\n`,
          type: 'implementation',
        });
        break;
        
      case 'test':
        files.push({
          path: 'generated/spec.test.ts',
          content: `// Generated tests\nimport { describe, it, expect } from 'vitest';\n\ndescribe('Generated', () => {\n  it('placeholder', () => {\n    expect(true).toBe(true);\n  });\n});\n`,
          type: 'test',
        });
        break;
        
      case 'security':
        // Security review step, no files
        break;
    }

    return files;
  }

  /**
   * Step 5: Verify the generated code
   */
  private async verify(isl: string, files: GeneratedFile[]): Promise<VerificationResult> {
    // Placeholder verification
    // In full implementation, this would run the ISL verifier
    
    return {
      success: true,
      trustScore: 85,
      confidence: 70,
      breakdown: {
        preconditions: { passed: 0, total: 0 },
        postconditions: { passed: 0, total: 0 },
        invariants: { passed: 0, total: 0 },
        errors: { covered: 0, total: 0 },
      },
      issues: [],
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
