/**
 * Generated from ISL domain: Counter
 * Version: 1.0.0
 * DO NOT EDIT - This file is auto-generated
 */

/** Entity: CounterValue */
export interface CounterValue {
  /** immutable, unique */
  readonly id: string;
  /** default */
  value: number;
  /** default */
  max_value: number;
  /** immutable */
  readonly created_at: Date;
}

export interface CounterValueRepository {
  findById(id: string): Promise<CounterValue | null>;
  exists(id: string): Promise<boolean>;
  create(data: Omit<CounterValue, 'id'>): Promise<CounterValue>;
  update(id: string, data: Partial<CounterValue>): Promise<CounterValue>;
  delete(id: string): Promise<void>;
}

/** Behavior: Increment */
/** Increment the counter by a specified amount */
export interface IncrementInput {
  counter_id: string;
  /** default */
  amount: number;
}

export type IncrementErrorCode =
  | 'NOT_FOUND'
  | 'MAX_EXCEEDED'
  | 'INVALID_AMOUNT';

export interface IncrementError {
  code: IncrementErrorCode;
  message: string;
  retriable?: boolean;
  retryAfter?: number;
}

export type IncrementResult =
  | { success: true; data: CounterValue }
  | { success: false; error: IncrementError };

export interface IncrementBehavior {
  execute(input: IncrementInput): Promise<IncrementResult>;
}

export type IncrementFunction = (input: IncrementInput) => Promise<IncrementResult>;

/** Behavior: GetCounter */
/** Retrieve the current counter value */
export interface GetCounterInput {
  counter_id: string;
}

export type GetCounterErrorCode =
  | 'NOT_FOUND';

export interface GetCounterError {
  code: GetCounterErrorCode;
  message: string;
  retriable?: boolean;
  retryAfter?: number;
}

export type GetCounterResult =
  | { success: true; data: CounterValue }
  | { success: false; error: GetCounterError };

export interface GetCounterBehavior {
  execute(input: GetCounterInput): Promise<GetCounterResult>;
}

export type GetCounterFunction = (input: GetCounterInput) => Promise<GetCounterResult>;

/** Behavior: CreateCounter */
/** Create a new counter with optional max value */
export interface CreateCounterInput {
  /** default */
  max_value?: number;
}

export type CreateCounterErrorCode =
  | 'INVALID_MAX';

export interface CreateCounterError {
  code: CreateCounterErrorCode;
  message: string;
  retriable?: boolean;
  retryAfter?: number;
}

export type CreateCounterResult =
  | { success: true; data: CounterValue }
  | { success: false; error: CreateCounterError };

export interface CreateCounterBehavior {
  execute(input: CreateCounterInput): Promise<CreateCounterResult>;
}

export type CreateCounterFunction = (input: CreateCounterInput) => Promise<CreateCounterResult>;
