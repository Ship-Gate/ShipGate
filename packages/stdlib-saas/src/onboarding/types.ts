/**
 * Onboarding types
 */

import { UUID } from '../types';

export interface OnboardingStep {
  id: string;
  name: string;
  description: string;
  required: boolean;
  order: number;
  rollback?: boolean;
  dependencies?: string[];
  handler: OnboardingHandler;
  timeout?: number;
  retryPolicy?: OnboardingRetryPolicy;
}

export interface OnboardingHandler {
  execute: (context: OnboardingContext) => Promise<OnboardingResult>;
  rollback?: (context: OnboardingContext) => Promise<void>;
  validate?: (context: OnboardingContext) => Promise<boolean>;
}

export interface OnboardingRetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
  retryableErrors?: string[];
}

export interface OnboardingContext {
  tenantId: UUID;
  userId: UUID;
  data: Record<string, any>;
  completedSteps: string[];
  failedSteps: string[];
  currentStep?: string;
  metadata?: Record<string, any>;
}

export interface OnboardingResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
  retryable?: boolean;
  nextStepDelay?: number;
}

export interface OnboardingFlow {
  id: string;
  name: string;
  description: string;
  steps: OnboardingStep[];
  version: string;
  createdAt: Date;
  active: boolean;
}

export interface OnboardingSession {
  id: string;
  tenantId: UUID;
  userId: UUID;
  flowId: string;
  flowVersion: string;
  status: OnboardingStatus;
  currentStepIndex: number;
  completedSteps: string[];
  failedSteps: string[];
  stepResults: Record<string, OnboardingResult>;
  context: OnboardingContext;
  startedAt: Date;
  completedAt?: Date;
  lastActivityAt: Date;
}

export enum OnboardingStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  PAUSED = 'PAUSED'
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  plan: string;
  steps: Omit<OnboardingStep, 'handler'>[];
}
