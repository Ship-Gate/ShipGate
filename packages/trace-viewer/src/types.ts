/**
 * Trace Viewer Types
 * 
 * Type definitions for verification traces and proof bundles.
 */

export type EventType = 
  | 'call'
  | 'return'
  | 'state_change'
  | 'check'
  | 'invariant'
  | 'postcondition'
  | 'precondition'
  | 'temporal'
  | 'error';

export interface TraceEvent {
  id: string;
  type: EventType;
  timestamp: number;
  data: EventData;
  stackFrame?: StackFrame;
}

export type EventData = 
  | CallEventData
  | ReturnEventData
  | StateChangeEventData
  | CheckEventData
  | ErrorEventData;

export interface CallEventData {
  kind: 'call';
  function: string;
  args: Record<string, unknown>;
  caller?: string;
}

export interface ReturnEventData {
  kind: 'return';
  function: string;
  result: unknown;
  duration: number;
}

export interface StateChangeEventData {
  kind: 'state_change';
  path: string[];
  oldValue: unknown;
  newValue: unknown;
  source: string;
}

export interface CheckEventData {
  kind: 'check';
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
  category: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion';
}

export interface ErrorEventData {
  kind: 'error';
  message: string;
  stack?: string;
  code?: string;
}

export interface StackFrame {
  id: string;
  function: string;
  file?: string;
  line?: number;
  column?: number;
  variables: Record<string, unknown>;
  parent?: string;
}

export interface State {
  [key: string]: unknown;
}

export interface StateSnapshot {
  timestamp: number;
  state: State;
  eventId: string;
}

export interface Trace {
  id: string;
  name: string;
  domain: string;
  startTime: number;
  endTime?: number;
  events: TraceEvent[];
  initialState: State;
  snapshots: StateSnapshot[];
  metadata: TraceMetadata;
}

export interface TraceMetadata {
  testName?: string;
  scenario?: string;
  implementation?: string;
  version?: string;
  environment?: string;
  passed: boolean;
  failureIndex?: number;
  duration: number;
}

export interface ProofBundle {
  trace: Trace;
  contract: string;
  verificationResult: VerificationResult;
  generatedAt: string;
}

export interface VerificationResult {
  passed: boolean;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  coverage: number;
  failures: FailureInfo[];
}

export interface FailureInfo {
  eventId: string;
  expression: string;
  expected: unknown;
  actual: unknown;
  message: string;
  category: string;
}

export interface PlaybackState {
  currentIndex: number;
  playing: boolean;
  speed: number;
  looping: boolean;
}

export interface ViewerFilter {
  eventTypes: EventType[];
  showPassing: boolean;
  showFailing: boolean;
  searchQuery: string;
}

export interface ExpressionResult {
  expression: string;
  result: unknown;
  type: string;
  error?: string;
}
