/**
 * Checkout flow state machine implementation
 * @packageDocumentation
 */

import { CheckoutStatus } from '../types';
import { 
  CheckoutFlow, 
  CheckoutStep, 
  CheckoutStepConfig, 
  CheckoutEvent,
  CheckoutEventType,
  CheckoutConfig,
  CustomerInfo,
  Address,
  PaymentMethodInfo
} from './types';
import { ValidationError } from '../errors';

// ============================================================================
// CHECKOUT FLOW STATE MACHINE
// ============================================================================

export class CheckoutFlowManager {
  private flow: CheckoutFlow;
  private config: CheckoutConfig;
  private events: CheckoutEvent[] = [];
  private stepData: Map<CheckoutStep, any> = new Map();

  constructor(sessionId: string, config: CheckoutConfig) {
    this.config = config;
    
    // Initialize flow with first required step
    const firstStep = this.getFirstStep();
    
    this.flow = {
      sessionId,
      currentStep: firstStep,
      completedSteps: [],
      pendingSteps: this.getPendingSteps(firstStep),
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.recordEvent('session_created', { firstStep });
  }

  // ============================================================================
  // FLOW STATE MANAGEMENT
  // ============================================================================

  /**
   * Get current flow state
   */
  getFlow(): CheckoutFlow {
    return { ...this.flow };
  }

  /**
   * Get current step
   */
  getCurrentStep(): CheckoutStep {
    return this.flow.currentStep;
  }

  /**
   * Get step configuration
   */
  getStepConfig(step: CheckoutStep): CheckoutStepConfig | undefined {
    return this.config.steps.find(s => s.step === step);
  }

  /**
   * Check if step is completed
   */
  isStepCompleted(step: CheckoutStep): boolean {
    return this.flow.completedSteps.includes(step);
  }

  /**
   * Check if step can be accessed
   */
  canAccessStep(step: CheckoutStep): boolean {
    // Can always access current step
    if (step === this.flow.currentStep) {
      return true;
    }

    // Can access completed steps
    if (this.isStepCompleted(step)) {
      return true;
    }

    // Check if all previous steps are completed
    const stepIndex = this.config.steps.findIndex(s => s.step === step);
    if (stepIndex === -1) {
      return false;
    }

    for (let i = 0; i < stepIndex; i++) {
      const prevStep = this.config.steps[i].step;
      if (!this.isStepCompleted(prevStep) && this.getStepConfig(prevStep)?.required) {
        return false;
      }
    }

    return true;
  }

  /**
   * Move to next step
   */
  async nextStep(): Promise<CheckoutStep> {
    const currentStepConfig = this.getStepConfig(this.flow.currentStep);
    
    // Validate current step is completed
    if (currentStepConfig?.required && !this.isStepCompleted(this.flow.currentStep)) {
      throw new ValidationError(
        `Current step ${this.flow.currentStep} must be completed before proceeding`,
        'step',
        this.flow.currentStep,
        'required'
      );
    }

    // Find next step
    const currentIndex = this.config.steps.findIndex(s => s.step === this.flow.currentStep);
    let nextStep: CheckoutStep | null = null;

    for (let i = currentIndex + 1; i < this.config.steps.length; i++) {
      const stepConfig = this.config.steps[i];
      
      // Check if step should be skipped
      if (!this.shouldSkipStep(stepConfig)) {
        nextStep = stepConfig.step;
        break;
      } else {
        // Mark skipped step as completed
        if (!this.flow.completedSteps.includes(stepConfig.step)) {
          this.flow.completedSteps.push(stepConfig.step);
          this.recordEvent('step_skipped', { step: stepConfig.step });
        }
      }
    }

    if (!nextStep) {
      // No more steps, flow is complete
      this.flow.currentStep = 'complete';
      this.flow.pendingSteps = [];
      this.recordEvent('checkout_completed');
      return 'complete';
    }

    // Update flow
    this.flow.currentStep = nextStep;
    this.flow.pendingSteps = this.getPendingSteps(nextStep);
    this.flow.updatedAt = new Date();

    this.recordEvent('step_started', { step: nextStep });

    return nextStep;
  }

  /**
   * Go back to previous step
   */
  previousStep(): CheckoutStep {
    const currentIndex = this.config.steps.findIndex(s => s.step === this.flow.currentStep);
    
    if (currentIndex <= 0) {
      throw new ValidationError(
        'Already at first step',
        'step',
        this.flow.currentStep,
        'invalid_transition'
      );
    }

    // Find previous accessible step
    let prevStep: CheckoutStep | null = null;
    
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = this.config.steps[i].step;
      if (this.canAccessStep(step)) {
        prevStep = step;
        break;
      }
    }

    if (!prevStep) {
      throw new ValidationError(
        'No previous step available',
        'step',
        this.flow.currentStep,
        'invalid_transition'
      );
    }

    // Update flow
    this.flow.currentStep = prevStep;
    this.flow.pendingSteps = this.getPendingSteps(prevStep);
    this.flow.updatedAt = new Date();

    this.recordEvent('step_started', { step: prevStep, direction: 'backward' });

    return prevStep;
  }

