/**
 * ISL Runtime SDK Types
 */

export type ViolationType = 
  | 'precondition'
  | 'postcondition'
  | 'invariant'
  | 'temporal'
  | 'type';

export interface Violation {
  type: ViolationType;
  domain: string;
  behavior: string;
  condition: string;
  message: string;
  input?: unknown;
  output?: unknown;
  timestamp: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  success: boolean;
  violations: Violation[];
  duration: number;
  preconditionsChecked: number;
  postconditionsChecked: number;
  invariantsChecked: number;
}

export interface ExecutionContext {
  requestId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  metadata?: Record<string, unknown>;
  db?: unknown;
  services?: Record<string, unknown>;
}

export type VerificationMode = 'enforce' | 'monitor' | 'shadow' | 'disabled';

export interface VerificationOptions {
  mode: VerificationMode;
  sampling?: number;
  timeout?: number;
  onViolation?: (violation: Violation) => void | Promise<void>;
}
