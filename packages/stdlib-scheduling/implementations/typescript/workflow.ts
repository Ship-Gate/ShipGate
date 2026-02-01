/**
 * Workflow Implementation
 * 
 * Multi-step workflow execution engine.
 */

import { v4 as uuidv4 } from 'uuid';
import type { 
  JobHandler, 
  RetryPolicy, 
  SchedulingError 
} from './scheduler.js';
import { WorkflowValidationError } from './scheduler.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowId = string;

export const WORKFLOW_STATUSES = ['PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type WorkflowStatus = typeof WORKFLOW_STATUSES[number];

export const STEP_STATUSES = ['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED'] as const;
export type StepStatus = typeof STEP_STATUSES[number];

/** Input for defining a workflow step */
export interface WorkflowStepInput {
  name: string;
  handler: string;
  input?: Record<string, unknown>;
  dependsOn?: string[];
  condition?: string;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

/** Workflow step with execution state */
export interface WorkflowStep {
  name: string;
  handler: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: StepStatus;
  dependsOn?: string[];
  condition?: string;
  retryPolicy?: RetryPolicy;
  timeout?: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  attempts: number;
  error?: string;
}

/** Workflow entity */
export interface Workflow {
  id: WorkflowId;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  currentStep?: number;
  status: WorkflowStatus;
  context: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  continueOnFailure: boolean;
  maxParallelism: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RunWorkflowInput {
  name: string;
  description?: string;
  steps: WorkflowStepInput[];
  initialContext?: Record<string, unknown>;
  continueOnFailure?: boolean;
  maxParallelism?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export type RunWorkflowOutput =
  | { success: true; workflow: Workflow }
  | { success: false; error: SchedulingError };

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export type WorkflowEvent =
  | { type: 'workflow.started'; workflow: Workflow }
  | { type: 'workflow.completed'; workflow: Workflow }
  | { type: 'workflow.failed'; workflow: Workflow; error: string }
  | { type: 'workflow.cancelled'; workflow: Workflow }
  | { type: 'workflow.paused'; workflow: Workflow }
  | { type: 'workflow.resumed'; workflow: Workflow }
  | { type: 'step.started'; workflow: Workflow; step: WorkflowStep }
  | { type: 'step.completed'; workflow: Workflow; step: WorkflowStep }
  | { type: 'step.failed'; workflow: Workflow; step: WorkflowStep; error: string }
  | { type: 'step.skipped'; workflow: Workflow; step: WorkflowStep };

// ─────────────────────────────────────────────────────────────────────────────
// Validation Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect cycles in step dependencies
 */
export function detectCycles(steps: WorkflowStepInput[]): string[] | null {
  const graph = new Map<string, string[]>();
  const stepNames = new Set(steps.map(s => s.name));

  // Build adjacency list
  for (const step of steps) {
    graph.set(step.name, step.dependsOn ?? []);
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycle: string[] = [];

  function dfs(node: string, path: string[]): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!stepNames.has(neighbor)) continue;
      
      if (!visited.has(neighbor)) {
        if (dfs(neighbor, [...path, neighbor])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        // Found cycle
        const cycleStart = path.indexOf(neighbor);
        cycle.push(...path.slice(cycleStart), neighbor);
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const step of steps) {
    if (!visited.has(step.name)) {
      if (dfs(step.name, [step.name])) {
        return cycle;
      }
    }
  }

  return null;
}

/**
 * Topological sort of steps
 */
export function topologicalSort(steps: WorkflowStepInput[]): WorkflowStepInput[] {
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const stepMap = new Map<string, WorkflowStepInput>();

  // Initialize
  for (const step of steps) {
    stepMap.set(step.name, step);
    graph.set(step.name, []);
    inDegree.set(step.name, 0);
  }

  // Build graph
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (stepMap.has(dep)) {
        graph.get(dep)!.push(step.name);
        inDegree.set(step.name, (inDegree.get(step.name) ?? 0) + 1);
      }
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: WorkflowStepInput[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(stepMap.get(current)!);

    for (const neighbor of graph.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

/**
 * Validate workflow steps
 */
export function validateWorkflowSteps(
  steps: WorkflowStepInput[],
  handlers: Map<string, JobHandler>
): { valid: true } | { valid: false; error: WorkflowValidationError } {
  // Check for empty steps
  if (steps.length === 0) {
    return {
      valid: false,
      error: new WorkflowValidationError('Workflow must have at least one step')
    };
  }

  // Check for duplicate names
  const names = new Set<string>();
  for (const step of steps) {
    if (names.has(step.name)) {
      return {
        valid: false,
        error: new WorkflowValidationError(`Duplicate step name: ${step.name}`, {
          duplicate: step.name
        })
      };
    }
    names.add(step.name);
  }

  // Check for missing dependencies
  for (const step of steps) {
    for (const dep of step.dependsOn ?? []) {
      if (!names.has(dep)) {
        return {
          valid: false,
          error: new WorkflowValidationError(`Step '${step.name}' depends on non-existent step '${dep}'`, {
            step: step.name,
            missing: dep
          })
        };
      }
    }
  }

  // Check for cycles
  const cycle = detectCycles(steps);
  if (cycle) {
    return {
      valid: false,
      error: new WorkflowValidationError('Step dependencies form a cycle', {
        cycle
      })
    };
  }

  // Check for missing handlers
  for (const step of steps) {
    if (!handlers.has(step.handler)) {
      return {
        valid: false,
        error: new WorkflowValidationError(`Handler not found: ${step.handler}`, {
          step: step.name,
          handler: step.handler
        })
      };
    }
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Engine
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowEngineOptions {
  handlers: Map<string, JobHandler>;
  onEvent?: (event: WorkflowEvent) => void;
}

export class WorkflowEngine {
  private workflows = new Map<WorkflowId, Workflow>();
  private handlers: Map<string, JobHandler>;
  private onEvent?: (event: WorkflowEvent) => void;
  private activeExecutions = new Map<WorkflowId, AbortController>();

  constructor(options: WorkflowEngineOptions) {
    this.handlers = options.handlers;
    this.onEvent = options.onEvent;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Workflow Operations
  // ───────────────────────────────────────────────────────────────────────────

  /**
   * Run a new workflow
   */
  async runWorkflow(input: RunWorkflowInput): Promise<RunWorkflowOutput> {
    // Validate steps
    const validation = validateWorkflowSteps(input.steps, this.handlers);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Create workflow
    const now = new Date();
    const workflow: Workflow = {
      id: uuidv4(),
      name: input.name,
      description: input.description,
      steps: input.steps.map(s => ({
        ...s,
        status: 'PENDING' as StepStatus,
        attempts: 0,
      })),
      status: 'PENDING',
      context: input.initialContext ?? {},
      completedSteps: 0,
      failedSteps: 0,
      skippedSteps: 0,
      continueOnFailure: input.continueOnFailure ?? false,
      maxParallelism: input.maxParallelism ?? 1,
      tags: input.tags,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.workflows.set(workflow.id, workflow);

    // Start execution
    this.executeWorkflow(workflow);

    return { success: true, workflow };
  }

  /**
   * Pause a running workflow
   */
  pauseWorkflow(workflowId: WorkflowId): Workflow | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'RUNNING') return undefined;

    workflow.status = 'PAUSED';
    workflow.updatedAt = new Date();

    this.emit({ type: 'workflow.paused', workflow });

    return workflow;
  }

  /**
   * Resume a paused workflow
   */
  resumeWorkflow(workflowId: WorkflowId): Workflow | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'PAUSED') return undefined;

    workflow.status = 'RUNNING';
    workflow.updatedAt = new Date();

    this.emit({ type: 'workflow.resumed', workflow });
    this.executeWorkflow(workflow);

    return workflow;
  }

  /**
   * Cancel a workflow
   */
  cancelWorkflow(workflowId: WorkflowId): Workflow | undefined {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return undefined;

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(workflow.status)) {
      return undefined;
    }

    // Abort any running execution
    const controller = this.activeExecutions.get(workflowId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(workflowId);
    }

    workflow.status = 'CANCELLED';
    workflow.updatedAt = new Date();

    this.emit({ type: 'workflow.cancelled', workflow });

    return workflow;
  }

  /**
   * Get a workflow by ID
   */
  getWorkflow(workflowId: WorkflowId): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  /**
   * List workflows
   */
  listWorkflows(filters?: {
    status?: WorkflowStatus | WorkflowStatus[];
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Workflow[] {
    let workflows = Array.from(this.workflows.values());

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      workflows = workflows.filter(w => statuses.includes(w.status));
    }

    if (filters?.tags) {
      workflows = workflows.filter(w =>
        w.tags && filters.tags!.every(t => w.tags!.includes(t))
      );
    }

    workflows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = filters?.offset ?? 0;
    const limit = filters?.limit ?? 100;
    return workflows.slice(offset, offset + limit);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Internal Execution
  // ───────────────────────────────────────────────────────────────────────────

  private async executeWorkflow(workflow: Workflow): Promise<void> {
    if (workflow.status !== 'PENDING' && workflow.status !== 'RUNNING') {
      return;
    }

    const controller = new AbortController();
    this.activeExecutions.set(workflow.id, controller);

    workflow.status = 'RUNNING';
    workflow.startedAt = workflow.startedAt ?? new Date();
    workflow.updatedAt = new Date();

    this.emit({ type: 'workflow.started', workflow });

    try {
      await this.runSteps(workflow, controller.signal);

      if (workflow.status === 'RUNNING') {
        if (workflow.failedSteps > 0 && !workflow.continueOnFailure) {
          workflow.status = 'FAILED';
          this.emit({
            type: 'workflow.failed',
            workflow,
            error: `${workflow.failedSteps} step(s) failed`
          });
        } else {
          workflow.status = 'COMPLETED';
          workflow.completedAt = new Date();
          workflow.durationMs = workflow.completedAt.getTime() - workflow.startedAt!.getTime();
          this.emit({ type: 'workflow.completed', workflow });
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        workflow.status = 'FAILED';
        this.emit({
          type: 'workflow.failed',
          workflow,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    } finally {
      this.activeExecutions.delete(workflow.id);
      workflow.updatedAt = new Date();
    }
  }

  private async runSteps(workflow: Workflow, signal: AbortSignal): Promise<void> {
    // Sort steps topologically
    const sortedSteps = topologicalSort(
      workflow.steps.map(s => ({
        name: s.name,
        handler: s.handler,
        dependsOn: s.dependsOn,
        input: s.input,
        condition: s.condition,
        retryPolicy: s.retryPolicy,
        timeout: s.timeout,
      }))
    );

    const completedSteps = new Set<string>();
    const failedSteps = new Set<string>();

    while (completedSteps.size + failedSteps.size < workflow.steps.length) {
      if (signal.aborted || workflow.status === 'PAUSED') break;

      // Find ready steps
      const readySteps = sortedSteps.filter(stepInput => {
        const step = workflow.steps.find(s => s.name === stepInput.name)!;
        if (step.status !== 'PENDING') return false;

        // Check dependencies
        const deps = stepInput.dependsOn ?? [];
        const depsCompleted = deps.every(d => completedSteps.has(d));
        const depsFailed = deps.some(d => failedSteps.has(d));

        if (depsFailed && !workflow.continueOnFailure) {
          // Skip this step
          step.status = 'SKIPPED';
          workflow.skippedSteps++;
          this.emit({ type: 'step.skipped', workflow, step });
          return false;
        }

        return depsCompleted;
      });

      if (readySteps.length === 0) break;

      // Execute ready steps (respecting parallelism)
      const batch = readySteps.slice(0, workflow.maxParallelism);
      await Promise.all(
        batch.map(stepInput => this.executeStep(workflow, stepInput.name, signal))
      );

      // Update tracking
      for (const step of workflow.steps) {
        if (step.status === 'COMPLETED') {
          completedSteps.add(step.name);
        } else if (step.status === 'FAILED') {
          failedSteps.add(step.name);
        }
      }
    }
  }

  private async executeStep(
    workflow: Workflow,
    stepName: string,
    signal: AbortSignal
  ): Promise<void> {
    const step = workflow.steps.find(s => s.name === stepName);
    if (!step) return;

    const handler = this.handlers.get(step.handler);
    if (!handler) {
      step.status = 'FAILED';
      step.error = `Handler not found: ${step.handler}`;
      workflow.failedSteps++;
      this.emit({ type: 'step.failed', workflow, step, error: step.error });
      return;
    }

    // Check condition
    if (step.condition) {
      try {
        const conditionFn = new Function('context', `return ${step.condition}`);
        if (!conditionFn(workflow.context)) {
          step.status = 'SKIPPED';
          workflow.skippedSteps++;
          this.emit({ type: 'step.skipped', workflow, step });
          return;
        }
      } catch {
        // If condition evaluation fails, proceed with step
      }
    }

    step.status = 'RUNNING';
    step.startedAt = new Date();
    step.attempts++;
    workflow.updatedAt = new Date();

    this.emit({ type: 'step.started', workflow, step });

    const maxAttempts = step.retryPolicy?.maxAttempts ?? 1;

    while (step.attempts <= maxAttempts) {
      if (signal.aborted) break;

      try {
        // Prepare input with context
        const input = {
          ...step.input,
          __context: workflow.context,
        };

        // Execute with timeout
        const timeout = step.timeout ?? 300000; // 5 min default
        const result = await Promise.race([
          handler(input, {
            jobId: `${workflow.id}:${step.name}`,
            attempt: step.attempts,
            maxAttempts,
            startedAt: step.startedAt!,
            signal,
          }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Step timeout')), timeout)
          ),
        ]);

        // Success
        step.status = 'COMPLETED';
        step.completedAt = new Date();
        step.durationMs = step.completedAt.getTime() - step.startedAt!.getTime();
        step.output = result as Record<string, unknown>;
        workflow.completedSteps++;

        // Merge output into context
        if (step.output) {
          workflow.context = {
            ...workflow.context,
            [step.name]: step.output,
          };
        }

        this.emit({ type: 'step.completed', workflow, step });
        return;
      } catch (err) {
        step.error = err instanceof Error ? err.message : String(err);

        if (step.attempts < maxAttempts) {
          // Retry with backoff
          const delay = (step.retryPolicy?.initialDelay ?? 1000) *
            Math.pow(step.retryPolicy?.backoffMultiplier ?? 2, step.attempts - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          step.attempts++;
        } else {
          // Final failure
          step.status = 'FAILED';
          step.completedAt = new Date();
          step.durationMs = step.completedAt.getTime() - step.startedAt!.getTime();
          workflow.failedSteps++;
          this.emit({ type: 'step.failed', workflow, step, error: step.error });
          return;
        }
      }
    }
  }

  private emit(event: WorkflowEvent): void {
    this.onEvent?.(event);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone Functions
// ─────────────────────────────────────────────────────────────────────────────

let defaultEngine: WorkflowEngine | null = null;

function getDefaultEngine(): WorkflowEngine {
  if (!defaultEngine) {
    defaultEngine = new WorkflowEngine({ handlers: new Map() });
  }
  return defaultEngine;
}

export async function runWorkflow(input: RunWorkflowInput): Promise<RunWorkflowOutput> {
  return getDefaultEngine().runWorkflow(input);
}

export function pauseWorkflow(workflowId: WorkflowId): Workflow | undefined {
  return getDefaultEngine().pauseWorkflow(workflowId);
}

export function resumeWorkflow(workflowId: WorkflowId): Workflow | undefined {
  return getDefaultEngine().resumeWorkflow(workflowId);
}

export function cancelWorkflow(workflowId: WorkflowId): Workflow | undefined {
  return getDefaultEngine().cancelWorkflow(workflowId);
}

export function getWorkflow(workflowId: WorkflowId): Workflow | undefined {
  return getDefaultEngine().getWorkflow(workflowId);
}

export function listWorkflows(filters?: Parameters<WorkflowEngine['listWorkflows']>[0]): Workflow[] {
  return getDefaultEngine().listWorkflows(filters);
}