  /**
   * Jump to a specific step
   */
  jumpToStep(step: CheckoutStep): void {
    if (!this.canAccessStep(step)) {
      throw new ValidationError(
        `Cannot access step ${step}`,
        'step',
        step,
        'not_accessible'
      );
    }

    const previousStep = this.flow.currentStep;
    this.flow.currentStep = step;
    this.flow.pendingSteps = this.getPendingSteps(step);
    this.flow.updatedAt = new Date();

    this.recordEvent('step_started', { 
      step, 
      previousStep,
      direction: step === 'complete' ? 'finish' : 'jump'
    });
  }

  // ============================================================================
  // STEP DATA MANAGEMENT
  // ============================================================================

  /**
   * Set data for current step
   */
  setStepData(data: any): void {
    this.stepData.set(this.flow.currentStep, data);
    this.flow.updatedAt = new Date();
  }

  /**
   * Get data for a step
   */
  getStepData(step?: CheckoutStep): any {
    return this.stepData.get(step || this.flow.currentStep);
  }

  /**
   * Clear data for a step
   */
  clearStepData(step?: CheckoutStep): void {
    this.stepData.delete(step || this.flow.currentStep);
    this.flow.updatedAt = new Date();
  }

  /**
   * Complete current step
   */
  completeStep(data?: any): void {
    const stepConfig = this.getStepConfig(this.flow.currentStep);
    
    // Validate step if required
    if (stepConfig?.required) {
      this.validateStep(this.flow.currentStep, data);
    }

    // Store step data
    if (data) {
      this.setStepData(data);
    }

    // Mark as completed
    if (!this.flow.completedSteps.includes(this.flow.currentStep)) {
      this.flow.completedSteps.push(this.flow.currentStep);
    }

    this.flow.updatedAt = new Date();
    this.recordEvent('step_completed', { step: this.flow.currentStep });
  }

