/**
 * Onboarding provisioner - manages tenant onboarding flows
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  OnboardingFlow, 
  OnboardingSession, 
  OnboardingStep, 
  OnboardingContext, 
  OnboardingResult,
  OnboardingStatus 
} from './types';
import { getOnboardingStepsForPlan } from './steps';
import { OnboardingStore } from './store';
import { OnboardingError } from '../errors';

export class OnboardingProvisioner {
  constructor(private store: OnboardingStore) {}

  /**
   * Start an onboarding session for a new tenant
   */
  async startOnboarding(
    tenantId: string,
    userId: string,
    plan: string,
    initialData?: Record<string, any>
  ): Promise<OnboardingSession> {
    // Create onboarding flow based on plan
    const flow = await this.createFlowForPlan(plan);
    
    // Initialize context
    const context: OnboardingContext = {
      tenantId: { value: tenantId },
      userId: { value: userId },
      data: initialData || {},
      completedSteps: [],
      failedSteps: []
    };

    // Create session
    const session: OnboardingSession = {
      id: uuidv4(),
      tenantId: { value: tenantId },
      userId: { value: userId },
      flowId: flow.id,
      flowVersion: flow.version,
      status: OnboardingStatus.IN_PROGRESS,
      currentStepIndex: 0,
      completedSteps: [],
      failedSteps: [],
      stepResults: {},
      context,
      startedAt: new Date(),
      lastActivityAt: new Date()
    };

    await this.store.saveSession(session);
    return session;
  }

  /**
   * Execute the next step in an onboarding session
   */
  async executeNextStep(sessionId: string): Promise<OnboardingSession> {
    const session = await this.store.findSession(sessionId);
    if (!session) {
      throw new OnboardingError('', 'Session not found');
    }

    if (session.status !== OnboardingStatus.IN_PROGRESS) {
      throw new OnboardingError('', `Session is not in progress: ${session.status}`);
    }

    const flow = await this.store.findFlow(session.flowId);
    if (!flow) {
      throw new OnboardingError('', 'Onboarding flow not found');
    }

    // Check if all steps are completed
    if (session.currentStepIndex >= flow.steps.length) {
      session.status = OnboardingStatus.COMPLETED;
      session.completedAt = new Date();
      await this.store.saveSession(session);
      return session;
    }

    const currentStep = flow.steps[session.currentStepIndex];
    
    // Check dependencies
    if (currentStep.dependencies) {
      for (const dep of currentStep.dependencies) {
        if (!session.completedSteps.includes(dep)) {
          throw new OnboardingError(
            currentStep.id,
            `Dependency not satisfied: ${dep}`
          );
        }
      }
    }

    // Update context
    session.context.currentStep = currentStep.id;
    session.context.completedSteps = session.completedSteps;
    session.context.failedSteps = session.failedSteps;

    // Execute the step
    const result = await this.executeStep(currentStep, session.context);
    session.stepResults[currentStep.id] = result;
    session.lastActivityAt = new Date();

    if (result.success) {
      // Mark step as completed
      session.completedSteps.push(currentStep.id);
      session.context.completedSteps.push(currentStep.id);
      
      // Merge result data
      if (result.data) {
        session.context.data = { ...session.context.data, ...result.data };
      }

      // Move to next step
      session.currentStepIndex++;

      // Check if this was the last step
      if (session.currentStepIndex >= flow.steps.length) {
        session.status = OnboardingStatus.COMPLETED;
        session.completedAt = new Date();
      }
    } else {
      // Step failed
      session.failedSteps.push(currentStep.id);
      session.context.failedSteps.push(currentStep.id);

      // Check if we should rollback
      if (currentStep.rollback && currentStep.handler.rollback) {
        try {
          await currentStep.handler.rollback(session.context);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      // Check if the step is required
      if (currentStep.required) {
        session.status = OnboardingStatus.FAILED;
      } else {
        // Skip optional failed steps
        session.currentStepIndex++;
      }
    }

    await this.store.saveSession(session);
    return session;
  }

  /**
   * Execute a single onboarding step
   */
  private async executeStep(
    step: OnboardingStep,
    context: OnboardingContext
  ): Promise<OnboardingResult> {
    const maxAttempts = step.retryPolicy?.maxAttempts || 1;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Validate before executing
        if (step.handler.validate) {
          const isValid = await step.handler.validate(context);
          if (!isValid) {
            return {
              success: false,
              error: 'Step validation failed',
              retryable: false
            };
          }
        }

        // Execute with timeout
        const result = await this.executeWithTimeout(
          step,
          context,
          step.timeout || 30000
        );

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Check if we should retry
        if (attempt < maxAttempts && this.shouldRetry(step, lastError)) {
          const delay = this.calculateRetryDelay(step, attempt);
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Step execution failed',
      retryable: this.shouldRetry(step, lastError)
    };
  }

  /**
   * Execute a step with timeout
   */
  private async executeWithTimeout(
    step: OnboardingStep,
    context: OnboardingContext,
    timeoutMs: number
  ): Promise<OnboardingResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      step.handler.execute(context)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Check if a step should be retried
   */
  private shouldRetry(step: OnboardingStep, error?: Error): boolean {
    if (!step.retryPolicy || !error) {
      return false;
    }

    if (step.retryPolicy.retryableErrors) {
      return step.retryPolicy.retryableErrors.includes(error.message);
    }

    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(step: OnboardingStep, attempt: number): number {
    if (!step.retryPolicy) {
      return 0;
    }

    const { backoffMs, maxBackoffMs } = step.retryPolicy;
    const delay = backoffMs * Math.pow(2, attempt - 1);
    return Math.min(delay, maxBackoffMs);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create an onboarding flow for a specific plan
   */
  private async createFlowForPlan(plan: string): Promise<OnboardingFlow> {
    const steps = getOnboardingStepsForPlan(plan);
    
    const flow: OnboardingFlow = {
      id: `flow_${plan.toLowerCase()}_${Date.now()}`,
      name: `${plan} Onboarding`,
      description: `Onboarding flow for ${plan} plan`,
      steps,
      version: '1.0.0',
      createdAt: new Date(),
      active: true
    };

    await this.store.saveFlow(flow);
    return flow;
  }

  /**
   * Get onboarding session status
   */
  async getSessionStatus(sessionId: string): Promise<OnboardingSession | null> {
    return await this.store.findSession(sessionId);
  }

  /**
   * Pause an onboarding session
   */
  async pauseSession(sessionId: string): Promise<OnboardingSession> {
    const session = await this.store.findSession(sessionId);
    if (!session) {
      throw new OnboardingError('', 'Session not found');
    }

    session.status = OnboardingStatus.PAUSED;
    session.lastActivityAt = new Date();
    await this.store.saveSession(session);
    return session;
  }

  /**
   * Resume a paused onboarding session
   */
  async resumeSession(sessionId: string): Promise<OnboardingSession> {
    const session = await this.store.findSession(sessionId);
    if (!session) {
      throw new OnboardingError('', 'Session not found');
    }

    if (session.status !== OnboardingStatus.PAUSED) {
      throw new OnboardingError('', 'Session is not paused');
    }

    session.status = OnboardingStatus.IN_PROGRESS;
    session.lastActivityAt = new Date();
    await this.store.saveSession(session);
    return session;
  }

  /**
   * Cancel an onboarding session
   */
  async cancelSession(sessionId: string): Promise<OnboardingSession> {
    const session = await this.store.findSession(sessionId);
    if (!session) {
      throw new OnboardingError('', 'Session not found');
    }

    session.status = OnboardingStatus.CANCELLED;
    session.lastActivityAt = new Date();
    await this.store.saveSession(session);
    return session;
  }

  /**
   * Retry a failed step
   */
  async retryStep(sessionId: string, stepId: string): Promise<OnboardingSession> {
    const session = await this.store.findSession(sessionId);
    if (!session) {
      throw new OnboardingError('', 'Session not found');
    }

    // Remove from failed steps
    session.failedSteps = session.failedSteps.filter(id => id !== stepId);
    session.context.failedSteps = session.context.failedSteps.filter(id => id !== stepId);

    // Remove step result
    delete session.stepResults[stepId];

    // Find the step index
    const flow = await this.store.findFlow(session.flowId);
    if (!flow) {
      throw new OnboardingError('', 'Onboarding flow not found');
    }

    const stepIndex = flow.steps.findIndex(step => step.id === stepId);
    if (stepIndex === -1) {
      throw new OnboardingError(stepId, 'Step not found in flow');
    }

    // Set current step to retry
    session.currentStepIndex = stepIndex;
    session.status = OnboardingStatus.IN_PROGRESS;
    session.lastActivityAt = new Date();

    await this.store.saveSession(session);
    
    // Execute the step
    return await this.executeNextStep(sessionId);
  }
}
