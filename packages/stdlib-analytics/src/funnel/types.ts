/**
 * Funnel types
 */

export interface FunnelStep {
  name: string;
  eventName: string;
  filter?: EventPropertyFilter;
}

export interface EventPropertyFilter {
  property: string;
  operator: FilterOperator;
  value: unknown;
}

export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_set'
  | 'is_not_set';

export interface FunnelResult {
  steps: FunnelStepResult[];
  overallConversion: number;
  medianTimeToConvertMs: number | null;
}

export interface FunnelStepResult {
  name: string;
  count: number;
  conversionRate: number;
  dropOffRate: number;
  medianTimeFromPreviousMs: number | null;
}

export interface FunnelConfig {
  /** Max time between first and last step for a user to count as converting */
  conversionWindowMs: number;
}

export interface FunnelEvent {
  eventName: string;
  userId: string;
  timestamp: number;
  properties?: Record<string, unknown>;
}