  /**
   * Validate step data
   */
  private validateStep(step: CheckoutStep, data: any): void {
    const stepConfig = this.getStepConfig(step);
    
    if (!stepConfig?.validation) {
      return;
    }

    for (const rule of stepConfig.validation.rules) {
      const value = this.getNestedValue(data, rule.field);
      
      if (rule.type === 'required' && (!value || value === '')) {
        throw new ValidationError(
          rule.message || `${rule.field} is required`,
          rule.field,
          value,
          'required'
        );
      }

      if (rule.type === 'email' && value && !this.isValidEmail(value)) {
        throw new ValidationError(
          rule.message || `${rule.field} must be a valid email`,
          rule.field,
          value,
          'email_format'
        );
      }

      if (rule.type === 'min_length' && value && value.length < rule.value) {
        throw new ValidationError(
          rule.message || `${rule.field} must be at least ${rule.value} characters`,
          rule.field,
          value,
          'min_length'
        );
      }

      if (rule.type === 'max_length' && value && value.length > rule.value) {
        throw new ValidationError(
          rule.message || `${rule.field} must not exceed ${rule.value} characters`,
          rule.field,
          value,
          'max_length'
        );
      }
    }
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Set customer info
   */
  setCustomerInfo(customerInfo: CustomerInfo): void {
    this.setStepData({ customerInfo });
  }

  /**
   * Get customer info
   */
  getCustomerInfo(): CustomerInfo | undefined {
    return this.getStepData('customer_info')?.customerInfo;
  }

  /**
   * Set shipping address
   */
  setShippingAddress(address: Address): void {
    this.setStepData({ shippingAddress: address });
  }

  /**
   * Get shipping address
   */
  getShippingAddress(): Address | undefined {
    return this.getStepData('shipping_address')?.shippingAddress;
  }

  /**
   * Set billing address
   */
  setBillingAddress(address: Address): void {
    this.setStepData({ billingAddress: address });
  }

  /**
   * Get billing address
   */
  getBillingAddress(): Address | undefined {
    return this.getStepData('billing_address')?.billingAddress;
  }

  /**
   * Set payment method
   */
  setPaymentMethod(paymentMethod: PaymentMethodInfo): void {
    this.setStepData({ paymentMethod });
  }

  /**
   * Get payment method
   */
  getPaymentMethod(): PaymentMethodInfo | undefined {
    return this.getStepData('payment_method')?.paymentMethod;
  }

  // ============================================================================
  // FLOW UTILITIES
  // ============================================================================

  /**
   * Get first step
   */
  private getFirstStep(): CheckoutStep {
    for (const stepConfig of this.config.steps) {
      if (!this.shouldSkipStep(stepConfig)) {
        return stepConfig.step;
      }
    }
    return 'complete';
  }

  /**
   * Get pending steps after current step
   */
  private getPendingSteps(currentStep: CheckoutStep): CheckoutStep[] {
    const pending: CheckoutStep[] = [];
    const currentIndex = this.config.steps.findIndex(s => s.step === currentStep);

    for (let i = currentIndex + 1; i < this.config.steps.length; i++) {
      const stepConfig = this.config.steps[i];
      if (!this.shouldSkipStep(stepConfig)) {
        pending.push(stepConfig.step);
      }
    }

    return pending;
  }

  /**
   * Check if step should be skipped
   */
  private shouldSkipStep(stepConfig: CheckoutStepConfig): boolean {
    if (!stepConfig.skipConditions) {
      return false;
    }

    for (const condition of stepConfig.skipConditions) {
      if (this.evaluateSkipCondition(condition)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Evaluate skip condition
   */
  private evaluateSkipCondition(condition: any): boolean {
    // This would evaluate based on cart data, customer data, etc.
    // For now, return false (don't skip)
    return false;
  }

  /**
   * Record flow event
   */
  private recordEvent(type: CheckoutEventType, data?: any): void {
    const event: CheckoutEvent = {
      type,
      sessionId: this.flow.sessionId,
      timestamp: new Date(),
      data,
    };

    this.events.push(event);

    // Keep only last 100 events
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
  }

  /**
   * Get flow events
   */
  getEvents(): CheckoutEvent[] {
    return [...this.events];
  }

  /**
   * Get flow progress (0 to 1)
   */
  getProgress(): number {
    const totalSteps = this.config.steps.filter(s => s.required).length;
    const completedRequiredSteps = this.config.steps.filter(s => 
      s.required && this.flow.completedSteps.includes(s.step)
    ).length;

    if (totalSteps === 0) {
      return 1;
    }

    return completedRequiredSteps / totalSteps;
  }

  /**
   * Check if flow is complete
   */
  isComplete(): boolean {
    return this.flow.currentStep === 'complete';
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
